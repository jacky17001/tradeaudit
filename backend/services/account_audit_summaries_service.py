from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from data_sources.account_audit_summaries_repository import (
    get_account_audit_summary_by_source,
    get_account_audit_summary_record,
    list_account_audit_summary_records,
    upsert_account_audit_summary,
)
from data_sources.account_audit_mt5_repository import (
    get_mt5_connection_record,
    list_mt5_connection_trades,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _compute_metrics_from_mt5_trades(trades: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute audit metrics from a list of MT5 trade dicts."""
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": None,
            "pnl": None,
            "max_drawdown": None,
            "profit_factor": None,
            "expectancy": None,
            "average_holding_time": None,
            "period_start": None,
            "period_end": None,
        }

    total = len(trades)

    # Per-trade net PnL = profit + commission + swap
    pnl_values = [
        float(t.get("profit", 0) or 0)
        + float(t.get("commission", 0) or 0)
        + float(t.get("swap", 0) or 0)
        for t in trades
    ]

    wins = sum(1 for p in pnl_values if p > 0)
    win_rate = round((wins / total * 100), 2)
    pnl = round(sum(pnl_values), 2)

    gross_profit = sum(p for p in pnl_values if p > 0)
    gross_loss = abs(sum(p for p in pnl_values if p < 0))
    profit_factor = round(gross_profit / gross_loss, 4) if gross_loss > 0 else None

    expectancy = round(pnl / total, 4) if total > 0 else None

    # Max drawdown from running equity curve
    close_time_pnls = [
        (t.get("closeTime") or "", pnl_values[i])
        for i, t in enumerate(trades)
    ]
    close_time_pnls.sort(key=lambda x: x[0])
    running_equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for _, p in close_time_pnls:
        running_equity += p
        if running_equity > peak:
            peak = running_equity
        dd = peak - running_equity
        if dd > max_dd:
            max_dd = dd
    max_drawdown = round(max_dd, 2) if max_dd > 0 else None

    # Average holding time in hours
    holding_hours: list[float] = []
    for t in trades:
        open_time = t.get("openTime")
        close_time = t.get("closeTime")
        if open_time and close_time:
            try:
                open_dt = datetime.fromisoformat(str(open_time))
                close_dt = datetime.fromisoformat(str(close_time))
                hours = (close_dt - open_dt).total_seconds() / 3600.0
                if hours >= 0:
                    holding_hours.append(hours)
            except (ValueError, TypeError):
                pass
    avg_holding = round(sum(holding_hours) / len(holding_hours), 2) if holding_hours else None

    # Covered period
    open_times = [str(t["openTime"]) for t in trades if t.get("openTime")]
    close_times = [str(t["closeTime"]) for t in trades if t.get("closeTime")]
    period_start = min(open_times) if open_times else None
    period_end = max(close_times) if close_times else None

    return {
        "total_trades": total,
        "win_rate": win_rate,
        "pnl": pnl,
        "max_drawdown": max_drawdown,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "average_holding_time": avg_holding,
        "period_start": period_start,
        "period_end": period_end,
    }


def recompute_account_audit_summary(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Recompute and upsert an audit summary for a given source.

    Accepted source types:
    - 'mt5_investor'        → reads account_audit_mt5_trades
    - 'statement_upload'    → intake job stub (metrics mostly null)
    - 'account_history_upload' → intake job stub
    - 'manual_trade_import' → intake job stub
    """
    source_type = str(payload.get("sourceType") or "").strip()
    source_ref_id_raw = payload.get("sourceRefId")

    if not source_type:
        raise ValueError("sourceType is required")

    _allowed_source_types = {
        "mt5_investor",
        "statement_upload",
        "account_history_upload",
        "manual_trade_import",
    }
    if source_type not in _allowed_source_types:
        raise ValueError(
            f"Invalid sourceType '{source_type}'. "
            f"Allowed: {', '.join(sorted(_allowed_source_types))}"
        )

    try:
        source_ref_id = int(source_ref_id_raw or 0)
    except (TypeError, ValueError):
        raise ValueError("sourceRefId must be an integer")

    if source_ref_id <= 0:
        raise ValueError("sourceRefId must be a positive integer")

    if source_type == "mt5_investor":
        connection = get_mt5_connection_record(source_ref_id)
        trades = list_mt5_connection_trades(source_ref_id, limit=1000)
        metrics = _compute_metrics_from_mt5_trades(trades)
        account_label = str(
            connection.get("connectionLabel")
            or f"MT5 {connection.get('accountNumber', '')}@{connection.get('server', '')}"
        )
    else:
        # Intake job: minimal summary — just record that this source exists.
        # Structured trade metrics are not available; total_trades uses detectedRows.
        from data_sources.account_audit_intake_repository import get_account_audit_intake_job
        intake_job = get_account_audit_intake_job(source_ref_id)
        account_label = str(intake_job.get("sourceLabel") or f"{source_type}#{source_ref_id}")
        metrics = {
            "total_trades": intake_job.get("detectedRows"),
            "win_rate": None,
            "pnl": None,
            "max_drawdown": None,
            "profit_factor": None,
            "expectancy": None,
            "average_holding_time": None,
            "period_start": None,
            "period_end": None,
        }

    upsert_payload = {
        "account_label": account_label,
        **metrics,
    }
    return upsert_account_audit_summary(source_type, source_ref_id, upsert_payload)


def get_account_audit_summary_detail(summary_id: int) -> dict[str, Any]:
    return get_account_audit_summary_record(summary_id)


def list_account_audit_summaries(
    source_type_filter: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    return list_account_audit_summary_records(source_type_filter, limit)
