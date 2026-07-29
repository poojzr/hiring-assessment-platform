from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


class ReferencePhoto(Base):
    __tablename__ = "reference_photo"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    photo_url = Column(String(500), nullable=False)
    face_encoding = Column(Text, nullable=True)
    captured_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_ref_photo_candidate", "candidate_id"),
        Index("idx_ref_photo_session", "session_id"),
    )

    candidate = relationship("Candidate", back_populates="reference_photos")
    session = relationship("AssessmentSession", back_populates="reference_photos")