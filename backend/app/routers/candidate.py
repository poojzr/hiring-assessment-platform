from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.candidate import Candidate
from app.models.user import User
from app.models.job_role import JobRoleThreshold
from app.models.assessment import AssessmentTemplate, AssessmentSession, Answer, SessionQuestion
from app.models.proctoring import ProctorEvent
from app.models.recording import Recording
from app.utils.auth import get_current_user, get_client_ip
from app.services.email_service import send_assessment_email

router = APIRouter(prefix="/candidates", tags=["candidates"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

class CandidateCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    job_role_id: Optional[int] = None
    ats_score: Optional[float] = None
    resume_url: Optional[str] = None

class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    job_role_id: Optional[int] = None
    ats_score: Optional[float] = None
    shortlisted: Optional[bool] = None
    resume_url: Optional[str] = None

class CandidateResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str
    email: str
    phone: Optional[str]
    resume_url: Optional[str]
    job_role_id: Optional[int]
    job_role: Optional[str] = None
    ats_score: Optional[float]
    shortlisted: bool
    shortlisted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    access_token: Optional[str] = None

    class Config:
        from_attributes = True

class CandidateListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: list[CandidateResponse]

class ATSScoreRequest(BaseModel):
    ats_score: float

class ATSScoreResponse(BaseModel):
    candidate_id: int
    ats_score: float
    threshold: float
    shortlisted: bool
    session_created: bool
    email_sent: bool
    access_token: Optional[str] = None
    session_id: Optional[int] = None
    message: str
    template_name: Optional[str] = None
    eligibility: Optional[str] = None

class ResendEmailResponse(BaseModel):
    success: bool
    message: str

class DeleteCandidateResponse(BaseModel):
    message: str
    deleted: bool
    deactivated: Optional[bool] = None

class BulkSessionCreateRequest(BaseModel):
    candidate_ids: List[int]

class BulkSessionCreateResponse(BaseModel):
    total: int
    success: int
    failed: int
    results: List[dict]

def create_assessment_session(db: Session, candidate: Candidate, template: AssessmentTemplate):
    now_time = now()
    access_days = 3
    allowed_until = now_time + timedelta(days=access_days)
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
        allowed_until=allowed_until,
    )
    db.add(session)
    db.flush()

    try:
        from app.services.exam_service import select_and_pin_questions
        select_and_pin_questions(db, session, template)
    except Exception as e:
        print(f"[WARNING] Failed to pin questions: {e}")

    db.commit()
    db.refresh(session)
    return session

def send_assessment_link_email(candidate: Candidate, access_token: str, job_role: str):
    try:
        deadline_str = (now() + timedelta(days=3)).strftime("%Y-%m-%d %H:%M IST")
        candidate_name = candidate.name or "Candidate"
        email_sent = send_assessment_email(
            to_email=candidate.email,
            candidate_name=candidate_name,
            access_token=access_token,
            deadline_str=deadline_str,
            job_role=job_role or "the position"
        )
        return email_sent
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False

def process_ats_check(db: Session, candidate: Candidate, ats_score: float):
    candidate.ats_score = ats_score

    threshold_value = 70.0
    threshold = None
    
    if candidate.job_role_id:
        threshold = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.id == candidate.job_role_id
        ).first()
        if threshold:
            threshold_value = threshold.ats_threshold
    else:
        default_threshold = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.job_role_name == "Default"
        ).first()
        if default_threshold:
            threshold_value = default_threshold.ats_threshold
            threshold = default_threshold
        else:
            first_threshold = db.query(JobRoleThreshold).first()
            if first_threshold:
                threshold_value = first_threshold.ats_threshold
                threshold = first_threshold

    print(f"[ATS CHECK] Candidate: {candidate.name}, Score: {ats_score}, Threshold: {threshold_value}")

    if ats_score >= threshold_value:
        template = None
        if candidate.job_role_id:
            template = db.query(AssessmentTemplate).filter(
                AssessmentTemplate.job_role_id == candidate.job_role_id,
                AssessmentTemplate.is_active == True
            ).first()
        else:
            template = db.query(AssessmentTemplate).filter(
                AssessmentTemplate.is_active == True
            ).first()

        if not template:
            candidate.shortlisted = False
            db.commit()
            return {
                "shortlisted": False,
                "session_created": False,
                "email_sent": False,
                "message": "No active template found for this job role",
                "threshold": threshold_value
            }

        existing_session = db.query(AssessmentSession).filter(
            AssessmentSession.candidate_id == candidate.id,
            AssessmentSession.status.in_(["scheduled", "in_progress"])
        ).first()

        if existing_session:
            candidate.shortlisted = True
            candidate.shortlisted_at = now()
            db.commit()
            db.refresh(candidate)
            return {
                "shortlisted": True,
                "session_created": True,
                "email_sent": True,
                "access_token": existing_session.access_token,
                "session_id": existing_session.id,
                "message": "Candidate already has an active session",
                "template_name": template.name if template else None,
                "threshold": threshold_value
            }

        candidate.shortlisted = True
        candidate.shortlisted_at = now()

        session = create_assessment_session(db, candidate, template)

        job_role_name = None
        if candidate.job_role_id:
            job_role = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == candidate.job_role_id).first()
            if job_role:
                job_role_name = job_role.job_role_name

        email_sent = send_assessment_link_email(candidate, session.access_token, job_role_name)

        db.commit()
        db.refresh(candidate)

        return {
            "shortlisted": True,
            "session_created": True,
            "email_sent": email_sent,
            "access_token": session.access_token,
            "session_id": session.id,
            "message": "Candidate shortlisted. Session created." + (" Email sent." if email_sent else " Email failed."),
            "template_name": template.name if template else None,
            "threshold": threshold_value
        }

    candidate.shortlisted = False
    db.commit()
    db.refresh(candidate)

    return {
        "shortlisted": False,
        "session_created": False,
        "email_sent": False,
        "message": f"ATS score {ats_score}% below threshold {threshold_value}%",
        "threshold": threshold_value
    }

