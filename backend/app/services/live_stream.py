import asyncio
import json
import time
import threading
import queue
import base64
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Set, Optional, Any
from datetime import datetime, timedelta
from fastapi import WebSocket, WebSocketDisconnect

from ..config import settings
from ..database import SessionLocal
from ..models.assessment import AssessmentSession
from ..models.user import User
from ..models.proctoring import ProctorEvent, ProctorEventType, SeverityLevel, ChatMessage
from .proctor_service import log_violation
from .proctor_detection import detect_faces, detect_brightness, detect_loud_voice, detect_lip_sync, detect_mobile_phone

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

class LiveStreamManager:
    def __init__(self):
        self._candidate_connections: Dict[int, WebSocket] = {}
        self._manager_connections: Dict[int, Set[WebSocket]] = {}
        self._session_managers: Dict[int, Set[WebSocket]] = {}
        self._session_snapshots: Dict[int, str] = {}
        self._session_audio: Dict[int, bytes] = {}
        self._session_video_frames: Dict[int, list] = {}
        self._session_lip_sync_counter: Dict[int, int] = {}

        self._worker_id = f"worker_{id(self)}_{int(time.time())}"

        self._redis_client = None
        self._pubsub = None
        self._listener_thread = None
        self._command_queue = queue.Queue()
        self._executor = ThreadPoolExecutor(max_workers=20)
        self._loop = None

        self._active_channels: Set[str] = set()

        self._frame_counters: Dict[int, int] = {}
        self._violation_state: Dict[int, Dict] = {}
        self._frame_detection_busy: Dict[int, bool] = {}
        self._audio_detection_busy: Dict[int, bool] = {}

        if settings.redis_enabled and REDIS_AVAILABLE:
            self._init_redis()
        elif settings.redis_enabled:
            print("[LiveStream] Warning: Redis enabled but redis-py not installed")

    def _get_loop(self):
        if self._loop is None or self._loop.is_closed():
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        return self._loop

    def _init_redis(self):
        try:
            self._redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self._redis_client.ping()
            self._pubsub = self._redis_client.pubsub(ignore_subscribe_messages=True)
            self._listener_thread = threading.Thread(
                target=self._pubsub_listener,
                daemon=True
            )
            self._listener_thread.start()
            print(f"[LiveStream] Redis connected, worker: {self._worker_id}")
        except Exception as e:
            print(f"[LiveStream] Redis connection failed: {e}")
            self._redis_client = None
            self._pubsub = None

    def _pubsub_listener(self):
        while True:
            try:
                try:
                    cmd = self._command_queue.get(timeout=0.1)
                    if cmd["action"] == "subscribe":
                        self._pubsub.subscribe(cmd["channel"])
                    elif cmd["action"] == "unsubscribe":
                        self._pubsub.unsubscribe(cmd["channel"])
                    continue
                except queue.Empty:
                    pass

                message = self._pubsub.get_message(timeout=0.1)
                if message and message.get("type") == "message":
                    data = json.loads(message["data"])
                    if data.get("worker_id") == self._worker_id:
                        continue
                    self._handle_pubsub_message(data)

            except Exception as e:
                print(f"[LiveStream] PubSub listener error: {e}")
                time.sleep(1)
                self._reconnect_pubsub()

    def _reconnect_pubsub(self):
        try:
            if self._pubsub:
                self._pubsub.close()
            self._pubsub = self._redis_client.pubsub(ignore_subscribe_messages=True)
            for channel in self._active_channels:
                self._command_queue.put({"action": "subscribe", "channel": channel})
            print("[LiveStream] PubSub reconnected with resubscriptions")
        except Exception as e:
            print(f"[LiveStream] PubSub reconnect failed: {e}")

    def _handle_pubsub_message(self, data: Dict[str, Any]):
        msg_type = data.get("type")
        session_id = data.get("session_id")
        loop = self._loop
        if loop is None or loop.is_closed():
            return

        if msg_type == "frame" and session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    asyncio.run_coroutine_threadsafe(ws.send_json(data), loop)
                except Exception:
                    pass

        elif msg_type == "violation" and session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    asyncio.run_coroutine_threadsafe(ws.send_json(data), loop)
                except Exception:
                    pass

        elif msg_type == "warning" and session_id in self._candidate_connections:
            try:
                asyncio.run_coroutine_threadsafe(
                    self._candidate_connections[session_id].send_json({
                        "type": "warning",
                        "message": data.get("message"),
                        "timestamp": data.get("timestamp")
                    }),
                    loop
                )
            except Exception:
                pass

        elif msg_type == "terminated" and session_id in self._candidate_connections:
            try:
                asyncio.run_coroutine_threadsafe(
                    self._candidate_connections[session_id].send_json({
                        "type": "terminated",
                        "reason": data.get("reason"),
                        "timestamp": data.get("timestamp")
                    }),
                    loop
                )
            except Exception:
                pass

        elif msg_type == "chat":
            if session_id in self._candidate_connections:
                try:
                    asyncio.run_coroutine_threadsafe(
                        self._candidate_connections[session_id].send_json({
                            "type": "chat",
                            "message": data.get("message"),
                            "sender": data.get("sender", "proctor"),
                            "timestamp": data.get("timestamp")
                        }),
                        loop
                    )
                except Exception:
                    pass
            if session_id in self._session_managers:
                for ws in list(self._session_managers[session_id]):
                    try:
                        asyncio.run_coroutine_threadsafe(ws.send_json(data), loop)
                    except Exception:
                        pass

    async def _publish_async(self, channel: str, data: Dict[str, Any]):
        if not self._redis_client:
            return

        def _do_publish():
            try:
                data["worker_id"] = self._worker_id
                self._redis_client.publish(channel, json.dumps(data))
            except Exception as e:
                print(f"[LiveStream] Publish error: {e}")

        loop = self._get_loop()
        if loop:
            await loop.run_in_executor(self._executor, _do_publish)

    async def _subscribe_async(self, channel: str):
        if not self._pubsub:
            return

        self._active_channels.add(channel)

        def _do_subscribe():
            self._command_queue.put({"action": "subscribe", "channel": channel})

        loop = self._get_loop()
        if loop:
            await loop.run_in_executor(self._executor, _do_subscribe)

    async def _unsubscribe_async(self, channel: str):
        if not self._pubsub:
            return

        self._active_channels.discard(channel)

        def _do_unsubscribe():
            self._command_queue.put({"action": "unsubscribe", "channel": channel})

        loop = self._get_loop()
        if loop:
            await loop.run_in_executor(self._executor, _do_unsubscribe)

    async def _broadcast_to_managers(self, session_id: int, message: Dict[str, Any]):
        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def subscribe_manager(self, websocket: WebSocket, session_id: int):
        if session_id not in self._session_managers:
            self._session_managers[session_id] = set()
        self._session_managers[session_id].add(websocket)

        if settings.redis_enabled:
            await self._subscribe_async(f"session:{session_id}")

    async def unsubscribe_manager(self, websocket: WebSocket, session_id: int):
        if session_id in self._session_managers:
            self._session_managers[session_id].discard(websocket)
            if not self._session_managers[session_id]:
                del self._session_managers[session_id]

        if settings.redis_enabled:
            await self._unsubscribe_async(f"session:{session_id}")

    async def get_active_sessions(self) -> list:
        sessions = []

        for session_id in self._candidate_connections.keys():
            sessions.append({
                "session_id": session_id,
                "status": "streaming",
                "worker": self._worker_id
            })

        if settings.redis_enabled and self._redis_client:
            loop = self._get_loop()
            if loop:
                try:
                    keys = await loop.run_in_executor(
                        self._executor,
                        self._redis_client.keys,
                        "presence:*"
                    )
                    for key in keys:
                        try:
                            session_id = int(key.split(":")[1])
                            if session_id not in self._candidate_connections:
                                data = await loop.run_in_executor(
                                    self._executor,
                                    self._redis_client.get,
                                    key
                                )
                                if data:
                                    parsed = json.loads(data)
                                    sessions.append({
                                        "session_id": session_id,
                                        "status": parsed.get("status", "unknown"),
                                        "last_update": parsed.get("last_update"),
                                        "worker": "remote"
                                    })
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[LiveStream] Redis presence error: {e}")

        return sessions

    async def _run_frame_detection_guarded(self, session_id: int, frame_data: bytes):
        try:
            await self._run_frame_detection(session_id, frame_data)
        finally:
            self._frame_detection_busy[session_id] = False

    async def _run_frame_detection(self, session_id: int, frame_data: bytes):
        try:
            loop = asyncio.get_running_loop()

            detections = await loop.run_in_executor(
                self._executor,
                detect_faces,
                frame_data
            )
            brightness = await loop.run_in_executor(
                self._executor,
                detect_brightness,
                frame_data
            )
            mobile_result = await loop.run_in_executor(
                self._executor,
                detect_mobile_phone,
                frame_data
            )

            violations = await self._check_sustained_violations(
                session_id, detections, brightness, mobile_result
            )

            if violations:
                for violation in violations:
                    def _log_violation(sid, vtype, sev, evdata):
                        db = SessionLocal()
                        try:
                            result = log_violation(
                                db,
                                sid,
                                vtype,
                                sev,
                                event_data=evdata,
                            )
                            print(f"[LiveStream] Violation logged: {vtype} - {sev}")
                            return result
                        finally:
                            db.close()

                    await loop.run_in_executor(
                        self._executor,
                        _log_violation,
                        session_id,
                        violation["type"],
                        violation["severity"],
                        violation.get("data")
                    )

                    violation_message = {
                        "type": "violation",
                        "session_id": session_id,
                        "event": violation["type"],
                        "severity": violation["severity"],
                        "timestamp": now().isoformat(),
                        "worker_id": self._worker_id
                    }

                    await self._broadcast_to_managers(session_id, violation_message)
                    await self._publish_async(f"session:{session_id}", violation_message)

            if settings.redis_enabled and self._redis_client:
                await loop.run_in_executor(
                    self._executor,
                    lambda: self._redis_client.setex(
                        f"presence:{session_id}",
                        30,
                        json.dumps({"status": "streaming", "last_update": time.time()})
                    )
                )
        except Exception as e:
            print(f"[LiveStream] Frame detection error: {e}")

    async def _run_audio_detection_guarded(self, session_id: int, audio_data: bytes):
        try:
            await self._run_audio_detection(session_id, audio_data)
        finally:
            self._audio_detection_busy[session_id] = False

    async def _run_audio_detection(self, session_id: int, audio_data: bytes):
        try:
            loop = asyncio.get_running_loop()

            voice_result = await loop.run_in_executor(
                self._executor,
                detect_loud_voice,
                audio_data
            )

            now_time = time.time()

            if session_id not in self._violation_state:
                self._violation_state[session_id] = {
                    "no_face_start": None,
                    "multiple_face_start": None,
                    "dark_start": None,
                    "mobile_start": None,
                    "loud_voice_start": None,
                    "loud_voice_last_logged": 0,
                    "loud_voice_last_seen": None,
                }

            state = self._violation_state[session_id]
            if "loud_voice_start" not in state:
                state["loud_voice_start"] = None
            if "loud_voice_last_logged" not in state:
                state["loud_voice_last_logged"] = 0
            if "loud_voice_last_seen" not in state:
                state["loud_voice_last_seen"] = None

            grace_period = 0.6

            if voice_result.get("is_loud", False):
                if state["loud_voice_start"] is None:
                    state["loud_voice_start"] = now_time
                state["loud_voice_last_seen"] = now_time

                sustained_for = now_time - state["loud_voice_start"]
                cooldown_elapsed = now_time - state["loud_voice_last_logged"]

                if sustained_for >= 1.5 and cooldown_elapsed >= 8:
                    state["loud_voice_last_logged"] = now_time
                    state["loud_voice_start"] = None
                    state["loud_voice_last_seen"] = None

                    def _log_loud_voice(sid):
                        db = SessionLocal()
                        try:
                            log_violation(
                                db,
                                sid,
                                "LOUD_VOICE",
                                "medium",
                                event_data={"level": voice_result.get("level", 0.0)}
                            )
                        finally:
                            db.close()

                    await loop.run_in_executor(
                        self._executor,
                        _log_loud_voice,
                        session_id
                    )

                    loud_voice_message = {
                        "type": "violation",
                        "session_id": session_id,
                        "event": "LOUD_VOICE",
                        "severity": "medium",
                        "timestamp": now().isoformat(),
                        "worker_id": self._worker_id
                    }

                    await self._broadcast_to_managers(session_id, loud_voice_message)
                    await self._publish_async(f"session:{session_id}", loud_voice_message)
            else:
                last_seen = state.get("loud_voice_last_seen")
                if last_seen is None or (now_time - last_seen) > grace_period:
                    state["loud_voice_start"] = None
                    state["loud_voice_last_seen"] = None

            self._session_lip_sync_counter[session_id] = self._session_lip_sync_counter.get(session_id, 0) + 1

            if self._session_lip_sync_counter[session_id] % 5 == 0:
                frames = self._session_video_frames.get(session_id, [])
                if len(frames) >= 10:
                    frames_copy = frames.copy()

                    def _check_lip_sync(fr, au):
                        return detect_lip_sync(fr, au)

                    lip_result = await loop.run_in_executor(
                        self._executor,
                        _check_lip_sync,
                        frames_copy,
                        audio_data
                    )

                    if lip_result.get("matched", True) == False:
                        def _log_lip_sync(sid):
                            db = SessionLocal()
                            try:
                                log_violation(
                                    db,
                                    sid,
                                    "LIP_SYNC_MISMATCH",
                                    "critical",
                                    event_data={"confidence": lip_result.get("confidence", 0.0)}
                                )
                            finally:
                                db.close()

                        await loop.run_in_executor(
                            self._executor,
                            _log_lip_sync,
                            session_id
                        )

                        lip_sync_message = {
                            "type": "violation",
                            "session_id": session_id,
                            "event": "LIP_SYNC_MISMATCH",
                            "severity": "critical",
                            "timestamp": now().isoformat(),
                            "worker_id": self._worker_id
                        }

                        await self._broadcast_to_managers(session_id, lip_sync_message)
                        await self._publish_async(f"session:{session_id}", lip_sync_message)
        except Exception as e:
            print(f"[LiveStream] Audio detection error: {e}")

    async def connect_candidate(self, websocket: WebSocket, session: AssessmentSession):
        try:
            self._get_loop()

            session_id = session.id
            self._candidate_connections[session_id] = websocket
            self._frame_counters[session_id] = 0
            self._session_video_frames[session_id] = []
            self._session_lip_sync_counter[session_id] = 0
            self._violation_state[session_id] = {
                "no_face_start": None,
                "multiple_face_start": None,
                "dark_start": None,
                "mobile_start": None,
                "loud_voice_count": 0,
                "loud_voice_last": None,
                "loud_voice_start": None,
                "loud_voice_last_logged": 0,
                "loud_voice_last_seen": None,
                "mobile_detected": False,
                "lip_sync_check_time": None,
            }
            self._session_audio[session_id] = b""

            if settings.redis_enabled:
                await self._subscribe_async(f"session:{session_id}")

            await self._publish_async("presence", {
                "type": "candidate_online",
                "session_id": session_id,
                "candidate_name": session.candidate.name if session.candidate else "Unknown",
                "job_role": session.template.job_role.job_role_name if session.template and session.template.job_role else "Unknown",
            })

            print(f"[LiveStream] Candidate connected for session {session_id}")

            try:
                while True:
                    try:
                        data = await websocket.receive()

                        if data.get("type") == "websocket.disconnect":
                            print(f"[LiveStream] Candidate disconnected: session {session_id}")
                            break

                        if data.get("bytes") is not None:
                            self._frame_counters[session_id] += 1

                            frame_data = data["bytes"]

                            if len(self._session_video_frames[session_id]) < 30:
                                self._session_video_frames[session_id].append(frame_data)
                            else:
                                self._session_video_frames[session_id].pop(0)
                                self._session_video_frames[session_id].append(frame_data)

                            should_run_detection = self._frame_counters[session_id] % 3 == 0
                            if should_run_detection and not self._frame_detection_busy.get(session_id, False):
                                self._frame_detection_busy[session_id] = True
                                asyncio.create_task(self._run_frame_detection_guarded(session_id, frame_data))

                            await self._forward_frame(session_id, frame_data, {}, [])

                        elif data.get("text") is not None:
                            try:
                                msg = json.loads(data["text"])
                                msg_type = msg.get("type")

                                if msg_type == "ping":
                                    await websocket.send_json({"type": "pong"})

                                elif msg_type == "audio":
                                    audio_data = base64.b64decode(msg.get("data", ""))
                                    if audio_data:
                                        self._session_audio[session_id] = audio_data
                                        if not self._audio_detection_busy.get(session_id, False):
                                            self._audio_detection_busy[session_id] = True
                                            asyncio.create_task(self._run_audio_detection_guarded(session_id, audio_data))

                                elif msg_type == "violation":
                                    event_type = msg.get("event")
                                    severity = msg.get("severity", "medium")
                                    if event_type:
                                        def _log_client_violation(sid, vtype, sev):
                                            db = SessionLocal()
                                            try:
                                                log_violation(db, sid, vtype, sev)
                                            finally:
                                                db.close()

                                        loop = asyncio.get_running_loop()
                                        await loop.run_in_executor(
                                            self._executor,
                                            _log_client_violation,
                                            session_id,
                                            event_type,
                                            severity
                                        )

                                        violation_message = {
                                            "type": "violation",
                                            "session_id": session_id,
                                            "event": event_type,
                                            "severity": severity,
                                            "timestamp": now().isoformat(),
                                            "worker_id": self._worker_id
                                        }

                                        await self._broadcast_to_managers(session_id, violation_message)
                                        await self._publish_async(f"session:{session_id}", violation_message)

                                elif msg_type == "chat":
                                    chat_message = msg.get("message")
                                    if chat_message:
                                        chat_payload = {
                                            "type": "chat",
                                            "session_id": session_id,
                                            "message": chat_message,
                                            "sender": "candidate",
                                            "timestamp": now().isoformat()
                                        }

                                        await self._broadcast_to_managers(session_id, chat_payload)
                                        await self._publish_async(f"session:{session_id}", chat_payload)

                                        loop = asyncio.get_running_loop()

                                        def _save_chat(sid, sender, text):
                                            db = SessionLocal()
                                            try:
                                                record = ChatMessage(
                                                    session_id=sid,
                                                    sender=sender,
                                                    message=text
                                                )
                                                db.add(record)
                                                db.commit()
                                            finally:
                                                db.close()

                                        asyncio.create_task(
                                            loop.run_in_executor(
                                                self._executor,
                                                _save_chat,
                                                session_id,
                                                "candidate",
                                                chat_message
                                            )
                                        )

                                        print(f"[LiveStream] Chat from candidate session {session_id}: {chat_message}")

                            except json.JSONDecodeError as e:
                                print(f"[LiveStream] Invalid JSON: {e}")

                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        print(f"[LiveStream] Error in candidate loop: {e}")
                        await asyncio.sleep(0.1)

            except WebSocketDisconnect:
                print(f"[LiveStream] Candidate disconnected: session {session_id}")
            finally:
                await self.disconnect_candidate(session_id)
        except Exception as e:
            print(f"[LiveStream] Failed to connect candidate: {e}")
            try:
                await websocket.close(code=1011, reason=f"Internal error: {str(e)}")
            except:
                pass

    async def _check_sustained_violations(self, session_id: int, detections: Dict, brightness: Dict, mobile_result: Optional[Dict] = None) -> list:
        violations = []

        if session_id not in self._violation_state:
            self._violation_state[session_id] = {
                "no_face_start": None,
                "multiple_face_start": None,
                "dark_start": None,
                "mobile_start": None,
            }

        state = self._violation_state[session_id]
        if "mobile_start" not in state:
            state["mobile_start"] = None

        now_time = time.time()

        if not detections.get("has_face"):
            if state["no_face_start"] is None:
                state["no_face_start"] = now_time
            elif now_time - state["no_face_start"] >= 5:
                violations.append({
                    "type": "NO_FACE",
                    "severity": "high",
                    "data": {"duration": now_time - state["no_face_start"]}
                })
                state["no_face_start"] = None
        else:
            state["no_face_start"] = None

        if detections.get("multiple_faces"):
            if state["multiple_face_start"] is None:
                state["multiple_face_start"] = now_time
            elif now_time - state["multiple_face_start"] >= 3:
                violations.append({
                    "type": "MULTIPLE_FACE",
                    "severity": "critical",
                    "data": {"face_count": detections.get("face_count")}
                })
                state["multiple_face_start"] = None
        else:
            state["multiple_face_start"] = None

        if brightness.get("is_very_dark"):
            if state["dark_start"] is None:
                state["dark_start"] = now_time
            elif now_time - state["dark_start"] >= 3:
                violations.append({
                    "type": "DARK_ENVIRONMENT",
                    "severity": "medium",
                    "data": {"brightness": brightness.get("brightness")}
                })
                state["dark_start"] = None
        else:
            state["dark_start"] = None

        if mobile_result and mobile_result.get("detected", False):
            if state["mobile_start"] is None:
                state["mobile_start"] = now_time
            state["mobile_last_seen"] = now_time

            if now_time - state["mobile_start"] >= 0.5:
                violations.append({
                    "type": "MOBILE_DETECTED",
                    "severity": "critical",
                    "data": {"confidence": mobile_result.get("confidence", 0.0)}
                })
                state["mobile_start"] = None
                state["mobile_last_seen"] = None
        else:
            last_seen = state.get("mobile_last_seen")
            if last_seen is None or (now_time - last_seen) > 1.0:
                state["mobile_start"] = None
                state["mobile_last_seen"] = None

        return violations

    async def _forward_frame(self, session_id: int, frame_data: bytes, detections: Dict, violations: list):
        loop = self._get_loop()

        frame_b64 = base64.b64encode(frame_data).decode("utf-8")
        self._session_snapshots[session_id] = frame_b64

        message = {
            "type": "frame",
            "session_id": session_id,
            "data": frame_b64,
            "timestamp": time.time(),
            "detections": detections,
            "violations": violations,
        }

        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

        if settings.redis_enabled:
            await self._publish_async(f"session:{session_id}", message)

    async def send_warning(self, session_id: int, message: str):
        if session_id in self._candidate_connections:
            try:
                await self._candidate_connections[session_id].send_json({
                    "type": "warning",
                    "message": message,
                    "timestamp": now().isoformat()
                })
                print(f"[LiveStream] Warning sent to candidate session {session_id}: {message}")
            except Exception as e:
                print(f"[LiveStream] Failed to send warning to candidate: {e}")

        await self._publish_async(f"session:{session_id}", {
            "type": "warning",
            "session_id": session_id,
            "message": message,
            "timestamp": now().isoformat()
        })

        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json({
                        "type": "warning_sent",
                        "session_id": session_id,
                        "message": message
                    })
                except Exception:
                    pass

        db = SessionLocal()
        try:
            session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
            if session:
                proctor_event = ProctorEvent(
                    session_id=session_id,
                    event_type=ProctorEventType.WARNING_SENT,
                    severity=SeverityLevel.LOW,
                    event_data={"message": message},
                    timestamp=now()
                )
                db.add(proctor_event)
                db.commit()
        finally:
            db.close()

    async def terminate_session(self, session_id: int, reason: str):
        if session_id in self._candidate_connections:
            try:
                await self._candidate_connections[session_id].send_json({
                    "type": "terminated",
                    "reason": reason,
                    "timestamp": now().isoformat()
                })
                await self._candidate_connections[session_id].close(code=1008)
                print(f"[LiveStream] Session {session_id} terminated. Reason: {reason}")
            except Exception as e:
                print(f"[LiveStream] Failed to terminate session {session_id}: {e}")

        await self._publish_async(f"session:{session_id}", {
            "type": "terminated",
            "session_id": session_id,
            "reason": reason,
            "timestamp": now().isoformat()
        })

        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json({
                        "type": "terminated",
                        "session_id": session_id,
                        "reason": reason
                    })
                except Exception:
                    pass

        db = SessionLocal()
        try:
            session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
            if session:
                session.status = "expired"
                session.eligibility = "auto_blocked"
                session.finished_at = now()

                proctor_event = ProctorEvent(
                    session_id=session_id,
                    event_type=ProctorEventType.SESSION_TERMINATED,
                    severity=SeverityLevel.HIGH,
                    event_data={"reason": reason},
                    timestamp=now()
                )
                db.add(proctor_event)
                db.commit()
        finally:
            db.close()

        await self.disconnect_candidate(session_id)

    async def send_chat_message(self, session_id: int, message: str, sender: str):
        if session_id in self._candidate_connections:
            try:
                await self._candidate_connections[session_id].send_json({
                    "type": "chat",
                    "message": message,
                    "sender": sender,
                    "timestamp": now().isoformat()
                })
                print(f"[LiveStream] Chat sent to candidate session {session_id}: {message}")
            except Exception as e:
                print(f"[LiveStream] Failed to send chat to candidate: {e}")

        await self._publish_async(f"session:{session_id}", {
            "type": "chat",
            "session_id": session_id,
            "message": message,
            "sender": sender,
            "timestamp": now().isoformat()
        })

        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json({
                        "type": "chat_sent",
                        "session_id": session_id,
                        "message": message
                    })
                except Exception:
                    pass

        db = SessionLocal()
        try:
            record = ChatMessage(
                session_id=session_id,
                sender=sender,
                message=message
            )
            db.add(record)
            db.commit()
        finally:
            db.close()

    async def connect_manager(self, websocket: WebSocket, user: User):
        try:
            self._get_loop()

            if user.id not in self._manager_connections:
                self._manager_connections[user.id] = set()
            self._manager_connections[user.id].add(websocket)

            print(f"[LiveStream] Manager connected: {user.email}")

            try:
                await websocket.send_json({
                    "type": "connected",
                    "message": "Welcome to live monitoring",
                    "timestamp": now().isoformat()
                })
            except Exception as e:
                print(f"[LiveStream] Failed to send welcome: {e}")

            while True:
                try:
                    data = await websocket.receive_text()
                    print(f"[LiveStream] Manager message received")

                    if not data:
                        continue

                    msg = json.loads(data)
                    msg_type = msg.get("action") or msg.get("type")

                    if msg_type == "subscribe":
                        session_id = msg.get("session_id")
                        if session_id:
                            db = SessionLocal()
                            try:
                                session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
                                if session:
                                    await self.subscribe_manager(websocket, session_id)
                                    await websocket.send_json({
                                        "type": "subscribed",
                                        "session_id": session_id,
                                        "message": f"Now watching session {session_id}"
                                    })
                                    print(f"[LiveStream] Manager subscribed to session {session_id}")
                                else:
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": f"Session {session_id} not found"
                                    })
                            finally:
                                db.close()

                    elif msg_type == "unsubscribe":
                        session_id = msg.get("session_id")
                        if session_id:
                            await self.unsubscribe_manager(websocket, session_id)
                            await websocket.send_json({
                                "type": "unsubscribed",
                                "session_id": session_id,
                                "message": "No longer watching this session"
                            })
                            print(f"[LiveStream] Manager unsubscribed from session {session_id}")

                    elif msg_type == "warn":
                        session_id = msg.get("session_id")
                        message = msg.get("message", "Warning from proctor")
                        if session_id:
                            await self.send_warning(session_id, message)
                            await websocket.send_json({
                                "type": "warning_sent",
                                "session_id": session_id,
                                "message": "Warning sent to candidate"
                            })
                            print(f"[LiveStream] Warning sent to session {session_id}")

                    elif msg_type == "terminate":
                        session_id = msg.get("session_id")
                        reason = msg.get("reason", "Terminated by proctor")
                        if session_id:
                            await self.terminate_session(session_id, reason)
                            await websocket.send_json({
                                "type": "terminated",
                                "session_id": session_id,
                                "message": f"Session terminated: {reason}"
                            })
                            print(f"[LiveStream] Session {session_id} terminated")

                    elif msg_type == "get_presence":
                        presence = await self.get_active_sessions()
                        await websocket.send_json({
                            "type": "presence",
                            "sessions": presence
                        })
                        print(f"[LiveStream] Presence sent: {len(presence)} sessions")

                    elif msg_type == "chat":
                        session_id = msg.get("session_id")
                        message = msg.get("message")
                        if session_id and message:
                            await self.send_chat_message(session_id, message, "proctor")
                            print(f"[LiveStream] Chat sent to session {session_id}")

                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                        print("[LiveStream] Pong sent")

                    else:
                        print(f"[LiveStream] Unknown message type: {msg_type}")

                except WebSocketDisconnect:
                    print(f"[LiveStream] Manager WebSocket disconnected: {user.email}")
                    break
                except json.JSONDecodeError as e:
                    print(f"[LiveStream] JSON parse error: {e}")
                    continue
                except Exception as e:
                    print(f"[LiveStream] Manager loop error: {e}")
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Error: {str(e)}"
                        })
                    except:
                        pass

        except Exception as e:
            print(f"[LiveStream] Manager connection error: {e}")
            try:
                await websocket.close(code=1011, reason=f"Internal error: {str(e)}")
            except:
                pass
        finally:
            await self.disconnect_manager(websocket, user.id)

    async def disconnect_candidate(self, session_id: int):
        if session_id in self._candidate_connections:
            del self._candidate_connections[session_id]

        self._frame_counters.pop(session_id, None)
        self._violation_state.pop(session_id, None)
        self._session_snapshots.pop(session_id, None)
        self._session_audio.pop(session_id, None)
        self._session_video_frames.pop(session_id, None)
        self._session_lip_sync_counter.pop(session_id, None)
        self._frame_detection_busy.pop(session_id, None)
        self._audio_detection_busy.pop(session_id, None)

        if session_id in self._session_managers:
            for ws in list(self._session_managers[session_id]):
                try:
                    await ws.send_json({
                        "type": "candidate_offline",
                        "session_id": session_id,
                        "message": "Candidate has disconnected"
                    })
                except Exception:
                    pass

        if settings.redis_enabled:
            await self._unsubscribe_async(f"session:{session_id}")
            if self._redis_client:
                loop = self._get_loop()
                if loop:
                    await loop.run_in_executor(
                        self._executor,
                        self._redis_client.delete,
                        f"presence:{session_id}"
                    )

        await self._publish_async("presence", {
            "type": "candidate_offline",
            "session_id": session_id,
        })

    async def disconnect_manager(self, websocket: WebSocket, user_id: int):
        if user_id in self._manager_connections:
            self._manager_connections[user_id].discard(websocket)
            if not self._manager_connections[user_id]:
                del self._manager_connections[user_id]

        for session_id in list(self._session_managers.keys()):
            self._session_managers[session_id].discard(websocket)
            if not self._session_managers[session_id]:
                del self._session_managers[session_id]

live_stream_manager = LiveStreamManager()