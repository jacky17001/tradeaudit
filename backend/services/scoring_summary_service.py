"""Stage 39 - Scoring / Decision Summary service."""
from __future__ import annotations

import logging
from typing import Any

from db.sqlite import connection_scope
from services.account_audit_service import get_account_audit_summary
from services.backtests_scoring_service import evaluate_backtest

logger = logging.getLogger(__name__)


def _decision_label(decision: str) -> str:
    mapping = {
        "PASS": "Qualified",
        "NEEDS_IMPROVEMENT": "Needs Improvement",
        "FAIL": "Rejected",
    }
    return mapping.get(decision, "Unknown")


def _confidence_label(level: str | None) -> str:
    mapping = {
        "HIGH": "high confidence",
        "MEDIUM": "moderate confidence",
        "LOW": "low confidence",
    }
    if not level:
        return "not enough data"
    return mapping.get(level.upper(), "not enough data")


def _adequacy_label(level: str | None) -> str:
    mapping = {
        "HIGH": "high",
        "MEDIUM": "medium",
        "LOW": "low",
        "UNKNOWN": "not enough data",
    }
    if not level:
        return "not enough data"
    return mapping.get(level.upper(), "not enough data")


def _factor_label(name: str | None) -> str:
    mapping = {
        "returnPct": "Return profile",
        "maxDrawdown": "Drawdown control",
        "profitFactor": "Profit factor",
        "winRate": "Win rate",
        "tradeCount": "Sample size",
        "riskScore": "Risk score",
    }
    if not name:
        return "not enough data"
    return mapping.get(name, str(name))


def _extract_key_lists(
    decision: str,
    strongest_factor: str,
    weakest_factor: str,
    hard_fail_reasons: list[str],
) -> tuple[list[str], list[str]]:
    strengths = [f"Strongest factor: {strongest_factor}"]
    if decision == "PASS":
        strengths.append("Primary quality gates are satisfied")
    elif decision == "NEEDS_IMPROVEMENT":
        strengths.append("Partial quality signal exists but needs tuning")

    risks = [f"Weakest factor: {weakest_factor}"]
    if hard_fail_reasons:
        risks.extend(hard_fail_reasons[:2])
    elif decision == "NEEDS_IMPROVEMENT":
        risks.append("At least one pass threshold is missing")
    elif decision == "FAIL":
        risks.append("Fail triggers indicate unacceptable risk profile")

    return strengths, risks


def _load_best_backtest() -> dict[str, Any] | None:
    try:
        with connection_scope() as conn:
            row = conn.execute(
                """
                SELECT
                    b.id, b.name, b.symbol, b.timeframe,
                    b.returnPct, b.winRate, b.maxDrawdown, b.profitFactor,
                    b.tradeCount, b.score, b.decision,
                    CASE WHEN c.strategy_id IS NOT NULL THEN 1 ELSE 0 END AS isCandidate
                FROM backtests b
                LEFT JOIN backtest_candidates c ON c.strategy_id = b.id
                ORDER BY b.score DESC
                LIMIT 1
                """
            ).fetchone()
        return dict(row) if row is not None else None
    except Exception as exc:
        logger.warning("scoring_summary: failed to load best backtest: %s", exc)
        return None


def get_strategy_scoring_summary() -> dict[str, Any]:
    row = _load_best_backtest()
    if row is None:
        return {
            "kind": "strategy",
            "title": "Strategy Scoring Summary",
            "score": None,
            "decision": "No Data",
            "strongestFactor": "not enough data",
            "weakestFactor": "not enough data",
            "confidence": "not enough data",
            "dataAdequacy": "not enough data",
            "keyStrengths": [],
            "keyRisks": ["not enough data"],
            "explanation": "No strategy record available yet.",
            "nextStep": "collect more data",
            "detailRef": None,
            "detailPath": "/backtests",
        }

    evaluated = evaluate_backtest({**row, "dataSourceType": "sqlite"})
    decision = str(evaluated.get("decision") or "UNKNOWN")

    strongest_factor = _factor_label(evaluated.get("strongestFactor"))
    weakest_factor = _factor_label(evaluated.get("weakestFactor"))
    strengths, risks = _extract_key_lists(
        decision,
        strongest_factor,
        weakest_factor,
        list(evaluated.get("hardFailReasons") or []),
    )

    return {
        "kind": "strategy",
        "title": "Strategy Scoring Summary",
        "score": int(evaluated.get("finalScore") or 0),
        "decision": _decision_label(decision),
        "strongestFactor": strongest_factor,
        "weakestFactor": weakest_factor,
        "confidence": _confidence_label(evaluated.get("confidenceLevel")),
        "dataAdequacy": _adequacy_label(evaluated.get("sampleAdequacy")),
        "keyStrengths": strengths,
        "keyRisks": risks,
        "explanation": str(evaluated.get("explanation") or "No explanation available."),
        "nextStep": str(evaluated.get("recommendedAction") or "Review required"),
        "detailRef": str(evaluated.get("id") or ""),
        "detailPath": "/backtests",
    }


def get_account_scoring_summary() -> dict[str, Any]:
    try:
        evaluated = get_account_audit_summary()
    except Exception as exc:
        logger.warning("scoring_summary: failed to load account audit summary: %s", exc)
        evaluated = None

    if evaluated is None:
        return {
            "kind": "account",
            "title": "Account Audit Scoring Summary",
            "score": None,
            "decision": "No Data",
            "strongestFactor": "not enough data",
            "weakestFactor": "not enough data",
            "confidence": "not enough data",
            "dataAdequacy": "not enough data",
            "keyStrengths": [],
            "keyRisks": ["not enough data"],
            "explanation": "No account audit summary available yet.",
            "nextStep": "collect more data",
            "detailRef": None,
            "detailPath": "/account-audit",
        }

    decision = str(evaluated.get("decision") or "UNKNOWN")
    strongest_factor = _factor_label(evaluated.get("strongestFactor"))
    weakest_factor = _factor_label(evaluated.get("weakestFactor"))
    strengths, risks = _extract_key_lists(
        decision,
        strongest_factor,
        weakest_factor,
        list(evaluated.get("hardFailReasons") or []),
    )

    return {
        "kind": "account",
        "title": "Account Audit Scoring Summary",
        "score": int(evaluated.get("finalScore") or evaluated.get("score") or 0),
        "decision": _decision_label(decision),
        "strongestFactor": strongest_factor,
        "weakestFactor": weakest_factor,
        "confidence": _confidence_label(evaluated.get("confidenceLevel")),
        "dataAdequacy": _adequacy_label(evaluated.get("sampleAdequacy")),
        "keyStrengths": strengths,
        "keyRisks": risks,
        "explanation": str(evaluated.get("explanation") or "No explanation available."),
        "nextStep": str(evaluated.get("recommendedAction") or "Review required"),
        "detailRef": None,
        "detailPath": "/account-audit",
    }


def get_scoring_summary(kind: str | None = None) -> dict[str, Any]:
    if kind == "strategy":
        return get_strategy_scoring_summary()
    if kind == "account":
        return get_account_scoring_summary()

    return {
        "strategy": get_strategy_scoring_summary(),
        "account": get_account_scoring_summary(),
    }
