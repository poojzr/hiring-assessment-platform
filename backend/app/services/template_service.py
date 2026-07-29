from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from ..models.assessment import AssessmentTemplate, TemplateHistory
from ..models.job_role import JobRoleThreshold
from ..models.user import User

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _next_version(db: Session, template_id: int) -> int:
    last = (
        db.query(TemplateHistory)
        .filter(TemplateHistory.template_id == template_id)
        .order_by(TemplateHistory.version.desc())
        .first()
    )
    return (last.version + 1) if last else 1

def _get_role_from_job_role_id(db: Session, job_role_id: int) -> str:
    job_role = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == job_role_id
    ).first()
    if not job_role:
        raise ValueError(f"Job role with id {job_role_id} not found")
    return job_role.job_role_name

def snapshot_template(db: Session, template: AssessmentTemplate, changed_by: Optional[int] = None) -> None:
    history = TemplateHistory(
        template_id=template.id,
        version=_next_version(db, template.id),
        name=template.name,
        role=template.role,
        sections_config=template.sections_config,
        duration_minutes=template.duration_minutes,
        pass_threshold=template.pass_threshold,
        changed_by=changed_by,
        changed_at=now(),
    )
    db.add(history)

def create_template(
    db: Session,
    *,
    name: str,
    job_role_id: int,
    sections_config: dict,
    duration_minutes: int,
    pass_threshold: float,
    is_active: bool,
    created_by: User,
) -> AssessmentTemplate:
    job_role = db.query(JobRoleThreshold).filter(
        JobRoleThreshold.id == job_role_id
    ).first()
    if not job_role:
        raise ValueError(f"Job role with id {job_role_id} not found")
    
    template = AssessmentTemplate(
        name=name,
        role=job_role.job_role_name,
        job_role_id=job_role_id,
        sections_config=sections_config,
        duration_minutes=duration_minutes,
        pass_threshold=pass_threshold,
        is_active=is_active,
        created_by=created_by.id,
        updated_by=created_by.id,
        created_at=now(),
        updated_at=now(),
    )
    db.add(template)
    db.flush()
    
    snapshot_template(db, template, created_by.id)
    
    return template

def update_template(
    db: Session,
    *,
    template: AssessmentTemplate,
    updates: Dict[str, Any],
    updated_by: User,
) -> AssessmentTemplate:
    snapshot_template(db, template, updated_by.id)
    
    if "name" in updates:
        template.name = updates["name"]
    
    if "job_role_id" in updates and updates["job_role_id"] is not None:
        job_role = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.id == updates["job_role_id"]
        ).first()
        if job_role:
            template.job_role_id = job_role.id
            template.role = job_role.job_role_name
    
    if "sections_config" in updates:
        template.sections_config = updates["sections_config"]
    
    if "duration_minutes" in updates:
        template.duration_minutes = updates["duration_minutes"]
    
    if "pass_threshold" in updates:
        template.pass_threshold = updates["pass_threshold"]
    
    if "is_active" in updates:
        template.is_active = updates["is_active"]
    
    template.updated_by = updated_by.id
    template.updated_at = now()
    
    db.flush()
    return template

def get_template(db: Session, template_id: int) -> Optional[AssessmentTemplate]:
    return db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()

def get_templates(db: Session, is_active: Optional[bool] = True) -> list:
    query = db.query(AssessmentTemplate)
    if is_active is not None:
        query = query.filter(AssessmentTemplate.is_active == is_active)
    return query.all()

def delete_template(db: Session, template_id: int) -> bool:
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id
    ).first()
    if not template:
        return False
    
    db.delete(template)
    db.flush()
    return True