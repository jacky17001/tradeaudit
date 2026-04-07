from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def insert_account_audit_intake_job(payload: dict[str, Any]) -> dict[str, Any]:
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with connection_scope() as connection:
        cursor = connection.execute(
            """
            INSERT INTO account_audit_intake_jobs (
                source_type,
                intake_method,
                source_label,
                original_filename,
                detected_rows,
                note,
                status,
                error_message,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(payload.get("source_type", "")),
                str(payload.get("intake_method", "")),
                str(payload.get("source_label", "")),
                str(payload.get("original_filename", "") or ""),
                int(payload.get("detected_rows", 0) or 0),
                str(payload.get("note", "") or ""),
                str(payload.get("status", "SUCCESS")),
                str(payload.get("error_message", "") or ""),
                created_at,
            ),
        )
        job_id = int(cursor.lastrowid or 0)

    return get_account_audit_intake_job(job_id)


def get_account_audit_intake_job(job_id: int) -> dict[str, Any]:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                source_type,
                intake_method,
                source_label,
                original_filename,
                detected_rows,
                note,
                status,
                error_message,
                created_at
            FROM account_audit_intake_jobs
            WHERE id = ?
            LIMIT 1
            """,
            (job_id,),
        ).fetchone()

    if row is None:
        raise ValueError(f"Account audit intake job {job_id} does not exist")

    return {
        "id": int(row["id"]),
        "sourceType": str(row["source_type"]),
        "intakeMethod": str(row["intake_method"]),
        "sourceLabel": str(row["source_label"]),
        "originalFilename": str(row["original_filename"] or ""),
        "detectedRows": int(row["detected_rows"] or 0),
        "note": str(row["note"] or ""),
        "status": str(row["status"]),
        "errorMessage": str(row["error_message"] or ""),
        "createdAt": str(row["created_at"]),
    }


def list_account_audit_intake_jobs(limit: int = 5) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 20)
    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                source_type,
                intake_method,
                source_label,
                original_filename,
                detected_rows,
                note,
                status,
                error_message,
                created_at
            FROM account_audit_intake_jobs
            ORDER BY id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()

    return [
        {
            "id": int(row["id"]),
            "sourceType": str(row["source_type"]),
            "intakeMethod": str(row["intake_method"]),
            "sourceLabel": str(row["source_label"]),
            "originalFilename": str(row["original_filename"] or ""),
            "detectedRows": int(row["detected_rows"] or 0),
            "note": str(row["note"] or ""),
            "status": str(row["status"]),
            "errorMessage": str(row["error_message"] or ""),
            "createdAt": str(row["created_at"]),
        }
        for row in rows
    ]