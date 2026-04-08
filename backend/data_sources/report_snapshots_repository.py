"""Report snapshots repository (Stage 50)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from db.sqlite import connection_scope


def insert_report_snapshot(
    snapshot_type: str,
    object_type: str,
    object_ref_id: int,
    title: str,
    payload_json: str,
    note: str | None,
) -> dict[str, Any]:
    now = datetime.utcnow().isoformat()
    with connection_scope() as conn:
        cursor = conn.execute(
            """
            INSERT INTO report_snapshots
            (snapshot_type, object_type, object_ref_id, title, payload_json, created_at, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (snapshot_type, object_type, object_ref_id, title, payload_json, now, note),
        )
        snapshot_id = int(cursor.lastrowid)
    return get_report_snapshot(snapshot_id)


def get_report_snapshot(snapshot_id: int) -> dict[str, Any] | None:
    with connection_scope() as conn:
        row = conn.execute("SELECT * FROM report_snapshots WHERE id = ?", (snapshot_id,)).fetchone()
    return dict(row) if row else None


def list_report_snapshots(
    limit: int = 200,
    snapshot_type: str | None = None,
    object_type: str | None = None,
    object_ref_id: int | None = None,
) -> list[dict[str, Any]]:
    with connection_scope() as conn:
        query = "SELECT * FROM report_snapshots WHERE 1=1"
        params: list[Any] = []

        if snapshot_type:
            query += " AND snapshot_type = ?"
            params.append(snapshot_type)
        if object_type:
            query += " AND object_type = ?"
            params.append(object_type)
        if object_ref_id is not None:
            query += " AND object_ref_id = ?"
            params.append(object_ref_id)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def count_report_snapshots(
    snapshot_type: str | None = None,
    object_type: str | None = None,
    object_ref_id: int | None = None,
) -> int:
    with connection_scope() as conn:
        query = "SELECT COUNT(*) AS c FROM report_snapshots WHERE 1=1"
        params: list[Any] = []

        if snapshot_type:
            query += " AND snapshot_type = ?"
            params.append(snapshot_type)
        if object_type:
            query += " AND object_type = ?"
            params.append(object_type)
        if object_ref_id is not None:
            query += " AND object_ref_id = ?"
            params.append(object_ref_id)

        row = conn.execute(query, params).fetchone()
    return int(row["c"]) if row else 0
