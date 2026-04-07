"""
Audit Cases Repository - Data access for audit cases
"""
from datetime import datetime
from db.sqlite import connection_scope


def insert_audit_case(case_type: str, ref_id: int, priority: str = 'normal', 
                     status: str = 'open', note: str = None) -> dict:
    """Create a new audit case"""
    with connection_scope() as db:
        now = datetime.utcnow().isoformat()
        
        cursor = db.execute(
            """
            INSERT INTO audit_cases 
            (case_type, ref_id, priority, status, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (case_type, ref_id, priority, status, note, now, now)
        )
        
        return {
            'id': cursor.lastrowid,
            'case_type': case_type,
            'ref_id': ref_id,
            'priority': priority,
            'status': status,
            'note': note,
            'created_at': now,
            'updated_at': now
        }


def get_audit_cases(limit: int = 50, status_filter: str = None, 
                   priority_filter: str = None) -> list:
    """Get audit cases with optional filters"""
    with connection_scope() as db:
        query = "SELECT * FROM audit_cases WHERE 1=1"
        params = []
        
        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)
        
        if priority_filter:
            query += " AND priority = ?"
            params.append(priority_filter)
        
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def get_audit_case(case_id: int) -> dict:
    """Get a single audit case by ID"""
    with connection_scope() as db:
        row = db.execute(
            "SELECT * FROM audit_cases WHERE id = ?",
            (case_id,)
        ).fetchone()
        return dict(row) if row else None


def update_audit_case(case_id: int, **kwargs) -> dict:
    """Update an audit case"""
    with connection_scope() as db:
        now = datetime.utcnow().isoformat()
        
        allowed_fields = {'priority', 'status', 'note'}
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
        updates['updated_at'] = now
        
        if not updates:
            return get_audit_case(case_id)
        
        set_clause = ', '.join([f'{k} = ?' for k in updates.keys()])
        values = list(updates.values()) + [case_id]
        
        db.execute(
            f"UPDATE audit_cases SET {set_clause} WHERE id = ?",
            values
        )
        
        return get_audit_case(case_id)


def get_review_queue(limit: int = 50) -> list:
    """Get review queue - prioritized list of cases for human review"""
    with connection_scope() as db:
        # Priority: high status cases, then by priority level
        rows = db.execute(
            """
            SELECT * FROM audit_cases
            WHERE status IN ('open', 'in_progress')
            ORDER BY 
                CASE WHEN priority = 'high' THEN 1 WHEN priority = 'normal' THEN 2 ELSE 3 END,
                created_at ASC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
        
        return [dict(row) for row in rows]


def count_audit_cases(status: str = None) -> int:
    """Count audit cases by status"""
    with connection_scope() as db:
        if status:
            result = db.execute(
                "SELECT COUNT(*) as cnt FROM audit_cases WHERE status = ?",
                (status,)
            ).fetchone()
        else:
            result = db.execute(
                "SELECT COUNT(*) as cnt FROM audit_cases"
            ).fetchone()
        
        return result['cnt'] if result else 0


def delete_audit_case(case_id: int) -> bool:
    """Delete an audit case"""
    with connection_scope() as db:
        db.execute("DELETE FROM audit_cases WHERE id = ?", (case_id,))
    return True
