from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ..models.assessment import (
    AssessmentSession,
    AssessmentTemplate,
    Answer,
    QuestionBank,
    SessionQuestion,
)
from ..models.candidate import Candidate
from .code_executor import execute_code
from .email_service import send_rejection_email, send_shortlist_email
from .proctor_service import calculate_integrity_score

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _get_section_weight(sections_config: dict, section_id: str) -> float:
    if not sections_config:
        return 1.0
    sections = sections_config.get("sections", [])
    for section in sections:
        if section.get("id") == section_id:
            return float(section.get("weight", 1.0))
    return 1.0

def evaluate_session(db: Session, session: AssessmentSession) -> Dict[str, Any]:
    if session.eligibility != "pending":
        return {
            "session_id": session.id,
            "total_score": session.total_score,
            "integrity_score": session.integrity_score,
            "cheating_risk": session.cheating_risk,
            "eligibility": session.eligibility,
            "message": "Already evaluated"
        }

    calculate_integrity_score(db, session.id)
    db.refresh(session)

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == session.template_id
    ).first()

    answers = db.query(Answer).filter(Answer.session_id == session.id).all()

    if not template or not answers:
        session.total_score = 0.0
        session.eligibility = "auto_blocked"
        db.commit()
        return {
            "session_id": session.id,
            "total_score": 0.0,
            "integrity_score": session.integrity_score,
            "eligibility": "auto_blocked"
        }

    pinned_questions = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id
    ).all()
    total_pinned = len(pinned_questions)

    if total_pinned == 0:
        session.total_score = 0.0
        session.eligibility = "auto_blocked"
        db.commit()
        return {
            "session_id": session.id,
            "total_score": 0.0,
            "integrity_score": session.integrity_score,
            "eligibility": "auto_blocked"
        }

    answer_map = {ans.question_id: ans for ans in answers}
    question_ids = [sq.question_id for sq in pinned_questions]
    questions = db.query(QuestionBank).filter(
        QuestionBank.id.in_(question_ids)
    ).all()
    question_map = {q.id: q for q in questions}
    sections_config = template.sections_config or {}

    total_weight = 0.0
    weighted_score = 0.0

    for sq in pinned_questions:
        weight = _get_section_weight(sections_config, sq.section_id)
        total_weight += weight
        
        ans = answer_map.get(sq.question_id)
        question = question_map.get(sq.question_id)

        if not question or not ans:
            weighted_score += 0.0
            continue

        ans.is_correct = False
        ans.auto_score = 0.0

        if question.type == "MCQ":
            submitted = (ans.answer_data or {}).get("answer", "")
            if submitted and submitted == question.correct_answer:
                ans.is_correct = True
                ans.auto_score = 1.0
            weighted_score += ans.auto_score * weight

        elif question.type == "CODING":
            submitted_code = (ans.answer_data or {}).get("code", "")
            
            if submitted_code.strip():
                hidden_cases = question.hidden_test_cases or []
                
                if hidden_cases:
                    language = getattr(question, "language", "python") or "python"
                    try:
                        result = execute_code(
                            code=submitted_code,
                            language=language,
                            test_cases=hidden_cases,
                        )
                        passed_count = result.get("passed_count", 0)
                        total_cases = result.get("total", len(hidden_cases))
                        
                        if total_cases > 0:
                            ans.auto_score = passed_count / total_cases
                            if ans.auto_score >= 0.5:
                                ans.is_correct = True
                    except Exception as e:
                        ans.auto_score = 0.0
                        ans.is_correct = False
                else:
                    public_cases = question.public_test_cases or []
                    if public_cases:
                        language = getattr(question, "language", "python") or "python"
                        try:
                            result = execute_code(
                                code=submitted_code,
                                language=language,
                                test_cases=public_cases,
                            )
                            if result.get("passed", False):
                                ans.auto_score = 1.0
                                ans.is_correct = True
                            else:
                                ans.auto_score = 0.0
                                ans.is_correct = False
                        except Exception as e:
                            ans.auto_score = 0.0
                            ans.is_correct = False
                    else:
                        if len(submitted_code.strip()) > 50:
                            ans.auto_score = 0.5
                            ans.is_correct = False
                        else:
                            ans.auto_score = 0.0
                            ans.is_correct = False
            else:
                ans.auto_score = 0.0
                ans.is_correct = False
            
            weighted_score += ans.auto_score * weight

    total_score = (weighted_score / total_weight * 100) if total_weight > 0 else 0.0
    session.total_score = round(total_score, 2)

    db.commit()

    if session.total_score >= template.pass_threshold:
        session.eligibility = "auto_eligible"
    else:
        session.eligibility = "auto_blocked"
    
    db.commit()

    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if candidate and candidate.email:
        try:
            if session.eligibility == "auto_eligible":
                send_shortlist_email(
                    candidate.email,
                    candidate.name or "Candidate",
                    template.role or "the position",
                    session.total_score,
                    session.integrity_score
                )
            else:
                send_rejection_email(
                    candidate.email,
                    candidate.name or "Candidate",
                    template.role or "the position",
                    session.total_score,
                    session.integrity_score
                )
        except Exception as e:
            print(f"[EMAIL ERROR] {e}")

    return {
        "session_id": session.id,
        "total_score": session.total_score,
        "integrity_score": session.integrity_score,
        "cheating_risk": session.cheating_risk,
        "eligibility": session.eligibility
    }