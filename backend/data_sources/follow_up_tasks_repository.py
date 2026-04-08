"""Follow-up tasks repository."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from db.sqlite import connection_scope


def insert_follow_up_task(
    object_type: str,
    object_ref_id: int,
    action_key: str,
    title: str,
    status: str,
    priority: str,
    due_label: str,
    note: str | None,
) -> dict[str, Any]:
    now = datetime.utcnow().isoformat()
    with connection_scope() as conn:
        cursor = conn.execute(
            """
            INSERT INTO follow_up_tasks
            (object_type, object_ref_id, action_key, title, status, priority, due_label, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (object_type, object_ref_id, action_key, title, status, priority, due_label, note, now, now),
        )
        task_id = int(cursor.lastrowid)

    return get_follow_up_task(task_id)


def get_follow_up_task(task_id: int) -> dict[str, Any] | None:
    with connection_scope() as conn:
        row = conn.execute("SELECT * FROM follow_up_tasks WHERE id = ?", (task_id,)).fetchone()
    return dict(row) if row else None


def get_follow_up_tasks(
    limit: int = 100,
    object_type: str | None = None,
    object_ref_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
) -> list[dict[str, Any]]:
    with connection_scope() as conn:
        query = "SELECT * FROM follow_up_tasks WHERE 1=1"
        params: list[Any] = []

        if object_type:
            query += " AND object_type = ?"
            params.append(object_type)
        if object_ref_id is not None:
            query += " AND object_ref_id = ?"
            params.append(object_ref_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        if priority:
            query += " AND priority = ?"
            params.append(priority)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()

    return [dict(row) for row in rows]


def count_follow_up_tasks(
    object_type: str | None = None,
    object_ref_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
) -> int:
    with connection_scope() as conn:
        query = "SELECT COUNT(*) AS c FROM follow_up_tasks WHERE 1=1"
        params: list[Any] = []

        if object_type:
            query += " AND object_type = ?"
            params.append(object_type)
        if object_ref_id is not None:
            query += " AND object_ref_id = ?"
            params.append(object_ref_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        if priority:
            query += " AND priority = ?"
            params.append(priority)

        row = conn.execute(query, params).fetchone()
    return int(row["c"]) if row else 0


def update_follow_up_task(
    task_id: int,
    status: str | None = None,
    priority: str | None = None,
    due_label: str | None = None,
    note: str | None = None,
) -> dict[str, Any] | None:
    fields: list[str] = []
    params: list[Any] = []

    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if priority is not None:
        fields.append("priority = ?")
        params.append(priority)
    if due_label is not None:
        fields.append("due_label = ?")
        params.append(due_label)
    if note is not None:
        fields.append("note = ?")
        params.append(note)

    if not fields:
        return get_follow_up_task(task_id)

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(task_id)

    with connection_scope() as conn:
        cursor = conn.execute(
            f"UPDATE follow_up_tasks SET {', '.join(fields)} WHERE id = ?",
            params,
        )
        if cursor.rowcount == 0:
            return None

    return get_follow_up_task(task_id)
