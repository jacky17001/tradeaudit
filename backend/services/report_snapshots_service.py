"""Report snapshots service (Stage 50)."""
from __future__ import annotations

import json
from typing import Any

from data_sources.report_snapshots_repository import (
    count_report_snapshots,
    get_report_snapshot,
    insert_report_snapshot,
    list_report_snapshots,
)

_VALID_SNAPSHOT_TYPES = {"audit_report", "comparison_report", "final_recommendation"}
_VALID_OBJECT_TYPES = {"strategy", "account", "audit_case", "comparison"}


_REQUIRED_BY_TYPE = {
    "audit_report": [
        "score",
        "verdict",
        "riskLevel",
        "trustLevel",
        "whyThisResult",
        "strengths",
        "risks",
        "recommendedActions",
        "timelineHighlights",
    ],
    "comparison_report": [
        "winner",
        "recommendation",
        "summaryConclusion",
        "keyDifferences",
        "scoreComparison",
        "riskComparison",
        "trustComparison",
    ],
    "final_recommendation": [
        "finalRecommendation",
        "finalStatus",
        "reviewerNote",
        "decisionSnapshot",
        "supportingSignals",
        "recommendedNextStep",
    ],
}


def _validate_payload_shape(snapshot_type: str, payload: dict[str, Any]) -> None:
    required = _REQUIRED_BY_TYPE.get(snapshot_type, [])
    missing = [k for k in required if k not in payload]
    if missing:
        raise ValueError(f"payload_json missing required keys: {', '.join(missing)}")


def create_report_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    snapshot_type = str(payload.get("snapshot_type") or "").strip().lower()
    object_type = str(payload.get("object_type") or "").strip().lower()
    object_ref_id = payload.get("object_ref_id")
    title = str(payload.get("title") or "").strip()
    note = payload.get("note")
    raw_payload = payload.get("payload_json")

    if snapshot_type not in _VALID_SNAPSHOT_TYPES:
        raise ValueError("snapshot_type must be audit_report, comparison_report, or final_recommendation")
    if object_type not in _VALID_OBJECT_TYPES:
        raise ValueError("object_type must be strategy, account, audit_case, or comparison")

    try:
        object_ref_id = int(object_ref_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("object_ref_id must be an integer") from exc

    if not title:
        raise ValueError("title is required")

    if not isinstance(raw_payload, dict):
        raise ValueError("payload_json must be an object")

    _validate_payload_shape(snapshot_type, raw_payload)
    encoded_payload = json.dumps(raw_payload, ensure_ascii=False)

    result = insert_report_snapshot(
        snapshot_type=snapshot_type,
        object_type=object_type,
        object_ref_id=object_ref_id,
        title=title,
        payload_json=encoded_payload,
        note=(str(note).strip() if note is not None else None),
    )
    return _decode_snapshot(result)


def _decode_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    try:
        item["payload_json"] = json.loads(item.get("payload_json") or "{}")
    except Exception:
        item["payload_json"] = {}
    return item


def list_snapshots(
    limit: int = 200,
    snapshot_type: str | None = None,
    object_type: str | None = None,
    object_ref_id: int | None = None,
) -> dict[str, Any]:
    if snapshot_type:
        snapshot_type = snapshot_type.strip().lower()
        if snapshot_type not in _VALID_SNAPSHOT_TYPES:
            raise ValueError("snapshotType must be audit_report, comparison_report, or final_recommendation")

    if object_type:
        object_type = object_type.strip().lower()
        if object_type not in _VALID_OBJECT_TYPES:
            raise ValueError("objectType must be strategy, account, audit_case, or comparison")

    parsed_ref = None
    if object_ref_id is not None:
        try:
            parsed_ref = int(object_ref_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("objectRefId must be an integer") from exc

    safe_limit = min(max(int(limit), 1), 500)
    rows = list_report_snapshots(safe_limit, snapshot_type, object_type, parsed_ref)
    total = count_report_snapshots(snapshot_type, object_type, parsed_ref)

    return {
        "items": [_decode_snapshot(r) for r in rows],
        "count": len(rows),
        "total": total,
        "filters": {
            "snapshotType": snapshot_type,
            "objectType": object_type,
            "objectRefId": parsed_ref,
        },
    }


def get_snapshot_detail(snapshot_id: int) -> dict[str, Any]:
    row = get_report_snapshot(snapshot_id)
    if not row:
        raise ValueError(f"Snapshot {snapshot_id} not found")
    return _decode_snapshot(row)
