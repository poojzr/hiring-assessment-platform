from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(100), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_reset_token_expires", "expires_at"),
        Index("idx_reset_token_used", "used"),
    )

    user = relationship("User", back_populates="password_reset_tokens")

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return True
        return self.expires_at < datetime.utcnow()

    @property
    def is_valid(self) -> bool:
        return not self.is_expired and not self.used