from pydantic import BaseModel, Field, field_validator, ValidationInfo
from typing import Optional, Any, List
from datetime import datetime

class QuestionCreate(BaseModel):
    type: str = Field(..., pattern="^(MCQ|CODING)$")
    text: str = Field(..., min_length=1)
    description: Optional[str] = None
    options: Optional[dict] = None
    correct_answer: Optional[str] = Field(None, max_length=500)
    coding_reference: Optional[str] = None
    tags: Optional[List[str]] = None
    topic: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[str] = Field("medium", pattern="^(easy|medium|hard)$")
    role: Optional[str] = Field(None, max_length=200)
    language: Optional[str] = Field("python", pattern="^(python|javascript|java|c|cpp|csharp)$")
    supported_languages: Optional[List[str]] = None
    allow_language_choice: bool = False
    public_test_cases: Optional[List[dict]] = None
    hidden_test_cases: Optional[List[dict]] = None

    @field_validator("options")
    def validate_options(cls, v: Optional[dict], info: ValidationInfo) -> Optional[dict]:
        if info.data.get("type") == "MCQ":
            if not v or not isinstance(v, dict):
                raise ValueError("MCQ questions require options as a dict")
            if len(v) < 2:
                raise ValueError("MCQ questions must have at least 2 options")
        return v

    @field_validator("correct_answer")
    def validate_correct_answer(cls, v: Optional[str], info: ValidationInfo) -> Optional[str]:
        if info.data.get("type") == "MCQ":
            if not v:
                raise ValueError("MCQ questions require a correct_answer")
            options = info.data.get("options", {})
            if v not in options:
                raise ValueError(f"correct_answer '{v}' must be one of the options keys")
        return v


class QuestionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern="^(MCQ|CODING)$")
    text: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    options: Optional[dict] = None
    correct_answer: Optional[str] = Field(None, max_length=500)
    coding_reference: Optional[str] = None
    tags: Optional[List[str]] = None
    topic: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[str] = Field(None, pattern="^(easy|medium|hard)$")
    role: Optional[str] = Field(None, max_length=200)
    language: Optional[str] = Field(None, pattern="^(python|javascript|java|c|cpp|csharp)$")
    supported_languages: Optional[List[str]] = None
    allow_language_choice: Optional[bool] = None
    public_test_cases: Optional[List[dict]] = None
    hidden_test_cases: Optional[List[dict]] = None
    is_active: Optional[bool] = None


class QuestionResponse(BaseModel):
    id: int
    type: str
    text: str
    description: Optional[str]
    options: Optional[dict]
    correct_answer: Optional[str]
    coding_reference: Optional[str]
    tags: Optional[List[str]]
    topic: Optional[str]
    difficulty: Optional[str]
    role: Optional[str]
    language: str
    supported_languages: Optional[List[str]] = None
    allow_language_choice: bool = False
    public_test_cases: Optional[List[dict]]
    hidden_test_cases: Optional[List[dict]]
    is_active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: list[QuestionResponse]


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    job_role_id: int = Field(..., description="FK to job_role_thresholds")
    sections_config: dict = Field(..., description="Sections configuration")
    duration_minutes: int = Field(60, gt=0)
    pass_threshold: float = Field(60.0, ge=0, le=100)

    @field_validator("sections_config")
    def validate_sections_config(cls, v: dict) -> dict:
        if not v or "sections" not in v:
            raise ValueError("sections_config must contain 'sections' key")
        sections = v.get("sections", [])
        if not sections:
            raise ValueError("At least one section is required")
        for i, section in enumerate(sections):
            if "id" not in section or not section["id"]:
                raise ValueError(f"Section {i}: 'id' is required and must be non-empty")
            if "type" not in section or section["type"] not in ["MCQ", "CODING"]:
                raise ValueError(f"Section {i}: type must be MCQ or CODING")
            if "count" not in section or section["count"] < 1:
                raise ValueError(f"Section {i}: count must be positive")
            if "duration_minutes" not in section or section["duration_minutes"] < 1:
                raise ValueError(f"Section {i}: duration_minutes must be positive")
            if "order" not in section:
                raise ValueError(f"Section {i}: order is required")
            if "difficulty_distribution" in section:
                dist = section["difficulty_distribution"]
                total = sum(dist.values())
                if total > 1.0:
                    raise ValueError(f"Section {i}: difficulty_distribution values sum to {total}, must be <= 1.0")
        return v


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    job_role_id: Optional[int] = None
    sections_config: Optional[dict] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    pass_threshold: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    role: str
    job_role_id: int
    job_role_name: Optional[str] = None
    sections_config: dict
    duration_minutes: int
    pass_threshold: float
    is_active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100
    items: list[TemplateResponse]


class AssessmentQuestionPublic(BaseModel):
    id: int
    type: str
    text: str
    description: Optional[str]
    options: Optional[dict] = None
    topic: Optional[str]
    difficulty: Optional[str]
    language: Optional[str] = "python"
    supported_languages: Optional[List[str]] = None
    allow_language_choice: bool = False
    public_test_cases: Optional[List[dict]] = None


class AssessmentStartResponse(BaseModel):
    access_token: str
    template_name: str
    job_role: str
    duration_minutes: int
    pass_threshold: float
    allowed_until: Optional[datetime]
    started_at: Optional[datetime]
    status: str
    questions: List[AssessmentQuestionPublic]


class SessionStartResponse(BaseModel):
    status: str
    started_at: datetime
    message: str


class SessionStatusResponse(BaseModel):
    status: str
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    total_score: Optional[float]
    integrity_score: Optional[float]
    eligibility: Optional[str]

class AnswerSubmit(BaseModel):
    question_id: int
    answer_data: dict


class SubmitRequest(BaseModel):
    answers: List[AnswerSubmit]


class SubmitResponse(BaseModel):
    access_token: str
    status: str
    total_score: Optional[float]
    integrity_score: Optional[float]
    cheating_risk: Optional[str]
    eligibility: Optional[str]
    message: str



class AnswerAutosave(BaseModel):
    question_id: int
    answer_data: dict


class RunCodeRequest(BaseModel):
    question_id: int
    code: str = Field(..., min_length=1)
    language: str = Field("python", pattern="^(python|javascript|java|c|cpp|csharp)$")


class TestCaseResult(BaseModel):
    passed: bool
    input: str
    expected: str
    actual: str
    error: Optional[str] = None


class RunCodeResponse(BaseModel):
    passed: bool
    total: int
    passed_count: int
    results: List[TestCaseResult]
    error: Optional[str] = None




class QuestionHistoryResponse(BaseModel):
    id: int
    question_id: int
    version: int
    type: str
    text: str
    description: Optional[str]
    options: Optional[dict]
    correct_answer: Optional[str]
    tags: Optional[List[str]]
    topic: Optional[str]
    difficulty: Optional[str]
    role: Optional[str]
    language: Optional[str]
    public_test_cases: Optional[List[dict]]
    hidden_test_cases: Optional[List[dict]]
    changed_by: Optional[int]
    changed_at: datetime

    class Config:
        from_attributes = True


class TemplateHistoryResponse(BaseModel):
    id: int
    template_id: int
    version: int
    name: str
    role: str
    sections_config: dict
    duration_minutes: int
    pass_threshold: float
    changed_by: Optional[int]
    changed_at: datetime

    class Config:
        from_attributes = True