from fastapi import FastAPI
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.sessions import SessionMiddleware

from ..config import settings
from ..utils.security_headers import SecurityHeadersMiddleware


def setup_security_middleware(app: FastAPI):
    
    app.add_middleware(SecurityHeadersMiddleware)
    
    
    if settings.is_production:
        app.add_middleware(HTTPSRedirectMiddleware)
    
    
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SECRET_KEY,
        session_cookie="session",
        max_age=3600,
        same_site="lax",
        https_only=settings.is_production,
    )