@router.get("/", response_model=CandidateListResponse)
def list_candidates(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    shortlisted: Optional[bool] = None,
    job_role_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    query = db.query(Candidate)

    if search:
        query = query.filter(
            Candidate.name.ilike(f"%{search}%") | Candidate.email.ilike(f"%{search}%")
        )
    if shortlisted is not None:
        query = query.filter(Candidate.shortlisted == shortlisted)
    if job_role_id:
        query = query.filter(Candidate.job_role_id == job_role_id)

    total = query.count()
    candidates = query.offset(skip).limit(limit).all()

    items = []
    for c in candidates:
        job_role_name = None
        if c.job_role_id:
            threshold = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == c.job_role_id).first()
            if threshold:
                job_role_name = threshold.job_role_name

        session = db.query(AssessmentSession).filter(
            AssessmentSession.candidate_id == c.id,
            AssessmentSession.status.in_(["scheduled", "in_progress"])
        ).first()

        items.append(CandidateResponse(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            email=c.email,
            phone=c.phone,
            resume_url=c.resume_url,
            job_role_id=c.job_role_id,
            job_role=job_role_name,
            ats_score=c.ats_score,
            shortlisted=c.shortlisted,
            shortlisted_at=c.shortlisted_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
            access_token=session.access_token if session else None
        ))

    return CandidateListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=items
    )

@router.post("/", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate(
    data: CandidateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    existing = db.query(Candidate).filter(Candidate.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    candidate = Candidate(
        name=data.name,
        email=data.email,
        phone=data.phone,
        job_role_id=data.job_role_id,
        ats_score=data.ats_score,
        shortlisted=False,
        resume_url=data.resume_url,
    )
    db.add(candidate)
    db.flush()

    job_role_name = None
    if candidate.job_role_id:
        threshold = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == candidate.job_role_id).first()
        if threshold:
            job_role_name = threshold.job_role_name

    session = None
    if data.ats_score is not None:
        result = process_ats_check(db, candidate, data.ats_score)
        if result.get("shortlisted"):
            candidate.shortlisted = True
            db.commit()
            db.refresh(candidate)
            session = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == candidate.id,
                AssessmentSession.status.in_(["scheduled", "in_progress"])
            ).first()

    db.commit()
    db.refresh(candidate)

    return CandidateResponse(
        id=candidate.id,
        user_id=candidate.user_id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        resume_url=candidate.resume_url,
        job_role_id=candidate.job_role_id,
        job_role=job_role_name,
        ats_score=candidate.ats_score,
        shortlisted=candidate.shortlisted,
        shortlisted_at=candidate.shortlisted_at,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
        access_token=session.access_token if session else None
    )

@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_role_name = None
    if candidate.job_role_id:
        threshold = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == candidate.job_role_id).first()
        if threshold:
            job_role_name = threshold.job_role_name

    session = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate.id,
        AssessmentSession.status.in_(["scheduled", "in_progress"])
    ).first()

    return CandidateResponse(
        id=candidate.id,
        user_id=candidate.user_id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        resume_url=candidate.resume_url,
        job_role_id=candidate.job_role_id,
        job_role=job_role_name,
        ats_score=candidate.ats_score,
        shortlisted=candidate.shortlisted,
        shortlisted_at=candidate.shortlisted_at,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
        access_token=session.access_token if session else None
    )

@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: int,
    data: CandidateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if data.email and data.email != candidate.email:
        existing = db.query(Candidate).filter(Candidate.email == data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already used by another candidate")

    update_data = data.model_dump(exclude_unset=True)
    has_ats_update = "ats_score" in update_data and update_data["ats_score"] is not None

    for key, value in update_data.items():
        if value is not None:
            setattr(candidate, key, value)

    session = None
    if has_ats_update:
        result = process_ats_check(db, candidate, update_data["ats_score"])
        if result.get("shortlisted"):
            candidate.shortlisted = True
            session = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == candidate.id,
                AssessmentSession.status.in_(["scheduled", "in_progress"])
            ).first()
        else:
            candidate.shortlisted = False
    elif "shortlisted" in update_data and update_data["shortlisted"] is not None:
        candidate.shortlisted = update_data["shortlisted"]

    db.commit()
    db.refresh(candidate)

    job_role_name = None
    if candidate.job_role_id:
        threshold = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == candidate.job_role_id).first()
        if threshold:
            job_role_name = threshold.job_role_name

    return CandidateResponse(
        id=candidate.id,
        user_id=candidate.user_id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        resume_url=candidate.resume_url,
        job_role_id=candidate.job_role_id,
        job_role=job_role_name,
        ats_score=candidate.ats_score,
        shortlisted=candidate.shortlisted,
        shortlisted_at=candidate.shortlisted_at,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
        access_token=session.access_token if session else None
    )

@router.delete("/{candidate_id}", response_model=DeleteCandidateResponse)
def delete_candidate(
    candidate_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    sessions = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == candidate_id).all()
    
    if sessions:
        candidate.shortlisted = False
        for session in sessions:
            session.eligibility = "auto_blocked"
            session.status = "expired"
        db.commit()
        return DeleteCandidateResponse(
            message=f"Candidate has {len(sessions)} session(s). Deactivated and sessions blocked.",
            deleted=False,
            deactivated=True
        )

    db.delete(candidate)
    db.commit()

    return DeleteCandidateResponse(
        message="Candidate deleted successfully",
        deleted=True,
        deactivated=False
    )

@router.delete("/{candidate_id}/permanent")
def delete_candidate_permanent(
    candidate_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    sessions = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == candidate_id).all()
    
    if sessions:
        for session in sessions:
            db.query(Answer).filter(Answer.session_id == session.id).delete()
            db.query(SessionQuestion).filter(SessionQuestion.session_id == session.id).delete()
            db.query(ProctorEvent).filter(ProctorEvent.session_id == session.id).delete()
            db.query(Recording).filter(Recording.session_id == session.id).delete()
            db.delete(session)
        db.commit()

    db.delete(candidate)
    db.commit()

    return DeleteCandidateResponse(
        message="Candidate and all associated data deleted permanently",
        deleted=True,
        deactivated=False
    )

