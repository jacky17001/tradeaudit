from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _map_summary_row(row: Any) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "sourceType": str(row["source_type"]),
        "sourceRefId": int(row["source_ref_id"]),
        "accountLabel": str(row["account_label"]),
        "totalTrades": row["total_trades"],
        "winRate": row["win_rate"],
        "pnl": row["pnl"],
        "maxDrawdown": row["max_drawdown"],
        "profitFactor": row["profit_factor"],
        "expectancy": row["expectancy"],
        "averageHoldingTime": row["average_holding_time"],
        "periodStart": row["period_start"],
        "periodEnd": row["period_end"],
        "lastComputedAt": str(row["last_computed_at"]),
        "createdAt": str(row["created_at"]),
        "updatedAt": str(row["updated_at"]),
    }


def upsert_account_audit_summary(
    source_type: str,
    source_ref_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Insert or update a summary record for (source_type, source_ref_id)."""
    now = _now_iso()
    with connection_scope() as conn:
        existing = conn.execute(
            "SELECT id FROM account_audit_summaries WHERE source_type = ? AND source_ref_id = ?",
            (source_type, source_ref_id),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE account_audit_summaries
                SET
                    account_label = ?,
                    total_trades = ?,
                    win_rate = ?,
                    pnl = ?,
                    max_drawdown = ?,
                    profit_factor = ?,
                    expectancy = ?,
                    average_holding_time = ?,
                    period_start = ?,
                    period_end = ?,
                    last_computed_at = ?,
                    updated_at = ?
                WHERE source_type = ? AND source_ref_id = ?
                """,
                (
                    str(payload.get("account_label", "")),
                    payload.get("total_trades"),
                    payload.get("win_rate"),
                    payload.get("pnl"),
                    payload.get("max_drawdown"),
                    payload.get("profit_factor"),
                    payload.get("expectancy"),
                    payload.get("average_holding_time"),
                    payload.get("period_start"),
                    payload.get("period_end"),
                    now,
                    now,
                    source_type,
                    source_ref_id,
                ),
            )
            record_id = int(existing["id"])
        else:
            cursor = conn.execute(
                """
                INSERT INTO account_audit_summaries (
                    source_type,
                    source_ref_id,
                    account_label,
                    total_trades,
                    win_rate,
                    pnl,
                    max_drawdown,
                    profit_factor,
                    expectancy,
                    average_holding_time,
                    period_start,
                    period_end,
                    last_computed_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source_type,
                    source_ref_id,
                    str(payload.get("account_label", "")),
                    payload.get("total_trades"),
                    payload.get("win_rate"),
                    payload.get("pnl"),
                    payload.get("max_drawdown"),
                    payload.get("profit_factor"),
                    payload.get("expectancy"),
                    payload.get("average_holding_time"),
                    payload.get("period_start"),
                    payload.get("period_end"),
                    now,
                    now,
                    now,
                ),
            )
            record_id = int(cursor.lastrowid or 0)

    return get_account_audit_summary_record(record_id)


def get_account_audit_summary_record(summary_id: int) -> dict[str, Any]:
    with connection_scope() as conn:
        row = conn.execute(
            "SELECT * FROM account_audit_summaries WHERE id = ?",
            (summary_id,),
        ).fetchone()
    if row is None:
        raise ValueError(f"Account audit summary #{summary_id} not found")
    return _map_summary_row(row)


def get_account_audit_summary_by_source(
    source_type: str, source_ref_id: int
) -> dict[str, Any] | None:
    with connection_scope() as conn:
        row = conn.execute(
            "SELECT * FROM account_audit_summaries WHERE source_type = ? AND source_ref_id = ?",
            (source_type, source_ref_id),
        ).fetchone()
    if row is None:
        return None
    return _map_summary_row(row)


def list_account_audit_summary_records(
    source_type_filter: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    safe_limit = min(max(int(limit or 20), 1), 100)
    with connection_scope() as conn:
        if source_type_filter:
            rows = conn.execute(
                "SELECT * FROM account_audit_summaries WHERE source_type = ? ORDER BY id DESC LIMIT ?",
                (source_type_filter, safe_limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM account_audit_summaries ORDER BY id DESC LIMIT ?",
                (safe_limit,),
            ).fetchall()
    return [_map_summary_row(r) for r in rows]
