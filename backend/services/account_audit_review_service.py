"""Service for aggregating account audit review data across multiple sources."""
from __future__ import annotations

from typing import Any

from data_sources.account_audit_intake_repository import (
    get_account_audit_intake_job,
)
from data_sources.account_audit_mt5_repository import (
    get_mt5_connection_record,
    list_mt5_connection_trades,
)
from data_sources.account_audit_summaries_repository import (
    get_account_audit_summary_by_source,
)


def get_account_audit_review(
    source_type: str,
    source_ref_id: int,
) -> dict[str, Any]:
    """
    Aggregate account audit review data for a single source.
    
    Returns a comprehensive review dict with:
    - source_info: basic source identification
    - account_info: MT5 account details (if MT5 source)
    - metrics_summary: latest audit summary metrics
    - recent_trades: last 20 trades (if MT5 source)
    - data_coverage: completeness metrics
    
    If parts are missing, returns None for that section rather than failing.
    """
    if source_type not in ["mt5_investor", "statement_upload", "account_history_upload", "manual_trade_import"]:
        raise ValueError(f"Invalid source_type: {source_type}")

    # Fetch source-specific info
    if source_type == "mt5_investor":
        source_info = _get_mt5_source_info(source_ref_id)
    else:
        source_info = _get_intake_source_info(source_type, source_ref_id)

    # Fetch summary (same logic for all sources)
    summary = get_account_audit_summary_by_source(source_type, source_ref_id)

    # Fetch recent trades (only for MT5)
    recent_trades = []
    if source_type == "mt5_investor":
        try:
            recent_trades = list_mt5_connection_trades(source_ref_id, limit=20)
        except Exception:
            recent_trades = []

    # Build data coverage
    data_coverage = _build_data_coverage(
        source_type,
        source_info,
        summary,
        recent_trades,
    )

    return {
        "sourceInfo": source_info,
        "accountInfo": source_info.get("accountInfo") if source_type == "mt5_investor" else None,
        "metricsSummary": _map_summary_dict(summary) if summary else None,
        "recentTrades": recent_trades,
        "dataCoverage": data_coverage,
    }


def _get_mt5_source_info(connection_id: int) -> dict[str, Any]:
    """Fetch MT5 connection info."""
    conn = get_mt5_connection_record(connection_id)
    return {
        "sourceType": "mt5_investor",
        "sourceRefId": connection_id,
        "sourceLabel": conn["connectionLabel"] or f"MT5 Connection {connection_id}",
        "accountNumber": conn["accountNumber"],
        "server": conn["server"],
        "status": conn["status"],
        "lastTestedAt": conn["lastTestedAt"],
        "lastSyncedAt": conn["lastSyncedAt"],
        "syncedTradeCount": conn["syncedTradeCount"],
        "accountInfo": conn["accountInfo"],
        "readOnlyAccess": conn["readOnlyAccess"],
    }


def _get_intake_source_info(source_type: str, job_id: int) -> dict[str, Any]:
    """Fetch intake job info."""
    job = get_account_audit_intake_job(job_id)
    return {
        "sourceType": source_type,
        "sourceRefId": job_id,
        "sourceLabel": job["sourceLabel"] or f"{source_type} job {job_id}",
        "intakeMethod": job["intakeMethod"],
        "originalFilename": job["originalFilename"],
        "detectedRows": job["detectedRows"],
        "note": job["note"],
        "status": job["status"],
        "errorMessage": job["errorMessage"],
        "createdAt": job["createdAt"],
    }


def _map_summary_dict(summary: dict[str, Any] | None) -> dict[str, Any] | None:
    """Convert summary to review-friendly dict."""
    if not summary:
        return None
    return {
        "id": summary.get("id"),
        "totalTrades": summary.get("totalTrades"),
        "winRate": summary.get("winRate"),
        "pnl": summary.get("pnl"),
        "maxDrawdown": summary.get("maxDrawdown"),
        "profitFactor": summary.get("profitFactor"),
        "expectancy": summary.get("expectancy"),
        "averageHoldingTime": summary.get("averageHoldingTime"),
        "periodStart": summary.get("periodStart"),
        "periodEnd": summary.get("periodEnd"),
        "lastComputedAt": summary.get("lastComputedAt"),
    }


def _build_data_coverage(
    source_type: str,
    source_info: dict[str, Any],
    summary: dict[str, Any] | None,
    recent_trades: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build data coverage/completeness metrics."""
    coverage = {
        "hasSummary": summary is not None,
        "tradeCount": len(recent_trades),
        "coveredPeriod": None,
        "lastSyncOrUpload": None,
        "completenessNote": "",
    }

    # Covered period from summary
    if summary:
        coverage["coveredPeriod"] = {
            "start": summary.get("periodStart"),
            "end": summary.get("periodEnd"),
        }

    # Last sync or upload timestamp
    if source_type == "mt5_investor":
        coverage["lastSyncOrUpload"] = source_info.get("lastSyncedAt")
    else:
        coverage["lastSyncOrUpload"] = source_info.get("createdAt")

    # Completeness note
    if source_type == "mt5_investor":
        if not summary:
            coverage["completenessNote"] = "Awaiting first summary computation"
        elif len(recent_trades) == 0:
            coverage["completenessNote"] = "Summary computed but no trades synced yet"
        else:
            coverage["completenessNote"] = "Complete"
    else:
        # Intake sources
        if summary and summary.get("totalTrades"):
            coverage["completenessNote"] = "Complete"
        elif summary:
            coverage["completenessNote"] = "Summary computed but metrics may be partial"
        else:
            coverage["completenessNote"] = "Awaiting summary computation"

    return coverage
