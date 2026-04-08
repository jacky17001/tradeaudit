"""Stage 40 - Recommended Actions service."""
from __future__ import annotations

from typing import Any

from db.sqlite import connection_scope
from services.scoring_summary_service import (
    get_account_scoring_summary,
    get_strategy_scoring_summary,
)


def _append_action(actions: list[dict[str, Any]], item: dict[str, Any]) -> None:
    if any(a.get("actionKey") == item.get("actionKey") for a in actions):
        return
    actions.append(item)


def _priority(level: str) -> str:
    return level if level in {"High", "Medium", "Low"} else "Medium"


def _signal_low(text: str | None) -> bool:
    raw = str(text or "").lower()
    return "low" in raw or "not enough" in raw


def _signal_medium(text: str | None) -> bool:
    raw = str(text or "").lower()
    return "medium" in raw or "moderate" in raw


def _strategy_context() -> dict[str, int]:
    try:
        with connection_scope() as conn:
            forward_runs = conn.execute("SELECT COUNT(*) AS c FROM forward_runs").fetchone()["c"]
            gate_results = conn.execute("SELECT COUNT(*) AS c FROM forward_run_gate_results").fetchone()["c"]
        return {"forwardRuns": int(forward_runs), "gateResults": int(gate_results)}
    except Exception:
        return {"forwardRuns": 0, "gateResults": 0}


def _account_context() -> dict[str, int]:
    try:
        with connection_scope() as conn:
            mt5_connections = conn.execute(
                "SELECT COUNT(*) AS c FROM account_audit_mt5_connections"
            ).fetchone()["c"]
            summary_count = conn.execute(
                "SELECT COUNT(*) AS c FROM account_audit_summaries"
            ).fetchone()["c"]
        return {"mt5Connections": int(mt5_connections), "summaryCount": int(summary_count)}
    except Exception:
        return {"mt5Connections": 0, "summaryCount": 0}


def _build_strategy_actions() -> dict[str, Any]:
    summary = get_strategy_scoring_summary()
    decision = str(summary.get("decision") or "Unknown")
    score = summary.get("score")
    confidence = str(summary.get("confidence") or "")
    adequacy = str(summary.get("dataAdequacy") or "")
    ctx = _strategy_context()

    actions: list[dict[str, Any]] = []

    if score is None:
        _append_action(
            actions,
            {
                "actionKey": "collect_more_data",
                "title": "collect more data",
                "description": "Import additional strategy records before making promotion decisions.",
                "priority": _priority("High"),
                "reason": "No strategy score is available.",
                "targetPath": "/backtests",
            },
        )
    elif decision == "Qualified":
        _append_action(
            actions,
            {
                "actionKey": "continue_forward",
                "title": "continue forward",
                "description": "Move this strategy to the forward validation path.",
                "priority": _priority("High"),
                "reason": "Decision is qualified and score supports forward progression.",
                "targetPath": "/forward-gate",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "continue_monitoring",
                "title": "continue monitoring",
                "description": "Keep tracking stability and risk behavior after qualification.",
                "priority": _priority("Medium"),
                "reason": "Even qualified strategies need ongoing monitoring.",
                "targetPath": "/forward-gate",
            },
        )
        if _signal_low(adequacy):
            _append_action(
                actions,
                {
                    "actionKey": "collect_more_data",
                    "title": "collect more data",
                    "description": "Increase sample size to strengthen decision confidence.",
                    "priority": _priority("Medium"),
                    "reason": "Data adequacy is still low.",
                    "targetPath": "/backtests",
                },
            )
    elif decision == "Needs Improvement":
        _append_action(
            actions,
            {
                "actionKey": "review_manually",
                "title": "review manually",
                "description": "Review weak metrics and failure gaps before promotion.",
                "priority": _priority("High"),
                "reason": "Decision indicates unresolved quality gaps.",
                "targetPath": "/backtests",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "collect_more_data",
                "title": "collect more data",
                "description": "Add more trade samples to reduce uncertainty.",
                "priority": _priority("High" if _signal_low(adequacy) else "Medium"),
                "reason": "Current confidence/adequacy is not strong enough.",
                "targetPath": "/backtests",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "continue_monitoring",
                "title": "continue monitoring",
                "description": "Observe behavior while tuning parameters.",
                "priority": _priority("Medium"),
                "reason": "Monitoring prevents premature promotion.",
                "targetPath": "/forward-gate",
            },
        )
    else:
        _append_action(
            actions,
            {
                "actionKey": "reject_candidate",
                "title": "reject candidate",
                "description": "Remove this strategy from candidate promotion queue.",
                "priority": _priority("High"),
                "reason": "Decision is rejected with unacceptable risk profile.",
                "targetPath": "/backtests",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "archive_result",
                "title": "archive result",
                "description": "Archive this failed result for traceability and future comparison.",
                "priority": _priority("Medium"),
                "reason": "Rejected outcomes should be retained but deprioritized.",
                "targetPath": "/audit-cases",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "collect_more_data",
                "title": "collect more data",
                "description": "Rebuild evidence before any new candidate decision.",
                "priority": _priority("Medium"),
                "reason": "Current evidence quality is insufficient for progression.",
                "targetPath": "/backtests",
            },
        )

    if ctx["forwardRuns"] == 0 and decision == "Qualified":
        _append_action(
            actions,
            {
                "actionKey": "continue_forward",
                "title": "continue forward",
                "description": "Create the first forward run for this strategy.",
                "priority": _priority("High"),
                "reason": "No forward run exists yet.",
                "targetPath": "/forward-gate",
            },
        )

    if _signal_medium(confidence) and decision != "Qualified":
        _append_action(
            actions,
            {
                "actionKey": "review_manually",
                "title": "review manually",
                "description": "Add a human review checkpoint before final action.",
                "priority": _priority("Medium"),
                "reason": "Confidence is moderate and decision is not qualified.",
                "targetPath": "/audit-cases",
            },
        )

    return {
        "kind": "strategy",
        "title": "Strategy Recommended Actions",
        "score": score,
        "decision": decision,
        "recommendedActions": actions,
    }


