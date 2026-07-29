from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from app.models.audit_log import AuditLog

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def write_audit_log(
    db: Session,
    user_id: Optional[int],
    endpoint: str,
    method: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status_code: Optional[int] = None,
    response_time: Optional[int] = None,
    extra_data: Optional[dict] = None
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        endpoint=endpoint,
        method=method,
        ip_address=ip_address,
        user_agent=user_agent,
        status_code=status_code,
        response_time=response_time,
        extra_data=extra_data,
        created_at=now(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_audit_logs(
    db: Session,
    user_id: Optional[int] = None,
    endpoint: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
) -> list:
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if endpoint:
        query = query.filter(AuditLog.endpoint == endpoint)
    
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()