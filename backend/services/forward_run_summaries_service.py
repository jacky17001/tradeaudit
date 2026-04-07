from typing import Any

from data_sources.forward_run_summaries_repository import (
    get_forward_run_summary,
    upsert_forward_run_summary,
)
from data_sources.forward_runs_repository import get_forward_run


def _to_int(value: Any, field: str) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a number") from exc


def _to_float(value: Any, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a number") from exc


def save_forward_run_summary(run_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    run = get_forward_run(run_id)
    if run is None:
        raise ValueError(f"Forward run {run_id} does not exist")

    total_trades = _to_int(payload.get("totalTrades", 0), "totalTrades")
    win_rate = _to_float(payload.get("winRate", 0), "winRate")
    pnl = _to_float(payload.get("pnl", 0), "pnl")
    max_drawdown = _to_float(payload.get("maxDrawdown", 0), "maxDrawdown")
    expectancy = _to_float(payload.get("expectancy", 0), "expectancy")
    period_start = payload.get("periodStart")
    period_end = payload.get("periodEnd")

    if total_trades < 0:
        raise ValueError("totalTrades must be >= 0")

    return upsert_forward_run_summary(
        forward_run_id=run_id,
        total_trades=total_trades,
        win_rate=win_rate,
        pnl=pnl,
        max_drawdown=max_drawdown,
        expectancy=expectancy,
        period_start=str(period_start).strip() if period_start is not None and str(period_start).strip() else None,
        period_end=str(period_end).strip() if period_end is not None and str(period_end).strip() else None,
    )


def get_forward_run_summary_for_run(run_id: int) -> dict[str, Any] | None:
    run = get_forward_run(run_id)
    if run is None:
        raise ValueError(f"Forward run {run_id} does not exist")
    return get_forward_run_summary(run_id)
