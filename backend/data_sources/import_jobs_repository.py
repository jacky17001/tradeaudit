from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def insert_import_job(log: dict[str, Any]) -> int:
    triggered_at = str(
        log.get("triggeredAt")
        or datetime.now(timezone.utc).isoformat(timespec="seconds")
    )

    with connection_scope() as connection:
        cursor = connection.execute(
            """
            INSERT INTO import_jobs (
                jobType, triggeredAt, sourcePath, mode,
                importedCount, skippedCount, failedCount, invalidRowCount,
                reEvaluatedCount, snapshotWrittenCount,
                status, errorMessage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(log.get("jobType", "backtests-import")),
                triggered_at,
                str(log.get("sourcePath", "")),
                str(log.get("mode", "replace")),
                _to_int(log.get("importedCount"), 0),
                _to_int(log.get("skippedCount"), 0),
                _to_int(log.get("failedCount"), 0),
                _to_int(log.get("invalidRowCount"), 0),
                _to_int(log.get("reEvaluatedCount"), 0),
                _to_int(log.get("snapshotWrittenCount"), 0),
                str(log.get("status", "unknown")),
                str(log.get("errorMessage", "") or ""),
            ),
        )
        return int(cursor.lastrowid or 0)


def get_recent_import_jobs(limit: int = 5) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 50))

    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT
                id, jobType, triggeredAt, sourcePath, mode,
                importedCount, skippedCount, failedCount, invalidRowCount,
                reEvaluatedCount, snapshotWrittenCount,
                status, errorMessage
            FROM import_jobs
            ORDER BY id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()

    return [
        {
            "id": _to_int(row["id"]),
            "jobType": row["jobType"],
            "triggeredAt": row["triggeredAt"],
            "sourcePath": row["sourcePath"],
            "mode": row["mode"],
            "importedCount": _to_int(row["importedCount"]),
            "skippedCount": _to_int(row["skippedCount"]),
            "failedCount": _to_int(row["failedCount"]),
            "invalidRowCount": _to_int(row["invalidRowCount"]),
            "reEvaluatedCount": _to_int(row["reEvaluatedCount"]),
            "snapshotWrittenCount": _to_int(row["snapshotWrittenCount"]),
            "status": row["status"],
            "errorMessage": row["errorMessage"] or "",
        }
        for row in rows
    ]


def get_import_job_by_id(job_id: int) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id, jobType, triggeredAt, sourcePath, mode,
                importedCount, skippedCount, failedCount, invalidRowCount,
                reEvaluatedCount, snapshotWrittenCount,
                status, errorMessage
            FROM import_jobs
            WHERE id = ?
            LIMIT 1
            """,
            (job_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "id": _to_int(row["id"]),
        "jobType": row["jobType"],
        "triggeredAt": row["triggeredAt"],
        "sourcePath": row["sourcePath"],
        "mode": row["mode"],
        "importedCount": _to_int(row["importedCount"]),
        "skippedCount": _to_int(row["skippedCount"]),
        "failedCount": _to_int(row["failedCount"]),
        "invalidRowCount": _to_int(row["invalidRowCount"]),
        "reEvaluatedCount": _to_int(row["reEvaluatedCount"]),
        "snapshotWrittenCount": _to_int(row["snapshotWrittenCount"]),
        "status": row["status"],
        "errorMessage": row["errorMessage"] or "",
    }