@router.post("/{candidate_id}/ats-score", response_model=ATSScoreResponse)
def check_ats_score(
    candidate_id: int,
    data: ATSScoreRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if data.ats_score < 0 or data.ats_score > 100:
        raise HTTPException(status_code=400, detail="ATS score must be between 0 and 100")

    result = process_ats_check(db, candidate, data.ats_score)

    return ATSScoreResponse(
        candidate_id=candidate.id,
        ats_score=data.ats_score,
        threshold=result.get("threshold", 70),
        shortlisted=result.get("shortlisted", False),
        session_created=result.get("session_created", False),
        email_sent=result.get("email_sent", False),
        access_token=result.get("access_token"),
        session_id=result.get("session_id"),
        message=result.get("message", ""),
        template_name=result.get("template_name"),
        eligibility="auto_eligible" if result.get("shortlisted") else "blocked"
    )

@router.post("/{candidate_id}/resend-email", response_model=ResendEmailResponse)
def resend_assessment_email(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.shortlisted:
        raise HTTPException(status_code=400, detail="Candidate is not shortlisted")

    session = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate.id,
        AssessmentSession.status.in_(["scheduled", "in_progress"])
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="No active session found for this candidate")

    job_role_name = None
    if candidate.job_role_id:
        threshold = db.query(JobRoleThreshold).filter(JobRoleThreshold.id == candidate.job_role_id).first()
        if threshold:
            job_role_name = threshold.job_role_name

    email_sent = send_assessment_link_email(candidate, session.access_token, job_role_name)

    return ResendEmailResponse(
        success=email_sent,
        message="Email sent successfully" if email_sent else "Failed to send email"
    )

@router.post("/bulk-sessions", response_model=BulkSessionCreateResponse)
def bulk_create_sessions(
    data: BulkSessionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")

    if not data.candidate_ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")

    results = []
    success_count = 0
    failed_count = 0

    for candidate_id in data.candidate_ids:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            results.append({
                "candidate_id": candidate_id,
                "status": "failed",
                "message": "Candidate not found"
            })
            failed_count += 1
            continue

        if candidate.ats_score is None:
            results.append({
                "candidate_id": candidate_id,
                "name": candidate.name,
                "status": "failed",
                "message": "ATS score not set. Please check ATS score first."
            })
            failed_count += 1
            continue

        threshold_value = 70.0
        if candidate.job_role_id:
            threshold = db.query(JobRoleThreshold).filter(
                JobRoleThreshold.id == candidate.job_role_id
            ).first()
            if threshold:
                threshold_value = threshold.ats_threshold

        if candidate.ats_score >= threshold_value:
            template = None
            if candidate.job_role_id:
                template = db.query(AssessmentTemplate).filter(
                    AssessmentTemplate.job_role_id == candidate.job_role_id,
                    AssessmentTemplate.is_active == True
                ).first()
            else:
                template = db.query(AssessmentTemplate).filter(
                    AssessmentTemplate.is_active == True
                ).first()

            if not template:
                results.append({
                    "candidate_id": candidate_id,
                    "name": candidate.name,
                    "status": "failed",
                    "message": "No active template found for this job role"
                })
                failed_count += 1
                continue

            existing_session = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == candidate.id,
                AssessmentSession.status.in_(["scheduled", "in_progress"])
            ).first()

            if existing_session:
                results.append({
                    "candidate_id": candidate_id,
                    "name": candidate.name,
                    "status": "success",
                    "message": "Already has an active session",
                    "access_token": existing_session.access_token,
                    "session_id": existing_session.id
                })
                success_count += 1
                continue

            candidate.shortlisted = True
            candidate.shortlisted_at = now()

            session = create_assessment_session(db, candidate, template)

            job_role_name = None
            if candidate.job_role_id:
                job_role = db.query(JobRoleThreshold).filter(
                    JobRoleThreshold.id == candidate.job_role_id
                ).first()
                if job_role:
                    job_role_name = job_role.job_role_name

            email_sent = send_assessment_link_email(candidate, session.access_token, job_role_name)

            db.commit()
            db.refresh(candidate)

            results.append({
                "candidate_id": candidate_id,
                "name": candidate.name,
                "status": "success",
                "message": "Session created" + (" and email sent" if email_sent else " but email failed"),
                "access_token": session.access_token,
                "session_id": session.id,
                "email_sent": email_sent
            })
            success_count += 1
        else:
            candidate.shortlisted = False
            db.commit()
            results.append({
                "candidate_id": candidate_id,
                "name": candidate.name,
                "status": "failed",
                "message": f"ATS score {candidate.ats_score}% below threshold {threshold_value}%"
            })
            failed_count += 1

    return BulkSessionCreateResponse(
        total=len(data.candidate_ids),
        success=success_count,
        failed=failed_count,
        results=results
    )