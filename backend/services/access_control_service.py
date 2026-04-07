"""Minimal access protection for TradeAudit."""
import os
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import request, jsonify

# Get admin password from environment; default to 'admin' for dev
ADMIN_PASSWORD = os.environ.get('TRADEAUDIT_ADMIN_PASSWORD', 'admin')

# Simple in-memory session storage (dev/test; production should use Redis/DB)
_SESSIONS = {}


def _hash_password(password: str) -> str:
    """Simple SHA256 hash for password verification."""
    return hashlib.sha256(password.encode()).hexdigest()


def create_session(password: str) -> dict | None:
    """
    Verify password and create session token.
    Returns session dict with token if successful, None otherwise.
    """
    if password != ADMIN_PASSWORD:
        return None
    
    # Generate simple token
    import secrets
    token = secrets.token_urlsafe(32)
    
    # Store session with expiration (12 hours)
    expiration = datetime.now(timezone.utc) + timedelta(hours=12)
    _SESSIONS[token] = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': expiration.isoformat(),
    }
    
    return {
        'token': token,
        'expiresAt': expiration.isoformat(),
    }


def verify_access() -> bool:
    """
    Check if request has valid access token.
    Looks in: Authorization header (Bearer token) or X-Access-Token header.
    """
    # Get token from Authorization header or X-Access-Token header
    auth_header = request.headers.get('Authorization', '')
    token = None
    
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
    else:
        token = request.headers.get('X-Access-Token')
    
    if not token:
        return False
    
    # Check if token exists and not expired
    if token not in _SESSIONS:
        return False
    
    session = _SESSIONS[token]
    expires_at = datetime.fromisoformat(session['expires_at'])
    
    if datetime.now(timezone.utc) > expires_at:
        # Token expired
        del _SESSIONS[token]
        return False
    
    return True


def require_access(f):
    """
    Decorator to protect routes with access check.
    Returns 401 if not authorized.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not verify_access():
            return jsonify({
                'error': 'UNAUTHORIZED',
                'message': 'Access denied. Please provide valid access token.',
            }), 401
        return f(*args, **kwargs)
    return decorated_function


def cleanup_expired_sessions():
    """Remove expired sessions (call periodically)."""
    now = datetime.now(timezone.utc)
    expired_tokens = []
    
    for token, session in _SESSIONS.items():
        expires_at = datetime.fromisoformat(session['expires_at'])
        if now > expires_at:
            expired_tokens.append(token)
    
    for token in expired_tokens:
        del _SESSIONS[token]
    
    return len(expired_tokens)
