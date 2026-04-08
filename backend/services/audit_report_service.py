"""Stage 43 - Unified audit report payload service."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope
from services.recommended_actions_service import get_recommended_actions
from services.result_overview_service import get_result_overview
from services.scoring_summary_service import get_scoring_summary
from services.timeline_service import get_account_audit_timeline, get_strategy_timeline


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _latest_account_source() -> tuple[str, int] | None:
    try:
        with connection_scope() as conn:
            row = conn.execute(
                """
                SELECT source_type, source_ref_id
                FROM account_audit_summaries
                ORDER BY last_computed_at DESC, id DESC
                LIMIT 1
                """
            ).fetchone()
        if not row:
            return None
        return str(row["source_type"]), int(row["source_ref_id"])
    except Exception:
        return None


def _map_timeline_items(timeline: dict[str, Any] | None, limit: int = 5) -> list[dict[str, Any]]:
    if not timeline:
        return []
    items = timeline.get("items") or []
    mapped: list[dict[str, Any]] = []
    for item in items[:limit]:
        mapped.append(
            {
                "title": str(item.get("title") or ""),
                "description": str(item.get("description") or ""),
                "createdAt": item.get("created_at"),
                "sourceSection": str(item.get("source_section") or ""),
                "eventType": str(item.get("event_type") or ""),
            }
        )
    return mapped


def _build_report(kind: str) -> dict[str, Any]:
    overview = get_result_overview()
    scoring = get_scoring_summary(kind)
    actions = get_recommended_actions(kind)

    overview_key = "strategyOverview" if kind == "strategy" else "accountOverview"
    summary_entry = overview.get(overview_key) or {}

    timeline_payload: dict[str, Any] | None = None
    if kind == "strategy":
        strategy_ref = str(summary_entry.get("refId") or "").strip()
        if strategy_ref:
            try:
                timeline_payload = get_strategy_timeline(strategy_ref, limit=5)
            except Exception:
                timeline_payload = None
    else:
        source = _latest_account_source()
        if source:
            source_type, source_ref_id = source
            try:
                timeline_payload = get_account_audit_timeline(source_type, source_ref_id, limit=5)
            except Exception:
                timeline_payload = None

    return {
        "kind": kind,
        "title": "Strategy Audit Report" if kind == "strategy" else "Account Audit Report",
        "generatedAt": _now_iso(),
        "score": summary_entry.get("score"),
        "verdict": summary_entry.get("verdict"),
        "riskLevel": summary_entry.get("riskLevel"),
        "trustLevel": summary_entry.get("trustLevel"),
        "decision": scoring.get("decision"),
        "recommendedNextStep": summary_entry.get("recommendedNextStep"),
        "whyThisResult": scoring.get("explanation"),
        "detailRef": scoring.get("detailRef"),
        "detailPath": scoring.get("detailPath"),
        "strengths": scoring.get("keyStrengths") or [],
        "risks": scoring.get("keyRisks") or [],
        "recommendedActions": (actions.get("recommendedActions") or []),
        "timelineHighlights": _map_timeline_items(timeline_payload, limit=5),
    }


def get_audit_report(kind: str | None = None) -> dict[str, Any]:
    if kind == "strategy":
        return _build_report("strategy")
    if kind == "account":
        return _build_report("account")
    return {
        "strategy": _build_report("strategy"),
        "account": _build_report("account"),
    }
