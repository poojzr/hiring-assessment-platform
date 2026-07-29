from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class JobRoleThreshold(Base):
    __tablename__ = "job_role_thresholds"

    id = Column(Integer, primary_key=True, index=True)
    job_role_name = Column(String(255), unique=True, nullable=False, index=True)
    ats_threshold = Column(Float, nullable=False, default=70.0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

   
    candidates = relationship("Candidate", back_populates="job_role_threshold")
    templates = relationship("AssessmentTemplate", back_populates="job_role")