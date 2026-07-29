import cv2
import numpy as np
import base64
import threading
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import math
import struct
import os

from .yolo_detector import YOLOMobileDetector, detect_mobile_yolo

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False
    print("MediaPipe not available")

HAS_TORCH = True

def _convert_to_native(obj):
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _convert_to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_to_native(item) for item in obj]
    return obj

class FaceDetector:
    def __init__(self):
        self.mp_face_detection = None
        self.face_detection = None
        self._initialized = False
        self._lock = threading.Lock()
        self._init_mediapipe()
    
    def _init_mediapipe(self):
        if not HAS_MEDIAPIPE:
            return
        try:
            self.mp_face_detection = mp.solutions.face_detection
            self.face_detection = self.mp_face_detection.FaceDetection(
                model_selection=1,
                min_detection_confidence=0.5
            )
            self._initialized = True
            print("[FaceDetector] MediaPipe initialized successfully")
        except Exception as e:
            print(f"[FaceDetector] MediaPipe initialization failed: {e}")
            self._initialized = False
    
    def detect(self, frame_data: bytes) -> Dict[str, Any]:
        try:
            nparr = np.frombuffer(frame_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"error": "Failed to decode image", "face_count": 0, "faces": []}
            
            if self._initialized and self.face_detection:
                try:
                    with self._lock:
                        return self._detect_mediapipe(img)
                except Exception as e:
                    print(f"[FaceDetector] MediaPipe error, falling back to OpenCV: {e}")
                    return self._detect_opencv(img)
            else:
                return self._detect_opencv(img)
                
        except Exception as e:
            print(f"[FaceDetector] Error: {e}")
            return {"error": str(e), "face_count": 0, "faces": []}
    
    def _detect_mediapipe(self, img: np.ndarray) -> Dict[str, Any]:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(rgb)
        
        faces = []
        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                faces.append({
                    "x": float(bbox.xmin),
                    "y": float(bbox.ymin),
                    "width": float(bbox.width),
                    "height": float(bbox.height),
                    "confidence": float(detection.score[0]) if detection.score else 0.0,
                    "landmarks": [
                        {"x": float(lm.x), "y": float(lm.y)}
                        for lm in detection.location_data.relative_keypoints
                    ] if detection.location_data.relative_keypoints else []
                })
        
        return {
            "face_count": len(faces),
            "faces": faces,
            "has_face": len(faces) > 0,
            "multiple_faces": len(faces) > 1,
            "method": "mediapipe"
        }
    
    def _detect_opencv(self, img: np.ndarray) -> Dict[str, Any]:
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        
        if face_cascade.empty():
            print("[FaceDetector] Failed to load face cascade")
            return {"error": "Failed to load face cascade", "face_count": 0, "faces": []}
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        detections = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        faces = []
        for (x, y, w, h) in detections:
            faces.append({
                "x": float(x / img.shape[1]),
                "y": float(y / img.shape[0]),
                "width": float(w / img.shape[1]),
                "height": float(h / img.shape[0]),
                "confidence": 1.0,
                "landmarks": []
            })
        
        print(f"[FaceDetector] OpenCV detected {len(faces)} faces")
        
        return {
            "face_count": len(faces),
            "faces": faces,
            "has_face": len(faces) > 0,
            "multiple_faces": len(faces) > 1,
            "method": "opencv"
        }

class MobileDetector:
    def __init__(self):
        self.yolo_detector = YOLOMobileDetector()
        self._initialized = True
        print("[MobileDetector] Initialized with YOLO")

    def detect(self, frame_data: bytes) -> Dict[str, Any]:
        if not self.yolo_detector or self.yolo_detector.model is None:
            return {"detected": False, "confidence": 0.0, "error": "YOLO model not loaded"}

        try:
            yolo_result = self.yolo_detector.detect(frame_data)
            if yolo_result.get("detected", False):
                print(f"[MobileDetector] Phone detected with confidence: {yolo_result.get('confidence', 0)}")
            return yolo_result
        except Exception as e:
            print(f"[MobileDetector] YOLO error: {e}")
            return {"detected": False, "confidence": 0.0, "error": str(e)}

