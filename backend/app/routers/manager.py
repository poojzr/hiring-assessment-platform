from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.assessment import AssessmentSession, AssessmentTemplate, Answer
from app.models.proctoring import ProctorEvent, ProctorEventType, SeverityLevel
from app.models.job_role import JobRoleThreshold
from app.models.recording import Recording
from app.utils.auth import require_manager, get_current_user, get_client_ip
from app.services.export_service import export_candidate_data, export_bulk_candidates, export_sessions_data
from app.services.analytics_service import get_session_analytics, get_violation_analytics, get_question_analytics
from app.services.audit_service import write_audit_log
from app.services.email_service import send_assessment_email
from app.services.exam_service import select_and_pin_questions

router = APIRouter(prefix="/manager", tags=["manager"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

class DashboardStatsResponse(BaseModel):
    total_sessions: int
    completion_rate: float
    pass_rate: float
    average_score: float
    eligible_count: int
    integrity_distribution: dict
    total_violations: int
    violation_summary: dict

class SessionListItem(BaseModel):
    session_id: int
    candidate_id: Optional[int] = None
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
    reason: Optional[str] = None
    violation_count: int = 0
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

class SessionListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    items: List[SessionListItem]

class SessionDetailResponse(BaseModel):
    id: int
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
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    allowed_from: Optional[datetime]
    allowed_until: Optional[datetime]

class SessionCreate(BaseModel):
    candidate_id: int
    template_id: int
    access_days: int = 3
    allowed_until: Optional[datetime] = None

class SessionCreateResponse(BaseModel):
    id: int
    access_token: str
    candidate_id: int
    candidate_name: str
    candidate_email: str
    template_id: int
    template_name: str
    job_role: str
    status: str
    eligibility: str
    allowed_from: Optional[datetime]
    allowed_until: Optional[datetime]
    created_at: datetime

class ResendEmailResponse(BaseModel):
    success: bool
    message: str

class DeleteSessionResponse(BaseModel):
    message: str
    deleted: bool

class EligibleCandidateResponse(BaseModel):
    session_id: int
    access_token: str
    candidate_id: int
    candidate_name: str
    candidate_email: str
    candidate_phone: Optional[str]
    job_role: str
    ats_score: Optional[float]
    total_score: float
    integrity_score: float
    cheating_risk: str
    eligibility: str
    template_name: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]

class EligibleShortlistResponse(BaseModel):
    total: int
    items: List[EligibleCandidateResponse]

class OverrideRequest(BaseModel):
    eligibility: str
    override_reason: str

class OverrideResponse(BaseModel):
    session_id: int
    eligibility: str
    override_reason: str
    overridden_by: str
    overridden_at: datetime
    message: str

class ViolationTimelineItem(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    snapshot_url: Optional[str]
    clip_url: Optional[str]
    time: Optional[float] = None

class ViolationTimelineResponse(BaseModel):
    violations: List[ViolationTimelineItem]
    duration: Optional[float] = None

def create_assessment_session_record(db: Session, candidate: Candidate, template: AssessmentTemplate, access_days: int = 3, allowed_until: Optional[datetime] = None):
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

@router.post("/sessions", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    data: SessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
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

    session = create_assessment_session_record(
        db, candidate, template, data.access_days, data.allowed_until
    )

    try:
        deadline_str = session.allowed_until.strftime("%Y-%m-%d %H:%M IST")
        send_assessment_email(
            to_email=candidate.email,
            candidate_name=candidate.name,
            access_token=session.access_token,
            deadline_str=deadline_str,
            job_role=template.role
        )
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")

    return SessionCreateResponse(
        id=session.id,
        access_token=session.access_token,
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        candidate_email=candidate.email,
        template_id=template.id,
        template_name=template.name,
        job_role=template.role,
        status=session.status,
        eligibility=session.eligibility,
        allowed_from=session.allowed_from,
        allowed_until=session.allowed_until,
        created_at=session.created_at
    )

@router.get("/analytics/overview", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    stats = get_session_analytics(db)
    violations = get_violation_analytics(db)

    eligible_count = db.query(AssessmentSession).filter(
        AssessmentSession.eligibility.in_(["auto_eligible", "manager_overridden"]),
        AssessmentSession.status == "completed"
    ).count()

    return DashboardStatsResponse(
        total_sessions=stats.get("total_sessions", 0),
        completion_rate=stats.get("completion_rate", 0),
        pass_rate=stats.get("pass_rate", 0),
        average_score=stats.get("average_score", 0),
        eligible_count=eligible_count,
        integrity_distribution={
            "clean": db.query(AssessmentSession).filter(AssessmentSession.cheating_risk == "clean").count(),
            "minor": db.query(AssessmentSession).filter(AssessmentSession.cheating_risk == "minor").count(),
            "high": db.query(AssessmentSession).filter(AssessmentSession.cheating_risk == "high").count(),
        },
        total_violations=violations.get("total_violations", 0),
        violation_summary=violations.get("by_severity", {"critical": 0, "high": 0, "medium": 0, "low": 0})
    )

@router.get("/analytics/questions")
def get_analytics_questions(
    job_role: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = Query(None, pattern="^(easy|medium|hard)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    return get_question_analytics(db, job_role, topic, difficulty)

@router.get("/analytics/violations")
def get_analytics_violations(
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    return get_violation_analytics(db, session_id)

@router.get("/sessions", response_model=SessionListResponse)
def list_sessions(
    status: Optional[str] = Query(None, pattern="^(scheduled|in_progress|completed|expired)$"),
    eligibility: Optional[str] = Query(None, pattern="^(pending|auto_eligible|auto_blocked|manager_overridden)$"),
    job_role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
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

        reason = None
        if s.status == "completed":
            reason = None
        elif s.status == "in_progress":
            reason = "Assessment in progress"
        elif s.status == "expired":
            reason = "Link expired - assessment not attempted" if not s.started_at else "Session expired while in progress"
        elif s.status == "scheduled":
            if s.allowed_until and now() > s.allowed_until:
                reason = "Link expired - assessment not attempted"
            else:
                reason = "Not yet started"

        violation_count = db.query(ProctorEvent).filter(ProctorEvent.session_id == s.id).count()

        items.append(SessionListItem(
            session_id=s.id,
            candidate_id=candidate.id if candidate else None,
            access_token=s.access_token,
            candidate_name=candidate.name if candidate else "Unknown",
            candidate_email=candidate.email if candidate else "Unknown",
            template_name=template.name if template else "Unknown",
            job_role=template.role if template else "Unknown",
            status=s.status,
            total_score=s.total_score,
            integrity_score=s.integrity_score,
            cheating_risk=s.cheating_risk,
            eligibility=s.eligibility,
            reason=reason,
            violation_count=violation_count,
            started_at=s.started_at,
            finished_at=s.finished_at,
            created_at=s.created_at
        ))

    return SessionListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=items
    )

@router.get("/sessions/export")
def export_sessions(
    format: str = Query("csv", pattern="^(csv|json)$"),
    status: Optional[str] = Query(None, pattern="^(scheduled|in_progress|completed|expired)$"),
    eligibility: Optional[str] = Query(None, pattern="^(pending|auto_eligible|auto_blocked|manager_overridden)$"),
    job_role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    filters = {}
    if status:
        filters["status"] = status
    if eligibility:
        filters["eligibility"] = eligibility
    if job_role:
        filters["job_role"] = job_role
    if search:
        filters["search"] = search

    result = export_sessions_data(db, filters, format)

    return Response(
        content=result["data"],
        media_type=result["content_type"],
        headers={"Content-Disposition": f"attachment; filename={result['filename']}"}
    )

@router.get("/sessions/by-token/{access_token}", response_model=SessionDetailResponse)
def get_session_by_token(
    access_token: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(
        AssessmentSession.access_token == access_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = session.candidate
    template = session.template

    return SessionDetailResponse(
        id=session.id,
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
        started_at=session.started_at,
        finished_at=session.finished_at,
        allowed_from=session.allowed_from,
        allowed_until=session.allowed_until
    )

@router.get("/sessions/{session_id}")
def get_session_details(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = session.candidate
    template = session.template

    return {
        "id": session.id,
        "access_token": session.access_token,
        "candidate_name": candidate.name if candidate else "Unknown",
        "candidate_email": candidate.email if candidate else "Unknown",
        "template_name": template.name if template else "Unknown",
        "job_role": template.role if template else "Unknown",
        "status": session.status,
        "total_score": session.total_score,
        "integrity_score": session.integrity_score,
        "cheating_risk": session.cheating_risk,
        "eligibility": session.eligibility,
        "started_at": session.started_at,
        "finished_at": session.finished_at,
        "allowed_from": session.allowed_from,
        "allowed_until": session.allowed_until
    }

@router.post("/sessions/{session_id}/resend-email", response_model=ResendEmailResponse)
def resend_session_email(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status not in ["scheduled", "in_progress"]:
        raise HTTPException(status_code=400, detail="Cannot resend email for a completed or expired session")

    candidate = session.candidate
    template = session.template

    if not candidate or not template:
        raise HTTPException(status_code=404, detail="Candidate or template not found")

    deadline_str = session.allowed_until.strftime("%Y-%m-%d %H:%M IST") if session.allowed_until else None

    email_sent = send_assessment_email(
        to_email=candidate.email,
        candidate_name=candidate.name,
        access_token=session.access_token,
        deadline_str=deadline_str,
        job_role=template.role
    )

    return ResendEmailResponse(
        success=email_sent,
        message="Email sent successfully" if email_sent else "Failed to send email"
    )

@router.delete("/sessions/{session_id}", response_model=DeleteSessionResponse)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "in_progress":
        raise HTTPException(status_code=400, detail="Cannot delete an in-progress session")

    db.delete(session)
    db.commit()

    return DeleteSessionResponse(
        message="Session deleted successfully",
        deleted=True
    )

@router.post("/sessions/{session_id}/override", response_model=OverrideResponse)
def override_eligibility(
    session_id: int,
    data: OverrideRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    if data.eligibility not in ["manager_overridden", "auto_blocked"]:
        raise HTTPException(status_code=400, detail="Invalid eligibility value")

    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "completed":
        raise HTTPException(status_code=400, detail=f"Cannot override a session in '{session.status}' state. Assessment must be completed first.")

    session.eligibility = data.eligibility
    session.override_reason = data.override_reason
    session.overridden_by = user.id
    session.overridden_at = now()
    db.commit()
    db.refresh(session)

    write_audit_log(
        db,
        user.id,
        f"/api/manager/sessions/{session_id}/override",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"session_id": session.id, "eligibility": data.eligibility}
    )
    db.commit()

    return OverrideResponse(
        session_id=session.id,
        eligibility=session.eligibility,
        override_reason=session.override_reason,
        overridden_by=user.email,
        overridden_at=session.overridden_at,
        message="Eligibility overridden successfully"
    )

@router.get("/candidates/eligible-shortlist", response_model=EligibleShortlistResponse)
def get_eligible_shortlist(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    sessions = db.query(AssessmentSession).filter(
        AssessmentSession.eligibility.in_(["auto_eligible", "manager_overridden"]),
        AssessmentSession.status == "completed"
    ).all()

    items = []
    for session in sessions:
        candidate = session.candidate
        template = session.template
        if candidate:
            items.append(EligibleCandidateResponse(
                session_id=session.id,
                access_token=session.access_token,
                candidate_id=candidate.id,
                candidate_name=candidate.name,
                candidate_email=candidate.email,
                candidate_phone=candidate.phone,
                job_role=template.role if template else "Unknown",
                ats_score=candidate.ats_score,
                total_score=session.total_score or 0,
                integrity_score=session.integrity_score or 0,
                cheating_risk=session.cheating_risk or "clean",
                eligibility=session.eligibility,
                template_name=template.name if template else "Unknown",
                started_at=session.started_at,
                finished_at=session.finished_at
            ))

    return EligibleShortlistResponse(
        total=len(items),
        items=items
    )

@router.get("/candidates/{candidate_id}/report")
def get_candidate_report(
    candidate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    sessions = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate_id
    ).all()

    all_violations = []
    for session in sessions:
        violations = db.query(ProctorEvent).filter(
            ProctorEvent.session_id == session.id
        ).all()
        all_violations.extend(violations)

    answers = db.query(Answer).join(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate_id
    ).all()

    result = {
        "candidate": {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "ats_score": candidate.ats_score,
            "shortlisted": candidate.shortlisted,
            "job_role": candidate.job_role_threshold.job_role_name if candidate.job_role_threshold else None,
        },
        "sessions": [
            {
                "id": s.id,
                "access_token": s.access_token,
                "status": s.status,
                "total_score": s.total_score,
                "integrity_score": s.integrity_score,
                "cheating_risk": s.cheating_risk,
                "eligibility": s.eligibility,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            }
            for s in sessions
        ],
        "answers": [
            {
                "question_id": a.question_id,
                "answer_data": a.answer_data,
                "is_correct": a.is_correct,
                "auto_score": a.auto_score,
            }
            for a in answers
        ],
        "violations": [
            {
                "type": v.event_type.value if hasattr(v.event_type, 'value') else str(v.event_type),
                "severity": v.severity.value if hasattr(v.severity, 'value') else str(v.severity),
                "timestamp": v.timestamp.isoformat() if v.timestamp else None,
                "snapshot_url": v.snapshot_url,
                "clip_url": v.clip_url,
            }
            for v in all_violations
        ],
        "violation_summary": {
            "total": len(all_violations),
            "critical": sum(1 for v in all_violations if hasattr(v.severity, 'value') and v.severity.value == "critical"),
            "high": sum(1 for v in all_violations if hasattr(v.severity, 'value') and v.severity.value == "high"),
            "medium": sum(1 for v in all_violations if hasattr(v.severity, 'value') and v.severity.value == "medium"),
            "low": sum(1 for v in all_violations if hasattr(v.severity, 'value') and v.severity.value == "low"),
        }
    }

    return result

@router.get("/candidates/{candidate_id}/export")
def export_candidate(
    candidate_id: int,
    format: str = Query("json", pattern="^(json|csv|pdf)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    result = export_candidate_data(db, candidate_id, format)

    return Response(
        content=result["data"],
        media_type=result["content_type"],
        headers={"Content-Disposition": f"attachment; filename={result['filename']}"}
    )

@router.get("/candidates/export")
def export_candidates(
    format: str = Query("csv", pattern="^(csv|json)$"),
    job_role: Optional[str] = None,
    shortlisted: Optional[bool] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    filters = {}
    if job_role:
        filters["job_role"] = job_role
    if shortlisted is not None:
        filters["shortlisted"] = shortlisted
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    if search:
        filters["search"] = search

    result = export_bulk_candidates(db, filters, format)

    return Response(
        content=result["data"],
        media_type=result["content_type"],
        headers={"Content-Disposition": f"attachment; filename={result['filename']}"}
    )

@router.get("/sessions/{session_id}/violation-timeline", response_model=ViolationTimelineResponse)
def get_violation_timeline(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events = db.query(ProctorEvent).filter(
        ProctorEvent.session_id == session_id
    ).order_by(ProctorEvent.timestamp).all()

    violations = []
    for event in events:
        time_offset = None
        if session.started_at:
            time_offset = (event.timestamp - session.started_at).total_seconds()

        violations.append(ViolationTimelineItem(
            id=event.id,
            timestamp=event.timestamp,
            event_type=event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
            severity=event.severity.value if hasattr(event.severity, 'value') else str(event.severity),
            snapshot_url=event.snapshot_url,
            clip_url=event.clip_url,
            time=time_offset if time_offset and time_offset > 0 else 0
        ))

    duration = None
    if session.started_at and session.finished_at:
        duration = (session.finished_at - session.started_at).total_seconds()

    return ViolationTimelineResponse(
        violations=violations,
        duration=duration
    )