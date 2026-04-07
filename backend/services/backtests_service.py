import logging

from data.mock_api.backtests import BACKTESTS_ITEMS
from data_sources.backtests_repository import query_backtests_page
from data_sources.backtest_candidates_repository import (
    is_strategy_in_backtests,
    mark_candidate,
    unmark_candidate,
)
from data_sources.evaluation_snapshots_repository import attach_previous_from_history
from services.backtests_scoring_service import evaluate_backtest

logger = logging.getLogger(__name__)


def _fallback_backtests(reason: str) -> list[dict]:
    logger.warning(
        "service=backtests_service reason=%s action=fallback_to_mock",
        reason,
    )
    return BACKTESTS_ITEMS


def get_backtests_page(page: int, page_size: int, candidate_only: bool = False) -> dict:
    safe_page = page
    safe_page_size = page_size

    try:
        query_result = query_backtests_page(safe_page, safe_page_size, candidate_only=candidate_only)
        items = []
        for row in query_result["items"]:
            evaluated = evaluate_backtest({**row, "dataSourceType": "sqlite"})
            entity_id = str(row.get("id", "unknown"))
            items.append(attach_previous_from_history("backtests", entity_id, evaluated))
        total = query_result["total"]
    except Exception as exc:
        fallback_rows = _fallback_backtests(f"sqlite_query_exception:{exc}")
        total = len(fallback_rows)
        start = (safe_page - 1) * safe_page_size
        end = start + safe_page_size
        items = []
        for row in fallback_rows[start:end]:
            evaluated = evaluate_backtest({**row, "dataSourceType": "mock"})
            entity_id = str(row.get("id", "unknown"))
            items.append(attach_previous_from_history("backtests", entity_id, evaluated))

    return {
        "items": items,
        "page": safe_page,
        "pageSize": safe_page_size,
        "total": total,
    }


def set_backtest_candidate(strategy_id: str, is_candidate: bool) -> dict:
    if not is_strategy_in_backtests(strategy_id):
        raise ValueError(f"Strategy {strategy_id} does not exist in current active dataset")

    if is_candidate:
        mark_candidate(strategy_id)
    else:
        unmark_candidate(strategy_id)

    return {
        "ok": True,
        "strategyId": strategy_id,
        "isCandidate": is_candidate,
    }
