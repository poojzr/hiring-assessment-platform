import secrets
import string
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.otp import OTP
from ..models.user import User
from .email_service import send_otp_via_email
from ..config import settings
from ..utils.rate_limiter import get_redis_client

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

_redis_client = get_redis_client() if settings.redis_enabled else None
_in_memory_otp_counts = {}

def _check_otp_rate_limit(user_id: int) -> bool:
    if _redis_client:
        try:
            key = f"otp_rate:{user_id}"
            count = _redis_client.incr(key)
            if count == 1:
                _redis_client.expire(key, 3600)
            return count <= 3
        except Exception as e:
            print(f"[OTP] Redis error: {e}, falling back to in-memory")
    
    now_time = time.time()
    if user_id not in _in_memory_otp_counts:
        _in_memory_otp_counts[user_id] = []
    
    _in_memory_otp_counts[user_id] = [
        t for t in _in_memory_otp_counts[user_id] if t > now_time - 3600
    ]
    
    if len(_in_memory_otp_counts[user_id]) >= 3:
        return False
    
    _in_memory_otp_counts[user_id].append(now_time)
    return True

def generate_otp(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def send_otp_email(db: Session, user_id: int, email: str) -> dict:
    if not _check_otp_rate_limit(user_id):
        return {"error": "Too many OTP requests. Please try again later."}
    
    otp_code = generate_otp()
    expires_at = now() + timedelta(minutes=5)
    
    otp = OTP(
        user_id=user_id,
        otp_code=otp_code,
        expires_at=expires_at,
        used=False,
    )
    db.add(otp)
    db.commit()
    
    success = send_otp_via_email(email, otp_code)
    
    return {
        "success": success,
        "message": "OTP sent" if success else "Failed to send OTP",
        "expires_in": 5,
    }

def verify_otp(db: Session, user_id: int, otp_code: str) -> dict:
    otp = db.query(OTP).filter(
        OTP.user_id == user_id,
        OTP.otp_code == otp_code,
        OTP.used == False
    ).first()
    
    if not otp:
        return {"verified": False, "message": "Invalid OTP code"}
    
    if otp.expires_at < now():
        return {"verified": False, "message": "OTP has expired"}
    
    otp.used = True
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_verified = True
    
    db.commit()
    
    return {"verified": True, "message": "OTP verified successfully"}

def cleanup_expired_otps(db: Session) -> int:
    expired = db.query(OTP).filter(
        OTP.expires_at < now()
    ).delete()
    db.commit()
    return expired