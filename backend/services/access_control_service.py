"""Minimal access protection for TradeAudit."""
import os
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

from flask import request, jsonify
# Simple in-memory session storage (dev/test; production should use Redis/DB)
_SESSIONS = {}


def _hash_password(password: str) -> str:
    """Simple SHA256 hash for password verification."""
    return hashlib.sha256(password.encode()).hexdigest()


def _resolve_admin_password() -> str:
    configured = os.environ.get('TRADEAUDIT_ADMIN_PASSWORD')
    if configured is None:
        return 'admin'
    return str(configured).strip()


def _resolve_session_ttl_hours() -> int:
    raw = (os.environ.get('TRADEAUDIT_SESSION_TTL_HOURS') or '').strip()
    if not raw:
        return 12
    try:
        ttl = int(raw)
        return min(max(ttl, 1), 72)
    except ValueError:
        return 12


def create_session(password: str) -> dict | None:
    """
    Verify password and create session token.
    Returns session dict with token if successful, None otherwise.
    """
    configured_password = (password or "").strip()
    admin_password = _resolve_admin_password()

    if configured_password != (admin_password or ""):
        return None
    
    # Generate simple token
    import secrets
    token = secrets.token_urlsafe(32)
    
    # Store session with configurable expiration (default 12 hours)
    expiration = datetime.now(timezone.utc) + timedelta(hours=_resolve_session_ttl_hours())
    _SESSIONS[token] = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': expiration.isoformat(),
    }
    
    return {
        'token': token,
        'issuedAt': _SESSIONS[token]['created_at'],
        'expiresAt': expiration.isoformat(),
    }


def _extract_token() -> str | None:
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
        return token or None
    alt_token = request.headers.get('X-Access-Token', '').strip()
    return alt_token or None


def get_access_status() -> dict[str, Any]:
    """Centralized request access status for consistent auth handling."""
    token = _extract_token()
    if not token:
        return {
            'ok': False,
            'code': 'UNAUTHORIZED',
            'reason': 'missing_token',
            'message': 'Protected access required',
        }

    session = _SESSIONS.get(token)
    if not session:
        return {
            'ok': False,
            'code': 'INVALID_SESSION',
            'reason': 'invalid_token',
            'message': 'Invalid session',
        }

    expires_at = datetime.fromisoformat(session['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        _SESSIONS.pop(token, None)
        return {
            'ok': False,
            'code': 'SESSION_EXPIRED',
            'reason': 'expired',
            'message': 'Session expired',
        }

    return {
        'ok': True,
        'code': 'OK',
        'reason': 'valid',
        'message': 'Authorized',
        'expiresAt': session['expires_at'],
        'createdAt': session['created_at'],
    }


def verify_access() -> bool:
    """
    Check if request has valid access token.
    Looks in: Authorization header (Bearer token) or X-Access-Token header.
    """
    return bool(get_access_status()['ok'])


def require_access(f):
    """
    Decorator to protect routes with access check.
    Returns 401 if not authorized.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        status = get_access_status()
        if not status['ok']:
            return jsonify({
                'error': {
                    'code': status['code'],
                    'message': status['message'],
                }
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
