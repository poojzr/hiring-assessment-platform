from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_refresh_token_expires", "expires_at"),
        Index("idx_refresh_token_revoked", "revoked"),
    )

    user = relationship("User", back_populates="refresh_tokens")

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return True
        return self.expires_at < datetime.utcnow()

    @property
    def is_valid(self) -> bool:
        return not self.is_expired and not self.revoked