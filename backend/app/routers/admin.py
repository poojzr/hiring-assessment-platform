from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
import csv
import io
import json

from ..database import get_db
from ..models.user import User
from ..models.candidate import Candidate
from ..models.job_role import JobRoleThreshold
from ..models.assessment import (
    QuestionBank,
    AssessmentTemplate,
    AssessmentSession,
    SessionQuestion,
    Answer,
    TemplateHistory,
    QuestionHistory,
)
from ..schemas.assessment import (
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateListResponse,
    QuestionHistoryResponse,
    TemplateHistoryResponse,
)
from ..schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from ..schemas.candidate import ThresholdCreate, ThresholdResponse
from ..utils.auth import require_admin, require_manager, get_current_user, get_client_ip, hash_password
from ..services.template_service import create_template, update_template
from ..services.audit_service import write_audit_log

router = APIRouter(prefix="/admin", tags=["admin"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

@router.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def create_user(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing_user = db.query(User).filter(User.email == data.email).first()
    existing_candidate = db.query(Candidate).filter(Candidate.email == data.email).first()
    
    if existing_user or existing_candidate:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if data.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=400,
            detail="Role must be 'admin' or 'manager'"
        )
    
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=data.is_active,
        password_changed_at=now(),
    )
    db.add(user)
    db.flush()
    
    db.commit()
    db.refresh(user)
    
    write_audit_log(
        db,
        admin.id,
        "/api/admin/users",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        201,
        extra_data={"user_id": user.id, "role": user.role}
    )
    db.commit()
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.get("/users", response_model=UserListResponse)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search and len(search.strip()) > 0:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            User.name.ilike(search_term) | User.email.ilike(search_term)
        )
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()
    
    items = []
    for user in users:
        items.append(UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            last_login=user.last_login,
            created_at=user.created_at,
            updated_at=user.updated_at
        ))
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items
    }

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if admin.id == user_id and data.role is not None and data.role != user.role:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role. Have another admin do it."
        )
    
    if data.role is not None and data.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid role. Must be 'admin' or 'manager'"
        )
    
    if data.email and data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    update_data = data.model_dump(exclude_unset=True)
    
    if "password" in update_data and update_data["password"]:
        user.hashed_password = hash_password(update_data["password"])
        update_data.pop("password", None)
    
    for key, value in update_data.items():
        if value is not None:
            setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/users/{user_id}",
        "PUT",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"user_id": user.id}
    )
    db.commit()
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if admin.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete yourself. Have another admin do it."
        )
    
    candidate = db.query(Candidate).filter(Candidate.user_id == user_id).first()
    
    permanent = request.query_params.get("permanent", "false").lower() == "true"
    
    if permanent:
        if candidate:
            db.delete(candidate)
        db.delete(user)
        db.commit()
        write_audit_log(
            db,
            admin.id,
            f"/api/admin/users/{user_id}",
            "DELETE",
            get_client_ip(request),
            request.headers.get("user-agent"),
            200,
            extra_data={"user_id": user_id, "permanent": True}
        )
        db.commit()
        return {"message": "User and candidate deleted permanently", "permanent": True}
    else:
        user.is_active = False
        if candidate:
            candidate.shortlisted = False
        db.commit()
        write_audit_log(
            db,
            admin.id,
            f"/api/admin/users/{user_id}",
            "DELETE",
            get_client_ip(request),
            request.headers.get("user-agent"),
            200,
            extra_data={"user_id": user_id, "permanent": False}
        )
        db.commit()
        return {"message": "User deactivated (soft delete)", "permanent": False}

@router.post("/thresholds", status_code=status.HTTP_201_CREATED, response_model=ThresholdResponse)
def create_threshold(
    data: ThresholdCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.job_role_name == data.job_role_name
    ).first()
    
    if existing:
        existing.ats_threshold = data.ats_threshold
        db.commit()
        db.refresh(existing)
        return ThresholdResponse(
            id=existing.id,
            job_role_name=existing.job_role_name,
            ats_threshold=existing.ats_threshold,
            created_at=existing.created_at,
            updated_at=existing.updated_at
        )
    
    threshold = JobRoleThreshold(**data.model_dump())
    db.add(threshold)
    db.commit()
    db.refresh(threshold)
    
    write_audit_log(
        db,
        admin.id,
        "/api/admin/thresholds",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        201,
        extra_data={"threshold_id": threshold.id}
    )
    db.commit()
    
    return ThresholdResponse(
        id=threshold.id,
        job_role_name=threshold.job_role_name,
        ats_threshold=threshold.ats_threshold,
        created_at=threshold.created_at,
        updated_at=threshold.updated_at
    )

