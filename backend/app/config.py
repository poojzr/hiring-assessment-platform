import os
from dotenv import load_dotenv

load_dotenv()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./hiring_platform.db")
    APP_NAME: str = os.environ.get("APP_NAME", "Hiring Assessment Platform")
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    ENV: str = os.environ.get("ENV", "development")
    
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    REFRESH_SECRET_KEY: str = os.environ.get("REFRESH_SECRET_KEY", "dev-refresh-secret-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_PASS: str = os.environ.get("SMTP_PASS", "")
    FROM_EMAIL: str = os.environ.get("FROM_EMAIL", "noreply@hiring-platform.com")
    
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    
    CODE_EXECUTOR_TIMEOUT: int = int(os.environ.get("CODE_EXECUTOR_TIMEOUT", "10"))
    CODE_EXECUTOR_MEMORY_MB: int = int(os.environ.get("CODE_EXECUTOR_MEMORY_MB", "256"))
    
    STORAGE_BACKEND: str = os.environ.get("STORAGE_BACKEND", "local")
    STORAGE_DIR: str = os.environ.get("STORAGE_DIR", "./uploads")
    
    CLOUDINARY_CLOUD_NAME: str = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.environ.get("CLOUDINARY_API_SECRET", "")
    
    REDIS_URL: str = os.environ.get("REDIS_URL", "")
    
    RATE_LIMIT_MAX_REQUESTS: int = int(os.environ.get("RATE_LIMIT_MAX_REQUESTS", "100"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
    MAX_LOGIN_ATTEMPTS: int = int(os.environ.get("MAX_LOGIN_ATTEMPTS", "5"))
    ACCOUNT_LOCKOUT_MINUTES: int = int(os.environ.get("ACCOUNT_LOCKOUT_MINUTES", "30"))
    
    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "")
    ADMIN_NAME: str = os.environ.get("ADMIN_NAME", "System Administrator")
    
    DEFAULT_ATS_THRESHOLD: float = float(os.environ.get("DEFAULT_ATS_THRESHOLD", "70.0"))
    ASSESSMENT_ACCESS_DAYS: int = int(os.environ.get("ASSESSMENT_ACCESS_DAYS", "3"))
    ALLOWED_HOSTS: str = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
    
    @property
    def cors_origins_list(self) -> list:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
    
    @property
    def is_production(self) -> bool:
        return self.ENV == "production"
    
    @property
    def redis_enabled(self) -> bool:
        return bool(self.REDIS_URL)
    
    @property
    def cloudinary_configured(self) -> bool:
        return all([self.CLOUDINARY_CLOUD_NAME, self.CLOUDINARY_API_KEY, self.CLOUDINARY_API_SECRET])
    
    @property
    def allowed_hosts_list(self) -> list:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()