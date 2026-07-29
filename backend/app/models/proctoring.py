from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ProctorEventType(str, enum.Enum):
    NO_FACE = "NO_FACE"
    MULTIPLE_FACE = "MULTIPLE_FACE"
    MOBILE_DETECTED = "MOBILE_DETECTED"
    LOUD_VOICE = "LOUD_VOICE"
    MULTIPLE_VOICE = "MULTIPLE_VOICE"
    LIP_SYNC_MISMATCH = "LIP_SYNC_MISMATCH"
    TAB_SWITCH = "TAB_SWITCH"
    COPY_PASTE = "COPY_PASTE"
    SCREEN_SHARE = "SCREEN_SHARE"
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    DARK_ENVIRONMENT = "DARK_ENVIRONMENT"
    WARNING_SENT = "WARNING_SENT"
    SESSION_TERMINATED = "SESSION_TERMINATED"


class SeverityLevel(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ProctorEvent(Base):
    __tablename__ = "proctor_event"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    event_type = Column(SQLEnum(ProctorEventType), nullable=False)
    severity = Column(SQLEnum(SeverityLevel), nullable=False)
    timestamp = Column(DateTime, server_default=func.now())
    snapshot_url = Column(String(500), nullable=True)
    clip_url = Column(String(500), nullable=True)
    event_data = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    session = relationship("AssessmentSession", back_populates="proctor_events")


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())