@router.get("/thresholds", response_model=list[ThresholdResponse])
def list_thresholds(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    thresholds = db.query(JobRoleThreshold).all()
    return [
        ThresholdResponse(
            id=t.id,
            job_role_name=t.job_role_name,
            ats_threshold=t.ats_threshold,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in thresholds
    ]

@router.get("/thresholds/{threshold_id}", response_model=ThresholdResponse)
def get_threshold(
    threshold_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    threshold = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == threshold_id
    ).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="Threshold not found")
    
    return ThresholdResponse(
        id=threshold.id,
        job_role_name=threshold.job_role_name,
        ats_threshold=threshold.ats_threshold,
        created_at=threshold.created_at,
        updated_at=threshold.updated_at
    )

@router.put("/thresholds/{threshold_id}", response_model=ThresholdResponse)
def update_threshold(
    threshold_id: int,
    data: ThresholdCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    threshold = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == threshold_id
    ).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="Threshold not found")
    
    threshold.job_role_name = data.job_role_name
    threshold.ats_threshold = data.ats_threshold
    threshold.updated_at = now()
    
    db.commit()
    db.refresh(threshold)
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/thresholds/{threshold_id}",
        "PUT",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"threshold_id": threshold.id}
    )
    db.commit()
    
    return ThresholdResponse(
        id=threshold.id,
        job_role_name=threshold.job_role_name,
        ats_threshold=threshold.ats_threshold,
        created_at=threshold.created_at,
        updated_at=threshold.updated_at
    )

@router.delete("/thresholds/{threshold_id}")
def delete_threshold(
    threshold_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    threshold = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == threshold_id
    ).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="Threshold not found")
    
    candidate_usage = db.query(Candidate).filter(
        Candidate.job_role_id == threshold_id
    ).count()
    template_usage = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.job_role_id == threshold_id
    ).count()
    
    if candidate_usage > 0 or template_usage > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete threshold. It is used by {candidate_usage} candidate(s) and {template_usage} template(s)."
        )
    
    db.delete(threshold)
    db.commit()
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/thresholds/{threshold_id}",
        "DELETE",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"threshold_id": threshold_id}
    )
    db.commit()
    
    return {"message": "Threshold deleted successfully"}

