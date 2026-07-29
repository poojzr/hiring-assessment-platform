import asyncio
import random
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from ..models.assessment import (
    AssessmentSession,
    AssessmentTemplate,
    QuestionBank,
    Answer,
    SessionQuestion,
)
from ..models.job_role import JobRoleThreshold
from ..config import settings
from ..utils.rate_limiter import get_redis_client
from ..database import SessionLocal

SUBMISSION_GRACE_SECONDS = 60

_executor = ThreadPoolExecutor(max_workers=4)
_background_task = None
_redis_client = get_redis_client() if settings.redis_enabled else None
_in_memory_eval_locks = {}
_eval_lock_mutex = threading.Lock()

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _get_evaluation_lock_key(session_id: int) -> str:
    return f"eval_lock:{session_id}"

def _acquire_evaluation_lock(session_id: int) -> bool:
    if _redis_client:
        try:
            lock_key = _get_evaluation_lock_key(session_id)
            result = _redis_client.set(lock_key, "1", nx=True, ex=600)
            return result is True
        except Exception as e:
            print(f"[EvalLock] Redis error: {e}, falling back to in-memory")
    
    with _eval_lock_mutex:
        if session_id in _in_memory_eval_locks:
            return False
        _in_memory_eval_locks[session_id] = time.time()
        return True

def _release_evaluation_lock(session_id: int) -> None:
    if _redis_client:
        try:
            lock_key = _get_evaluation_lock_key(session_id)
            _redis_client.delete(lock_key)
        except Exception as e:
            print(f"[EvalLock] Redis delete error: {e}")
    
    with _eval_lock_mutex:
        _in_memory_eval_locks.pop(session_id, None)

def _run_evaluation_with_lock(db: Session, session: AssessmentSession) -> bool:
    from .evaluation_service import evaluate_session
    
    if not _acquire_evaluation_lock(session.id):
        print(f"[EvalLock] Session {session.id} already being evaluated by another worker")
        return False
    
    try:
        db.refresh(session)
        if session.eligibility != "pending":
            print(f"[EvalLock] Session {session.id} already evaluated (eligibility: {session.eligibility})")
            return False
        
        evaluate_session(db, session)
        db.refresh(session)
        return True
    except Exception as e:
        print(f"[EvalLock] Evaluation failed for session {session.id}: {e}")
        db.rollback()
        db.refresh(session)
        return False
    finally:
        _release_evaluation_lock(session.id)

async def start_section_deadline_monitor():
    global _background_task
    loop = asyncio.get_running_loop()
    _background_task = loop.create_task(_check_section_deadlines_loop())
    print("[SectionMonitor] Started")

async def _check_section_deadlines_loop():
    while True:
        try:
            await asyncio.sleep(5)
            
            db = SessionLocal()
            try:
                sessions = db.query(AssessmentSession).filter(
                    AssessmentSession.status == "in_progress",
                    AssessmentSession.section_deadlines.isnot(None)
                ).all()
                
                now_time = now()
                
                for session in sessions:
                    expired_section = await _check_and_expire_sections(db, session, now_time)
                    if expired_section:
                        lock_key = _get_section_lock_key(session.id, expired_section)
                        lock_acquired = await _try_acquire_lock(lock_key, ttl=120)
                        
                        if lock_acquired:
                            loop = asyncio.get_running_loop()
                            await loop.run_in_executor(
                                _executor,
                                _auto_submit_section_sync,
                                session.id,
                                expired_section
                            )
                        else:
                            print(f"[SectionMonitor] Lock not acquired for session {session.id}, section {expired_section}")
                        
            finally:
                db.close()
                
        except Exception as e:
            print(f"[SectionMonitor] Error: {e}")

async def _check_and_expire_sections(db: Session, session: AssessmentSession, now_time: datetime) -> Optional[str]:
    if not session.section_deadlines:
        return None
    
    completed = session.completed_sections or {}
    
    for section_id, deadline_str in session.section_deadlines.items():
        if section_id.startswith("_"):
            continue
        if completed.get(section_id, False):
            continue
        
        try:
            deadline = datetime.fromisoformat(deadline_str)
            if now_time >= deadline:
                return section_id
        except (ValueError, TypeError):
            continue
    
    return None

def _get_section_lock_key(session_id: int, section_id: str) -> str:
    return f"section_lock:{session_id}:{section_id}"

async def _try_acquire_lock(lock_key: str, ttl: int = 120) -> bool:
    if not _redis_client:
        return True
    
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            _executor,
            lambda: _redis_client.set(lock_key, "1", nx=True, ex=ttl)
        )
        return result is True
    except Exception as e:
        print(f"[Lock] Error acquiring lock {lock_key}: {e}")
        return False

def _auto_submit_section_sync(session_id: int, section_id: str):
    db = SessionLocal()
    lock_key = _get_section_lock_key(session_id, section_id)
    
    try:
        session = db.query(AssessmentSession).filter(
            AssessmentSession.id == session_id
        ).first()
        
        if not session:
            print(f"[SectionMonitor] Session {session_id} not found")
            return
        
        if session.status == "completed":
            print(f"[SectionMonitor] Session {session_id} already completed")
            return
        
        if session.completed_sections is None:
            session.completed_sections = {}
        session.completed_sections[section_id] = True
        
        all_sections = [k for k in (session.section_deadlines or {}).keys() if not k.startswith("_")]
        all_completed = all(session.completed_sections.get(s, False) for s in all_sections)
        
        if all_completed:
            session.status = "completed"
            session.finished_at = now()
            db.commit()
            
            print(f"[SectionMonitor] Session {session.id} fully completed, running evaluation")
            _run_evaluation_with_lock(db, session)
        else:
            db.commit()
            print(f"[SectionMonitor] Session {session.id}, section {section_id} auto-submitted")
        
    finally:
        db.close()
        if _redis_client:
            try:
                _redis_client.delete(lock_key)
            except Exception:
                pass

async def start_evaluation_retry_monitor():
    loop = asyncio.get_running_loop()
    loop.create_task(_retry_pending_evaluations_loop())
    print("[EvaluationRetry] Started")

async def _retry_pending_evaluations_loop():
    while True:
        try:
            await asyncio.sleep(300)
            
            db = SessionLocal()
            try:
                pending_sessions = db.query(AssessmentSession).filter(
                    AssessmentSession.status == "completed",
                    AssessmentSession.eligibility == "pending"
                ).all()
                
                if pending_sessions:
                    print(f"[EvaluationRetry] Found {len(pending_sessions)} pending evaluations to retry")
                
                for session in pending_sessions:
                    try:
                        loop = asyncio.get_running_loop()
                        await loop.run_in_executor(
                            _executor,
                            _retry_single_evaluation_sync,
                            session.id
                        )
                        print(f"[EvaluationRetry] Successfully evaluated session {session.id}")
                    except Exception as e:
                        print(f"[EvaluationRetry] Failed to evaluate session {session.id}: {e}")
                        
            finally:
                db.close()
                
        except Exception as e:
            print(f"[EvaluationRetry] Error in retry loop: {e}")

def _retry_single_evaluation_sync(session_id: int):
    db = SessionLocal()
    try:
        session = db.query(AssessmentSession).filter(
            AssessmentSession.id == session_id
        ).first()
        
        if not session:
            print(f"[EvaluationRetry] Session {session_id} not found")
            return
        
        _run_evaluation_with_lock(db, session)
    finally:
        db.close()

def validate_session_access(db: Session, access_token: str) -> AssessmentSession:
    session = db.query(AssessmentSession).filter(
        AssessmentSession.access_token == access_token
    ).first()

    if not session:
        raise ValueError("Invalid or expired assessment token")

    if session.allowed_until and now() > session.allowed_until:
        session.status = "expired"
        db.commit()
        raise ValueError("Assessment window has expired")

    return session

def select_and_pin_questions(db: Session, session: AssessmentSession, template: AssessmentTemplate):
    sections_config = template.sections_config or {}
    sections = sections_config.get("sections", [])
    
    if not sections:
        print("[QuestionSelect] No sections found in template")
        return
    
    job_role = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == template.job_role_id
    ).first()
    
    job_role_name = job_role.job_role_name if job_role else None
    
    position = 0
    for section in sections:
        q_type = section.get("type", "MCQ")
        count = section.get("count", 5)
        topic = section.get("topic", "")
        difficulty_dist = section.get("difficulty_distribution", {"easy": 0.3, "medium": 0.5, "hard": 0.2})
        
        all_questions = db.query(QuestionBank).filter(
            QuestionBank.type == q_type,
            QuestionBank.is_active == True
        ).all()
        
        if not all_questions:
            print(f"[QuestionSelect] No questions found for type {q_type}")
            continue
        
        role_questions = []
        if job_role_name:
            role_questions = [q for q in all_questions if q.role == job_role_name or q.role is None or q.role == ""]
            print(f"[QuestionSelect] Found {len(role_questions)} questions with role '{job_role_name}' or no role")
        
        if topic and role_questions:
            topic_questions = [q for q in role_questions if q.topic == topic]
        elif topic:
            topic_questions = [q for q in all_questions if q.topic == topic]
        else:
            topic_questions = []
        
        if topic_questions:
            print(f"[QuestionSelect] Found {len(topic_questions)} questions with topic '{topic}'")
        
        easy_pool = [q for q in all_questions if q.difficulty == "easy"]
        medium_pool = [q for q in all_questions if q.difficulty == "medium"]
        hard_pool = [q for q in all_questions if q.difficulty == "hard"]
        
        easy_count = int(count * difficulty_dist.get("easy", 0.3))
        medium_count = int(count * difficulty_dist.get("medium", 0.5))
        hard_count = count - easy_count - medium_count
        
        selected = []
        
        if topic and topic_questions:
            easy_topic = [q for q in topic_questions if q.difficulty == "easy"]
            medium_topic = [q for q in topic_questions if q.difficulty == "medium"]
            hard_topic = [q for q in topic_questions if q.difficulty == "hard"]
            
            if easy_topic:
                selected.extend(random.sample(easy_topic, min(easy_count, len(easy_topic))))
            if medium_topic:
                selected.extend(random.sample(medium_topic, min(medium_count, len(medium_topic))))
            if hard_topic:
                selected.extend(random.sample(hard_topic, min(hard_count, len(hard_topic))))
            
            remaining_needed = count - len(selected)
            if remaining_needed > 0:
                remaining_topic = [q for q in topic_questions if q not in selected]
                if remaining_topic:
                    selected.extend(random.sample(remaining_topic, min(remaining_needed, len(remaining_topic))))
                    remaining_needed = count - len(selected)
            
            if remaining_needed > 0:
                if easy_pool:
                    selected.extend(random.sample(easy_pool, min(easy_count, len(easy_pool))))
                if medium_pool:
                    selected.extend(random.sample(medium_pool, min(medium_count, len(medium_pool))))
                if hard_pool:
                    selected.extend(random.sample(hard_pool, min(hard_count, len(hard_pool))))
                
                remaining_needed = count - len(selected)
                if remaining_needed > 0:
                    remaining_pool = [q for q in all_questions if q not in selected]
                    if remaining_pool:
                        selected.extend(random.sample(remaining_pool, min(remaining_needed, len(remaining_pool))))
        
        elif job_role_name and role_questions:
            easy_role = [q for q in role_questions if q.difficulty == "easy"]
            medium_role = [q for q in role_questions if q.difficulty == "medium"]
            hard_role = [q for q in role_questions if q.difficulty == "hard"]
            
            if easy_role:
                selected.extend(random.sample(easy_role, min(easy_count, len(easy_role))))
            if medium_role:
                selected.extend(random.sample(medium_role, min(medium_count, len(medium_role))))
            if hard_role:
                selected.extend(random.sample(hard_role, min(hard_count, len(hard_role))))
            
            remaining_needed = count - len(selected)
            if remaining_needed > 0:
                remaining_role = [q for q in role_questions if q not in selected]
                if remaining_role:
                    selected.extend(random.sample(remaining_role, min(remaining_needed, len(remaining_role))))
                    remaining_needed = count - len(selected)
            
            if remaining_needed > 0:
                if easy_pool:
                    selected.extend(random.sample(easy_pool, min(easy_count, len(easy_pool))))
                if medium_pool:
                    selected.extend(random.sample(medium_pool, min(medium_count, len(medium_pool))))
                if hard_pool:
                    selected.extend(random.sample(hard_pool, min(hard_count, len(hard_pool))))
                
                remaining_needed = count - len(selected)
                if remaining_needed > 0:
                    remaining_pool = [q for q in all_questions if q not in selected]
                    if remaining_pool:
                        selected.extend(random.sample(remaining_pool, min(remaining_needed, len(remaining_pool))))
        else:
            if easy_pool:
                selected.extend(random.sample(easy_pool, min(easy_count, len(easy_pool))))
            if medium_pool:
                selected.extend(random.sample(medium_pool, min(medium_count, len(medium_pool))))
            if hard_pool:
                selected.extend(random.sample(hard_pool, min(hard_count, len(hard_pool))))
            
            remaining_needed = count - len(selected)
            if remaining_needed > 0:
                remaining_pool = [q for q in all_questions if q not in selected]
                if remaining_pool:
                    selected.extend(random.sample(remaining_pool, min(remaining_needed, len(remaining_pool))))
        
        print(f"[QuestionSelect] Selected {len(selected)} questions for section {section.get('id')}")
        
        if not selected:
            print("[QuestionSelect] WARNING: No questions selected")
            continue
        
        for q in selected:
            db.add(SessionQuestion(
                session_id=session.id,
                question_id=q.id,
                section_id=section.get("id", f"section_{position}"),
                position=position
            ))
            position += 1
        
        db.flush()

def get_assessment_for_session(db: Session, session: AssessmentSession) -> dict:
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == session.template_id
    ).first()

    if not template:
        return {"error": "Assessment template not found"}

    if session.status == "completed":
        return {"error": "Assessment already submitted", "status": "completed"}

    if session.status == "expired":
        return {"error": "Assessment window expired", "status": "expired"}

    existing_pins = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id
    ).order_by(SessionQuestion.position).all()

    if existing_pins:
        question_ids = [sq.question_id for sq in existing_pins]
        questions = db.query(QuestionBank).filter(
            QuestionBank.id.in_(question_ids)
        ).all()
        q_map = {q.id: q for q in questions}
        ordered = [q_map[qid] for qid in question_ids if qid in q_map]
        serialized = [_serialize_question_public(q) for q in ordered if q]
    else:
        return {"error": "No questions found for this assessment"}

    job_role = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == template.job_role_id
    ).first()

    return {
        "access_token": session.access_token,
        "template_name": template.name,
        "job_role": job_role.job_role_name if job_role else "Unknown",
        "duration_minutes": template.duration_minutes,
        "pass_threshold": template.pass_threshold,
        "allowed_until": session.allowed_until.isoformat() if session.allowed_until else None,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "status": session.status,
        "questions": serialized
    }

def _serialize_question_public(q: QuestionBank) -> dict:
    return {
        "id": q.id,
        "type": q.type,
        "text": q.text,
        "description": q.description,
        "options": q.options,
        "topic": q.topic,
        "difficulty": q.difficulty,
        "language": q.language,
        "public_test_cases": q.public_test_cases if q.type == "CODING" else None,
    }

def start_assessment_session(db: Session, session: AssessmentSession) -> dict:
    now_time = now()

    if session.status == "completed":
        return {"error": "Assessment already completed"}

    if session.status == "expired":
        return {"error": "Assessment has expired"}

    if session.status == "in_progress":
        return {
            "status": "in_progress",
            "started_at": session.started_at,
            "message": "Assessment already in progress"
        }

    lock_key = f"start_lock:{session.id}"
    if _redis_client:
        try:
            acquired = _redis_client.set(lock_key, "1", nx=True, ex=60)
            if not acquired:
                return {"error": "Session is being started by another process"}
        except Exception:
            pass
    
    try:
        session.status = "in_progress"
        session.started_at = now_time

        template = db.query(AssessmentTemplate).filter(
            AssessmentTemplate.id == session.template_id
        ).first()

        if template and template.sections_config:
            sections = template.sections_config.get("sections", [])
            sections = sorted(sections, key=lambda s: s.get("order", 0))
            deadlines = {}
            current_time = now_time

            for section in sections:
                duration = section.get("duration_minutes", 30)
                current_time = current_time + timedelta(minutes=duration)
                deadlines[section.get("id")] = current_time.isoformat()

            session.section_deadlines = deadlines
            session.completed_sections = {}

        db.commit()
        db.refresh(session)
    finally:
        if _redis_client:
            try:
                _redis_client.delete(lock_key)
            except Exception:
                pass

    return {
        "status": session.status,
        "started_at": session.started_at,
        "section_deadlines": session.section_deadlines,
        "message": "Assessment started successfully"
    }

def upsert_answer(
    db: Session,
    session: AssessmentSession,
    question_id: int,
    answer_data: dict
) -> Answer:
    if session.status != "in_progress":
        raise ValueError("Cannot save answer: assessment is not in progress")
    
    pinned = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id,
        SessionQuestion.question_id == question_id
    ).first()
    if not pinned:
        raise ValueError(f"Question {question_id} is not part of this assessment")
    
    question = db.query(QuestionBank).filter(
        QuestionBank.id == question_id
    ).first()
    if not question:
        raise ValueError(f"Question {question_id} not found")
    
    existing = db.query(Answer).filter(
        Answer.session_id == session.id,
        Answer.question_id == question_id
    ).first()
    
    if existing:
        existing.answer_data = answer_data
        existing.section_id = pinned.section_id
        existing.updated_at = now()
        answer = existing
    else:
        answer = Answer(
            session_id=session.id,
            question_id=question_id,
            section_id=pinned.section_id,
            answer_data=answer_data,
        )
        db.add(answer)
    
    db.commit()
    return answer

def submit_assessment_answers(
    db: Session,
    session: AssessmentSession,
    answers: List[Dict[str, Any]]
) -> dict:
    now_time = now()

    if session.status == "completed":
        return {"error": "Assessment already submitted"}

    if session.status != "in_progress":
        return {"error": "Assessment has not been started. Please start before submitting."}

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == session.template_id
    ).first()

    if session.started_at and template:
        duration_seconds = (template.duration_minutes or 60) * 60
        deadline = session.started_at + timedelta(seconds=duration_seconds + SUBMISSION_GRACE_SECONDS)

        if now_time > deadline:
            session.status = "expired"
            db.commit()
            return {"error": "Time limit exceeded. Assessment expired."}

    pinned = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id
    ).all()
    pinned_ids = {sq.question_id for sq in pinned}
    pinned_section_map = {sq.question_id: sq.section_id for sq in pinned}

    seen_question_ids = set()
    for ans in answers:
        qid = ans.get("question_id")
        if not qid:
            return {"error": "Missing question_id in answer"}

        if qid in seen_question_ids:
            return {"error": f"Duplicate answer submitted for question {qid}"}
        seen_question_ids.add(qid)

        if qid not in pinned_ids:
            return {"error": f"Question {qid} was not part of this assessment"}

    pinned_questions = db.query(QuestionBank).filter(
        QuestionBank.id.in_(pinned_ids)
    ).all()
    question_map = {q.id: q for q in pinned_questions}

    for ans in answers:
        question = question_map.get(ans["question_id"])
        if not question:
            continue

        answer_data = ans.get("answer_data", {})
        if question.type == "MCQ":
            valid_keys = list((question.options or {}).keys())
            submitted_answer = answer_data.get("answer", "")
            if submitted_answer not in valid_keys:
                return {
                    "error": f"Invalid answer '{submitted_answer}' for question "
                             f"{question.id}. Valid options: {', '.join(valid_keys)}"
                }
        elif question.type == "CODING":
            pass

    try:
        for ans in answers:
            question_id = ans["question_id"]
            section_id = pinned_section_map.get(question_id, "unknown")
            
            existing = db.query(Answer).filter(
                Answer.session_id == session.id,
                Answer.question_id == question_id
            ).first()
            
            if existing:
                existing.answer_data = ans["answer_data"]
                existing.section_id = section_id
                existing.updated_at = now()
            else:
                db.add(Answer(
                    session_id=session.id,
                    question_id=question_id,
                    section_id=section_id,
                    answer_data=ans["answer_data"],
                ))

        session.status = "completed"
        session.finished_at = now_time
        db.commit()
        db.refresh(session)
    except Exception:
        db.rollback()
        raise

    evaluation_success = False
    try:
        evaluation_success = _run_evaluation_with_lock(db, session)
        db.refresh(session)
    except Exception as e:
        print(f"[EVAL ERROR] Evaluation failed for session {session.id}: {e}")
        evaluation_success = False

    return {
        "access_token": session.access_token,
        "status": session.status,
        "total_score": session.total_score,
        "integrity_score": session.integrity_score,
        "cheating_risk": session.cheating_risk,
        "eligibility": session.eligibility,
        "evaluation_success": evaluation_success,
        "message": "Assessment submitted successfully" + 
                   (" Evaluation completed." if evaluation_success else " Evaluation pending - will retry within 5 minutes.")
    }

def get_current_section(session: AssessmentSession) -> str:
    if not session.section_deadlines:
        return "section_1"
    
    completed = session.completed_sections or {}
    now_time = now()
    
    sorted_sections = sorted(
        [(k, v) for k, v in session.section_deadlines.items() if not k.startswith("_")],
        key=lambda x: x[1]
    )
    
    for section_id, deadline_str in sorted_sections:
        if completed.get(section_id, False):
            continue
        try:
            deadline = datetime.fromisoformat(deadline_str)
            if now_time < deadline:
                return section_id
        except (ValueError, TypeError):
            continue
    
    return "completed"

def is_section_completed(session: AssessmentSession, section_id: str) -> bool:
    completed = session.completed_sections or {}
    return completed.get(section_id, False)