from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import base64
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.database import get_db
from app.models.assessment import AssessmentSession
from app.models.proctoring import ProctorEvent, ProctorEventType, SeverityLevel, ChatMessage
from app.models.user import User
from app.models.candidate import Candidate
from app.utils.auth import require_manager, get_current_user, get_current_user_optional, decode_access_token
from app.services.proctor_service import (
    log_violation,
    calculate_integrity_score,
    get_session_events,
    get_violation_summary,
    process_frame_for_violations
)
from app.services.storage_service import save_snapshot
from app.services.live_stream import live_stream_manager
from app.services.proctor_detection import detect_lip_sync

router = APIRouter(prefix="/proctor", tags=["proctoring"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

_executor = ThreadPoolExecutor(max_workers=4)

@router.get("/test")
def proctor_test():
    return {"message": "Proctor router is working"}

class ViolationLogRequest(BaseModel):
    session_id: int
    event_type: str
    severity: str
    snapshot_url: Optional[str] = None
    clip_url: Optional[str] = None
    event_data: Optional[dict] = None

class ViolationLogResponse(BaseModel):
    event_id: int
    logged: bool
    integrity_score: float
    cheating_risk: str

class ProctorEventResponse(BaseModel):
    id: int
    session_id: int
    event_type: str
    severity: str
    timestamp: datetime
    snapshot_url: Optional[str]
    clip_url: Optional[str]
    event_data: Optional[dict]

class IntegrityFinalizeResponse(BaseModel):
    session_id: int
    integrity_score: float
    cheating_risk: str
    total_events: int
    events_by_severity: dict

class FrameProcessRequest(BaseModel):
    session_id: int
    frame: str
    audio: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    sender: str
    message: str
    timestamp: datetime

@router.post("/log-violation", response_model=ViolationLogResponse)
def log_violation_endpoint(
    data: ViolationLogRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == data.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = log_violation(
        db,
        data.session_id,
        data.event_type,
        data.severity,
        data.snapshot_url,
        data.clip_url,
        data.event_data
    )

    return ViolationLogResponse(**result)

@router.get("/sessions/{session_id}/events", response_model=List[ProctorEventResponse])
def get_events(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    events = get_session_events(db, session_id)
    return [
        ProctorEventResponse(
            id=e.id,
            session_id=e.session_id,
            event_type=e.event_type.value,
            severity=e.severity.value,
            timestamp=e.timestamp,
            snapshot_url=e.snapshot_url,
            clip_url=e.clip_url,
            event_data=e.event_data
        )
        for e in events
    ]

@router.get("/sessions/{session_id}/integrity")
def get_integrity(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    score, risk = calculate_integrity_score(db, session_id)
    summary = get_violation_summary(db, session_id)
    return {
        "integrity_score": score,
        "cheating_risk": risk,
        "total_events": summary["total"],
        "events_by_severity": summary["by_severity"]
    }

@router.post("/sessions/{session_id}/finalize", response_model=IntegrityFinalizeResponse)
def finalize_integrity(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    score, risk = calculate_integrity_score(db, session_id)
    summary = get_violation_summary(db, session_id)

    return IntegrityFinalizeResponse(
        session_id=session_id,
        integrity_score=score,
        cheating_risk=risk,
        total_events=summary["total"],
        events_by_severity=summary["by_severity"]
    )

@router.get("/sessions/{identifier}/chat", response_model=List[ChatMessageResponse])
def get_chat_history(
    identifier: str,
    db: Session = Depends(get_db)
):
    session = None
    try:
        session_id = int(identifier)
        session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    except ValueError:
        pass

    if not session:
        session = db.query(AssessmentSession).filter(AssessmentSession.access_token == identifier).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.timestamp).all()

    return [
        ChatMessageResponse(
            id=m.id,
            session_id=m.session_id,
            sender=m.sender,
            message=m.message,
            timestamp=m.timestamp
        )
        for m in messages
    ]

@router.post("/process-frame")
def process_frame(
    data: FrameProcessRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional)
):
    try:
        session = db.query(AssessmentSession).filter(AssessmentSession.id == data.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        frame_bytes = base64.b64decode(data.frame)

        audio_bytes = None
        if data.audio:
            audio_bytes = base64.b64decode(data.audio)

        result = process_frame_for_violations(db, data.session_id, frame_bytes, audio_bytes)

        if result.get("logged_violations"):
            snapshot_url = save_snapshot(data.session_id, frame_bytes, "violation")
            result["snapshot_url"] = snapshot_url

        return result

    except Exception as e:
        print(f"[PROCTOR ERROR] {e}")
        return {
            "error": str(e),
            "detections": {},
            "logged_violations": [],
            "integrity_score": 100.0
        }

@router.websocket("/live/{identifier}")
async def proctor_websocket(
    websocket: WebSocket,
    identifier: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return

    session = None
    try:
        session_id = int(identifier)
        session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    except ValueError:
        pass

    if not session:
        session = db.query(AssessmentSession).filter(AssessmentSession.access_token == identifier).first()

    if not session:
        await websocket.close(code=1008, reason="Session not found")
        return

    if token != session.access_token:
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=1008, reason="Invalid token")
            return
        try:
            user_id = int(payload.get("sub"))
        except Exception:
            await websocket.close(code=1008, reason="Invalid token")
            return

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return

        if user.role == "candidate":
            candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
            if not candidate or candidate.id != session.candidate_id:
                await websocket.close(code=1008, reason="Not authorized for this session")
                return

    try:
        await websocket.accept()
        await live_stream_manager.connect_candidate(websocket, session)
    except Exception as e:
        print(f"[WebSocket] Proctor connection error: {e}")
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass

@router.websocket("/manager/live")
async def manager_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return

    try:
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=1008, reason="Invalid token")
            return
        user_id = int(payload.get("sub"))
    except Exception as e:
        await websocket.close(code=1008, reason="Invalid token")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role not in ["admin", "manager"]:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    try:
        await websocket.accept()
        await live_stream_manager.connect_manager(websocket, user)
    except Exception as e:
        print(f"[WebSocket] Manager connection error: {e}")
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass