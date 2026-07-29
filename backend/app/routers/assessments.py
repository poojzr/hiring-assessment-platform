from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import random
import base64

from app.database import get_db
from app.models.assessment import AssessmentSession, QuestionBank, SessionQuestion, Answer
from app.models.user import User
from app.models.candidate import Candidate
from app.models.otp import OTP
from app.models.reference_photo import ReferencePhoto
from app.models.recording import Recording
from app.services.code_executor import execute_code
from app.services.email_service import send_otp_via_email
from app.services.storage_service import save_snapshot, save_recording_chunk
from app.utils.auth import get_current_user_optional, get_client_ip

router = APIRouter(prefix="/assessments", tags=["assessments"])

DEFAULT_CODING_LANGUAGES = ["python", "java", "cpp", "javascript"]

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

class AnswerSubmit(BaseModel):
    question_id: int
    answer_data: dict

class SubmitRequest(BaseModel):
    answers: List[AnswerSubmit]

class RunCodeRequest(BaseModel):
    question_id: int
    code: str
    language: str = "python"

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp_code: str

class CapturePhotoRequest(BaseModel):
    photo: str

class AssessmentQuestionPublic(BaseModel):
    id: int
    type: str
    text: str
    options: Optional[dict] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    language: Optional[str] = None
    supported_languages: Optional[List[str]] = None
    allow_language_choice: bool = False

class AssessmentStartResponse(BaseModel):
    access_token: str
    session_id: int
    template_name: str
    job_role: str
    duration_minutes: int
    pass_threshold: float
    status: str
    sections_config: Optional[dict] = None
    questions: List[AssessmentQuestionPublic]
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None

class SubmitResponse(BaseModel):
    access_token: str
    status: str
    total_score: Optional[float] = None
    integrity_score: Optional[float] = None
    eligibility: Optional[str] = None
    message: str

class VerificationStatusResponse(BaseModel):
    email_verified: bool
    photo_captured: bool

class AssessmentStatusResponse(BaseModel):
    status: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    total_score: Optional[float]
    integrity_score: Optional[float]
    eligibility: Optional[str]

def get_session_by_token(db: Session, access_token: str) -> AssessmentSession:
    session = db.query(AssessmentSession).filter(
        AssessmentSession.access_token == access_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/{access_token}", response_model=AssessmentStartResponse)
def get_assessment(
    access_token: str,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status == "completed":
        raise HTTPException(status_code=403, detail="Assessment already completed")

    if session.status == "expired":
        raise HTTPException(status_code=403, detail="Assessment expired")

    now_time = now()
    if session.allowed_from and now_time < session.allowed_from:
        raise HTTPException(
            status_code=403,
            detail=f"Assessment not yet available. Opens at: {session.allowed_from}"
        )

    if session.allowed_until and now_time > session.allowed_until:
        session.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Assessment window has expired")

    template = session.template
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    session_questions = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id
    ).order_by(SessionQuestion.position).all()

    question_ids = [sq.question_id for sq in session_questions]
    questions = db.query(QuestionBank).filter(QuestionBank.id.in_(question_ids)).all()
    question_map = {q.id: q for q in questions}

    public_questions = []
    for sq in session_questions:
        q = question_map.get(sq.question_id)
        if q:
            supported_languages = q.supported_languages
            if not supported_languages:
                if q.language:
                    supported_languages = [q.language]
                elif q.type == "CODING":
                    supported_languages = DEFAULT_CODING_LANGUAGES

            allow_language_choice = bool(q.allow_language_choice)
            if q.type == "CODING" and supported_languages and len(supported_languages) > 1:
                allow_language_choice = True

            public_questions.append(
                AssessmentQuestionPublic(
                    id=q.id,
                    type=q.type,
                    text=q.text,
                    options=q.options,
                    topic=q.topic,
                    difficulty=q.difficulty,
                    language=q.language,
                    supported_languages=supported_languages,
                    allow_language_choice=allow_language_choice
                )
            )

    candidate_name = None
    candidate_email = None
    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if candidate:
        candidate_name = candidate.name
        candidate_email = candidate.email

    return AssessmentStartResponse(
        access_token=session.access_token,
        session_id=session.id,
        template_name=template.name,
        job_role=template.role,
        duration_minutes=template.duration_minutes,
        pass_threshold=template.pass_threshold,
        status=session.status,
        sections_config=template.sections_config,
        questions=public_questions,
        candidate_name=candidate_name,
        candidate_email=candidate_email
    )

@router.post("/{access_token}/send-otp")
def send_otp_endpoint(
    access_token: str,
    data: SendOTPRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status == "completed":
        raise HTTPException(status_code=403, detail="Assessment already completed")

    if session.status == "expired":
        raise HTTPException(status_code=403, detail="Assessment has expired")

    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if data.email != candidate.email:
        raise HTTPException(status_code=400, detail="Email does not match candidate record")

    otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = now() + timedelta(minutes=5)

    existing_otp = db.query(OTP).filter(
        OTP.user_id == candidate.user_id,
        OTP.used == False
    ).first()
    if existing_otp:
        db.delete(existing_otp)
        db.commit()

    otp = OTP(
        user_id=candidate.user_id,
        otp_code=otp_code,
        expires_at=expires_at,
        used=False,
    )
    db.add(otp)
    db.commit()

    try:
        send_otp_via_email(candidate.email, otp_code)
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")

    return {"message": "OTP sent successfully", "expires_in": 5}

@router.post("/{access_token}/verify-otp")
def verify_otp_endpoint(
    access_token: str,
    data: VerifyOTPRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if data.email != candidate.email:
        raise HTTPException(status_code=400, detail="Email does not match candidate record")

    otp = db.query(OTP).filter(
        OTP.user_id == candidate.user_id,
        OTP.otp_code == data.otp_code,
        OTP.used == False
    ).first()

    if not otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if otp.expires_at < now():
        raise HTTPException(status_code=400, detail="OTP has expired")

    otp.used = True
    db.commit()

    return {"verified": True, "message": "OTP verified successfully"}

@router.post("/{access_token}/capture-photo")
def capture_photo_endpoint(
    access_token: str,
    data: CapturePhotoRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    photo_data = data.photo
    if photo_data.startswith('data:image'):
        photo_data = photo_data.split(',')[1]

    image_bytes = base64.b64decode(photo_data)

    photo_url = save_snapshot(
        session.id,
        image_bytes,
        f"candidate_photo_{candidate.id}"
    )

    reference_photo = ReferencePhoto(
        candidate_id=candidate.id,
        session_id=session.id,
        photo_url=photo_url,
        captured_at=now(),
    )
    db.add(reference_photo)
    db.commit()

    return {"message": "Photo captured successfully", "photo_url": photo_url}

@router.get("/{access_token}/verify-status", response_model=VerificationStatusResponse)
def get_verification_status(
    access_token: str,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    if not candidate:
        return VerificationStatusResponse(email_verified=False, photo_captured=False)

    otp_verified = db.query(OTP).filter(
        OTP.user_id == candidate.user_id,
        OTP.used == True
    ).first() is not None

    photo_captured = db.query(ReferencePhoto).filter(
        ReferencePhoto.session_id == session.id
    ).first() is not None

    return VerificationStatusResponse(
        email_verified=otp_verified,
        photo_captured=photo_captured
    )

@router.post("/{access_token}/start")
def start_assessment(
    access_token: str,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status == "completed":
        raise HTTPException(status_code=403, detail="Assessment already completed")

    if session.status == "expired":
        raise HTTPException(status_code=403, detail="Assessment expired")

    if session.status == "in_progress":
        return {"status": "in_progress", "message": "Assessment already started"}

    now_time = now()
    if session.allowed_from and now_time < session.allowed_from:
        raise HTTPException(
            status_code=403,
            detail=f"Assessment not yet available. Opens at: {session.allowed_from}"
        )

    if session.allowed_until and now_time > session.allowed_until:
        session.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Assessment window has expired")

    session.status = "in_progress"
    session.started_at = now_time
    db.commit()

    return {"status": "in_progress", "message": "Assessment started successfully"}

@router.post("/{access_token}/answer")
def save_answer(
    access_token: str,
    data: AnswerSubmit,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status != "in_progress":
        raise HTTPException(status_code=403, detail="Assessment not in progress")

    session_question = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id,
        SessionQuestion.question_id == data.question_id
    ).first()
    if not session_question:
        raise HTTPException(status_code=404, detail="Question not in this assessment")

    existing = db.query(Answer).filter(
        Answer.session_id == session.id,
        Answer.question_id == data.question_id
    ).first()

    if existing:
        existing.answer_data = data.answer_data
    else:
        answer = Answer(
            session_id=session.id,
            question_id=data.question_id,
            section_id=session_question.section_id,
            answer_data=data.answer_data
        )
        db.add(answer)

    db.commit()
    return {"success": True, "message": "Answer saved"}

@router.post("/{access_token}/submit", response_model=SubmitResponse)
def submit_assessment(
    access_token: str,
    data: Optional[SubmitRequest] = None,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status == "completed":
        raise HTTPException(status_code=403, detail="Assessment already submitted")

    if session.status != "in_progress":
        raise HTTPException(status_code=403, detail="Assessment not started")

    if data and data.answers:
        for ans in data.answers:
            session_question = db.query(SessionQuestion).filter(
                SessionQuestion.session_id == session.id,
                SessionQuestion.question_id == ans.question_id
            ).first()
            if session_question:
                existing = db.query(Answer).filter(
                    Answer.session_id == session.id,
                    Answer.question_id == ans.question_id
                ).first()
                if existing:
                    existing.answer_data = ans.answer_data
                else:
                    db.add(Answer(
                        session_id=session.id,
                        question_id=ans.question_id,
                        section_id=session_question.section_id,
                        answer_data=ans.answer_data
                    ))

    session.status = "completed"
    session.finished_at = now()
    db.commit()
    db.refresh(session)

    try:
        from app.services.evaluation_service import evaluate_session
        evaluate_session(db, session)
        db.refresh(session)
    except Exception as e:
        print(f"[EVAL ERROR] Evaluation failed: {e}")

    return SubmitResponse(
        access_token=session.access_token,
        status=session.status,
        total_score=session.total_score,
        integrity_score=session.integrity_score,
        eligibility=session.eligibility,
        message="Assessment submitted successfully"
    )

@router.post("/{access_token}/run-code")
def run_code(
    access_token: str,
    data: RunCodeRequest,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status not in ["in_progress", "scheduled"]:
        raise HTTPException(status_code=403, detail="Cannot run code in this state")

    question = db.query(QuestionBank).filter(QuestionBank.id == data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if question.type != "CODING":
        raise HTTPException(status_code=400, detail="Not a coding question")

    public_cases = question.public_test_cases or []
    if not public_cases:
        raise HTTPException(status_code=400, detail="No public test cases available")

    try:
        result = execute_code(
            code=data.code,
            language=data.language,
            test_cases=public_cases,
        )
        return result
    except Exception as e:
        return {
            "passed": False,
            "total": 0,
            "passed_count": 0,
            "results": [],
            "error": f"Execution error: {str(e)}"
        }

@router.get("/{access_token}/status", response_model=AssessmentStatusResponse)
def get_assessment_status(
    access_token: str,
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    return AssessmentStatusResponse(
        status=session.status,
        started_at=session.started_at,
        finished_at=session.finished_at,
        total_score=session.total_score,
        integrity_score=session.integrity_score,
        eligibility=session.eligibility
    )

@router.post("/{access_token}/upload-recording")
async def upload_recording(
    access_token: str,
    chunk: UploadFile = File(...),
    chunk_index: int = Form(0),
    db: Session = Depends(get_db)
):
    session = get_session_by_token(db, access_token)

    if session.status != "in_progress":
        raise HTTPException(status_code=403, detail="Assessment not in progress")

    content = await chunk.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    file_url = save_recording_chunk(
        session_id=session.id,
        chunk_data=content,
        filename=chunk.filename,
        chunk_index=chunk_index
    )

    recording = Recording(
        session_id=session.id,
        video_url=file_url,
        chunk_index=chunk_index,
        duration=0,
        quality_level="medium",
        uploaded_at=now()
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)

    return {
        "recording_id": recording.id,
        "video_url": recording.video_url,
        "chunk_index": recording.chunk_index,
        "message": "Upload successful"
    }