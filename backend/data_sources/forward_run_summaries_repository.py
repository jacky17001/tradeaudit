from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_summary(row: Any) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "forwardRunId": int(row["forward_run_id"]),
        "totalTrades": int(row["total_trades"] or 0),
        "winRate": float(row["win_rate"] or 0),
        "pnl": float(row["pnl"] or 0),
        "maxDrawdown": float(row["max_drawdown"] or 0),
        "expectancy": float(row["expectancy"] or 0),
        "periodStart": row["period_start"],
        "periodEnd": row["period_end"],
        "lastUpdatedAt": row["last_updated_at"],
        "createdAt": row["created_at"],
    }


def upsert_forward_run_summary(
    forward_run_id: int,
    total_trades: int,
    win_rate: float,
    pnl: float,
    max_drawdown: float,
    expectancy: float,
    period_start: str | None,
    period_end: str | None,
) -> dict[str, Any]:
    now = _now_iso()

    with connection_scope() as connection:
        existing = connection.execute(
            "SELECT id FROM forward_run_summaries WHERE forward_run_id = ? LIMIT 1",
            (forward_run_id,),
        ).fetchone()

        if existing is None:
            connection.execute(
                """
                INSERT INTO forward_run_summaries (
                    forward_run_id,
                    total_trades, win_rate, pnl, max_drawdown, expectancy,
                    period_start, period_end,
                    last_updated_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    forward_run_id,
                    total_trades,
                    win_rate,
                    pnl,
                    max_drawdown,
                    expectancy,
                    period_start,
                    period_end,
                    now,
                    now,
                ),
            )
        else:
            connection.execute(
                """
                UPDATE forward_run_summaries
                SET
                    total_trades = ?,
                    win_rate = ?,
                    pnl = ?,
                    max_drawdown = ?,
                    expectancy = ?,
                    period_start = ?,
                    period_end = ?,
                    last_updated_at = ?
                WHERE forward_run_id = ?
                """,
                (
                    total_trades,
                    win_rate,
                    pnl,
                    max_drawdown,
                    expectancy,
                    period_start,
                    period_end,
                    now,
                    forward_run_id,
                ),
            )

    summary = get_forward_run_summary(forward_run_id)
    if summary is None:
        raise ValueError("Failed to save forward run summary")
    return summary


def get_forward_run_summary(forward_run_id: int) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id, forward_run_id,
                total_trades, win_rate, pnl, max_drawdown, expectancy,
                period_start, period_end,
                last_updated_at, created_at
            FROM forward_run_summaries
            WHERE forward_run_id = ?
            LIMIT 1
            """,
            (forward_run_id,),
        ).fetchone()

    if row is None:
        return None
    return _row_to_summary(row)


def list_forward_run_summaries(forward_run_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not forward_run_ids:
        return {}

    placeholders = ",".join(["?"] * len(forward_run_ids))
    with connection_scope() as connection:
        rows = connection.execute(
            f"""
            SELECT
                id, forward_run_id,
                total_trades, win_rate, pnl, max_drawdown, expectancy,
                period_start, period_end,
                last_updated_at, created_at
            FROM forward_run_summaries
            WHERE forward_run_id IN ({placeholders})
            """,
            tuple(forward_run_ids),
        ).fetchall()

    return {
        int(row["forward_run_id"]): _row_to_summary(row)
        for row in rows
    }
