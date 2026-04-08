"""
Stage 38 – Result Overview Service
Aggregates the latest strategy and account audit results into a front-door summary.
Rules are transparent and rule-based; no AI inference.
"""
from __future__ import annotations

import logging
from typing import Any

from db.sqlite import connection_scope
from services.account_audit_service import get_account_audit_summary
from services.backtests_scoring_service import evaluate_backtest

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Verdict / Risk / Trust / Next-Step mapping rules
# ---------------------------------------------------------------------------

def _map_verdict(decision: str) -> str:
    mapping = {
        "PASS": "Qualified",
        "NEEDS_IMPROVEMENT": "Marginal",
        "FAIL": "Rejected",
    }
    return mapping.get(decision, "Unknown")


def _map_risk_level(decision: str, score: int) -> str:
    if decision == "FAIL":
        return "High"
    if decision == "NEEDS_IMPROVEMENT":
        return "Medium"
    if decision == "PASS" and score >= 70:
        return "Low"
    return "Medium"


def _map_trust_level(decision: str, score: int) -> str:
    if decision == "PASS" and score >= 80:
        return "High"
    if decision == "PASS":
        return "Medium"
    if decision == "NEEDS_IMPROVEMENT":
        return "Medium"
    return "Low"


def _map_strategy_next_step(decision: str) -> str:
    if decision == "PASS":
        return "continue forward"
    if decision == "NEEDS_IMPROVEMENT":
        return "review required"
    if decision == "FAIL":
        return "collect more data"
    return "not enough data"


def _map_account_next_step(decision: str) -> str:
    if decision == "PASS":
        return "continue monitoring"
    if decision == "NEEDS_IMPROVEMENT":
        return "review required"
    if decision == "FAIL":
        return "collect more data"
    return "not enough data"


# ---------------------------------------------------------------------------
# Strategy overview – best (highest-score) backtest from active dataset
# ---------------------------------------------------------------------------

def _get_best_backtest() -> dict[str, Any] | None:
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
        if row is None:
            return None
        return dict(row)
    except Exception as exc:
        logger.warning("result_overview: best_backtest query failed: %s", exc)
        return None


def _build_strategy_overview(backtest: dict[str, Any] | None) -> dict[str, Any]:
    if backtest is None:
        return {
            "title": "Strategy Audit",
            "score": None,
            "verdict": "No Data",
            "riskLevel": "Unknown",
            "trustLevel": "Unknown",
            "recommendedNextStep": "not enough data",
            "refId": None,
            "strategyName": None,
            "isCandidate": False,
        }

    raw_score = int(float(backtest.get("score") or 0))
    decision = backtest.get("decision") or "UNKNOWN"

    # Re-evaluate if decision missing (should not happen but guard)
    if not decision or decision == "UNKNOWN":
        try:
            evaluated = evaluate_backtest({**backtest, "dataSourceType": "sqlite"})
            raw_score = int(evaluated.get("finalScore") or raw_score)
            decision = evaluated.get("decision") or "UNKNOWN"
        except Exception:
            pass

    return {
        "title": "Strategy Audit",
        "score": raw_score,
        "verdict": _map_verdict(decision),
        "riskLevel": _map_risk_level(decision, raw_score),
        "trustLevel": _map_trust_level(decision, raw_score),
        "recommendedNextStep": _map_strategy_next_step(decision),
        "refId": str(backtest.get("id", "")),
        "strategyName": backtest.get("name") or backtest.get("id") or "N/A",
        "isCandidate": bool(backtest.get("isCandidate")),
    }


# ---------------------------------------------------------------------------
# Account overview – latest account audit summary evaluation
# ---------------------------------------------------------------------------

def _build_account_overview() -> dict[str, Any]:
    try:
        audit = get_account_audit_summary()
    except Exception as exc:
        logger.warning("result_overview: account_audit fetch failed: %s", exc)
        audit = None

    if audit is None:
        return {
            "title": "Account Audit",
            "score": None,
            "verdict": "No Data",
            "riskLevel": "Unknown",
            "trustLevel": "Unknown",
            "recommendedNextStep": "not enough data",
            "refId": None,
        }

    raw_score = int(float(audit.get("finalScore") or audit.get("score") or 0))
    decision = audit.get("decision") or "UNKNOWN"

    return {
        "title": "Account Audit",
        "score": raw_score,
        "verdict": _map_verdict(decision),
        "riskLevel": _map_risk_level(decision, raw_score),
        "trustLevel": _map_trust_level(decision, raw_score),
        "recommendedNextStep": _map_account_next_step(decision),
        "refId": None,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_result_overview() -> dict[str, Any]:
    backtest = _get_best_backtest()
    strategy_overview = _build_strategy_overview(backtest)
    account_overview = _build_account_overview()

    return {
        "strategyOverview": strategy_overview,
        "accountOverview": account_overview,
    }
