from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    resume_url = Column(String(500), nullable=True)
    job_role_id = Column(Integer, ForeignKey("job_role_thresholds.id"), nullable=True)
    ats_score = Column(Float, nullable=True)
    shortlisted = Column(Boolean, nullable=False, default=False, index=True)
    shortlisted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    
    user = relationship("User", back_populates="candidates")
    job_role_threshold = relationship("JobRoleThreshold", back_populates="candidates")
    sessions = relationship("AssessmentSession", back_populates="candidate", cascade="all, delete-orphan")
    reference_photos = relationship("ReferencePhoto", back_populates="candidate")