from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def insert_change_items(job_id: int, items: list[dict[str, Any]]) -> None:
    if not items:
        return

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with connection_scope() as connection:
        connection.executemany(
            """
            INSERT INTO backtest_change_items (
                import_job_id, strategy_id, strategy_name,
                change_type,
                before_score, after_score, score_delta,
                before_decision, after_decision,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    job_id,
                    str(item.get("strategy_id", "")),
                    str(item.get("strategy_name", "")),
                    str(item.get("change_type", "")),
                    item.get("before_score"),
                    item.get("after_score"),
                    item.get("score_delta"),
                    item.get("before_decision"),
                    item.get("after_decision"),
                    now,
                )
                for item in items
            ],
        )


def get_change_items(
    job_id: int,
    *,
    change_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 500)
    safe_offset = max(offset, 0)

    with connection_scope() as connection:
        if change_type:
            rows = connection.execute(
                """
                SELECT id, import_job_id, strategy_id, strategy_name,
                       change_type, before_score, after_score, score_delta,
                       before_decision, after_decision, created_at
                FROM backtest_change_items
                WHERE import_job_id = ? AND change_type = ?
                ORDER BY id ASC
                LIMIT ? OFFSET ?
                """,
                (job_id, change_type.upper(), safe_limit, safe_offset),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, import_job_id, strategy_id, strategy_name,
                       change_type, before_score, after_score, score_delta,
                       before_decision, after_decision, created_at
                FROM backtest_change_items
                WHERE import_job_id = ?
                ORDER BY id ASC
                LIMIT ? OFFSET ?
                """,
                (job_id, safe_limit, safe_offset),
            ).fetchall()

    return [
        {
            "id": row["id"],
            "importJobId": row["import_job_id"],
            "strategyId": row["strategy_id"],
            "strategyName": row["strategy_name"],
            "changeType": row["change_type"],
            "beforeScore": row["before_score"],
            "afterScore": row["after_score"],
            "scoreDelta": row["score_delta"],
            "beforeDecision": row["before_decision"],
            "afterDecision": row["after_decision"],
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def get_change_items_count(
    job_id: int,
    *,
    change_type: str | None = None,
) -> int:
    with connection_scope() as connection:
        if change_type:
            row = connection.execute(
                "SELECT COUNT(*) as cnt FROM backtest_change_items WHERE import_job_id = ? AND change_type = ?",
                (job_id, change_type.upper()),
            ).fetchone()
        else:
            row = connection.execute(
                "SELECT COUNT(*) as cnt FROM backtest_change_items WHERE import_job_id = ?",
                (job_id,),
            ).fetchone()
    return int(row["cnt"]) if row else 0
