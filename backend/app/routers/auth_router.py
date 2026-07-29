from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets

from app.database import get_db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.refresh_token import RefreshToken
from app.models.password_reset import PasswordResetToken
from app.models.otp import OTP
from app.models.audit_log import AuditLog
from app.utils.auth import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user, get_client_ip
from app.services.email_service import send_otp_via_email, send_password_reset_email
from app.utils.rate_limiter import login_limiter, register_limiter, otp_limiter, rate_limit
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    name: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SendOTPRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
@rate_limit(register_limiter)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role="candidate",
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.flush()
    
    candidate = Candidate(
        user_id=user.id,
        name=user.name,
        email=user.email,
    )
    db.add(candidate)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_refresh_token)
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        name=user.name
    )


@router.post("/login", response_model=LoginResponse)
@rate_limit(login_limiter)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    
    if not verify_password(data.password, user.hashed_password):
        user.failed_login_attempts += 1
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user.failed_login_attempts = 0
    user.last_login = now()
    db.commit()
    
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_refresh_token)
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        name=user.name
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at
    )

@router.post("/logout")
def logout(data: RefreshTokenRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.user_id == user.id
    ).first()
    
    if db_token:
        db_token.revoked = True
        db.commit()
    
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=LoginResponse)
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.revoked == False
    ).first()
    
    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    if db_token.expires_at < now():
        raise HTTPException(status_code=401, detail="Refresh token expired")
    
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    new_refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    
    db_token.token = new_refresh_token
    db_token.expires_at = now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        role=user.role,
        name=user.name
    )


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user:
        return {"message": "If an account exists, a reset link has been sent"}
    
    token = secrets.token_urlsafe(32)
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=now() + timedelta(hours=1),
        used=False,
    )
    db.add(reset_token)
    db.commit()
    
    send_password_reset_email(user.email, token)
    
    return {"message": "If an account exists, a reset link has been sent"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == data.token,
        PasswordResetToken.used == False
    ).first()
    
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if reset_token.expires_at < now():
        raise HTTPException(status_code=400, detail="Token has expired")
    
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    user.hashed_password = hash_password(data.new_password)
    reset_token.used = True
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/send-otp")
@rate_limit(otp_limiter)
def send_otp(data: SendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))
    
    otp = OTP(
        user_id=user.id,
        otp_code=otp_code,
        expires_at=now() + timedelta(minutes=5),
        used=False,
    )
    db.add(otp)
    db.commit()
    
    send_otp_via_email(user.email, otp_code)
    
    return {"message": "OTP sent successfully", "expires_in": 5}


@router.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    otp = db.query(OTP).filter(
        OTP.user_id == user.id,
        OTP.otp_code == data.otp_code,
        OTP.used == False
    ).first()
    
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if otp.expires_at < now():
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    otp.used = True
    user.is_verified = True
    db.commit()
    
    return {"message": "OTP verified successfully", "verified": True}