def _build_account_actions() -> dict[str, Any]:
    summary = get_account_scoring_summary()
    decision = str(summary.get("decision") or "Unknown")
    score = summary.get("score")
    confidence = str(summary.get("confidence") or "")
    adequacy = str(summary.get("dataAdequacy") or "")
    ctx = _account_context()

    actions: list[dict[str, Any]] = []

    if ctx["mt5Connections"] == 0:
        _append_action(
            actions,
            {
                "actionKey": "connect_mt5_read_only",
                "title": "connect MT5 read-only",
                "description": "Connect MT5 investor account for read-only audit sync.",
                "priority": _priority("High"),
                "reason": "No MT5 read-only connection exists.",
                "targetPath": "/account-audit",
            },
        )

    if ctx["summaryCount"] == 0:
        _append_action(
            actions,
            {
                "actionKey": "upload_statement",
                "title": "upload statement",
                "description": "Upload broker statement files to generate audit evidence.",
                "priority": _priority("High"),
                "reason": "No computed account summary exists yet.",
                "targetPath": "/account-audit",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "upload_account_history",
                "title": "upload account history",
                "description": "Upload account history rows for structured quality checks.",
                "priority": _priority("High"),
                "reason": "Account history data is required for summary computation.",
                "targetPath": "/account-audit",
            },
        )

    if decision == "Qualified":
        _append_action(
            actions,
            {
                "actionKey": "continue_monitoring",
                "title": "continue monitoring",
                "description": "Keep monitoring account risk and execution consistency.",
                "priority": _priority("High"),
                "reason": "Decision is qualified but live risk still needs tracking.",
                "targetPath": "/account-audit",
            },
        )
    elif decision == "Needs Improvement":
        _append_action(
            actions,
            {
                "actionKey": "review_manually",
                "title": "review manually",
                "description": "Perform manual review on weak account factors.",
                "priority": _priority("High"),
                "reason": "Decision indicates unresolved account quality gaps.",
                "targetPath": "/audit-cases",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "recompute_summary",
                "title": "recompute summary",
                "description": "Recompute summary after new intake or sync records.",
                "priority": _priority("Medium"),
                "reason": "Updated data may improve score reliability.",
                "targetPath": "/account-audit",
            },
        )
    else:
        _append_action(
            actions,
            {
                "actionKey": "collect_more_data",
                "title": "collect more data",
                "description": "Collect additional account evidence before next review.",
                "priority": _priority("High"),
                "reason": "Decision is rejected and evidence quality is insufficient.",
                "targetPath": "/account-audit",
            },
        )
        _append_action(
            actions,
            {
                "actionKey": "review_manually",
                "title": "review manually",
                "description": "Escalate to manual review before any follow-up decision.",
                "priority": _priority("Medium"),
                "reason": "Rejected account outcomes require controlled review.",
                "targetPath": "/audit-cases",
            },
        )

    if _signal_low(confidence) or _signal_low(adequacy):
        _append_action(
            actions,
            {
                "actionKey": "collect_more_data",
                "title": "collect more data",
                "description": "Improve confidence with additional synced or uploaded records.",
                "priority": _priority("High"),
                "reason": "Confidence or data adequacy is low.",
                "targetPath": "/account-audit",
            },
        )

    if ctx["summaryCount"] > 0:
        _append_action(
            actions,
            {
                "actionKey": "recompute_summary",
                "title": "recompute summary",
                "description": "Refresh score from the latest account intake and sync data.",
                "priority": _priority("Low"),
                "reason": "Periodic recomputation keeps the score aligned with latest records.",
                "targetPath": "/account-audit",
            },
        )

    return {
        "kind": "account",
        "title": "Account Recommended Actions",
        "score": score,
        "decision": decision,
        "recommendedActions": actions,
    }


def get_recommended_actions(kind: str | None = None) -> dict[str, Any]:
    if kind == "strategy":
        return _build_strategy_actions()
    if kind == "account":
        return _build_account_actions()

    return {
        "strategy": _build_strategy_actions(),
        "account": _build_account_actions(),
    }