class VoiceDetector:
    def __init__(self):
        self.sample_rate = 16000
        self._log_counter = 0
    
    def detect_loud_voice(self, audio_data: bytes) -> Dict[str, Any]:
        try:
            if not audio_data or len(audio_data) < 100:
                return {"is_loud": False, "level": 0.0}
            
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
            if len(audio_array) == 0:
                return {"is_loud": False, "level": 0.0}
            
            rms = float(np.sqrt(np.mean(audio_array.astype(np.float64) ** 2)))
            normalized = min(1.0, rms)
            
            is_loud = normalized > 0.05
            
            self._log_counter += 1
            if self._log_counter % 20 == 0:
                print(f"[VoiceDetector] Current level: {normalized:.4f}")
            
            if is_loud:
                print(f"[VoiceDetector] Loud voice detected: {normalized:.4f}")
            
            return {
                "is_loud": is_loud,
                "is_very_loud": bool(normalized > 0.12),
                "level": float(normalized),
                "db": float(20 * math.log10(normalized + 0.0001))
            }
        except Exception as e:
            print(f"[VoiceDetector] Error: {e}")
            return {"is_loud": False, "level": 0.0, "error": str(e)}
    
    def detect_multiple_voices(self, audio_data: bytes) -> Dict[str, Any]:
        try:
            if not audio_data or len(audio_data) < 512:
                return {"multiple_voices": False, "confidence": 0.0}
            
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
            if len(audio_array) < 128:
                return {"multiple_voices": False, "confidence": 0.0}
            
            fft = np.fft.fft(audio_array)
            magnitude = np.abs(fft[:len(fft)//2])
            magnitude = magnitude / np.max(magnitude + 0.0001)
            
            peaks = []
            for i in range(2, len(magnitude) - 2):
                if magnitude[i] > 0.3 and magnitude[i] > magnitude[i-1] and magnitude[i] > magnitude[i+1]:
                    peaks.append(magnitude[i])
            
            strong_peaks = [p for p in peaks if p > 0.4]
            
            if len(strong_peaks) >= 3:
                return {"multiple_voices": True, "confidence": min(1.0, len(strong_peaks) / 5.0)}
            elif len(strong_peaks) >= 2:
                return {"multiple_voices": True, "confidence": 0.5}
            
            return {"multiple_voices": False, "confidence": 0.0}
            
        except Exception as e:
            return {"multiple_voices": False, "confidence": 0.0, "error": str(e)}

class LipSyncDetector:
    def __init__(self):
        self.face_detector = FaceDetector()
    
    def detect_mismatch(self, video_frames: List[bytes], audio_data: bytes) -> Dict[str, Any]:
        try:
            if not video_frames or len(video_frames) < 5:
                return {"matched": True, "confidence": 1.0}
            
            if not audio_data or len(audio_data) < 100:
                return {"matched": True, "confidence": 1.0}
            
            mouth_movements = []
            for frame in video_frames[:10]:
                face_result = self.face_detector.detect(frame)
                if face_result.get("has_face") and face_result.get("faces"):
                    face = face_result["faces"][0]
                    landmarks = face.get("landmarks", [])
                    if landmarks and len(landmarks) >= 8:
                        lip_landmarks = landmarks[4:8] if len(landmarks) >= 8 else landmarks
                        mouth_movement = sum(
                            ((l["x"] - landmarks[0]["x"]) ** 2 + (l["y"] - landmarks[0]["y"]) ** 2)
                            for l in lip_landmarks
                        )
                        mouth_movements.append(mouth_movement)
            
            if len(mouth_movements) < 3:
                return {"matched": True, "confidence": 0.9}
            
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
            audio_energy = float(np.std(audio_array)) if len(audio_array) > 0 else 0.0
            
            mouth_variance = np.var(mouth_movements)
            audio_normalized = min(1.0, audio_energy / 0.3)
            
            if mouth_variance > 50 and audio_normalized < 0.1:
                print(f"[LipSync] Mismatch detected: mouth variance {mouth_variance:.2f}, audio {audio_normalized:.2f}")
                return {"matched": False, "confidence": 0.7}
            if mouth_variance < 5 and audio_normalized > 0.5:
                print(f"[LipSync] Mismatch detected: mouth variance {mouth_variance:.2f}, audio {audio_normalized:.2f}")
                return {"matched": False, "confidence": 0.6}
            
            return {"matched": True, "confidence": 0.9}
            
        except Exception as e:
            print(f"[LipSync] Error: {e}")
            return {"matched": True, "confidence": 0.5, "error": str(e)}

class BrightnessDetector:
    def detect(self, frame_data: bytes) -> Dict[str, Any]:
        try:
            nparr = np.frombuffer(frame_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"is_dark": False, "brightness": 100.0}
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            avg_brightness = np.mean(gray)
            
            return {
                "brightness": float(avg_brightness),
                "is_dark": bool(avg_brightness < 80),
                "is_very_dark": bool(avg_brightness < 40),
                "is_bright": bool(avg_brightness > 150)
            }
        except Exception as e:
            return {"is_dark": False, "brightness": 100.0, "error": str(e)}

class ProctorDetectionService:
    def __init__(self):
        self.face_detector = None
        self.mobile_detector = None
        self.voice_detector = None
        self.lip_sync_detector = None
        self.brightness_detector = None
        self._initialized = False
        self._init_detectors()
    
    def _init_detectors(self):
        try:
            self.face_detector = FaceDetector()
            self.mobile_detector = MobileDetector()
            self.voice_detector = VoiceDetector()
            self.lip_sync_detector = LipSyncDetector()
            self.brightness_detector = BrightnessDetector()
            self._initialized = True
            print("[ProctorDetectionService] All detectors initialized")
        except Exception as e:
            print(f"[ProctorDetectionService] Init error: {e}")
            self._initialized = False
    
    def detect_all(self, frame_data: bytes, audio_data: Optional[bytes] = None) -> Dict[str, Any]:
        if not self._initialized:
            self._init_detectors()
        
        face_result = self.face_detector.detect(frame_data) if self.face_detector else {"face_count": 0, "faces": []}
        mobile_result = self.mobile_detector.detect(frame_data) if self.mobile_detector else {"detected": False}
        brightness_result = self.brightness_detector.detect(frame_data) if self.brightness_detector else {"is_dark": False}
        
        results = {
            "faces": face_result,
            "mobile": mobile_result,
            "brightness": brightness_result,
            "violations": [],
            "timestamp": now().isoformat()
        }
        
        if audio_data and self.voice_detector:
            results["voice"] = self.voice_detector.detect_loud_voice(audio_data)
            results["multiple_voices"] = self.voice_detector.detect_multiple_voices(audio_data)
        
        violations = []
        
        if not face_result.get("has_face", False):
            violations.append({"type": "NO_FACE", "severity": "high", "detected": True})
        
        if face_result.get("multiple_faces", False):
            violations.append({"type": "MULTIPLE_FACE", "severity": "critical", "detected": True})
        
        if mobile_result.get("detected", False):
            violations.append({"type": "MOBILE_DETECTED", "severity": "critical", "detected": True})
        
        if brightness_result.get("is_very_dark", False):
            violations.append({"type": "DARK_ENVIRONMENT", "severity": "medium", "detected": True})
        
        if audio_data and self.voice_detector:
            voice_result = results.get("voice", {})
            if voice_result.get("is_loud", False):
                violations.append({"type": "LOUD_VOICE", "severity": "medium", "detected": True})
            
            multiple_voices = results.get("multiple_voices", {})
            if multiple_voices.get("multiple_voices", False):
                violations.append({"type": "MULTIPLE_VOICE", "severity": "high", "detected": True})
        
        results["violations"] = violations
        
        if violations:
            print(f"[ProctorDetectionService] Detected {len(violations)} violations")
        
        return _convert_to_native(results)

detection_service = ProctorDetectionService()

def detect_faces(frame_data: bytes) -> Dict[str, Any]:
    return detection_service.face_detector.detect(frame_data) if detection_service.face_detector else {"face_count": 0, "faces": []}

def detect_brightness(frame_data: bytes) -> Dict[str, Any]:
    return detection_service.brightness_detector.detect(frame_data) if detection_service.brightness_detector else {"is_dark": False}

def detect_loud_voice(audio_data: bytes) -> Dict[str, Any]:
    return detection_service.voice_detector.detect_loud_voice(audio_data) if detection_service.voice_detector else {"is_loud": False, "level": 0.0}

def detect_mobile_phone(frame_data: bytes) -> Dict[str, Any]:
    return detection_service.mobile_detector.detect(frame_data) if detection_service.mobile_detector else {"detected": False}

def detect_multiple_voices(audio_data: bytes) -> Dict[str, Any]:
    return detection_service.voice_detector.detect_multiple_voices(audio_data) if detection_service.voice_detector else {"multiple_voices": False}

def detect_lip_sync(video_frames: List[bytes], audio_data: bytes) -> Dict[str, Any]:
    return detection_service.lip_sync_detector.detect_mismatch(video_frames, audio_data) if detection_service.lip_sync_detector else {"matched": True}

def detect_all(frame_data: bytes, audio_data: Optional[bytes] = None) -> Dict[str, Any]:
    return detection_service.detect_all(frame_data, audio_data)