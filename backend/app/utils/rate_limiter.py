import time
import threading
from typing import Dict, Tuple, Optional
from collections import deque
from functools import wraps
from fastapi import Request, HTTPException, status

from ..config import settings

_redis_client = None

try:
    import redis
    if settings.redis_enabled:
        _redis_client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        _redis_client.ping()
        print("[RateLimiter] Redis connected")
    else:
        print("[RateLimiter] Redis not enabled, using in-memory fallback")
except Exception as e:
    print(f"[RateLimiter] Redis connection failed: {e}, using in-memory fallback")
    _redis_client = None

def get_redis_client():
    return _redis_client

_in_memory_requests: Dict[str, deque] = {}

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
    
    def _check_redis(self, key: str) -> bool:
        if not _redis_client:
            return self._check_in_memory(key)
        
        try:
            now = time.time()
            window_start = now - self.window_seconds
            
            pipe = _redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            count = pipe.execute()[1]
            
            if count >= self.max_requests:
                return False
            
            pipe = _redis_client.pipeline()
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, self.window_seconds)
            pipe.execute()
            
            return True
        except Exception as e:
            print(f"[RateLimiter] Redis error: {e}, falling back to in-memory")
            return self._check_in_memory(key)
    
    def _check_in_memory(self, key: str) -> bool:
        with self._lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            if key not in _in_memory_requests:
                _in_memory_requests[key] = deque()
            
            queue = _in_memory_requests[key]
            
            while queue and queue[0] < window_start:
                queue.popleft()
            
            if len(queue) >= self.max_requests:
                return False
            
            queue.append(now)
            return True
    
    def check(self, key: str) -> bool:
        if _redis_client:
            return self._check_redis(key)
        return self._check_in_memory(key)

def rate_limit(limiter: RateLimiter):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                for kwarg in kwargs.values():
                    if isinstance(kwarg, Request):
                        request = kwarg
                        break
            
            if not request:
                if callable(func):
                    if hasattr(func, '__call__'):
                        if not hasattr(func, '__self__'):
                            if not hasattr(func, '__qualname__'):
                                if not hasattr(func, '__name__'):
                                    return func(*args, **kwargs)
                        result = func(*args, **kwargs)
                        if hasattr(result, '__await__'):
                            return await result
                        return result
                    result = func(*args, **kwargs)
                    if hasattr(result, '__await__'):
                        return await result
                    return result
                return func(*args, **kwargs)
            
            client_ip = request.client.host if request.client else "unknown"
            key = f"rate_limit:{client_ip}:{func.__name__}"
            
            if not limiter.check(key):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Maximum {limiter.max_requests} requests per {limiter.window_seconds} seconds."
                )
            
            result = func(*args, **kwargs)
            if hasattr(result, '__await__'):
                return await result
            return result
        return wrapper
    return decorator

login_limiter = RateLimiter(
    max_requests=settings.MAX_LOGIN_ATTEMPTS,
    window_seconds=settings.ACCOUNT_LOCKOUT_MINUTES * 60
)

register_limiter = RateLimiter(
    max_requests=10,
    window_seconds=3600
)

otp_limiter = RateLimiter(
    max_requests=3,
    window_seconds=3600
)

class LoginRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._attempts: Dict[str, list] = {}
    
    def check(self, email: str) -> Tuple[bool, int]:
        key = f"login:{email}"
        
        if _redis_client:
            try:
                now = time.time()
                window_start = now - (settings.ACCOUNT_LOCKOUT_MINUTES * 60)
                
                pipe = _redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zcard(key)
                count = pipe.execute()[1]
                
                if count >= settings.MAX_LOGIN_ATTEMPTS:
                    return False, 0
                
                return True, settings.MAX_LOGIN_ATTEMPTS - count
            except Exception:
                pass
        
        with self._lock:
            now = time.time()
            window_start = now - (settings.ACCOUNT_LOCKOUT_MINUTES * 60)
            
            if key not in self._attempts:
                self._attempts[key] = []
            
            self._attempts[key] = [t for t in self._attempts[key] if t > window_start]
            
            if len(self._attempts[key]) >= settings.MAX_LOGIN_ATTEMPTS:
                return False, 0
            
            remaining = settings.MAX_LOGIN_ATTEMPTS - len(self._attempts[key])
            return True, remaining
    
    def record_failure(self, email: str):
        key = f"login:{email}"
        
        if _redis_client:
            try:
                now = time.time()
                pipe = _redis_client.pipeline()
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, settings.ACCOUNT_LOCKOUT_MINUTES * 60)
                pipe.execute()
                return
            except Exception:
                pass
        
        with self._lock:
            now = time.time()
            if key not in self._attempts:
                self._attempts[key] = []
            self._attempts[key].append(now)
    
    def clear(self, email: str):
        key = f"login:{email}"
        
        if _redis_client:
            try:
                _redis_client.delete(key)
                return
            except Exception:
                pass
        
        with self._lock:
            if key in self._attempts:
                del self._attempts[key]

login_rate_limiter = LoginRateLimiter()