from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime


class OTP(Base):
    __tablename__ = "otp"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_otp_code", "otp_code"),
        Index("idx_otp_expires", "expires_at"),
    )

    user = relationship("User", back_populates="otps")

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return True
        return self.expires_at < datetime.utcnow()