import os
import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv
load_dotenv()
from .models.user import User
from .models.job_role import JobRoleThreshold
from .models.audit_log import AuditLog
from .utils.auth import hash_password, is_strong_password
from .config import settings

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def seed_database(db: Session) -> None:
    print("Starting database seeding...")
    
    try:
        admin_exists = db.query(User).filter(User.role == "admin").first()
        
        if admin_exists:
            print(f"Admin already exists: {admin_exists.email}")
        else:
            admin_email = os.getenv("ADMIN_EMAIL") or settings.ADMIN_EMAIL
            admin_password = os.getenv("ADMIN_PASSWORD") or settings.ADMIN_PASSWORD
            admin_name = os.getenv("ADMIN_NAME") or settings.ADMIN_NAME or "System Administrator"
            
            print(f"Admin Email from env: {admin_email}")
            print(f"Admin Password set: {'Yes' if admin_password else 'No'}")
            
            if not admin_email or not admin_password:
                print("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file")
                print("Skipping admin seeding.")
                return
            
            if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", admin_email):
                print(f"  Invalid admin email format: {admin_email}")
                print(" Skipping admin seeding.")
                return
            
            if not is_strong_password(admin_password):
                print("Admin password must be at least 8 characters with uppercase, lowercase, numbers, and special characters")
                print("Skipping admin seeding.")
                return
            
            try:
                admin = User(
                    name=admin_name,
                    email=admin_email,
                    hashed_password=hash_password(admin_password),
                    role="admin",
                    is_active=True,
                    is_verified=True,
                    password_changed_at=now(),
                )
                db.add(admin)
                db.commit()
                db.refresh(admin)
                
                audit_log = AuditLog(
                    user_id=admin.id,
                    endpoint="/system/seed",
                    method="SYSTEM",
                    status_code=201,
                    created_at=now(),
                )
                db.add(audit_log)
                db.commit()
                
                print(f" Admin user created successfully!")
                print(f"   Email: {admin_email}")
                print(f"   Name: {admin_name}")
            except IntegrityError:
                db.rollback()
                print("Admin creation failed (race condition) - another worker likely created it")
                
    except Exception as e:
        print(f"Admin creation error: {e}")
        db.rollback()
    
    try:
        threshold_exists = db.query(JobRoleThreshold).filter(
            JobRoleThreshold.job_role_name == "Default"
        ).first()
        
        if not threshold_exists:
            default_threshold = JobRoleThreshold(
                job_role_name="Default",
                ats_threshold=float(os.getenv("DEFAULT_ATS_THRESHOLD", getattr(settings, "DEFAULT_ATS_THRESHOLD", 70.0))),
            )
            db.add(default_threshold)
            db.commit()
            print(f"Default ATS threshold created: {default_threshold.ats_threshold}%")
        else:
            print(f"Default ATS threshold already exists: {threshold_exists.ats_threshold}%")
    except Exception as e:
        db.rollback()
        print(f"Default threshold creation error: {e}")
    
    print("Database seeding completed!")