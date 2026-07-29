from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
from pydantic import BaseModel

from app.database import get_db
from app.models.assessment import AssessmentSession, AssessmentTemplate
from app.models.candidate import Candidate
from app.models.user import User
from app.utils.auth import require_manager, get_current_user, get_client_ip
from app.services.exam_service import select_and_pin_questions
from app.services.email_service import send_assessment_email

router = APIRouter(prefix="/sessions", tags=["sessions"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

class SessionCreate(BaseModel):
    candidate_id: int
    template_id: int
    access_days: int = 3
    allowed_until: Optional[datetime] = None

class SessionResponse(BaseModel):
    id: int
    access_token: str
    candidate_id: int
    candidate_name: str
    candidate_email: str
    template_id: int
    template_name: str
    job_role: str
    status: str
    total_score: Optional[float]
    integrity_score: Optional[float]
    cheating_risk: Optional[str]
    eligibility: str
    allowed_from: Optional[datetime]
    allowed_until: Optional[datetime]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class SessionListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: List[SessionResponse]

class SessionByTokenResponse(BaseModel):
    session_id: int
    access_token: str
    candidate_name: str
    candidate_email: str
    template_name: str
    job_role: str
    status: str
    total_score: Optional[float]
    integrity_score: Optional[float]
    cheating_risk: Optional[str]
    eligibility: str
    duration_minutes: Optional[int]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    allowed_from: Optional[datetime]
    allowed_until: Optional[datetime]

class ResendEmailResponse(BaseModel):
    success: bool
    message: str

def create_assessment_session(db: Session, candidate: Candidate, template: AssessmentTemplate, access_days: int = 3, allowed_until: Optional[datetime] = None):
    now_time = now()
    
    if allowed_until:
        allowed_until_dt = allowed_until
    else:
        allowed_until_dt = now_time + timedelta(days=access_days)
    
    access_token = str(uuid.uuid4())

    session = AssessmentSession(
        access_token=access_token,
        candidate_id=candidate.id,
        template_id=template.id,
        status="scheduled",
        eligibility="pending",
        integrity_score=100.0,
        cheating_risk="clean",
        allowed_from=now_time,
        allowed_until=allowed_until_dt,
    )
    db.add(session)
    db.flush()

    try:
        select_and_pin_questions(db, session, template)
    except Exception as e:
        print(f"[WARNING] Failed to pin questions: {e}")

    db.commit()
    db.refresh(session)
    return session

@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    data: SessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == data.template_id,
        AssessmentTemplate.is_active == True
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or inactive")

    existing = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate.id,
        AssessmentSession.status.in_(["scheduled", "in_progress"])
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Candidate already has an active session")

    session = create_assessment_session(
        db, candidate, template, data.access_days, data.allowed_until
    )

    job_role_name = template.role

    email_sent = False
    try:
        deadline_str = session.allowed_until.strftime("%Y-%m-%d %H:%M IST")
        email_sent = send_assessment_email(
            to_email=candidate.email,
            candidate_name=candidate.name,
            access_token=session.access_token,
            deadline_str=deadline_str,
            job_role=job_role_name
        )
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")

    return SessionResponse(
        id=session.id,
        access_token=session.access_token,
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        candidate_email=candidate.email,
        template_id=template.id,
        template_name=template.name,
        job_role=template.role,
        status=session.status,
        total_score=session.total_score,
        integrity_score=session.integrity_score,
        cheating_risk=session.cheating_risk,
        eligibility=session.eligibility,
        allowed_from=session.allowed_from,
        allowed_until=session.allowed_until,
        started_at=session.started_at,
        finished_at=session.finished_at,
        created_at=session.created_at,
        updated_at=session.updated_at
    )

@router.get("/", response_model=SessionListResponse)
def list_sessions(
    status: Optional[str] = Query(None, pattern="^(scheduled|in_progress|completed|expired)$"),
    eligibility: Optional[str] = Query(None, pattern="^(pending|auto_eligible|auto_blocked|manager_overridden)$"),
    job_role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    query = db.query(AssessmentSession)

    if status:
        query = query.filter(AssessmentSession.status == status)
    if eligibility:
        query = query.filter(AssessmentSession.eligibility == eligibility)

    if search:
        query = query.join(AssessmentSession.candidate).filter(
            Candidate.name.ilike(f"%{search}%") | Candidate.email.ilike(f"%{search}%")
        )

    if job_role:
        query = query.join(AssessmentSession.template).filter(AssessmentTemplate.role == job_role)

    total = query.count()
    sessions = query.offset(skip).limit(limit).all()

    items = []
    for s in sessions:
        candidate = s.candidate
        template = s.template
        items.append(SessionResponse(
            id=s.id,
            access_token=s.access_token,
            candidate_id=candidate.id if candidate else 0,
            candidate_name=candidate.name if candidate else "Unknown",
            candidate_email=candidate.email if candidate else "Unknown",
            template_id=template.id if template else 0,
            template_name=template.name if template else "Unknown",
            job_role=template.role if template else "Unknown",
            status=s.status,
            total_score=s.total_score,
            integrity_score=s.integrity_score,
            cheating_risk=s.cheating_risk,
            eligibility=s.eligibility,
            allowed_from=s.allowed_from,
            allowed_until=s.allowed_until,
            started_at=s.started_at,
            finished_at=s.finished_at,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))

    return SessionListResponse(total=total, skip=skip, limit=limit, items=items)

@router.get("/view/{access_token}", response_model=SessionByTokenResponse)
def get_session_by_token(
    access_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(
        AssessmentSession.access_token == access_token
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = session.candidate
    template = session.template

    return SessionByTokenResponse(
        session_id=session.id,
        access_token=session.access_token,
        candidate_name=candidate.name if candidate else "Unknown",
        candidate_email=candidate.email if candidate else "Unknown",
        template_name=template.name if template else "Unknown",
        job_role=template.role if template else "Unknown",
        status=session.status,
        total_score=session.total_score,
        integrity_score=session.integrity_score,
        cheating_risk=session.cheating_risk,
        eligibility=session.eligibility,
        duration_minutes=template.duration_minutes if template else None,
        started_at=session.started_at,
        finished_at=session.finished_at,
        allowed_from=session.allowed_from,
        allowed_until=session.allowed_until
    )

@router.post("/{session_id}/resend-email", response_model=ResendEmailResponse)
def resend_session_email(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status not in ["scheduled", "in_progress"]:
        raise HTTPException(status_code=400, detail="Cannot resend email for completed session")

    candidate = session.candidate
    template = session.template

    if not candidate or not template:
        raise HTTPException(status_code=404, detail="Candidate or template not found")

    email_sent = send_assessment_email(
        to_email=candidate.email,
        candidate_name=candidate.name,
        access_token=session.access_token,
        deadline_str=session.allowed_until.strftime("%Y-%m-%d %H:%M IST") if session.allowed_until else None,
        job_role=template.role
    )

    return ResendEmailResponse(
        success=email_sent,
        message="Email sent successfully" if email_sent else "Failed to send email"
    )

@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "in_progress":
        raise HTTPException(status_code=400, detail="Cannot delete an in-progress session")

    db.delete(session)
    db.commit()

    return {"message": "Session deleted successfully"}