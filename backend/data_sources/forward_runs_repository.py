from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _map_forward_run_row(row: Any) -> dict[str, Any]:
    summary = None
    if row["summary_id"] is not None:
        summary = {
            "id": int(row["summary_id"]),
            "forwardRunId": int(row["id"]),
            "totalTrades": int(row["total_trades"] or 0),
            "winRate": float(row["win_rate"] or 0),
            "pnl": float(row["pnl"] or 0),
            "maxDrawdown": float(row["max_drawdown"] or 0),
            "expectancy": float(row["expectancy"] or 0),
            "periodStart": row["period_start"],
            "periodEnd": row["period_end"],
            "lastUpdatedAt": row["last_updated_at"],
            "createdAt": row["summary_created_at"],
        }

    gate_result = None
    if row["gate_result_id"] is not None:
        gate_result = {
            "id": int(row["gate_result_id"]),
            "forwardRunId": int(row["id"]),
            "gateDecision": str(row["gate_decision"]),
            "confidence": row["confidence"],
            "hardFail": bool(row["hard_fail"]),
            "sampleAdequacy": row["sample_adequacy"],
            "strongestFactor": row["strongest_factor"],
            "weakestFactor": row["weakest_factor"],
            "notes": row["gate_notes"] or "",
            "evaluatedAt": row["evaluated_at"],
            "createdAt": row["gate_created_at"],
            "updatedAt": row["gate_updated_at"],
        }

    return {
        "id": int(row["id"]),
        "strategyId": row["strategy_id"],
        "strategyName": row["strategy_name"],
        "sourceJobId": int(row["source_job_id"]) if row["source_job_id"] is not None else None,
        "symbol": row["symbol"],
        "timeframe": row["timeframe"],
        "status": row["status"],
        "note": row["note"] or "",
        "startedAt": row["started_at"],
        "endedAt": row["ended_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "summary": summary,
        "gateResult": gate_result,
    }


def create_forward_run(
    strategy_id: str,
    strategy_name: str,
    source_job_id: int | None,
    symbol: str,
    timeframe: str,
    status: str,
    note: str = "",
    started_at: str | None = None,
) -> int:
    created_at = _now_iso()
    run_started_at = started_at or created_at

    with connection_scope() as connection:
        cursor = connection.execute(
            """
            INSERT INTO forward_runs (
                strategy_id, strategy_name, source_job_id,
                symbol, timeframe, status, note,
                started_at, ended_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                strategy_id,
                strategy_name,
                source_job_id,
                symbol,
                timeframe,
                status,
                note,
                run_started_at,
                None,
                created_at,
                created_at,
            ),
        )
        return int(cursor.lastrowid or 0)


def get_forward_run(run_id: int) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                fr.id, fr.strategy_id, fr.strategy_name, fr.source_job_id,
                fr.symbol, fr.timeframe, fr.status, fr.note,
                fr.started_at, fr.ended_at, fr.created_at, fr.updated_at,
                s.id AS summary_id,
                s.total_trades, s.win_rate, s.pnl, s.max_drawdown, s.expectancy,
                s.period_start, s.period_end, s.last_updated_at, s.created_at AS summary_created_at,
                gr.id AS gate_result_id,
                gr.gate_decision, gr.confidence, gr.hard_fail,
                gr.sample_adequacy, gr.strongest_factor, gr.weakest_factor,
                gr.notes AS gate_notes, gr.evaluated_at,
                gr.created_at AS gate_created_at, gr.updated_at AS gate_updated_at
            FROM forward_runs fr
            LEFT JOIN forward_run_summaries s ON s.forward_run_id = fr.id
            LEFT JOIN forward_run_gate_results gr ON gr.forward_run_id = fr.id
            WHERE fr.id = ?
            LIMIT 1
            """,
            (run_id,),
        ).fetchone()

    if row is None:
        return None

    return _map_forward_run_row(row)


def get_latest_forward_run_by_strategy(strategy_id: str) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                fr.id, fr.strategy_id, fr.strategy_name, fr.source_job_id,
                fr.symbol, fr.timeframe, fr.status, fr.note,
                fr.started_at, fr.ended_at, fr.created_at, fr.updated_at,
                s.id AS summary_id,
                s.total_trades, s.win_rate, s.pnl, s.max_drawdown, s.expectancy,
                s.period_start, s.period_end, s.last_updated_at, s.created_at AS summary_created_at,
                gr.id AS gate_result_id,
                gr.gate_decision, gr.confidence, gr.hard_fail,
                gr.sample_adequacy, gr.strongest_factor, gr.weakest_factor,
                gr.notes AS gate_notes, gr.evaluated_at,
                gr.created_at AS gate_created_at, gr.updated_at AS gate_updated_at
            FROM forward_runs fr
            LEFT JOIN forward_run_summaries s ON s.forward_run_id = fr.id
            LEFT JOIN forward_run_gate_results gr ON gr.forward_run_id = fr.id
            WHERE fr.strategy_id = ?
            ORDER BY fr.id DESC
            LIMIT 1
            """,
            (strategy_id,),
        ).fetchone()

    if row is None:
        return None

    return _map_forward_run_row(row)


def list_forward_runs(
    status: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict[str, Any]:
    offset = (page - 1) * page_size

    with connection_scope() as connection:
        if status:
            rows = connection.execute(
                """
                SELECT
                    fr.id, fr.strategy_id, fr.strategy_name, fr.source_job_id,
                    fr.symbol, fr.timeframe, fr.status, fr.note,
                    fr.started_at, fr.ended_at, fr.created_at, fr.updated_at,
                    s.id AS summary_id,
                    s.total_trades, s.win_rate, s.pnl, s.max_drawdown, s.expectancy,
                    s.period_start, s.period_end, s.last_updated_at, s.created_at AS summary_created_at,
                    gr.id AS gate_result_id,
                    gr.gate_decision, gr.confidence, gr.hard_fail,
                    gr.sample_adequacy, gr.strongest_factor, gr.weakest_factor,
                    gr.notes AS gate_notes, gr.evaluated_at,
                    gr.created_at AS gate_created_at, gr.updated_at AS gate_updated_at
                FROM forward_runs fr
                LEFT JOIN forward_run_summaries s ON s.forward_run_id = fr.id
                LEFT JOIN forward_run_gate_results gr ON gr.forward_run_id = fr.id
                WHERE fr.status = ?
                ORDER BY fr.id DESC
                LIMIT ? OFFSET ?
                """,
                (status, page_size, offset),
            ).fetchall()
            count_row = connection.execute(
                "SELECT COUNT(*) AS total FROM forward_runs WHERE status = ?",
                (status,),
            ).fetchone()
        else:
            rows = connection.execute(
                """
                SELECT
                    fr.id, fr.strategy_id, fr.strategy_name, fr.source_job_id,
                    fr.symbol, fr.timeframe, fr.status, fr.note,
                    fr.started_at, fr.ended_at, fr.created_at, fr.updated_at,
                    s.id AS summary_id,
                    s.total_trades, s.win_rate, s.pnl, s.max_drawdown, s.expectancy,
                    s.period_start, s.period_end, s.last_updated_at, s.created_at AS summary_created_at,
                    gr.id AS gate_result_id,
                    gr.gate_decision, gr.confidence, gr.hard_fail,
                    gr.sample_adequacy, gr.strongest_factor, gr.weakest_factor,
                    gr.notes AS gate_notes, gr.evaluated_at,
                    gr.created_at AS gate_created_at, gr.updated_at AS gate_updated_at
                FROM forward_runs fr
                LEFT JOIN forward_run_summaries s ON s.forward_run_id = fr.id
                LEFT JOIN forward_run_gate_results gr ON gr.forward_run_id = fr.id
                ORDER BY fr.id DESC
                LIMIT ? OFFSET ?
                """,
                (page_size, offset),
            ).fetchall()
            count_row = connection.execute(
                "SELECT COUNT(*) AS total FROM forward_runs"
            ).fetchone()

    items = []
    for row in rows:
        items.append(_map_forward_run_row(row))
    total = int(count_row["total"] or 0) if count_row else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


def update_forward_run_status(run_id: int, status: str, ended_at: str | None = None) -> dict[str, Any] | None:
    updated_at = _now_iso()

    with connection_scope() as connection:
        connection.execute(
            """
            UPDATE forward_runs
            SET status = ?, ended_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, ended_at, updated_at, run_id),
        )

    return get_forward_run(run_id)
