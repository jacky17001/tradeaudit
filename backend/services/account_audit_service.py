import logging

from data.mock_api.audit import AUDIT_SUMMARY
from data_sources.account_audit_repository import load_account_audit_summary

logger = logging.getLogger(__name__)


def get_account_audit_summary() -> dict:
    try:
        summary = load_account_audit_summary()
    except Exception as exc:
        logger.warning(
            "service=account_audit_service reason=%s action=fallback_to_mock",
            f"load_exception:{exc}",
        )
        return AUDIT_SUMMARY

    if summary is None:
        logger.warning(
            "service=account_audit_service reason=%s action=fallback_to_mock",
            "sqlite_missing_or_empty",
        )
        return AUDIT_SUMMARY
    return summary
