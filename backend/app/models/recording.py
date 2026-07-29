from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Recording(Base):
    __tablename__ = "recording"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    video_url = Column(String(500), nullable=True)
    audio_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)
    quality_level = Column(String(20), nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "chunk_index", name="uq_recording_session_chunk"),
        Index("idx_recording_session", "session_id"),
    )

    session = relationship("AssessmentSession", back_populates="recordings")