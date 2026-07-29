from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid
from ..models.candidate import Candidate
from ..models.job_role import JobRoleThreshold
from ..models.assessment import AssessmentSession, AssessmentTemplate
from .email_service import send_assessment_email
from ..config import settings
from sqlalchemy.exc import IntegrityError

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def check_ats_and_shortlist(
    db: Session,
    candidate_id: int,
    ats_score: float,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Dict[str, Any]:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate with id {candidate_id} not found")

    candidate.ats_score = ats_score

    threshold = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == candidate.job_role_id
    ).first()

    if not threshold:
        default_threshold = getattr(settings, 'DEFAULT_ATS_THRESHOLD', 70.0)
        
        threshold = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.job_role_name == "Default"
        ).first()
        
        if not threshold:
            try:
                threshold = JobRoleThreshold(
                    job_role_name="Default",
                    ats_threshold=default_threshold
                )
                db.add(threshold)
                db.flush()
            except IntegrityError:
                db.rollback()
                threshold = db.query(JobRoleThreshold).filter(
                    JobRoleThreshold.job_role_name == "Default"
                ).first()
                if not threshold:
                    raise ValueError("Failed to create or find Default threshold")
        
        candidate.job_role_id = threshold.id

    if ats_score < threshold.ats_threshold:
        candidate.shortlisted = False
        db.commit()
        return {
            "candidate_id": candidate.id,
            "ats_score": ats_score,
            "threshold": threshold.ats_threshold,
            "shortlisted": False,
            "session_created": False,
            "message": f"ATS score {ats_score} below threshold {threshold.ats_threshold}",
            "eligibility": "blocked"
        }

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.job_role_id == threshold.id,
        AssessmentTemplate.is_active == True
    ).first()

    if not template:
        raise ValueError(
            f"No active assessment template found for role '{threshold.job_role_name}'. "
            f"Please create one first."
        )

    existing_session = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate.id,
        AssessmentSession.status.in_(["scheduled", "in_progress"])
    ).first()

    if existing_session:
        candidate.shortlisted = True
        db.commit()
        return {
            "candidate_id": candidate.id,
            "ats_score": ats_score,
            "threshold": threshold.ats_threshold,
            "shortlisted": True,
            "session_created": False,
            "message": "Candidate already has an active assessment session",
            "access_token": existing_session.access_token,
            "session_id": existing_session.id,
            "template_name": template.name,
            "eligibility": existing_session.eligibility
        }

    now_time = now()
    access_days = getattr(settings, 'ASSESSMENT_ACCESS_DAYS', 3)
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
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session)
    db.flush()

    try:
        from ..services.exam_service import select_and_pin_questions
        select_and_pin_questions(db, session, template)
    except Exception as e:
        print(f"[WARNING] Failed to pin questions: {e}")

    db.commit()
    db.refresh(session)

    email_sent = False
    try:
        candidate_name = candidate.name or "Candidate"
        deadline_str = session.allowed_until.strftime("%Y-%m-%d %H:%M IST")
        email_sent = send_assessment_email(
            to_email=candidate.email,
            candidate_name=candidate_name,
            access_token=session.access_token,
            deadline_str=deadline_str,
            job_role=threshold.job_role_name
        )
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send assessment email: {e}")

    candidate.shortlisted = True
    candidate.shortlisted_at = now()
    db.commit()
    db.refresh(session)

    return {
        "candidate_id": candidate.id,
        "ats_score": ats_score,
        "threshold": threshold.ats_threshold,
        "shortlisted": True,
        "session_created": True,
        "email_sent": email_sent,
        "message": "Candidate shortlisted. Assessment session created." + 
                   (" Email sent." if email_sent else " Email failed - please resend manually."),
        "access_token": session.access_token,
        "session_id": session.id,
        "template_name": template.name,
        "eligibility": session.eligibility
    }