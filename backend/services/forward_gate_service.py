import logging

from data.mock_api.forward_gate import FORWARD_GATE_SUMMARY
from data_sources.evaluation_snapshots_repository import attach_previous_from_history
from data_sources.forward_gate_repository import load_forward_gate_summary
from services.forward_gate_scoring_service import evaluate_forward_gate

logger = logging.getLogger(__name__)


def get_forward_gate_summary() -> dict:
    try:
        summary = load_forward_gate_summary()
    except Exception as exc:
        logger.warning(
            "service=forward_gate_service reason=%s action=fallback_to_mock",
            f"load_exception:{exc}",
        )
        evaluated = evaluate_forward_gate({**FORWARD_GATE_SUMMARY, "dataSourceType": "mock"})
        return attach_previous_from_history("forward-gate", "forward-main", evaluated)

    if summary is None:
        logger.warning(
            "service=forward_gate_service reason=%s action=fallback_to_mock",
            "sqlite_missing_or_empty",
        )
        evaluated = evaluate_forward_gate({**FORWARD_GATE_SUMMARY, "dataSourceType": "mock"})
        return attach_previous_from_history("forward-gate", "forward-main", evaluated)

    evaluated = evaluate_forward_gate({**summary, "dataSourceType": "sqlite"})
    return attach_previous_from_history("forward-gate", "forward-main", evaluated)
