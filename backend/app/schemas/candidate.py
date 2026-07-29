from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    resume_url: Optional[str] = Field(None, max_length=500)
    job_role_id: Optional[int] = None
    ats_score: Optional[float] = Field(None, ge=0, le=100)


class CandidateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    resume_url: Optional[str] = Field(None, max_length=500)
    job_role_id: Optional[int] = None
    ats_score: Optional[float] = Field(None, ge=0, le=100)
    shortlisted: Optional[bool] = None


class CandidateResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str
    email: str
    phone: Optional[str]
    resume_url: Optional[str]
    job_role_id: Optional[int]
    job_role: Optional[str] = None
    ats_score: Optional[float]
    shortlisted: bool
    shortlisted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: list[CandidateResponse]


class ATSScoreRequest(BaseModel):
    ats_score: float = Field(..., ge=0, le=100)


class ATSScoreResponse(BaseModel):
    candidate_id: int
    ats_score: float
    threshold: float
    shortlisted: bool
    session_created: bool
    access_token: Optional[str] = None
    session_id: Optional[int] = None
    message: str
    template_name: Optional[str] = None
    eligibility: Optional[str] = None


class ThresholdCreate(BaseModel):
    job_role_name: str = Field(..., min_length=1, max_length=255)
    ats_threshold: float = Field(..., ge=0, le=100)


class ThresholdResponse(BaseModel):
    id: int
    job_role_name: str
    ats_threshold: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True