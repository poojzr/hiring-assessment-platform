import os
import uuid
from typing import Optional
from datetime import datetime, timedelta

from ..config import settings

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    HAS_CLOUDINARY = True
except ImportError:
    HAS_CLOUDINARY = False
    print("Cloudinary SDK not installed. Using local storage.")

def get_storage_backend() -> str:
    return getattr(settings, 'STORAGE_BACKEND', 'local')

def get_storage_dir() -> str:
    return getattr(settings, 'STORAGE_DIR', './uploads')

def ensure_storage_dir(path: str) -> None:
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        print(f"[Storage] Created directory: {path}")

def upload_to_cloudinary(
    file_data: bytes,
    public_id: Optional[str] = None,
    folder: str = "recordings",
    resource_type: str = "video",
    **kwargs
) -> dict:
    if not HAS_CLOUDINARY:
        return {"success": False, "error": "Cloudinary SDK not installed"}
    
    if not getattr(settings, 'cloudinary_configured', False):
        return {"success": False, "error": "Cloudinary not configured"}
    
    try:
        cloudinary.config(
            cloud_name=getattr(settings, 'CLOUDINARY_CLOUD_NAME', ''),
            api_key=getattr(settings, 'CLOUDINARY_API_KEY', ''),
            api_secret=getattr(settings, 'CLOUDINARY_API_SECRET', ''),
            secure=True,
        )
    except Exception as e:
        return {"success": False, "error": f"Cloudinary config error: {str(e)}"}
    
    if not public_id:
        public_id = str(uuid.uuid4())
    
    upload_options = {
        "public_id": public_id,
        "folder": folder,
        "resource_type": resource_type,
        "overwrite": True,
        **kwargs
    }
    
    try:
        result = cloudinary.uploader.upload(file_data, **upload_options)
        return {
            "success": True,
            "url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "duration": result.get("duration"),
            "bytes": result.get("bytes"),
            "format": result.get("format"),
        }
    except Exception as e:
        return {"success": False, "error": f"Cloudinary upload failed: {str(e)}"}

def save_recording_chunk(
    session_id: int,
    chunk_data: bytes,
    filename: Optional[str] = None,
    chunk_index: int = 0
) -> str:
    backend = get_storage_backend()
    
    if backend == "cloudinary":
        result = upload_to_cloudinary(
            chunk_data,
            public_id=f"session_{session_id}/chunk_{chunk_index}",
            folder=f"recordings/session_{session_id}",
            resource_type="video",
        )
        if result.get("success"):
            print(f"[Storage] Uploaded chunk {chunk_index} to Cloudinary")
            return result["url"]
        else:
            print(f"[Storage] Cloudinary upload failed: {result.get('error')}")
    
    storage_dir = get_storage_dir()
    session_dir = os.path.join(storage_dir, f"session_{session_id}")
    ensure_storage_dir(session_dir)
    
    if not filename:
        filename = f"chunk_{chunk_index}.webm"
    else:
        ext = os.path.splitext(filename)[1] or ".webm"
        filename = f"chunk_{chunk_index}{ext}"
    
    file_path = os.path.join(session_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(chunk_data)
    
    print(f"[Storage] Saved chunk {chunk_index} to: {file_path}")
    
    return f"/uploads/session_{session_id}/{filename}"

def save_snapshot(
    session_id: int,
    image_data: bytes,
    event_type: str = "snapshot"
) -> str:
    backend = get_storage_backend()
    
    if backend == "cloudinary":
        result = upload_to_cloudinary(
            image_data,
            public_id=f"session_{session_id}/{event_type}_{uuid.uuid4().hex[:8]}",
            folder=f"snapshots/session_{session_id}",
            resource_type="image",
        )
        if result.get("success"):
            print(f"[Storage] Saved snapshot to Cloudinary")
            return result["url"]
    
    storage_dir = get_storage_dir()
    session_dir = os.path.join(storage_dir, f"session_{session_id}", "snapshots")
    ensure_storage_dir(session_dir)
    
    safe_event_type = "".join(c for c in event_type if c.isalnum() or c in "_-") or "snapshot"
    filename = f"{safe_event_type}_{uuid.uuid4().hex[:8]}.jpg"
    file_path = os.path.join(session_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(image_data)
    
    print(f"[Storage] Saved snapshot to: {file_path}")
    
    return f"/uploads/session_{session_id}/snapshots/{filename}"

def delete_file(file_url: str) -> bool:
    if not file_url.startswith("/uploads/"):
        return False
    
    storage_dir = get_storage_dir()
    relative_path = file_url.replace("/uploads/", "", 1)
    full_path = os.path.realpath(os.path.join(storage_dir, relative_path))
    
    if full_path != storage_dir and not full_path.startswith(storage_dir + os.sep):
        print(f"[Storage] Blocked path traversal attempt: {file_url}")
        return False
    
    try:
        if os.path.exists(full_path) and os.path.isfile(full_path):
            os.remove(full_path)
            print(f"[Storage] Deleted file: {full_path}")
            return True
    except Exception as e:
        print(f"[Storage] Error deleting file: {e}")
    
    return False