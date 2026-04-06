import logging

from data.mock_api.backtests import BACKTESTS_ITEMS
from data_sources.backtests_repository import query_backtests_page

logger = logging.getLogger(__name__)


def _fallback_backtests(reason: str) -> list[dict]:
    logger.warning(
        "service=backtests_service reason=%s action=fallback_to_mock",
        reason,
    )
    return BACKTESTS_ITEMS


def get_backtests_page(page: int, page_size: int) -> dict:
    safe_page = page
    safe_page_size = page_size

    try:
        query_result = query_backtests_page(safe_page, safe_page_size)
        items = query_result["items"]
        total = query_result["total"]
    except Exception as exc:
        fallback_rows = _fallback_backtests(f"sqlite_query_exception:{exc}")
        total = len(fallback_rows)
        start = (safe_page - 1) * safe_page_size
        end = start + safe_page_size
        items = fallback_rows[start:end]

    return {
        "items": items,
        "page": safe_page,
        "pageSize": safe_page_size,
        "total": total,
    }
