from .auth_router import router as auth_router
from .admin import router as admin_router
from .assessments import router as assessments_router
from .proctor import router as proctor_router
from .recording import router as recording_router
from .manager import router as manager_router
from .evaluation import router as evaluation_router
from .candidate import router as candidate_router
from .sessions import router as sessions_router

__all__ = [
    "auth_router",
    "admin_router",
    "assessments_router",
    "proctor_router",
    "recording_router",
    "manager_router",
    "evaluation_router",
    "candidate_router",
    "sessions_router",
]