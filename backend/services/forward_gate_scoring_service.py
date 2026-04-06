from typing import Any

from config.evaluation_rules import EVALUATION_RULES
from services.evaluation_result import build_evaluation_result, merge_with_evaluation


RULES = EVALUATION_RULES["forward_gate"]


def _score_from_bands(value: float | int | str, bands: list[dict[str, Any]]) -> int:
    for band in bands:
        if "equals" in band and value == band["equals"]:
            return int(band["score"])
        if "gt" in band and value > band["gt"]:
            return int(band["score"])
        if "gte" in band and value >= band["gte"]:
            return int(band["score"])
        if "lt" in band and value < band["lt"]:
            return int(band["score"])
        if "max" in band and value <= band["max"]:
            return int(band["score"])
        if set(band.keys()) == {"score"}:
            return int(band["score"])

    return 0


def _score_forward_status(forward_status: str) -> int:
    return _score_from_bands(forward_status, RULES["score_bands"]["forwardStatus"])


def _score_sample_size(trades_observed: int) -> int:
    return _score_from_bands(trades_observed, RULES["score_bands"]["sampleSize"])


def _score_pass_rate(pass_rate: float) -> int:
    return _score_from_bands(pass_rate, RULES["score_bands"]["passRate"])


def _score_drawdown(max_drawdown: float) -> int:
    return _score_from_bands(max_drawdown, RULES["score_bands"]["maxDrawdown"])


def evaluate_forward_gate(summary: dict[str, Any]) -> dict[str, Any]:
    metrics = {
        "forwardStatus": summary.get("forwardStatus", "UNKNOWN"),
        "tradesObserved": int(float(summary.get("tradesObserved", 0) or 0)),
        "passRate": float(summary.get("passRate", 0) or 0),
        "maxDrawdown": float(summary.get("maxDrawdown", 0) or 0),
    }

    score_breakdown = {
        "forwardStatus": _score_forward_status(metrics["forwardStatus"]),
        "sampleSize": _score_sample_size(metrics["tradesObserved"]),
        "passRate": _score_pass_rate(metrics["passRate"]),
        "maxDrawdown": _score_drawdown(metrics["maxDrawdown"]),
    }
    final_score = sum(score_breakdown.values())

    hard_fail = RULES["hard_fail"]
    fail_reasons: list[str] = []
    if metrics["forwardStatus"] == hard_fail["forwardStatus_equals"]:
        fail_reasons.append("forward status is PAUSED")
    if metrics["maxDrawdown"] > hard_fail["maxDrawdown_gt"]:
        fail_reasons.append("max drawdown above 20%")
    if metrics["passRate"] < hard_fail["passRate_lt"]:
        fail_reasons.append("pass rate below 40%")

    if fail_reasons:
        decision = "FAIL"
        decision_reason = "Fail triggers: " + ", ".join(fail_reasons)
        recommended_action = "Stop promotion and investigate forward instability before resuming."
    else:
        pass_gate = RULES["pass_gate"]
        is_pass = (
            metrics["forwardStatus"] in pass_gate["forwardStatus_in"]
            and metrics["tradesObserved"] >= pass_gate["sampleSize_gte"]
            and metrics["passRate"] >= pass_gate["passRate_gte"]
            and metrics["maxDrawdown"] <= pass_gate["maxDrawdown_lte"]
            and final_score >= pass_gate["finalScore_gte"]
        )

        if is_pass:
            decision = "PASS"
            decision_reason = "Forward validation quality meets promotion threshold"
            recommended_action = "Proceed to gate promotion with continued monitoring."
        else:
            decision = "NEEDS_IMPROVEMENT"
            decision_reason = (
                "Forward validation is active but does not fully meet promotion thresholds"
            )
            recommended_action = "Accumulate more forward samples and improve stability metrics."

    if metrics["tradesObserved"] >= 50:
        sample_adequacy = "HIGH"
        confidence_level = "HIGH"
    elif metrics["tradesObserved"] >= 20:
        sample_adequacy = "MEDIUM"
        confidence_level = "MEDIUM"
    else:
        sample_adequacy = "LOW"
        confidence_level = "LOW"

    data_source_type = str(summary.get("dataSourceType", "unknown"))
    dataset_version = str(
        summary.get("datasetVersion")
        or f"forward-gate:{summary.get('strategyName', 'unknown')}:{data_source_type}"
    )
    previous_score = summary.get("score")
    previous_decision = summary.get("previousDecision")

    explanation = (
        f"Forward evaluation {decision} with final score {final_score}/100. "
        f"Status {metrics['forwardStatus']}, trades {metrics['tradesObserved']}, "
        f"pass rate {metrics['passRate']:.1f}%, max drawdown {metrics['maxDrawdown']:.2f}%. "
        f"Reason: {decision_reason}."
    )

    evaluation = build_evaluation_result(
        final_score=final_score,
        score_breakdown=score_breakdown,
        decision=decision,
        decision_reason=decision_reason,
        recommended_action=recommended_action,
        explanation=explanation,
        hard_fail_triggered=bool(fail_reasons),
        hard_fail_reasons=fail_reasons,
        confidence_level=confidence_level,
        sample_adequacy=sample_adequacy,
        data_source_type=data_source_type,
        dataset_version=dataset_version,
        previous_score=previous_score,
        previous_decision=previous_decision,
    )
    return merge_with_evaluation(summary, evaluation)