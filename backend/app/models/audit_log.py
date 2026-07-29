from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "api_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)  # ✅ Remove ForeignKey
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    status_code = Column(Integer, nullable=True)
    response_time = Column(Integer, nullable=True)
    extra_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_created", "created_at"),
        Index("idx_audit_endpoint", "endpoint"),
    )