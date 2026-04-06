from typing import Any

from config.evaluation_rules import EVALUATION_RULES
from services.evaluation_result import build_evaluation_result, merge_with_evaluation


RULES = EVALUATION_RULES["backtests"]


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


def score_return_pct(return_pct: float) -> int:
    return _score_from_bands(return_pct, RULES["score_bands"]["returnPct"])


def score_max_drawdown(max_drawdown: float) -> int:
    return _score_from_bands(max_drawdown, RULES["score_bands"]["maxDrawdown"])


def score_profit_factor(profit_factor: float) -> int:
    return _score_from_bands(profit_factor, RULES["score_bands"]["profitFactor"])


def score_win_rate(win_rate: float) -> int:
    return _score_from_bands(win_rate, RULES["score_bands"]["winRate"])


def score_trade_count(trade_count: int) -> int:
    return _score_from_bands(trade_count, RULES["score_bands"]["tradeCount"])


def _build_fail_reasons(metrics: dict[str, Any]) -> list[str]:
    hard_fail = RULES["hard_fail"]
    reasons: list[str] = []

    if metrics["tradeCount"] < hard_fail["tradeCount_lt"]:
        reasons.append("Trade count is below 20")
    if metrics["profitFactor"] < hard_fail["profitFactor_lt"]:
        reasons.append("Profit factor is below 1.0")
    if metrics["maxDrawdown"] > hard_fail["maxDrawdown_gt"]:
        reasons.append("Max drawdown is above 20%")
    if metrics["returnPct"] <= hard_fail["returnPct_lte"]:
        reasons.append("Return is not positive")

    return reasons


def _build_pass_gaps(metrics: dict[str, Any], final_score: int) -> list[str]:
    pass_gate = RULES["pass_gate"]
    gaps: list[str] = []

    if metrics["tradeCount"] < pass_gate["tradeCount_gte"]:
        gaps.append("trade count below 30")
    if metrics["profitFactor"] < pass_gate["profitFactor_gte"]:
        gaps.append("profit factor below 1.2")
    if metrics["maxDrawdown"] > pass_gate["maxDrawdown_lte"]:
        gaps.append("max drawdown above 12%")
    if metrics["returnPct"] <= pass_gate["returnPct_gt"]:
        gaps.append("return is not positive")
    if final_score < pass_gate["finalScore_gte"]:
        gaps.append("final score below 70")

    return gaps


def decide_backtest(metrics: dict[str, Any], final_score: int) -> tuple[str, str, str]:
    fail_reasons = _build_fail_reasons(metrics)
    if fail_reasons:
        return (
            "FAIL",
            "; ".join(fail_reasons),
            "Block promotion and fix critical risk/quality metrics before rerun.",
        )

    pass_gaps = _build_pass_gaps(metrics, final_score)
    if not pass_gaps:
        return (
            "PASS",
            "All pass gates satisfied with score >= 70",
            "Promote to forward validation and keep live monitoring active.",
        )

    return (
        "NEEDS_IMPROVEMENT",
        "Missing pass gates: " + ", ".join(pass_gaps),
        "Tune parameters and rerun backtests before promotion.",
    )


def build_explanation(
    metrics: dict[str, Any],
    score_breakdown: dict[str, int],
    final_score: int,
    decision: str,
    decision_reason: str,
) -> str:
    best_metric = max(score_breakdown, key=score_breakdown.get)
    weakest_metric = min(score_breakdown, key=score_breakdown.get)

    return (
        f"Final score {final_score}/100 ({decision}). "
        f"Best component: {best_metric}={score_breakdown[best_metric]}; "
        f"weakest component: {weakest_metric}={score_breakdown[weakest_metric]}. "
        f"Core stats: return {metrics['returnPct']:.2f}%, drawdown {metrics['maxDrawdown']:.2f}%, "
        f"PF {metrics['profitFactor']:.2f}, win rate {metrics['winRate']:.2f}%, trades {metrics['tradeCount']}. "
        f"Reason: {decision_reason}."
    )


def evaluate_backtest(row: dict[str, Any]) -> dict[str, Any]:
    metrics = {
        "returnPct": float(row.get("returnPct", 0) or 0),
        "maxDrawdown": float(row.get("maxDrawdown", 0) or 0),
        "profitFactor": float(row.get("profitFactor", 0) or 0),
        "winRate": float(row.get("winRate", 0) or 0),
        "tradeCount": int(float(row.get("tradeCount", 0) or 0)),
    }

    score_breakdown = {
        "returnPct": score_return_pct(metrics["returnPct"]),
        "maxDrawdown": score_max_drawdown(metrics["maxDrawdown"]),
        "profitFactor": score_profit_factor(metrics["profitFactor"]),
        "winRate": score_win_rate(metrics["winRate"]),
        "tradeCount": score_trade_count(metrics["tradeCount"]),
    }
    final_score = sum(score_breakdown.values())

    hard_fail_reasons = _build_fail_reasons(metrics)
    decision, decision_reason, recommended_action = decide_backtest(metrics, final_score)
    explanation = build_explanation(
        metrics,
        score_breakdown,
        final_score,
        decision,
        decision_reason,
    )

    if metrics["tradeCount"] >= 80:
        sample_adequacy = "HIGH"
        confidence_level = "HIGH"
    elif metrics["tradeCount"] >= 30:
        sample_adequacy = "MEDIUM"
        confidence_level = "MEDIUM" if decision != "FAIL" else "LOW"
    else:
        sample_adequacy = "LOW"
        confidence_level = "LOW"

    data_source_type = str(row.get("dataSourceType", "unknown"))
    dataset_version = str(
        row.get("datasetVersion")
        or f"backtests:{row.get('id', 'unknown')}:{data_source_type}"
    )
    previous_score = row.get("score")
    previous_decision = row.get("decision")

    evaluation = build_evaluation_result(
        final_score=final_score,
        score_breakdown=score_breakdown,
        decision=decision,
        decision_reason=decision_reason,
        recommended_action=recommended_action,
        explanation=explanation,
        hard_fail_triggered=bool(hard_fail_reasons),
        hard_fail_reasons=hard_fail_reasons,
        confidence_level=confidence_level,
        sample_adequacy=sample_adequacy,
        data_source_type=data_source_type,
        dataset_version=dataset_version,
        previous_score=previous_score,
        previous_decision=previous_decision,
    )

    return merge_with_evaluation(
        {
            **row,
            "tradeCount": metrics["tradeCount"],
        },
        evaluation,
    )