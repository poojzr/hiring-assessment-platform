from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, Enum as SQLEnum, Float, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    CODING = "CODING"


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class SessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"


class EligibilityStatus(str, enum.Enum):
    PENDING = "pending"
    AUTO_ELIGIBLE = "auto_eligible"
    AUTO_BLOCKED = "auto_blocked"
    MANAGER_OVERRIDDEN = "manager_overridden"


class CheatingRisk(str, enum.Enum):
    CLEAN = "clean"
    MINOR = "minor"
    HIGH = "high"


class QuestionBank(Base):
    __tablename__ = "question_bank"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(QuestionType), nullable=False)
    text = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    options = Column(JSON, nullable=True)
    correct_answer = Column(String(500), nullable=True)
    coding_reference = Column(Text, nullable=True)
    language = Column(String(50), nullable=True, default="python")
    supported_languages = Column(JSON, nullable=True)
    allow_language_choice = Column(Boolean, nullable=False, default=False)
    public_test_cases = Column(JSON, nullable=True)
    hidden_test_cases = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    topic = Column(String(100), nullable=True)
    difficulty = Column(SQLEnum(DifficultyLevel), nullable=True, default=DifficultyLevel.MEDIUM)
    role = Column(String(200), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_questions")
    updater = relationship("User", foreign_keys=[updated_by], back_populates="updated_questions")
    session_questions = relationship("SessionQuestion", back_populates="question", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
    history = relationship("QuestionHistory", back_populates="question", cascade="all, delete-orphan")


class AssessmentTemplate(Base):
    __tablename__ = "assessment_template"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    role = Column(String(200), nullable=False)
    job_role_id = Column(Integer, ForeignKey("job_role_thresholds.id"), nullable=False)
    sections_config = Column(JSON, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    pass_threshold = Column(Float, nullable=False, default=60.0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    job_role = relationship("JobRoleThreshold", back_populates="templates")
    sessions = relationship("AssessmentSession", back_populates="template", cascade="all, delete-orphan")
    history = relationship("TemplateHistory", back_populates="template", cascade="all, delete-orphan")

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_templates")
    updater = relationship("User", foreign_keys=[updated_by], back_populates="updated_templates")


class AssessmentSession(Base):
    __tablename__ = "assessment_session"

    id = Column(Integer, primary_key=True, index=True)
    access_token = Column(String(500), unique=True, nullable=False, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("assessment_template.id"), nullable=False)
    status = Column(SQLEnum(SessionStatus), nullable=False, default=SessionStatus.SCHEDULED)
    allowed_from = Column(DateTime, nullable=True)
    allowed_until = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    total_score = Column(Float, nullable=True)
    integrity_score = Column(Float, nullable=False, default=100.0)
    cheating_risk = Column(SQLEnum(CheatingRisk), nullable=True, default=CheatingRisk.CLEAN)
    eligibility = Column(SQLEnum(EligibilityStatus), nullable=False, default=EligibilityStatus.PENDING)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    overridden_at = Column(DateTime, nullable=True)
    section_deadlines = Column(JSON, nullable=True)
    completed_sections = Column(JSON, nullable=True, default={})
    ip_address = Column(String(45), nullable=True)
    device_fingerprint = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    candidate = relationship("Candidate", back_populates="sessions")
    template = relationship("AssessmentTemplate", back_populates="sessions")
    answers = relationship("Answer", back_populates="session", cascade="all, delete-orphan")
    session_questions = relationship("SessionQuestion", back_populates="session", cascade="all, delete-orphan")
    proctor_events = relationship("ProctorEvent", back_populates="session", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="session", cascade="all, delete-orphan")
    reference_photos = relationship("ReferencePhoto", back_populates="session", cascade="all, delete-orphan")
    overrider = relationship("User", foreign_keys=[overridden_by], back_populates="overridden_sessions")


class SessionQuestion(Base):
    __tablename__ = "session_question"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("question_bank.id"), nullable=False, index=True)
    section_id = Column(String(50), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_question"),
        Index("idx_session_question_section", "session_id", "section_id"),
    )

    session = relationship("AssessmentSession", back_populates="session_questions")
    question = relationship("QuestionBank", back_populates="session_questions")


class Answer(Base):
    __tablename__ = "answer"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_session.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("question_bank.id"), nullable=False, index=True)
    section_id = Column(String(50), nullable=False)
    answer_data = Column(JSON, nullable=False)
    is_correct = Column(Boolean, nullable=True)
    auto_score = Column(Float, nullable=True)
    manual_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_answer"),
        Index("idx_answer_section", "session_id", "section_id"),
    )

    session = relationship("AssessmentSession", back_populates="answers")
    question = relationship("QuestionBank", back_populates="answers")


class TemplateHistory(Base):
    __tablename__ = "template_history"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("assessment_template.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(200), nullable=False)
    role = Column(String(200), nullable=False)
    sections_config = Column(JSON, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    pass_threshold = Column(Float, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_template_version"),
    )

    template = relationship("AssessmentTemplate", back_populates="history")
    changer = relationship("User", foreign_keys=[changed_by], back_populates="template_history")


class QuestionHistory(Base):
    __tablename__ = "question_history"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("question_bank.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    type = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    options = Column(JSON, nullable=True)
    correct_answer = Column(String(500), nullable=True)
    tags = Column(JSON, nullable=True)
    topic = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    role = Column(String(200), nullable=True)
    language = Column(String(20), nullable=True)
    public_test_cases = Column(JSON, nullable=True)
    hidden_test_cases = Column(JSON, nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("question_id", "version", name="uq_question_version"),
    )

    question = relationship("QuestionBank", back_populates="history")
    changer = relationship("User", foreign_keys=[changed_by], back_populates="question_history")