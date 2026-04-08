"""Follow-up tasks service (Stage 49)."""
from __future__ import annotations

from typing import Any

from data_sources.follow_up_tasks_repository import (
    count_follow_up_tasks,
    get_follow_up_task,
    get_follow_up_tasks,
    insert_follow_up_task,
    update_follow_up_task,
)

_VALID_OBJECT_TYPES = {"strategy", "account", "audit_case"}
_VALID_STATUSES = {"open", "in_progress", "done", "cancelled"}
_VALID_PRIORITIES = {"high", "normal", "low"}
_VALID_DUE_LABELS = {"today", "this_week", "later"}

_ACTION_TITLE_MAP = {
    "follow_up": "Follow up",
    "recheck_later": "Recheck later",
    "need_more_data": "Need more data",
    "sync_again": "Sync again",
    "review_manually": "Review manually",
}


def _normalize_action_key(raw: str | None) -> str:
    value = str(raw or "").strip().lower().replace(" ", "_")
    if not value:
        return "follow_up"
    return value


def _default_title(action_key: str) -> str:
    return _ACTION_TITLE_MAP.get(action_key, action_key.replace("_", " ").strip().title())


def create_follow_up_task(payload: dict[str, Any]) -> dict[str, Any]:
    object_type = str(payload.get("object_type") or "").strip().lower()
    object_ref_id = payload.get("object_ref_id")
    action_key = _normalize_action_key(payload.get("action_key"))
    status = str(payload.get("status") or "open").strip().lower()
    priority = str(payload.get("priority") or "normal").strip().lower()
    due_label = str(payload.get("due_label") or "later").strip().lower()
    note = payload.get("note")

    if object_type not in _VALID_OBJECT_TYPES:
        raise ValueError("object_type must be strategy, account, or audit_case")

    try:
        object_ref_id = int(object_ref_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("object_ref_id must be an integer") from exc

    if status not in _VALID_STATUSES:
        raise ValueError("status must be open, in_progress, done, or cancelled")
    if priority not in _VALID_PRIORITIES:
        raise ValueError("priority must be high, normal, or low")
    if due_label not in _VALID_DUE_LABELS:
        raise ValueError("due_label must be today, this_week, or later")

    title = str(payload.get("title") or "").strip() or _default_title(action_key)
    safe_note = str(note).strip() if note is not None else None

    task = insert_follow_up_task(
        object_type=object_type,
        object_ref_id=object_ref_id,
        action_key=action_key,
        title=title,
        status=status,
        priority=priority,
        due_label=due_label,
        note=safe_note,
    )
    return task


def list_follow_up_tasks(
    limit: int = 100,
    object_type: str | None = None,
    object_ref_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
) -> dict[str, Any]:
    if object_type:
        object_type = object_type.strip().lower()
        if object_type not in _VALID_OBJECT_TYPES:
            raise ValueError("objectType must be strategy, account, or audit_case")

    if status:
        status = status.strip().lower()
        if status not in _VALID_STATUSES:
            raise ValueError("status must be open, in_progress, done, or cancelled")

    if priority:
        priority = priority.strip().lower()
        if priority not in _VALID_PRIORITIES:
            raise ValueError("priority must be high, normal, or low")

    parsed_ref_id = None
    if object_ref_id is not None:
        try:
            parsed_ref_id = int(object_ref_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("objectRefId must be an integer") from exc

    safe_limit = min(max(int(limit), 1), 500)
    items = get_follow_up_tasks(safe_limit, object_type, parsed_ref_id, status, priority)
    total = count_follow_up_tasks(object_type, parsed_ref_id, status, priority)

    return {
        "items": items,
        "count": len(items),
        "total": total,
        "filters": {
            "objectType": object_type,
            "objectRefId": parsed_ref_id,
            "status": status,
            "priority": priority,
        },
    }


def patch_follow_up_task(task_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    status = payload.get("status")
    priority = payload.get("priority")
    due_label = payload.get("due_label")
    note = payload.get("note")

    if status is not None:
        status = str(status).strip().lower()
        if status not in _VALID_STATUSES:
            raise ValueError("status must be open, in_progress, done, or cancelled")

    if priority is not None:
        priority = str(priority).strip().lower()
        if priority not in _VALID_PRIORITIES:
            raise ValueError("priority must be high, normal, or low")

    if due_label is not None:
        due_label = str(due_label).strip().lower()
        if due_label not in _VALID_DUE_LABELS:
            raise ValueError("due_label must be today, this_week, or later")

    task = update_follow_up_task(
        task_id=task_id,
        status=status,
        priority=priority,
        due_label=due_label,
        note=note if note is None else str(note).strip(),
    )
    if not task:
        raise ValueError(f"Task {task_id} not found")
    return task


def get_follow_up_task_options() -> dict[str, Any]:
    return {
        "objectTypes": sorted(_VALID_OBJECT_TYPES),
        "statuses": ["open", "in_progress", "done", "cancelled"],
        "priorities": ["high", "normal", "low"],
        "dueLabels": ["today", "this_week", "later"],
        "actionKeys": list(_ACTION_TITLE_MAP.keys()),
    }


def get_follow_up_task_detail(task_id: int) -> dict[str, Any]:
    task = get_follow_up_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")
    return task
