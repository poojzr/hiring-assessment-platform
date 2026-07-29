from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    PDF = "pdf"


class SessionFilter(BaseModel):
    status: Optional[str] = Field(None, pattern="^(scheduled|in_progress|completed|expired)$")
    eligibility: Optional[str] = Field(None, pattern="^(pending|auto_eligible|auto_blocked|manager_overridden)$")
    job_role: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None
    skip: int = 0
    limit: int = 100


class SessionListItem(BaseModel):
    session_id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    template_name: str
    job_role: str
    status: str
    total_score: Optional[float]
    integrity_score: Optional[float]
    cheating_risk: Optional[str]
    eligibility: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime


class SessionListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: List[SessionListItem]


class ViolationTimelineItem(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    snapshot_url: Optional[str]
    clip_url: Optional[str]


class AnswerReviewItem(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    section: str
    answer_data: dict
    is_correct: Optional[bool]
    auto_score: Optional[float]


class CandidateInfo(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    job_role: Optional[str]
    ats_score: Optional[float]
    shortlisted: bool


class SessionInfo(BaseModel):
    session_id: int
    status: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    total_score: Optional[float]
    integrity_score: Optional[float]
    cheating_risk: Optional[str]
    eligibility: str


class RecordingInfo(BaseModel):
    url: str
    chunk_index: int
    uploaded_at: datetime


class TimelineEvent(BaseModel):
    time: datetime
    event: str
    severity: Optional[str] = None


class ViolationSummary(BaseModel):
    total: int
    critical: int
    high: int
    medium: int
    low: int


class CandidateReportResponse(BaseModel):
    candidate: CandidateInfo
    sessions: List[SessionInfo]
    answers: List[AnswerReviewItem]
    violations: List[ViolationTimelineItem]
    recordings: List[RecordingInfo]
    timeline: List[TimelineEvent]
    violation_summary: ViolationSummary


class OverrideRequest(BaseModel):
    eligibility: str = Field(..., pattern="^(manager_overridden|auto_blocked)$")
    override_reason: str = Field(..., min_length=1)


class OverrideResponse(BaseModel):
    session_id: int
    eligibility: str
    override_reason: str
    overridden_by: str
    overridden_at: datetime
    message: str


class EligibleCandidateResponse(BaseModel):
    session_id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    candidate_phone: Optional[str]
    job_role: str
    ats_score: Optional[float]
    total_score: float
    integrity_score: float
    cheating_risk: str
    eligibility: str
    template_name: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]


class EligibleShortlistResponse(BaseModel):
    total: int
    items: List[EligibleCandidateResponse]


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.CSV
    filter: Optional[dict] = None
    candidate_ids: Optional[List[int]] = None


class ExportResponse(BaseModel):
    data: str
    filename: str
    content_type: str
    size_bytes: int


class AnalyticsOverviewResponse(BaseModel):
    total_sessions: int
    completion_rate: float
    pass_rate: float
    average_score: float
    integrity_distribution: dict
    total_violations: int
    violation_summary: dict


class AnalyticsSessionsResponse(BaseModel):
    daily: List[dict]
    weekly: List[dict]
    monthly: List[dict]


class AnalyticsViolationsResponse(BaseModel):
    by_type: List[dict]
    by_severity: List[dict]
    by_session: List[dict]


class AnalyticsQuestionsResponse(BaseModel):
    question_id: int
    text: str
    type: str
    topic: Optional[str]
    difficulty: Optional[str]
    total_uses: int
    pass_rate: Optional[float]
    flags: List[str]