"""Stage 45 - Conclusion-first comparison report service."""
from __future__ import annotations

from typing import Any

from db.sqlite import connection_scope
from services.timeline_service import get_account_audit_timeline, get_strategy_timeline


def _risk_rank(value: str) -> int:
    mapping = {"Low": 3, "Medium": 2, "High": 1, "Unknown": 0}
    return mapping.get(str(value or "Unknown"), 0)


def _trust_rank(value: str) -> int:
    mapping = {"High": 3, "Medium": 2, "Low": 1, "Unknown": 0}
    return mapping.get(str(value or "Unknown"), 0)


def _score_value(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def _verdict_from_score(score: int) -> str:
    if score >= 70:
        return "Qualified"
    if score >= 55:
        return "Marginal"
    return "Rejected"


def _risk_from_drawdown(drawdown: float | None) -> str:
    if drawdown is None:
        return "Unknown"
    if drawdown > 30:
        return "High"
    if drawdown > 15:
        return "Medium"
    return "Low"


def _trust_from_score(score: int) -> str:
    if score >= 80:
        return "High"
    if score >= 65:
        return "Medium"
    return "Low"


def _timeline_items_for_strategy(strategy_id: str) -> list[dict[str, Any]]:
    try:
        payload = get_strategy_timeline(strategy_id, limit=2)
        return payload.get("items") or []
    except Exception:
        return []


def _timeline_items_for_account(source_type: str, source_ref_id: int) -> list[dict[str, Any]]:
    try:
        payload = get_account_audit_timeline(source_type, source_ref_id, limit=2)
        return payload.get("items") or []
    except Exception:
        return []


def _pick_winner(left: dict[str, Any], right: dict[str, Any]) -> tuple[str, str, str, list[str]]:
    left_score = _score_value(left.get("score"))
    right_score = _score_value(right.get("score"))
    left_risk = _risk_rank(left.get("riskLevel"))
    right_risk = _risk_rank(right.get("riskLevel"))
    left_trust = _trust_rank(left.get("trustLevel"))
    right_trust = _trust_rank(right.get("trustLevel"))

    left_points = 0
    right_points = 0
    reasons: list[str] = []

    if left_score > right_score:
        left_points += 1
        reasons.append(f"Left has higher score ({left_score} vs {right_score}).")
    elif right_score > left_score:
        right_points += 1
        reasons.append(f"Right has higher score ({right_score} vs {left_score}).")

    if left_risk > right_risk:
        left_points += 1
        reasons.append(f"Left has lower risk ({left.get('riskLevel')} vs {right.get('riskLevel')}).")
    elif right_risk > left_risk:
        right_points += 1
        reasons.append(f"Right has lower risk ({right.get('riskLevel')} vs {left.get('riskLevel')}).")

    if left_trust > right_trust:
        left_points += 1
        reasons.append(
            f"Left has higher trust ({left.get('trustLevel')} vs {right.get('trustLevel')})."
        )
    elif right_trust > left_trust:
        right_points += 1
        reasons.append(
            f"Right has higher trust ({right.get('trustLevel')} vs {left.get('trustLevel')})."
        )

    score_gap = abs(left_score - right_score)
    if left_points == right_points or score_gap <= 3:
        return (
            "close",
            "Results are close",
            "Results are close; keep monitoring both or collect more data.",
            reasons or ["Key indicators are close between both sides."],
        )

    if left_points > right_points:
        return (
            "left",
            "Better choice: Left",
            "Left is currently the better choice based on score, risk, and trust profile.",
            reasons,
        )

    return (
        "right",
        "Better choice: Right",
        "Right is currently the better choice based on score, risk, and trust profile.",
        reasons,
    )


def _strategy_object_by_id(strategy_id: str) -> dict[str, Any] | None:
    with connection_scope() as conn:
        row = conn.execute(
            """
            SELECT id, name, score, decision, maxDrawdown
            FROM backtests
            WHERE id = ?
            """,
            (strategy_id,),
        ).fetchone()
    if not row:
        return None

    score = _score_value(row["score"])
    decision = str(row["decision"] or "")
    if decision == "PASS":
        verdict = "Qualified"
    elif decision == "NEEDS_IMPROVEMENT":
        verdict = "Marginal"
    elif decision == "FAIL":
        verdict = "Rejected"
    else:
        verdict = "Unknown"

    risk_level = "Low" if decision == "PASS" and score >= 70 else "Medium"
    if decision == "FAIL":
        risk_level = "High"
    trust_level = "High" if decision == "PASS" and score >= 80 else "Medium"
    if decision == "FAIL":
        trust_level = "Low"

    return {
        "id": str(row["id"]),
        "label": str(row["name"] or row["id"]),
        "score": score,
        "verdict": verdict,
        "riskLevel": risk_level,
        "trustLevel": trust_level,
        "recommendedNextStep": (
            "continue forward"
            if verdict == "Qualified"
            else "review required"
            if verdict == "Marginal"
            else "collect more data"
        ),
        "timelineHighlights": _timeline_items_for_strategy(str(row["id"])),
    }


def _default_strategy_pair() -> tuple[str, str] | None:
    with connection_scope() as conn:
        rows = conn.execute(
            """
            SELECT id
            FROM backtests
            ORDER BY score DESC, id ASC
            LIMIT 2
            """
        ).fetchall()
    if not rows:
        return None
    if len(rows) == 1:
        only_id = str(rows[0]["id"])
        return only_id, only_id
    return str(rows[0]["id"]), str(rows[1]["id"])


def _account_object_by_summary_id(summary_id: int) -> dict[str, Any] | None:
    with connection_scope() as conn:
        row = conn.execute(
            """
            SELECT id, source_type, source_ref_id, account_label, total_trades, win_rate, max_drawdown, profit_factor
            FROM account_audit_summaries
            WHERE id = ?
            """,
            (summary_id,),
        ).fetchone()
    if not row:
        return None

    win_rate = float(row["win_rate"] or 0)
    profit_factor = float(row["profit_factor"] or 0)
    max_drawdown = float(row["max_drawdown"] or 0)
    total_trades = int(row["total_trades"] or 0)

    pf_score = max(0.0, min((profit_factor - 1.0) * 100, 100))
    dd_score = 100.0 if max_drawdown <= 10 else 80.0 if max_drawdown <= 20 else 60.0 if max_drawdown <= 30 else 40.0
    trade_score = max(0.0, min(total_trades, 100))
    score = int(round((win_rate * 0.35) + (pf_score * 0.30) + (dd_score * 0.20) + (trade_score * 0.15)))

    risk_level = _risk_from_drawdown(max_drawdown)
    trust_level = _trust_from_score(score)
    verdict = _verdict_from_score(score)

    source_type = str(row["source_type"])
    source_ref_id = int(row["source_ref_id"])

    return {
        "id": str(row["id"]),
        "label": str(row["account_label"] or f"summary-{row['id']}"),
        "score": score,
        "verdict": verdict,
        "riskLevel": risk_level,
        "trustLevel": trust_level,
        "recommendedNextStep": (
            "continue monitoring"
            if verdict == "Qualified"
            else "review required"
            if verdict == "Marginal"
            else "collect more data"
        ),
        "timelineHighlights": _timeline_items_for_account(source_type, source_ref_id),
    }


def _default_account_pair() -> tuple[int, int] | None:
    with connection_scope() as conn:
        rows = conn.execute(
            """
            SELECT id
            FROM account_audit_summaries
            ORDER BY last_computed_at DESC, id DESC
            LIMIT 2
            """
        ).fetchall()
    if not rows:
        return None
    if len(rows) == 1:
        only_id = int(rows[0]["id"])
        return only_id, only_id
    return int(rows[0]["id"]), int(rows[1]["id"])


def _build_comparison(kind: str, left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    winner, recommendation, summary, reasons = _pick_winner(left, right)

    left_score = _score_value(left.get("score"))
    right_score = _score_value(right.get("score"))
    score_delta = left_score - right_score

    return {
        "kind": kind,
        "left": left,
        "right": right,
        "winner": winner,
        "recommendation": recommendation,
        "summaryConclusion": summary,
        "keyDifferences": reasons,
        "scoreComparison": {
            "left": left_score,
            "right": right_score,
            "delta": score_delta,
            "winner": "left" if score_delta > 0 else "right" if score_delta < 0 else "close",
        },
        "riskComparison": {
            "left": left.get("riskLevel"),
            "right": right.get("riskLevel"),
            "winner": "left" if _risk_rank(left.get("riskLevel")) > _risk_rank(right.get("riskLevel")) else "right" if _risk_rank(right.get("riskLevel")) > _risk_rank(left.get("riskLevel")) else "close",
        },
        "trustComparison": {
            "left": left.get("trustLevel"),
            "right": right.get("trustLevel"),
            "winner": "left" if _trust_rank(left.get("trustLevel")) > _trust_rank(right.get("trustLevel")) else "right" if _trust_rank(right.get("trustLevel")) > _trust_rank(left.get("trustLevel")) else "close",
        },
        "actionComparison": {
            "left": left.get("recommendedNextStep"),
            "right": right.get("recommendedNextStep"),
        },
        "timelineHighlights": {
            "left": left.get("timelineHighlights") or [],
            "right": right.get("timelineHighlights") or [],
        },
    }


def get_comparison_report(kind: str, left: str | None = None, right: str | None = None) -> dict[str, Any]:
    if kind not in {"strategy", "account"}:
        raise ValueError("kind must be strategy or account")

    if kind == "strategy":
        left_id = (left or "").strip()
        right_id = (right or "").strip()
        if not left_id or not right_id:
            pair = _default_strategy_pair()
            if not pair:
                placeholder = {
                    "id": "n/a",
                    "label": "No strategy data",
                    "score": 0,
                    "verdict": "Unknown",
                    "riskLevel": "Unknown",
                    "trustLevel": "Unknown",
                    "recommendedNextStep": "collect more data",
                    "timelineHighlights": [],
                }
                return _build_comparison("strategy", placeholder, placeholder)
            left_id, right_id = pair

        left_obj = _strategy_object_by_id(left_id)
        right_obj = _strategy_object_by_id(right_id)
        if not left_obj or not right_obj:
            raise ValueError("Strategy comparison targets not found")
        return _build_comparison("strategy", left_obj, right_obj)

    left_id_raw = (left or "").strip()
    right_id_raw = (right or "").strip()
    if not left_id_raw or not right_id_raw:
        pair = _default_account_pair()
        if not pair:
            raise ValueError("Not enough account summary records to compare")
        left_id, right_id = pair
    else:
        try:
            left_id = int(left_id_raw)
            right_id = int(right_id_raw)
        except Exception as exc:
            raise ValueError("account comparison expects summary id for left/right") from exc

    left_obj = _account_object_by_summary_id(left_id)
    right_obj = _account_object_by_summary_id(right_id)
    if not left_obj or not right_obj:
        raise ValueError("Account comparison targets not found")
    return _build_comparison("account", left_obj, right_obj)
