import logging

from data.mock_api.dashboard import DASHBOARD_SUMMARY
from data_sources.backtests_repository import query_backtests_summary

logger = logging.getLogger(__name__)


def get_dashboard_summary() -> dict:
    try:
        summary = query_backtests_summary()
    except Exception as exc:
        logger.warning(
            "service=dashboard_service reason=%s action=fallback_to_mock",
            f"sqlite_aggregate_exception:{exc}",
        )
        return DASHBOARD_SUMMARY

    total = summary["totalAudits"]

    if total == 0:
        logger.warning(
            "service=dashboard_service reason=%s action=fallback_to_mock",
            "no_rows_in_sqlite",
        )
        return DASHBOARD_SUMMARY

    recent_reports = min(12, total)

    return {
        "totalAudits": total,
        "averageScore": summary["averageScore"],
        "passRate": summary["passRate"],
        "recentReports": recent_reports,
    }
