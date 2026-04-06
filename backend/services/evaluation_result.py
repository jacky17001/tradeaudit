from typing import Any
from datetime import datetime, timezone

from config.evaluation_rules import EVALUATION_RULES_VERSION


def _pick_strongest_weakest(score_breakdown: dict[str, int]) -> tuple[str | None, str | None]:
    if not score_breakdown:
        return None, None

    strongest = max(score_breakdown, key=score_breakdown.get)
    weakest = min(score_breakdown, key=score_breakdown.get)
    return strongest, weakest


def build_evaluation_result(
    *,
    final_score: int,
    score_breakdown: dict[str, int],
    decision: str,
    decision_reason: str,
    recommended_action: str,
    explanation: str,
    hard_fail_triggered: bool = False,
    hard_fail_reasons: list[str] | None = None,
    confidence_level: str = "MEDIUM",
    sample_adequacy: str = "UNKNOWN",
    data_source_type: str = "unknown",
    evaluated_at: str | None = None,
    rules_version: str | None = None,
    dataset_version: str | None = None,
    previous_score: int | None = None,
    previous_decision: str | None = None,
) -> dict[str, Any]:
    strongest_factor, weakest_factor = _pick_strongest_weakest(score_breakdown)

    safe_evaluated_at = evaluated_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    safe_rules_version = rules_version or EVALUATION_RULES_VERSION
    safe_dataset_version = dataset_version or f"dataset:{data_source_type}:current"

    safe_previous_score: int | None
    if isinstance(previous_score, (int, float)):
        safe_previous_score = int(previous_score)
    else:
        safe_previous_score = None

    score_delta = (
        int(final_score) - safe_previous_score
        if safe_previous_score is not None
        else None
    )
    decision_changed = (
        previous_decision != decision
        if previous_decision is not None
        else None
    )

    return {
        "finalScore": int(final_score),
        "scoreBreakdown": score_breakdown,
        "decision": decision,
        "decisionReason": decision_reason,
        "recommendedAction": recommended_action,
        "explanation": explanation,
        "hardFailTriggered": hard_fail_triggered,
        "hardFailReasons": hard_fail_reasons or [],
        "strongestFactor": strongest_factor,
        "weakestFactor": weakest_factor,
        "confidenceLevel": confidence_level,
        "sampleAdequacy": sample_adequacy,
        "dataSourceType": data_source_type,
        "evaluatedAt": safe_evaluated_at,
        "rulesVersion": safe_rules_version,
        "datasetVersion": safe_dataset_version,
        "previousScore": safe_previous_score,
        "scoreDelta": score_delta,
        "previousDecision": previous_decision,
        "decisionChanged": decision_changed,
    }


def merge_with_evaluation(base: dict[str, Any], evaluation: dict[str, Any]) -> dict[str, Any]:
    return {
        **base,
        **evaluation,
        # Keep historical compatibility for fields that previously consumed `score`.
        "score": int(evaluation["finalScore"]),
    }