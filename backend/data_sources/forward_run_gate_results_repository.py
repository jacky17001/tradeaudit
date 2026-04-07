from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_gate_result(row: Any) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "forwardRunId": int(row["forward_run_id"]),
        "gateDecision": str(row["gate_decision"]),
        "confidence": row["confidence"],
        "hardFail": bool(row["hard_fail"]),
        "sampleAdequacy": row["sample_adequacy"],
        "strongestFactor": row["strongest_factor"],
        "weakestFactor": row["weakest_factor"],
        "notes": row["notes"] or "",
        "evaluatedAt": row["evaluated_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def upsert_forward_run_gate_result(
    forward_run_id: int,
    gate_decision: str,
    confidence: str | None,
    hard_fail: bool,
    sample_adequacy: str | None,
    strongest_factor: str | None,
    weakest_factor: str | None,
    notes: str,
    evaluated_at: str | None,
) -> dict[str, Any]:
    now = _now_iso()
    evaluated_ts = evaluated_at or now

    with connection_scope() as connection:
        existing = connection.execute(
            "SELECT id FROM forward_run_gate_results WHERE forward_run_id = ? LIMIT 1",
            (forward_run_id,),
        ).fetchone()

        if existing is None:
            connection.execute(
                """
                INSERT INTO forward_run_gate_results (
                    forward_run_id,
                    gate_decision,
                    confidence,
                    hard_fail,
                    sample_adequacy,
                    strongest_factor,
                    weakest_factor,
                    notes,
                    evaluated_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    forward_run_id,
                    gate_decision,
                    confidence,
                    1 if hard_fail else 0,
                    sample_adequacy,
                    strongest_factor,
                    weakest_factor,
                    notes,
                    evaluated_ts,
                    now,
                    now,
                ),
            )
        else:
            connection.execute(
                """
                UPDATE forward_run_gate_results
                SET
                    gate_decision = ?,
                    confidence = ?,
                    hard_fail = ?,
                    sample_adequacy = ?,
                    strongest_factor = ?,
                    weakest_factor = ?,
                    notes = ?,
                    evaluated_at = ?,
                    updated_at = ?
                WHERE forward_run_id = ?
                """,
                (
                    gate_decision,
                    confidence,
                    1 if hard_fail else 0,
                    sample_adequacy,
                    strongest_factor,
                    weakest_factor,
                    notes,
                    evaluated_ts,
                    now,
                    forward_run_id,
                ),
            )

    gate_result = get_forward_run_gate_result(forward_run_id)
    if gate_result is None:
        raise ValueError("Failed to save forward run gate result")
    return gate_result


def get_forward_run_gate_result(forward_run_id: int) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                forward_run_id,
                gate_decision,
                confidence,
                hard_fail,
                sample_adequacy,
                strongest_factor,
                weakest_factor,
                notes,
                evaluated_at,
                created_at,
                updated_at
            FROM forward_run_gate_results
            WHERE forward_run_id = ?
            LIMIT 1
            """,
            (forward_run_id,),
        ).fetchone()

    if row is None:
        return None
    return _row_to_gate_result(row)


def list_gate_results(
    decision: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    offset = (page - 1) * page_size

    with connection_scope() as connection:
        if decision:
            rows = connection.execute(
                """
                SELECT
                    gr.id,
                    gr.forward_run_id,
                    gr.gate_decision,
                    gr.confidence,
                    gr.hard_fail,
                    gr.sample_adequacy,
                    gr.strongest_factor,
                    gr.weakest_factor,
                    gr.notes,
                    gr.evaluated_at,
                    gr.created_at,
                    gr.updated_at,
                    fr.strategy_id,
                    fr.strategy_name,
                    fr.symbol,
                    fr.timeframe,
                    fr.status AS forward_status
                FROM forward_run_gate_results gr
                INNER JOIN forward_runs fr ON fr.id = gr.forward_run_id
                WHERE gr.gate_decision = ?
                ORDER BY gr.id DESC
                LIMIT ? OFFSET ?
                """,
                (decision, page_size, offset),
            ).fetchall()
            count_row = connection.execute(
                "SELECT COUNT(*) AS total FROM forward_run_gate_results WHERE gate_decision = ?",
                (decision,),
            ).fetchone()
        else:
            rows = connection.execute(
                """
                SELECT
                    gr.id,
                    gr.forward_run_id,
                    gr.gate_decision,
                    gr.confidence,
                    gr.hard_fail,
                    gr.sample_adequacy,
                    gr.strongest_factor,
                    gr.weakest_factor,
                    gr.notes,
                    gr.evaluated_at,
                    gr.created_at,
                    gr.updated_at,
                    fr.strategy_id,
                    fr.strategy_name,
                    fr.symbol,
                    fr.timeframe,
                    fr.status AS forward_status
                FROM forward_run_gate_results gr
                INNER JOIN forward_runs fr ON fr.id = gr.forward_run_id
                ORDER BY gr.id DESC
                LIMIT ? OFFSET ?
                """,
                (page_size, offset),
            ).fetchall()
            count_row = connection.execute(
                "SELECT COUNT(*) AS total FROM forward_run_gate_results"
            ).fetchone()

    items = []
    for row in rows:
        items.append(
            {
                **_row_to_gate_result(row),
                "strategyId": str(row["strategy_id"]),
                "strategyName": str(row["strategy_name"]),
                "symbol": str(row["symbol"]),
                "timeframe": str(row["timeframe"]),
                "forwardStatus": str(row["forward_status"]),
            }
        )

    total = int(count_row["total"] or 0) if count_row else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }
