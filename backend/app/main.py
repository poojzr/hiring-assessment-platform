from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .config import settings
from .database import ensure_schema
from .routers import (
    auth_router,
    admin_router,
    candidate_router,
    assessments_router,
    proctor_router,
    recording_router,
    manager_router,
    evaluation_router,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Hiring Assessment & Proctoring Platform API"
)

ensure_schema()

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]

if settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS.split(","):
        origin = origin.strip()
        if origin:
            origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(candidate_router, prefix="/api")
app.include_router(assessments_router, prefix="/api")
app.include_router(proctor_router, prefix="/api")
app.include_router(recording_router, prefix="/api")
app.include_router(manager_router, prefix="/api")
app.include_router(evaluation_router, prefix="/api")

os.makedirs(settings.STORAGE_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    try:
        from .services.exam_service import start_section_deadline_monitor, start_evaluation_retry_monitor
        await start_section_deadline_monitor()
        await start_evaluation_retry_monitor()
        print("All services started successfully")
    except Exception as e:
        print(f"Startup error: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down...")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENV,
    }

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": "1.0.0",
        "docs": "/docs",
    }