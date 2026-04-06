from typing import Any

from config.evaluation_rules import EVALUATION_RULES
from services.evaluation_result import build_evaluation_result, merge_with_evaluation


RULES = EVALUATION_RULES["account_audit"]


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


def _score_risk_score(risk_score: int) -> int:
    return _score_from_bands(risk_score, RULES["score_bands"]["riskScore"])


def _score_max_drawdown(max_drawdown: float) -> int:
    return _score_from_bands(max_drawdown, RULES["score_bands"]["maxDrawdown"])


def _score_win_rate(win_rate: float) -> int:
    return _score_from_bands(win_rate, RULES["score_bands"]["winRate"])


def _score_profit_factor(profit_factor: float) -> int:
    return _score_from_bands(profit_factor, RULES["score_bands"]["profitFactor"])


def _fail_reasons(metrics: dict[str, Any]) -> list[str]:
    hard_fail = RULES["hard_fail"]
    reasons: list[str] = []
    if metrics["profitFactor"] < hard_fail["profitFactor_lt"]:
        reasons.append("profit factor below 1.0")
    if metrics["maxDrawdown"] > hard_fail["maxDrawdown_gt"]:
        reasons.append("max drawdown above 20%")
    if metrics["riskScore"] < hard_fail["riskScore_lt"]:
        reasons.append("risk score below 45")
    return reasons


def _pass_gaps(metrics: dict[str, Any], final_score: int) -> list[str]:
    pass_gate = RULES["pass_gate"]
    gaps: list[str] = []
    if metrics["riskScore"] < pass_gate["riskScore_gte"]:
        gaps.append("risk score below 70")
    if metrics["maxDrawdown"] > pass_gate["maxDrawdown_lte"]:
        gaps.append("max drawdown above 12%")
    if metrics["profitFactor"] < pass_gate["profitFactor_gte"]:
        gaps.append("profit factor below 1.2")
    if metrics["winRate"] < pass_gate["winRate_gte"]:
        gaps.append("win rate below 45%")
    if final_score < pass_gate["finalScore_gte"]:
        gaps.append("final score below 70")
    return gaps


def evaluate_account_audit(summary: dict[str, Any]) -> dict[str, Any]:
    metrics = {
        "riskScore": int(float(summary.get("riskScore", 0) or 0)),
        "maxDrawdown": float(summary.get("maxDrawdown", 0) or 0),
        "winRate": float(summary.get("winRate", 0) or 0),
        "profitFactor": float(summary.get("profitFactor", 0) or 0),
    }

    score_breakdown = {
        "riskScore": _score_risk_score(metrics["riskScore"]),
        "maxDrawdown": _score_max_drawdown(metrics["maxDrawdown"]),
        "winRate": _score_win_rate(metrics["winRate"]),
        "profitFactor": _score_profit_factor(metrics["profitFactor"]),
    }
    final_score = sum(score_breakdown.values())

    fail_reasons = _fail_reasons(metrics)
    if fail_reasons:
        decision = "FAIL"
        decision_reason = "Fail triggers: " + ", ".join(fail_reasons)
        recommended_action = "Reduce risk exposure and stabilize account behavior before scaling."
    else:
        pass_gaps = _pass_gaps(metrics, final_score)
        if not pass_gaps:
            decision = "PASS"
            decision_reason = "All account quality gates satisfied"
            recommended_action = "Maintain current risk protocol and continue monitored execution."
        else:
            decision = "NEEDS_IMPROVEMENT"
            decision_reason = "Missing pass gates: " + ", ".join(pass_gaps)
            recommended_action = "Optimize risk controls and execution consistency, then re-evaluate."

    confidence_level = "HIGH" if metrics["riskScore"] >= 75 else "MEDIUM" if metrics["riskScore"] >= 60 else "LOW"
    sample_adequacy = "MEDIUM"
    data_source_type = str(summary.get("dataSourceType", "unknown"))
    dataset_version = str(
        summary.get("datasetVersion")
        or f"account-audit:{summary.get('accountName', 'unknown')}:{data_source_type}"
    )
    previous_score = summary.get("score")
    previous_decision = summary.get("previousDecision")

    explanation = (
        f"Account evaluation {decision} with final score {final_score}/100. "
        f"Risk score {metrics['riskScore']}, max drawdown {metrics['maxDrawdown']:.2f}%, "
        f"win rate {metrics['winRate']:.2f}%, PF {metrics['profitFactor']:.2f}. "
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