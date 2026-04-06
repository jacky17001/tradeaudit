import logging

from data.mock_api.forward_gate import FORWARD_GATE_SUMMARY
from data_sources.forward_gate_repository import load_forward_gate_summary

logger = logging.getLogger(__name__)


def get_forward_gate_summary() -> dict:
    try:
        summary = load_forward_gate_summary()
    except Exception as exc:
        logger.warning(
            "service=forward_gate_service reason=%s action=fallback_to_mock",
            f"load_exception:{exc}",
        )
        return FORWARD_GATE_SUMMARY

    if summary is None:
        logger.warning(
            "service=forward_gate_service reason=%s action=fallback_to_mock",
            "sqlite_missing_or_empty",
        )
        return FORWARD_GATE_SUMMARY
    return summary
