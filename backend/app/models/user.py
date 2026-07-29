from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CANDIDATE = "candidate"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.CANDIDATE)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    
    candidates = relationship("Candidate", back_populates="user", uselist=False)
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    otps = relationship("OTP", back_populates="user", cascade="all, delete-orphan")
    
    created_questions = relationship("QuestionBank", foreign_keys="QuestionBank.created_by", back_populates="creator")
    updated_questions = relationship("QuestionBank", foreign_keys="QuestionBank.updated_by", back_populates="updater")
    created_templates = relationship("AssessmentTemplate", foreign_keys="AssessmentTemplate.created_by", back_populates="creator")
    updated_templates = relationship("AssessmentTemplate", foreign_keys="AssessmentTemplate.updated_by", back_populates="updater")
    overridden_sessions = relationship("AssessmentSession", foreign_keys="AssessmentSession.overridden_by", back_populates="overrider")
    template_history = relationship("TemplateHistory", foreign_keys="TemplateHistory.changed_by", back_populates="changer")
    question_history = relationship("QuestionHistory", foreign_keys="QuestionHistory.changed_by", back_populates="changer")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def is_manager(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.MANAGER)

    @property
    def is_candidate(self) -> bool:
        return self.role == UserRole.CANDIDATE

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role.value})>"