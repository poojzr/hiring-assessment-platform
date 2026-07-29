from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from ..models.assessment import (
    AssessmentSession,
    AssessmentTemplate,
    QuestionBank,
    SessionQuestion,
    Answer,
)

from ..models.job_role import JobRoleThreshold
from ..models.proctoring import ProctorEvent


def get_session_analytics(db: Session, job_role: str = None) -> dict:
    query = db.query(AssessmentSession)
    
    if job_role:
        threshold = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.job_role_name == job_role
        ).first()
        if threshold:
            query = query.join(AssessmentSession.template).filter(
                AssessmentTemplate.job_role_id == threshold.id
            )
    
    total = query.count()
    completed = query.filter(AssessmentSession.status == "completed").count()
    
    eligible_count = query.filter(
        AssessmentSession.status == "completed",
        AssessmentSession.eligibility == "auto_eligible"
    ).count()
    
    return {
        "total_sessions": total,
        "completed": completed,
        "completion_rate": (completed / total * 100) if total > 0 else 0,
        "pass_rate": (eligible_count / completed * 100) if completed > 0 else 0,
    }


def get_violation_analytics(db: Session, session_id: int = None) -> dict:
    query = db.query(ProctorEvent)
    
    if session_id:
        query = query.filter(ProctorEvent.session_id == session_id)
    
    total = query.count()
    
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    type_counts = {}
    
    for event in query.all():
        severity_counts[event.severity.value] = severity_counts.get(event.severity.value, 0) + 1
        type_counts[event.event_type.value] = type_counts.get(event.event_type.value, 0) + 1
    
    return {
        "total_violations": total,
        "by_severity": severity_counts,
        "by_type": type_counts,
    }


def get_question_analytics(db: Session, job_role: str = None, topic: str = None, difficulty: str = None) -> list:
    query = db.query(QuestionBank).filter(QuestionBank.is_active == True)

    if job_role:
        query = query.filter(
            (QuestionBank.role == job_role) |
            (QuestionBank.role.is_(None))
        )
    if topic:
        query = query.filter(QuestionBank.topic == topic)
    if difficulty:
        query = query.filter(QuestionBank.difficulty == difficulty)

    questions = query.all()
    results = []

    for q in questions:
        usage_count = db.query(SessionQuestion).filter(
            SessionQuestion.question_id == q.id
        ).count()

        answers = db.query(Answer).filter(Answer.question_id == q.id).all()
        answered_count = len(answers)
        evaluated = [a for a in answers if a.is_correct is not None]

        if evaluated:
            correct = sum(1 for a in evaluated if a.is_correct)
            pass_rate = round((correct / len(evaluated)) * 100, 2)
        else:
            pass_rate = None

        flags = []
        if pass_rate is not None:
            if pass_rate < 20:
                flags.append("too_hard")
            elif pass_rate > 90:
                flags.append("too_easy")

        results.append({
            "question_id": q.id,
            "text": q.text[:100] + "..." if len(q.text) > 100 else q.text,
            "type": q.type,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "job_role": q.role,
            "total_uses": usage_count,
            "answered_count": answered_count,
            "evaluated_count": len(evaluated),
            "pass_rate": pass_rate,
            "flags": flags,
        })

    return results