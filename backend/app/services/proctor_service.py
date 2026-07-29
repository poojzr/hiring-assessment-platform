from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.models.assessment import AssessmentSession
from app.models.proctoring import ProctorEvent, ProctorEventType, SeverityLevel
from .proctor_detection import detect_all

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

SEVERITY_PENALTIES = {
    "critical": 40,
    "high": 25,
    "medium": 10,
    "low": 5,
}

def log_violation(
    db: Session,
    session_id: int,
    event_type: str,
    severity: str,
    snapshot_url: Optional[str] = None,
    clip_url: Optional[str] = None,
    event_data: Optional[Dict] = None,
) -> Dict[str, Any]:
    event = ProctorEvent(
        session_id=session_id,
        event_type=ProctorEventType(event_type),
        severity=SeverityLevel(severity),
        snapshot_url=snapshot_url,
        clip_url=clip_url,
        event_data=event_data,
        timestamp=now(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    score, risk = calculate_integrity_score(db, session_id)
    
    return {
        "event_id": event.id,
        "logged": True,
        "integrity_score": score,
        "cheating_risk": risk,
    }

def calculate_integrity_score(db: Session, session_id: int) -> tuple:
    events = db.query(ProctorEvent).filter(ProctorEvent.session_id == session_id).all()
    
    score = 100.0
    for event in events:
        penalty = SEVERITY_PENALTIES.get(event.severity.value, 0)
        score -= penalty
    
    score = max(0.0, score)
    
    if score >= 90:
        risk = "clean"
    elif score >= 70:
        risk = "minor"
    else:
        risk = "high"
    
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if session:
        session.integrity_score = score
        session.cheating_risk = risk
        db.commit()
    
    return score, risk

def get_session_events(db: Session, session_id: int) -> List[ProctorEvent]:
    return db.query(ProctorEvent).filter(
        ProctorEvent.session_id == session_id
    ).order_by(ProctorEvent.timestamp).all()

def get_violation_summary(db: Session, session_id: int) -> Dict[str, Any]:
    events = db.query(ProctorEvent).filter(ProctorEvent.session_id == session_id).all()
    
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    type_counts = {}
    
    for event in events:
        severity_counts[event.severity.value] = severity_counts.get(event.severity.value, 0) + 1
        type_counts[event.event_type.value] = type_counts.get(event.event_type.value, 0) + 1
    
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    
    return {
        "total": len(events),
        "by_severity": severity_counts,
        "by_type": type_counts,
        "integrity_score": session.integrity_score if session else 100.0,
        "cheating_risk": session.cheating_risk if session else "clean",
    }

def process_frame_for_violations(
    db: Session,
    session_id: int,
    frame_data: bytes,
    audio_data: Optional[bytes] = None
) -> Dict[str, Any]:
    results = detect_all(frame_data, audio_data)
    
    logged_violations = []
    for violation in results.get("violations", []):
        if violation.get("detected", False):
            result = log_violation(
                db,
                session_id,
                violation["type"],
                violation["severity"],
                event_data={"detection_data": results}
            )
            logged_violations.append(result)
    
    return {
        "detections": results,
        "logged_violations": logged_violations,
        "integrity_score": logged_violations[0].get("integrity_score", 100.0) if logged_violations else 100.0
    }