from datetime import datetime, timezone
import json
from typing import Any

from db.sqlite import connection_scope


# ---------------------------------------------------------------------------
# backtest_job_snapshots  – stores the full backtests rows per import job
# ---------------------------------------------------------------------------

def insert_job_snapshot_rows(job_id: int, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    with connection_scope() as connection:
        connection.executemany(
            """
            INSERT INTO backtest_job_snapshots (
                import_job_id, strategy_id, strategy_name,
                symbol, timeframe,
                return_pct, win_rate, max_drawdown, profit_factor, trade_count,
                score, decision
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    job_id,
                    str(row.get("strategy_id", "")),
                    str(row.get("strategy_name", "")),
                    str(row.get("symbol", "")),
                    str(row.get("timeframe", "")),
                    float(row.get("return_pct", 0)),
                    float(row.get("win_rate", 0)),
                    float(row.get("max_drawdown", 0)),
                    float(row.get("profit_factor", 0)),
                    int(row.get("trade_count", 0)),
                    int(row.get("score", 0)),
                    str(row.get("decision", "")),
                )
                for row in rows
            ],
        )


def get_job_snapshot_rows(job_id: int) -> list[dict[str, Any]]:
    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT strategy_id, strategy_name, symbol, timeframe,
                   return_pct, win_rate, max_drawdown, profit_factor, trade_count,
                   score, decision
            FROM backtest_job_snapshots
            WHERE import_job_id = ?
            ORDER BY id ASC
            """,
            (job_id,),
        ).fetchall()

    return [
        {
            "strategy_id": row["strategy_id"],
            "strategy_name": row["strategy_name"],
            "symbol": row["symbol"],
            "timeframe": row["timeframe"],
            "return_pct": float(row["return_pct"]),
            "win_rate": float(row["win_rate"]),
            "max_drawdown": float(row["max_drawdown"]),
            "profit_factor": float(row["profit_factor"]),
            "trade_count": int(row["trade_count"]),
            "score": int(row["score"]),
            "decision": str(row["decision"]),
        }
        for row in rows
    ]


def has_job_snapshot(job_id: int) -> bool:
    with connection_scope() as connection:
        row = connection.execute(
            "SELECT COUNT(*) as cnt FROM backtest_job_snapshots WHERE import_job_id = ?",
            (job_id,),
        ).fetchone()
    return int(row["cnt"]) > 0


# ---------------------------------------------------------------------------
# backtest_dataset_activations  – audit log of dataset activations
# ---------------------------------------------------------------------------

def insert_activation(
    source_import_job_id: int,
    strategies_count: int,
    activated_at: str | None = None,
    note: str | None = None,
    activation_diff_summary: dict[str, Any] | None = None,
) -> int:
    ts = activated_at or datetime.now(timezone.utc).isoformat(timespec="seconds")

    with connection_scope() as connection:
        cursor = connection.execute(
            """
            INSERT INTO backtest_dataset_activations (
                source_import_job_id, activated_at, activated_by, note,
                activation_diff_summary,
                strategies_count
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                source_import_job_id,
                ts,
                "system",
                note,
                json.dumps(activation_diff_summary, ensure_ascii=True) if activation_diff_summary is not None else None,
                strategies_count,
            ),
        )
        return int(cursor.lastrowid or 0)


def get_latest_activation() -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT id, source_import_job_id, activated_at, strategies_count, note, activation_diff_summary
            FROM backtest_dataset_activations
            ORDER BY id DESC
            LIMIT 1
            """,
        ).fetchone()

    if row is None:
        return None

    return {
        "id": int(row["id"]),
        "source_import_job_id": int(row["source_import_job_id"]),
        "activated_at": row["activated_at"],
        "strategies_count": int(row["strategies_count"]),
        "note": row["note"],
        "activation_diff_summary": json.loads(row["activation_diff_summary"]) if row["activation_diff_summary"] else None,
    }
