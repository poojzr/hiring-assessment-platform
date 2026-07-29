from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProctorInitRequest(BaseModel):
    access_token: str

class ProctorInitResponse(BaseModel):
    access_token: str
    status: str
    message: str
    session_id: int


class ViolationLogRequest(BaseModel):
    access_token: str
    event_type: str = Field(
        ...,
        pattern="^(NO_FACE|MULTIPLE_FACE|LOUD_VOICE|TAB_SWITCH|COPY_PASTE|SCREEN_SHARE|FULLSCREEN_EXIT|DARK_ENVIRONMENT)$"
    )
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    snapshot_url: Optional[str] = Field(None, max_length=500)
    clip_url: Optional[str] = Field(None, max_length=500)
    event_data: Optional[dict] = None


class ViolationLogResponse(BaseModel):
    event_id: int
    logged: bool
    integrity_score: float
    cheating_risk: str


class ProctorEventResponse(BaseModel):
    id: int
    session_id: int
    event_type: str
    severity: str
    timestamp: datetime
    snapshot_url: Optional[str]
    clip_url: Optional[str]
    event_data: Optional[dict]
    penalty: int

    class Config:
        from_attributes = True


class IntegrityFinalizeResponse(BaseModel):
    session_id: int
    integrity_score: float
    cheating_risk: str
    total_events: int
    events_by_severity: dict


class EnvironmentCheckRequest(BaseModel):
    access_token: str


class EnvironmentCheckResponse(BaseModel):
    browser: str
    version: str
    webrtc: bool
    websocket: bool
    internet: bool
    camera: bool
    microphone: bool
    fullscreen_supported: bool
    all_checks_passed: bool
    issues: List[str] = Field(default_factory=list)


class WarningRequest(BaseModel):
    access_token: str
    message: str


class WarningResponse(BaseModel):
    warning_count: int
    max_warnings: int
    auto_terminate: bool
    message: str