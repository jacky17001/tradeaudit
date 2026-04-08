"""Stage 46 - Reviewer mode final recommendation service."""
from __future__ import annotations

from typing import Any

from db.sqlite import connection_scope
from services.audit_report_service import get_audit_report


def _safe_int(value: Any) -> int:
    try:
        return int(float(value or 0))
    except Exception:
        return 0


def _map_action_to_recommendation(action: str | None) -> str | None:
    mapping = {
        "approve": "Recommended",
        "watch": "Watchlist",
        "needs_data": "Needs More Data",
        "reject": "Not Recommended",
    }
    return mapping.get(str(action or "").strip().lower())


def _status_for_recommendation(final_recommendation: str, reviewer_confirmed: bool) -> str:
    if final_recommendation == "Recommended":
        return "Reviewer Confirmed" if reviewer_confirmed else "Approved for Next Step"
    if final_recommendation == "Watchlist":
        return "Reviewer Watchlist" if reviewer_confirmed else "Monitoring Required"
    if final_recommendation == "Needs More Data":
        return "Reviewer Needs Data" if reviewer_confirmed else "Pending Evidence"
    if final_recommendation == "Not Recommended":
        return "Reviewer Rejected" if reviewer_confirmed else "Do Not Promote"
    return "Pending Evidence"


def _case_types_for_kind(kind: str) -> tuple[str, ...]:
    if kind == "strategy":
        return ("strategy", "backtest", "forward_run")
    return ("account_audit", "mt5_connection")


def _latest_case_context(kind: str) -> dict[str, Any] | None:
    case_types = _case_types_for_kind(kind)
    placeholders = ",".join("?" for _ in case_types)

    with connection_scope() as conn:
        case_row = conn.execute(
            f"""
            SELECT id, case_type, ref_id, priority, status, note, created_at, updated_at
            FROM audit_cases
            WHERE case_type IN ({placeholders})
            ORDER BY id DESC
            LIMIT 1
            """,
            case_types,
        ).fetchone()

        if not case_row:
            return None

        case_id = int(case_row["id"])

        latest_action = conn.execute(
            """
            SELECT action, reason, previous_status, new_status, created_at, created_by
            FROM review_actions
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (case_id,),
        ).fetchone()

        latest_note = conn.execute(
            """
            SELECT content, note_type, created_at, created_by
            FROM review_notes
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (case_id,),
        ).fetchone()

        action_rows = conn.execute(
            """
            SELECT action, reason, created_at
            FROM review_actions
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 3
            """,
            (case_id,),
        ).fetchall()

    return {
        "case": dict(case_row),
        "latestAction": dict(latest_action) if latest_action else None,
        "latestNote": dict(latest_note) if latest_note else None,
        "recentActions": [dict(row) for row in action_rows],
    }


def _fallback_from_report(report: dict[str, Any]) -> tuple[str, str, list[str]]:
    score = _safe_int(report.get("score"))
    verdict = str(report.get("verdict") or "Unknown")
    risk = str(report.get("riskLevel") or "Unknown")
    trust = str(report.get("trustLevel") or "Unknown")

    signals = [
        f"Score={score}",
        f"Verdict={verdict}",
        f"Risk={risk}",
        f"Trust={trust}",
    ]

    if verdict == "Rejected" or risk == "High":
        return (
            "Not Recommended",
            "Rejected verdict or high risk indicates unacceptable promotion risk.",
            signals,
        )

    if score >= 75 and verdict == "Qualified" and risk in {"Low", "Medium"} and trust in {"High", "Medium"}:
        return (
            "Recommended",
            "Strong score and acceptable risk/trust profile support promotion.",
            signals,
        )

    if score >= 60 or verdict == "Marginal":
        return (
            "Watchlist",
            "Signals are mixed; keep under watch while validating weak factors.",
            signals,
        )

    return (
        "Needs More Data",
        "Current evidence is limited for a confident recommendation.",
        signals,
    )


def _build_one(kind: str) -> dict[str, Any]:
    report = get_audit_report(kind)
    context = _latest_case_context(kind)

    fallback_recommendation, fallback_reason, signals = _fallback_from_report(report)

    latest_action = (context or {}).get("latestAction") if context else None
    latest_note = (context or {}).get("latestNote") if context else None
    latest_case = (context or {}).get("case") if context else None
    recent_actions = (context or {}).get("recentActions") if context else []

    action_recommendation = _map_action_to_recommendation((latest_action or {}).get("action") if latest_action else None)
    final_recommendation = action_recommendation or fallback_recommendation

    reason_parts: list[str] = []
    if latest_action and latest_action.get("reason"):
        reason_parts.append(str(latest_action.get("reason")))
    elif latest_note and latest_note.get("content"):
        reason_parts.append(str(latest_note.get("content")))
    reason_parts.append(fallback_reason)
    decision_reason = " ".join(part.strip() for part in reason_parts if part and str(part).strip())

    if latest_action:
        signals.insert(0, f"Latest review action={latest_action.get('action')}")
    if latest_case:
        signals.append(f"Case status={latest_case.get('status')}")

    for row in recent_actions:
        action = str(row.get("action") or "")
        if action:
            reason = str(row.get("reason") or "")
            snippet = f"Recent action: {action}" if not reason else f"Recent action: {action} ({reason})"
            if snippet not in signals:
                signals.append(snippet)

    reviewer_note = ""
    if latest_note and latest_note.get("content"):
        reviewer_note = str(latest_note["content"])
    elif latest_action and latest_action.get("reason"):
        reviewer_note = str(latest_action["reason"])

    decision_snapshot = {
        "source": "review_context" if latest_case else "rule_fallback",
        "caseId": (latest_case or {}).get("id"),
        "caseType": (latest_case or {}).get("case_type"),
        "caseStatus": (latest_case or {}).get("status"),
        "latestAction": (latest_action or {}).get("action"),
        "decidedAt": (latest_action or {}).get("created_at"),
        "reviewedBy": (latest_action or {}).get("created_by"),
    }

    return {
        "kind": kind,
        "finalRecommendation": final_recommendation,
        "finalStatus": _status_for_recommendation(final_recommendation, reviewer_confirmed=bool(latest_action)),
        "reviewerNote": reviewer_note,
        "decisionSnapshot": decision_snapshot,
        "whyThisRecommendation": decision_reason,
        "supportingSignals": signals[:8],
        "recommendedNextStep": report.get("recommendedNextStep"),
        "detailRef": report.get("detailRef"),
        "detailPath": report.get("detailPath"),
    }


def get_final_recommendation(kind: str | None = None) -> dict[str, Any]:
    if kind == "strategy":
        return _build_one("strategy")
    if kind == "account":
        return _build_one("account")
    if kind is None:
        return {
            "strategy": _build_one("strategy"),
            "account": _build_one("account"),
        }
    raise ValueError("kind must be strategy or account")
