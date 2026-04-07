"""
Review Notes & Actions Repository
"""
from datetime import datetime
from db.sqlite import connection_scope


def add_review_note(case_id: int, content: str, note_type: str = 'comment', 
                   created_by: str = 'system') -> dict:
    """Add a note to a case"""
    with connection_scope() as db:
        now = datetime.utcnow().isoformat()
        
        cursor = db.execute(
            """
            INSERT INTO review_notes (case_id, content, note_type, created_at, created_by)
            VALUES (?, ?, ?, ?, ?)
            """,
            (case_id, content, note_type, now, created_by)
        )
        
        return {
            'id': cursor.lastrowid,
            'case_id': case_id,
            'content': content,
            'note_type': note_type,
            'created_at': now,
            'created_by': created_by
        }


def get_review_notes(case_id: int, limit: int = 100) -> list:
    """Get all notes for a case"""
    with connection_scope() as db:
        rows = db.execute(
            """
            SELECT * FROM review_notes 
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (case_id, limit)
        ).fetchall()
        return [dict(row) for row in rows]


def get_latest_review_note(case_id: int) -> dict:
    """Get the most recent note for a case"""
    with connection_scope() as db:
        row = db.execute(
            """
            SELECT * FROM review_notes 
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (case_id,)
        ).fetchone()
        return dict(row) if row else None


def add_review_action(case_id: int, action: str, reason: str = None,
                     previous_status: str = None, new_status: str = None,
                     created_by: str = 'system') -> dict:
    """Record a review action (approve/reject/watch/needs_data)"""
    with connection_scope() as db:
        now = datetime.utcnow().isoformat()
        
        cursor = db.execute(
            """
            INSERT INTO review_actions 
            (case_id, action, reason, previous_status, new_status, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (case_id, action, reason, previous_status, new_status, now, created_by)
        )
        
        return {
            'id': cursor.lastrowid,
            'case_id': case_id,
            'action': action,
            'reason': reason,
            'previous_status': previous_status,
            'new_status': new_status,
            'created_at': now,
            'created_by': created_by
        }


def get_review_actions(case_id: int, limit: int = 100) -> list:
    """Get all actions for a case"""
    with connection_scope() as db:
        rows = db.execute(
            """
            SELECT * FROM review_actions 
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (case_id, limit)
        ).fetchall()
        return [dict(row) for row in rows]


def get_latest_review_action(case_id: int) -> dict:
    """Get the most recent action for a case"""
    with connection_scope() as db:
        row = db.execute(
            """
            SELECT * FROM review_actions 
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (case_id,)
        ).fetchone()
        return dict(row) if row else None