@router.post("/questions", status_code=status.HTTP_201_CREATED, response_model=QuestionResponse)
def create_question(
    data: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(QuestionBank).filter(
        func.lower(QuestionBank.text) == func.lower(data.text),
        QuestionBank.type == data.type
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A {data.type} question with this text already exists (ID: {existing.id})."
        )
    
    question = QuestionBank(**data.model_dump(), created_by=admin.id)
    db.add(question)
    db.flush()
    
    history = QuestionHistory(
        question_id=question.id,
        version=1,
        type=question.type,
        text=question.text,
        description=question.description,
        options=question.options,
        correct_answer=question.correct_answer,
        tags=question.tags,
        topic=question.topic,
        difficulty=question.difficulty,
        role=question.role,
        language=question.language,
        public_test_cases=question.public_test_cases,
        hidden_test_cases=question.hidden_test_cases,
        changed_by=admin.id,
    )
    db.add(history)
    db.commit()
    db.refresh(question)
    
    write_audit_log(
        db,
        admin.id,
        "/api/admin/questions",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        201,
        extra_data={"question_id": question.id}
    )
    db.commit()
    
    return QuestionResponse(
        id=question.id,
        type=question.type,
        text=question.text,
        description=question.description,
        options=question.options,
        correct_answer=question.correct_answer,
        coding_reference=question.coding_reference,
        tags=question.tags,
        topic=question.topic,
        difficulty=question.difficulty,
        role=question.role,
        language=question.language,
        public_test_cases=question.public_test_cases,
        hidden_test_cases=question.hidden_test_cases,
        is_active=question.is_active,
        created_by=question.created_by,
        updated_by=question.updated_by,
        created_at=question.created_at,
        updated_at=question.updated_at
    )

@router.get("/questions", response_model=QuestionListResponse)
def list_questions(
    type: Optional[str] = Query(None, pattern="^(MCQ|CODING)$"),
    difficulty: Optional[str] = Query(None, pattern="^(easy|medium|hard)$"),
    topic: Optional[str] = None,
    role: Optional[str] = None,
    is_active: bool = Query(True),
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(QuestionBank)
    
    if not include_inactive:
        query = query.filter(QuestionBank.is_active == is_active)
    if type:
        query = query.filter(QuestionBank.type == type)
    if difficulty:
        query = query.filter(QuestionBank.difficulty == difficulty)
    if topic:
        query = query.filter(QuestionBank.topic == topic)
    if role:
        query = query.filter(
            (QuestionBank.role == role) |
            (QuestionBank.role.is_(None))
        )
    
    total = query.count()
    questions = query.offset(skip).limit(limit).all()
    
    items = []
    for q in questions:
        items.append(QuestionResponse(
            id=q.id,
            type=q.type,
            text=q.text,
            description=q.description,
            options=q.options,
            correct_answer=q.correct_answer,
            coding_reference=q.coding_reference,
            tags=q.tags,
            topic=q.topic,
            difficulty=q.difficulty,
            role=q.role,
            language=q.language,
            public_test_cases=q.public_test_cases,
            hidden_test_cases=q.hidden_test_cases,
            is_active=q.is_active,
            created_by=q.created_by,
            updated_by=q.updated_by,
            created_at=q.created_at,
            updated_at=q.updated_at
        ))
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items
    }

@router.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    question = db.query(QuestionBank).filter(QuestionBank.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return QuestionResponse(
        id=question.id,
        type=question.type,
        text=question.text,
        description=question.description,
        options=question.options,
        correct_answer=question.correct_answer,
        coding_reference=question.coding_reference,
        tags=question.tags,
        topic=question.topic,
        difficulty=question.difficulty,
        role=question.role,
        language=question.language,
        public_test_cases=question.public_test_cases,
        hidden_test_cases=question.hidden_test_cases,
        is_active=question.is_active,
        created_by=question.created_by,
        updated_by=question.updated_by,
        created_at=question.created_at,
        updated_at=question.updated_at
    )

@router.put("/questions/{question_id}", response_model=QuestionResponse)
def update_question(
    question_id: int,
    data: QuestionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    question = db.query(QuestionBank).filter(QuestionBank.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    q_type = data.type or question.type
    
    if data.text:
        existing = db.query(QuestionBank).filter(
            func.lower(QuestionBank.text) == func.lower(data.text),
            QuestionBank.type == q_type,
            QuestionBank.id != question_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Another {q_type} question with this text already exists (ID: {existing.id})."
            )
    
    latest = db.query(QuestionHistory).filter(
        QuestionHistory.question_id == question_id
    ).order_by(QuestionHistory.version.desc()).first()
    next_version = (latest.version + 1) if latest else 1
    
    history = QuestionHistory(
        question_id=question_id,
        version=next_version,
        type=question.type,
        text=question.text,
        description=question.description,
        options=question.options,
        correct_answer=question.correct_answer,
        tags=question.tags,
        topic=question.topic,
        difficulty=question.difficulty,
        role=question.role,
        language=question.language,
        public_test_cases=question.public_test_cases,
        hidden_test_cases=question.hidden_test_cases,
        changed_by=admin.id,
    )
    db.add(history)
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)
    question.updated_by = admin.id
    
    db.commit()
    db.refresh(question)
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/questions/{question_id}",
        "PUT",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"question_id": question.id}
    )
    db.commit()
    
    return QuestionResponse(
        id=question.id,
        type=question.type,
        text=question.text,
        description=question.description,
        options=question.options,
        correct_answer=question.correct_answer,
        coding_reference=question.coding_reference,
        tags=question.tags,
        topic=question.topic,
        difficulty=question.difficulty,
        role=question.role,
        language=question.language,
        public_test_cases=question.public_test_cases,
        hidden_test_cases=question.hidden_test_cases,
        is_active=question.is_active,
        created_by=question.created_by,
        updated_by=question.updated_by,
        created_at=question.created_at,
        updated_at=question.updated_at
    )

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    question = db.query(QuestionBank).filter(QuestionBank.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    usage_count = db.query(SessionQuestion).filter(
        SessionQuestion.question_id == question_id
    ).count()
    
    if usage_count > 0:
        question.is_active = False
        db.commit()
        return {
            "message": f"Question is used in {usage_count} session(s). Soft-deleted.",
            "usage_count": usage_count,
            "soft_deleted": True
        }
    
    db.delete(question)
    db.commit()
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/questions/{question_id}",
        "DELETE",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"question_id": question_id}
    )
    db.commit()
    
    return {"message": "Question deleted permanently", "soft_deleted": False}

