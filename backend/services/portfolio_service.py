"""Stage 51 - Portfolio / Batch Triage service."""
from __future__ import annotations

from typing import Any

from db.sqlite import connection_scope


def _verdict_from_decision(decision: str | None) -> str:
    mapping = {
        "PASS": "Qualified",
        "NEEDS_IMPROVEMENT": "Needs Improvement",
        "FAIL": "Rejected",
    }
    return mapping.get(str(decision or "").upper(), "Unknown")


def _risk_from_drawdown(max_drawdown: Any) -> str:
    try:
        value = float(max_drawdown or 0)
    except Exception:
        value = 0.0

    if value >= 25:
        return "High"
    if value >= 12:
        return "Medium"
    return "Low"


def _trust_from_trade_count(trade_count: Any) -> str:
    try:
        value = int(float(trade_count or 0))
    except Exception:
        value = 0

    if value >= 200:
        return "High"
    if value >= 80:
        return "Medium"
    return "Low"


def _final_recommendation(score: Any, decision: str | None, risk_level: str, trust_level: str) -> str:
    try:
        s = int(float(score or 0))
    except Exception:
        s = 0

    d = str(decision or "").upper()
    if d == "FAIL" or risk_level == "High":
        return "Not Recommended"
    if s >= 75 and d == "PASS" and trust_level in {"Medium", "High"}:
        return "Recommended"
    if s >= 60 or d == "NEEDS_IMPROVEMENT":
        return "Watchlist"
    return "Needs More Data"


def _next_step_from_recommendation(recommendation: str) -> str:
    mapping = {
        "Recommended": "continue forward",
        "Watchlist": "recheck later",
        "Needs More Data": "need more data",
        "Not Recommended": "review manually",
    }
    return mapping.get(recommendation, "need more data")


def _latest_review_status_map(kind: str) -> dict[str, str]:
    # Minimal mapping: one latest status per object_type bucket
    case_types = ("strategy", "backtest") if kind == "strategy" else ("account_audit",)
    placeholders = ",".join("?" for _ in case_types)

    with connection_scope() as conn:
        rows = conn.execute(
            f"""
            SELECT case_type, status, updated_at
            FROM audit_cases
            WHERE case_type IN ({placeholders})
            ORDER BY id DESC
            LIMIT 50
            """,
            case_types,
        ).fetchall()

    latest = "open"
    if rows:
        latest = str(rows[0]["status"] or "open")

    # echo same baseline status across items for this minimal batch triage version
    return {"_default": latest}


def _latest_snapshot_time_map(object_type: str) -> dict[str, str]:
    with connection_scope() as conn:
        rows = conn.execute(
            """
            SELECT object_ref_id, MAX(created_at) AS latest_created_at
            FROM report_snapshots
            WHERE object_type = ?
            GROUP BY object_ref_id
            """,
            (object_type,),
        ).fetchall()

    return {str(r["object_ref_id"]): str(r["latest_created_at"] or "") for r in rows}


def _apply_filters(items: list[dict[str, Any]], risk_level: str | None, recommendation: str | None,
                   review_status: str | None, next_step: str | None) -> list[dict[str, Any]]:
    def ok(item: dict[str, Any]) -> bool:
        if risk_level and str(item.get("riskLevel")) != risk_level:
            return False
        if recommendation and str(item.get("finalRecommendation")) != recommendation:
            return False
        if review_status and str(item.get("reviewStatus")) != review_status:
            return False
        if next_step and str(item.get("nextStep")) != next_step:
            return False
        return True

    return [i for i in items if ok(i)]


def _build_strategy_items() -> list[dict[str, Any]]:
    review_map = _latest_review_status_map("strategy")
    snapshot_map = _latest_snapshot_time_map("strategy")

    with connection_scope() as conn:
        rows = conn.execute(
            """
            SELECT id, name, symbol, timeframe, score, decision, maxDrawdown, tradeCount
            FROM backtests
            ORDER BY score DESC, id ASC
            LIMIT 200
            """
        ).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        risk_level = _risk_from_drawdown(row["maxDrawdown"])
        trust_level = _trust_from_trade_count(row["tradeCount"])
        recommendation = _final_recommendation(row["score"], row["decision"], risk_level, trust_level)

        strategy_id = str(row["id"])
        items.append(
            {
                "id": f"strategy-{strategy_id}",
                "objectType": "strategy",
                "objectRefId": strategy_id,
                "title": str(row["name"] or f"Strategy {strategy_id}"),
                "score": int(float(row["score"] or 0)),
                "verdict": _verdict_from_decision(row["decision"]),
                "riskLevel": risk_level,
                "trustLevel": trust_level,
                "finalRecommendation": recommendation,
                "reviewStatus": review_map.get("_default", "open"),
                "nextStep": _next_step_from_recommendation(recommendation),
                "updatedAt": snapshot_map.get(strategy_id, ""),
                "detailPath": "/audit-report?kind=strategy",
            }
        )

    return items


def _build_account_items() -> list[dict[str, Any]]:
    review_map = _latest_review_status_map("account")
    snapshot_map = _latest_snapshot_time_map("account")

    with connection_scope() as conn:
        rows = conn.execute(
            """
            SELECT id, source_ref_id, account_label, total_trades, max_drawdown, created_at, updated_at
            FROM account_audit_summaries
            ORDER BY id DESC
            LIMIT 200
            """
        ).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        risk_level = _risk_from_drawdown(row["max_drawdown"])
        trust_level = _trust_from_trade_count(row["total_trades"])

        # Minimal scoring for account batch item to keep data shape consistent
        score = max(0, min(100, int(100 - float(row["max_drawdown"] or 0))))
        decision = "PASS" if score >= 75 else ("NEEDS_IMPROVEMENT" if score >= 60 else "FAIL")
        recommendation = _final_recommendation(score, decision, risk_level, trust_level)

        ref_id = int(row["source_ref_id"])
        items.append(
            {
                "id": f"account-{row['id']}",
                "objectType": "account",
                "objectRefId": ref_id,
                "title": str(row["account_label"] or f"Account {ref_id}"),
                "score": score,
                "verdict": _verdict_from_decision(decision),
                "riskLevel": risk_level,
                "trustLevel": trust_level,
                "finalRecommendation": recommendation,
                "reviewStatus": review_map.get("_default", "open"),
                "nextStep": _next_step_from_recommendation(recommendation),
                "updatedAt": snapshot_map.get(str(ref_id), str(row["updated_at"] or row["created_at"] or "")),
                "detailPath": "/audit-report?kind=account",
            }
        )

    return items


def get_portfolio_view(
    kind: str,
    risk_level: str | None = None,
    final_recommendation: str | None = None,
    review_status: str | None = None,
    next_step: str | None = None,
) -> dict[str, Any]:
    safe_kind = str(kind or "").strip().lower()
    if safe_kind not in {"strategy", "account"}:
        raise ValueError("kind must be strategy or account")

    items = _build_strategy_items() if safe_kind == "strategy" else _build_account_items()
    filtered = _apply_filters(items, risk_level, final_recommendation, review_status, next_step)

    return {
        "kind": safe_kind,
        "items": filtered,
        "total": len(filtered),
        "filtersEcho": {
            "riskLevel": risk_level,
            "finalRecommendation": final_recommendation,
            "reviewStatus": review_status,
            "nextStep": next_step,
        },
    }
