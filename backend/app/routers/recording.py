from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime, timedelta
import os

from app.database import get_db
from app.models.assessment import AssessmentSession
from app.models.recording import Recording
from app.models.user import User
from app.utils.auth import require_manager
from app.services.storage_service import save_recording_chunk, get_storage_dir

router = APIRouter(prefix="/recordings", tags=["recordings"])

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

@router.get("/test")
def recording_test():
    return {"message": "Recording router is working"}

@router.post("/sessions/{session_id}/upload")
async def upload_recording_chunk(
    session_id: int,
    chunk: UploadFile = File(...),
    chunk_index: int = Form(0, ge=0),
    duration: int = Form(0, ge=0),
    db: Session = Depends(get_db)
):
    session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    content = await chunk.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        file_url = save_recording_chunk(
            session_id=session_id,
            chunk_data=content,
            filename=chunk.filename,
            chunk_index=chunk_index
        )

        existing = db.query(Recording).filter(
            Recording.session_id == session_id,
            Recording.chunk_index == chunk_index
        ).first()

        if existing:
            existing.video_url = file_url
            existing.duration = duration
            existing.uploaded_at = now()
            db.commit()
            db.refresh(existing)
            recording = existing
        else:
            recording = Recording(
                session_id=session_id,
                video_url=file_url,
                chunk_index=chunk_index,
                duration=duration,
                quality_level="medium",
                uploaded_at=now()
            )
            db.add(recording)
            db.commit()
            db.refresh(recording)

        return {
            "recording_id": recording.id,
            "video_url": recording.video_url,
            "chunk_index": recording.chunk_index,
            "duration": recording.duration,
            "message": "Upload successful"
        }
    except Exception as e:
        print(f"[Recording] Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/sessions/{session_id}")
def get_recordings(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    recordings = db.query(Recording).filter(
        Recording.session_id == session_id
    ).order_by(Recording.chunk_index).all()

    total_duration = sum((r.duration or 0) for r in recordings)

    return {
        "session_id": session_id,
        "total_chunks": len(recordings),
        "total_duration": total_duration,
        "recordings": [
            {
                "id": r.id,
                "video_url": r.video_url,
                "chunk_index": r.chunk_index,
                "uploaded_at": r.uploaded_at,
                "duration": r.duration if hasattr(r, 'duration') else 0,
                "quality_level": r.quality_level if hasattr(r, 'quality_level') else "medium"
            }
            for r in recordings
        ]
    }

@router.get("/sessions")
def get_all_recordings(
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    try:
        recordings = db.query(Recording).order_by(Recording.session_id, Recording.chunk_index).all()

        grouped = {}
        for r in recordings:
            grouped.setdefault(r.session_id, []).append(r)

        result = []
        for session_id, chunks in grouped.items():
            session = db.query(AssessmentSession).filter(AssessmentSession.id == session_id).first()
            candidate_name = session.candidate.name if session and session.candidate else "Unknown"
            status_value = session.status if session else "unknown"
            upload_times = [c.uploaded_at for c in chunks if c.uploaded_at]
            latest_upload = max(upload_times) if upload_times else None
            total_duration = sum((c.duration or 0) for c in chunks)

            result.append({
                "session_id": session_id,
                "candidate_name": candidate_name,
                "status": status_value,
                "total_chunks": len(chunks),
                "total_duration": total_duration,
                "uploaded_at": latest_upload,
                "quality_level": chunks[-1].quality_level if chunks else "medium"
            })

        result.sort(key=lambda x: x["uploaded_at"] or datetime.min, reverse=True)

        return {
            "recordings": result,
            "total": len(result)
        }
    except Exception as e:
        print(f"[Recording] Error fetching all recordings: {e}")
        return {
            "recordings": [],
            "total": 0,
            "error": str(e)
        }

@router.get("/{recording_id}/stream")
def stream_recording(
    recording_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if not recording.video_url:
        raise HTTPException(status_code=404, detail="Video URL not found")

    storage_dir = get_storage_dir()

    if recording.video_url.startswith("http"):
        import requests
        try:
            response = requests.get(recording.video_url, stream=True, timeout=30)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Video not found on storage")
            return StreamingResponse(
                response.iter_content(chunk_size=8192),
                media_type="video/webm",
                headers={
                    "Content-Disposition": f"inline; filename=recording_{recording_id}.webm",
                    "Accept-Ranges": "bytes",
                }
            )
        except Exception as e:
            print(f"[Recording] Stream error: {e}")
            raise HTTPException(status_code=500, detail="Failed to stream video")

    if recording.video_url.startswith("/uploads/"):
        relative_path = recording.video_url.replace("/uploads/", "", 1)
        file_path = os.path.join(storage_dir, relative_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Video file not found")

        return FileResponse(
            file_path,
            media_type="video/webm",
            headers={
                "Content-Disposition": f"inline; filename=recording_{recording_id}.webm",
                "Accept-Ranges": "bytes",
            }
        )

    raise HTTPException(status_code=400, detail="Invalid video URL format")

@router.get("/{recording_id}")
def get_recording(
    recording_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    return {
        "id": recording.id,
        "session_id": recording.session_id,
        "video_url": recording.video_url,
        "chunk_index": recording.chunk_index,
        "uploaded_at": recording.uploaded_at
    }

@router.delete("/sessions/{session_id}")
def delete_recordings(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    recordings = db.query(Recording).filter(Recording.session_id == session_id).all()
    count = len(recordings)
    for recording in recordings:
        db.delete(recording)
    db.commit()
    return {"message": f"Deleted {count} recordings for session {session_id}"}

@router.delete("/{recording_id}")
def delete_recording(
    recording_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    db.delete(recording)
    db.commit()
    return {"message": "Recording deleted successfully"}