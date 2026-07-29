import os
import subprocess
import tempfile
from typing import Optional
from datetime import datetime, timedelta
from ..config import settings
from .storage_service import upload_to_cloudinary, get_storage_backend

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _get_storage_dir() -> str:
    return getattr(settings, 'STORAGE_DIR', './uploads')

def extract_violation_clip(
    video_path: str,
    timestamp: datetime,
    video_start_time: datetime,
    duration: int = 10,
    session_id: Optional[int] = None,
    event_id: Optional[int] = None
) -> Optional[str]:
    if not video_path:
        print("[ClipService] No video path provided")
        return None
    
    if not os.path.exists(video_path):
        print(f"[ClipService] Video file not found: {video_path}")
        return None
    
    try:
        time_delta = timestamp - video_start_time
        half_duration = duration / 2
        start_offset = max(0, time_delta.total_seconds() - half_duration)
        clip_duration = min(duration, time_delta.total_seconds() + half_duration)
        
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            clip_path = tmp.name
        
        cmd = [
            "ffmpeg",
            "-ss", str(start_offset),
            "-i", video_path,
            "-t", str(clip_duration),
            "-c", "copy",
            "-y",
            clip_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"[ClipService] FFmpeg error: {result.stderr}")
            os.unlink(clip_path)
            return None
        
        with open(clip_path, "rb") as f:
            clip_data = f.read()
        
        backend = get_storage_backend()
        
        if backend == "cloudinary" and getattr(settings, 'cloudinary_configured', False):
            public_id = f"session_{session_id}/clip_{event_id}" if session_id and event_id else f"clip_{int(now().timestamp())}"
            result = upload_to_cloudinary(
                clip_data,
                public_id=public_id,
                folder="clips",
                resource_type="video",
            )
            if result.get("success"):
                url = result.get("url")
            else:
                print(f"[ClipService] Cloudinary upload failed: {result.get('error')}")
                url = None
        else:
            storage_dir = _get_storage_dir()
            clip_dir = os.path.join(storage_dir, "clips")
            os.makedirs(clip_dir, exist_ok=True)
            
            filename = f"clip_{event_id or int(now().timestamp())}.webm"
            file_path = os.path.join(clip_dir, filename)
            
            with open(file_path, "wb") as f:
                f.write(clip_data)
            
            url = f"/uploads/clips/{filename}"
        
        try:
            os.unlink(clip_path)
        except Exception as e:
            print(f"[ClipService] Failed to delete temp file: {e}")
        
        return url
        
    except subprocess.TimeoutExpired:
        print("[ClipService] FFmpeg timeout")
        return None
    except FileNotFoundError:
        print("[ClipService] FFmpeg not installed")
        return None
    except Exception as e:
        print(f"[ClipService] Error extracting clip: {e}")
        return None

def extract_clip_from_url(
    video_url: str,
    timestamp: datetime,
    video_start_time: datetime,
    duration: int = 10,
    session_id: Optional[int] = None,
    event_id: Optional[int] = None
) -> Optional[str]:
    storage_dir = _get_storage_dir()
    
    if video_url.startswith("/uploads/"):
        relative_path = video_url.replace("/uploads/", "", 1)
        local_path = os.path.join(storage_dir, relative_path)
        return extract_violation_clip(local_path, timestamp, video_start_time, duration, session_id, event_id)
    
    elif video_url.startswith("http"):
        import requests
        try:
            response = requests.get(video_url, timeout=30)
            if response.status_code != 200:
                print(f"[ClipService] Failed to download video: {response.status_code}")
                return None
            
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(response.content)
                local_path = tmp.name
            
            result = extract_violation_clip(local_path, timestamp, video_start_time, duration, session_id, event_id)
            
            try:
                os.unlink(local_path)
            except Exception:
                pass
            
            return result
        except Exception as e:
            print(f"[ClipService] Failed to download video from URL: {e}")
            return None
    
    else:
        print(f"[ClipService] Unsupported video URL format: {video_url}")
        return None