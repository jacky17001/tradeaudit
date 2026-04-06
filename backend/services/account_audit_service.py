import logging

from data.mock_api.audit import AUDIT_SUMMARY
from data_sources.account_audit_repository import load_account_audit_summary
from data_sources.evaluation_snapshots_repository import attach_previous_from_history
from services.account_audit_scoring_service import evaluate_account_audit

logger = logging.getLogger(__name__)


def get_account_audit_summary() -> dict:
    try:
        summary = load_account_audit_summary()
    except Exception as exc:
        logger.warning(
            "service=account_audit_service reason=%s action=fallback_to_mock",
            f"load_exception:{exc}",
        )
        evaluated = evaluate_account_audit({**AUDIT_SUMMARY, "dataSourceType": "mock"})
        return attach_previous_from_history("account-audit", "account-main", evaluated)

    if summary is None:
        logger.warning(
            "service=account_audit_service reason=%s action=fallback_to_mock",
            "sqlite_missing_or_empty",
        )
        evaluated = evaluate_account_audit({**AUDIT_SUMMARY, "dataSourceType": "mock"})
        return attach_previous_from_history("account-audit", "account-main", evaluated)

    evaluated = evaluate_account_audit({**summary, "dataSourceType": "sqlite"})
    return attach_previous_from_history("account-audit", "account-main", evaluated)