@router.get("/questions/{question_id}/history", response_model=list[QuestionHistoryResponse])
def get_question_history(
    question_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    history = db.query(QuestionHistory).filter(
        QuestionHistory.question_id == question_id
    ).order_by(QuestionHistory.version.desc()).all()
    return [QuestionHistoryResponse.model_validate(h) for h in history]

@router.post("/questions/bulk-import")
async def bulk_import_questions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    if not file.filename.endswith(('.csv', '.json')):
        raise HTTPException(status_code=400, detail="Only CSV and JSON files are supported")
    
    content = await file.read()
    
    try:
        if file.filename.endswith('.json'):
            result = await _import_from_json(db, content, admin.id)
        else:
            result = await _import_from_csv(db, content, admin.id)
        
        write_audit_log(
            db,
            admin.id,
            "/api/admin/questions/bulk-import",
            "POST",
            None,
            None,
            200,
            extra_data={"total": result.get("total", 0)}
        )
        db.commit()
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def _import_from_json(db: Session, content: bytes, user_id: int):
    data = json.loads(content.decode('utf-8'))
    if not isinstance(data, list):
        raise ValueError("JSON must be an array of questions")
    
    results = []
    for item in data:
        try:
            question = QuestionBank(
                type=item.get('type', 'MCQ'),
                text=item.get('text', ''),
                description=item.get('description'),
                options=item.get('options'),
                correct_answer=item.get('correct_answer'),
                coding_reference=item.get('coding_reference'),
                language=item.get('language', 'python'),
                public_test_cases=item.get('public_test_cases'),
                hidden_test_cases=item.get('hidden_test_cases'),
                tags=item.get('tags'),
                topic=item.get('topic'),
                difficulty=item.get('difficulty', 'medium'),
                role=item.get('role'),
                created_by=user_id,
                is_active=True
            )
            db.add(question)
            results.append({"status": "success", "text": question.text[:50]})
        except Exception as e:
            results.append({"status": "failed", "error": str(e)})
    
    db.commit()
    return {"total": len(data), "results": results}

def safe_json_parse(value):
    if not value or str(value).strip() == '':
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value

async def _import_from_csv(db: Session, content: bytes, user_id: int):
    text = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    
    results = []
    for row in rows:
        try:
            options = safe_json_parse(row.get('options', '{}'))
            public_cases = safe_json_parse(row.get('public_test_cases', '[]'))
            hidden_cases = safe_json_parse(row.get('hidden_test_cases', '[]'))
            tags = safe_json_parse(row.get('tags', '[]'))
            
            if isinstance(public_cases, str):
                public_cases = []
            if isinstance(hidden_cases, str):
                hidden_cases = []
            if isinstance(tags, str):
                tags = []
            if not isinstance(options, dict):
                options = {}
            
            question = QuestionBank(
                type=row.get('type', 'MCQ'),
                text=row.get('text', ''),
                description=row.get('description'),
                options=options,
                correct_answer=row.get('correct_answer'),
                coding_reference=row.get('coding_reference'),
                language=row.get('language', 'python'),
                public_test_cases=public_cases,
                hidden_test_cases=hidden_cases,
                tags=tags,
                topic=row.get('topic'),
                difficulty=row.get('difficulty', 'medium'),
                role=row.get('role'),
                created_by=user_id,
                is_active=True
            )
            db.add(question)
            results.append({"status": "success", "text": question.text[:50]})
        except Exception as e:
            results.append({"status": "failed", "error": str(e)})
    
    db.commit()
    return {"total": len(rows), "results": results}

@router.post("/templates", status_code=status.HTTP_201_CREATED, response_model=TemplateResponse)
def create_template_endpoint(
    data: TemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    template = create_template(
        db,
        name=data.name,
        job_role_id=data.job_role_id,
        sections_config=data.sections_config,
        duration_minutes=data.duration_minutes,
        pass_threshold=data.pass_threshold,
        is_active=True,
        created_by=admin,
    )
    db.commit()
    db.refresh(template)
    
    write_audit_log(
        db,
        admin.id,
        "/api/admin/templates",
        "POST",
        get_client_ip(request),
        request.headers.get("user-agent"),
        201,
        extra_data={"template_id": template.id}
    )
    db.commit()
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        role=template.role,
        job_role_id=template.job_role_id,
        sections_config=template.sections_config,
        duration_minutes=template.duration_minutes,
        pass_threshold=template.pass_threshold,
        is_active=template.is_active,
        created_by=template.created_by,
        updated_by=template.updated_by,
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.get("/templates", response_model=TemplateListResponse)
def list_templates(
    is_active: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    query = db.query(AssessmentTemplate).filter(AssessmentTemplate.is_active == is_active)
    total = query.count()
    templates = query.offset(skip).limit(limit).all()
    
    items = []
    for t in templates:
        items.append(TemplateResponse(
            id=t.id,
            name=t.name,
            role=t.role,
            job_role_id=t.job_role_id,
            sections_config=t.sections_config,
            duration_minutes=t.duration_minutes,
            pass_threshold=t.pass_threshold,
            is_active=t.is_active,
            created_by=t.created_by,
            updated_by=t.updated_by,
            created_at=t.created_at,
            updated_at=t.updated_at
        ))
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items
    }

@router.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template_endpoint(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        role=template.role,
        job_role_id=template.job_role_id,
        sections_config=template.sections_config,
        duration_minutes=template.duration_minutes,
        pass_threshold=template.pass_threshold,
        is_active=template.is_active,
        created_by=template.created_by,
        updated_by=template.updated_by,
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template_endpoint(
    template_id: int,
    data: TemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    updates = data.model_dump(exclude_unset=True)
    template = update_template(
        db,
        template=template,
        updates=updates,
        updated_by=admin,
    )
    db.commit()
    db.refresh(template)
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/templates/{template_id}",
        "PUT",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"template_id": template.id}
    )
    db.commit()
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        role=template.role,
        job_role_id=template.job_role_id,
        sections_config=template.sections_config,
        duration_minutes=template.duration_minutes,
        pass_threshold=template.pass_threshold,
        is_active=template.is_active,
        created_by=template.created_by,
        updated_by=template.updated_by,
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.delete("/templates/{template_id}")
def delete_template_endpoint(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    usage_count = db.query(AssessmentSession).filter(
        AssessmentSession.template_id == template_id
    ).count()
    
    if usage_count > 0:
        template.is_active = False
        db.commit()
        return {
            "message": f"Template is used in {usage_count} session(s). Soft-deleted (set to inactive).",
            "usage_count": usage_count,
            "soft_deleted": True
        }
    
    db.delete(template)
    db.commit()
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/templates/{template_id}",
        "DELETE",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"template_id": template_id}
    )
    db.commit()
    
    return {"message": "Template deleted successfully", "soft_deleted": False}

@router.get("/templates/{template_id}/history", response_model=list[TemplateHistoryResponse])
def get_template_history_endpoint(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    history = db.query(TemplateHistory).filter(
        TemplateHistory.template_id == template_id
    ).order_by(TemplateHistory.version.desc()).all()
    return [TemplateHistoryResponse.model_validate(h) for h in history]

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status == "in_progress":
        raise HTTPException(status_code=400, detail="Cannot delete an in-progress session")
    
    db.delete(session)
    db.commit()
    
    write_audit_log(
        db,
        admin.id,
        f"/api/admin/sessions/{session_id}",
        "DELETE",
        get_client_ip(request),
        request.headers.get("user-agent"),
        200,
        extra_data={"session_id": session_id}
    )
    db.commit()
    
    return {"message": "Session deleted successfully"}