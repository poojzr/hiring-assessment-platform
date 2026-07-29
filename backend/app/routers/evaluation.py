from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database import get_db
from app.models.assessment import AssessmentSession
from app.models.user import User
from app.services.evaluation_service import evaluate_session
from app.services.audit_service import write_audit_log
from app.utils.auth import require_manager, get_client_ip

router = APIRouter(prefix="/admin", tags=["evaluation"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

@router.post("/sessions/{session_id}/re-evaluate")
def re_evaluate_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Session must be completed (current status: {session.status})"
        )
    
    old_eligibility = session.eligibility
    old_score = session.total_score
    
    session.eligibility = "pending"
    session.total_score = None
    db.commit()
    
    try:
        evaluate_session(db, session)
        db.refresh(session)
    except Exception as e:
        session.eligibility = old_eligibility
        session.total_score = old_score
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Re-evaluation failed: {str(e)}"
        )
    
    write_audit_log(
        db,
        user.id,
        f"/api/admin/sessions/{session_id}/re-evaluate",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"session_id": session.id}
    )
    db.commit()
    
    return {
        "session_id": session.id,
        "total_score": session.total_score,
        "integrity_score": session.integrity_score,
        "cheating_risk": session.cheating_risk,
        "eligibility": session.eligibility,
        "message": "Re-evaluation completed successfully"
    }