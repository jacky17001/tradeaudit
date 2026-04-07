from datetime import datetime, timezone
from typing import Any

from data_sources.backtest_candidates_repository import (
    is_strategy_candidate,
    is_strategy_in_backtests,
)
from data_sources.backtests_repository import get_backtest_strategy
from data_sources.forward_runs_repository import (
    create_forward_run,
    get_forward_run,
    list_forward_runs,
    update_forward_run_status,
)
from services.backtests_activate_service import get_active_dataset_info

RUNNING = "RUNNING"
PAUSED = "PAUSED"
COMPLETED = "COMPLETED"
FAILED = "FAILED"

ALLOWED_STATUSES = {RUNNING, PAUSED, COMPLETED, FAILED}
ALLOWED_TRANSITIONS = {
    RUNNING: {PAUSED, COMPLETED, FAILED},
    PAUSED: {RUNNING, COMPLETED, FAILED},
    COMPLETED: set(),
    FAILED: set(),
}


def _normalize_status(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().upper()
    if not normalized:
        return None
    return normalized


def create_forward_run_entry(
    strategy_id: str,
    symbol: str,
    timeframe: str,
    note: str = "",
) -> dict[str, Any]:
    clean_strategy_id = (strategy_id or "").strip()
    clean_symbol = (symbol or "").strip()
    clean_timeframe = (timeframe or "").strip()
    clean_note = (note or "").strip()

    if not clean_strategy_id:
        raise ValueError("strategyId is required")
    if not clean_symbol:
        raise ValueError("symbol is required")
    if not clean_timeframe:
        raise ValueError("timeframe is required")

    if not is_strategy_in_backtests(clean_strategy_id):
        raise ValueError(f"Strategy {clean_strategy_id} does not exist in current active dataset")

    if not is_strategy_candidate(clean_strategy_id):
        raise ValueError(f"Strategy {clean_strategy_id} is not marked as candidate")

    strategy = get_backtest_strategy(clean_strategy_id)
    if strategy is None:
        raise ValueError(f"Strategy {clean_strategy_id} does not exist in current active dataset")

    active_info = get_active_dataset_info()
    source_job_id = active_info.get("sourceJobId")
    if not isinstance(source_job_id, int):
        source_job_id = None

    new_id = create_forward_run(
        strategy_id=clean_strategy_id,
        strategy_name=str(strategy["name"]),
        source_job_id=source_job_id,
        symbol=clean_symbol,
        timeframe=clean_timeframe,
        status=RUNNING,
        note=clean_note,
    )

    created = get_forward_run(new_id)
    if created is None:
        raise ValueError("Failed to create forward run")
    return created


def list_forward_runs_page(status: str | None, page: int, page_size: int) -> dict[str, Any]:
    normalized_status = _normalize_status(status)
    if normalized_status is not None and normalized_status not in ALLOWED_STATUSES:
        raise ValueError("status must be RUNNING, PAUSED, COMPLETED, or FAILED")

    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    return list_forward_runs(normalized_status, safe_page, safe_page_size)


def change_forward_run_status(run_id: int, new_status: str) -> dict[str, Any]:
    normalized_status = _normalize_status(new_status)
    if normalized_status is None:
        raise ValueError("status is required")
    if normalized_status not in ALLOWED_STATUSES:
        raise ValueError("status must be RUNNING, PAUSED, COMPLETED, or FAILED")

    existing = get_forward_run(run_id)
    if existing is None:
        raise ValueError(f"Forward run {run_id} does not exist")

    current = str(existing["status"])
    if normalized_status == current:
        return existing

    allowed_targets = ALLOWED_TRANSITIONS.get(current, set())
    if normalized_status not in allowed_targets:
        raise ValueError(f"Invalid transition from {current} to {normalized_status}")

    ended_at = None
    if normalized_status in {COMPLETED, FAILED}:
        ended_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    updated = update_forward_run_status(run_id, normalized_status, ended_at=ended_at)
    if updated is None:
        raise ValueError(f"Forward run {run_id} does not exist")
    return updated
