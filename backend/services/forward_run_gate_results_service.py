from typing import Any

from data_sources.forward_run_gate_results_repository import (
    get_forward_run_gate_result,
    list_gate_results,
    upsert_forward_run_gate_result,
)
from data_sources.forward_runs_repository import get_forward_run

ALLOWED_GATE_DECISIONS = {
    "PASS",
    "PROMISING",
    "NEEDS_IMPROVEMENT",
    "FAIL",
    "REJECT",
}


def _normalize_gate_decision(value: Any) -> str:
    normalized = str(value or "").strip().upper()
    if not normalized:
        raise ValueError("gateDecision is required")
    if normalized not in ALLOWED_GATE_DECISIONS:
        raise ValueError("gateDecision must be PASS, PROMISING, NEEDS_IMPROVEMENT, FAIL, or REJECT")
    return normalized


def _optional_text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text if text else None


def _to_bool(value: Any, field: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return True
        if normalized in {"false", "0", "no", "n", ""}:
            return False
    raise ValueError(f"{field} must be a boolean")


def save_forward_run_gate_result(run_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    run = get_forward_run(run_id)
    if run is None:
        raise ValueError(f"Forward run {run_id} does not exist")

    gate_decision = _normalize_gate_decision(payload.get("gateDecision"))
    hard_fail = _to_bool(payload.get("hardFail", False), "hardFail")
    notes = str(payload.get("notes", "") or "").strip()

    return upsert_forward_run_gate_result(
        forward_run_id=run_id,
        gate_decision=gate_decision,
        confidence=_optional_text(payload.get("confidence")),
        hard_fail=hard_fail,
        sample_adequacy=_optional_text(payload.get("sampleAdequacy")),
        strongest_factor=_optional_text(payload.get("strongestFactor")),
        weakest_factor=_optional_text(payload.get("weakestFactor")),
        notes=notes,
        evaluated_at=_optional_text(payload.get("evaluatedAt")),
    )


def get_forward_run_gate_result_for_run(run_id: int) -> dict[str, Any] | None:
    run = get_forward_run(run_id)
    if run is None:
        raise ValueError(f"Forward run {run_id} does not exist")
    return get_forward_run_gate_result(run_id)


def list_gate_results_page(decision: str | None, page: int, page_size: int) -> dict[str, Any]:
    normalized_decision = None
    if decision is not None:
        candidate = str(decision).strip().upper()
        if candidate:
            if candidate not in ALLOWED_GATE_DECISIONS:
                raise ValueError("decision must be PASS, PROMISING, NEEDS_IMPROVEMENT, FAIL, or REJECT")
            normalized_decision = candidate

    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    return list_gate_results(normalized_decision, safe_page, safe_page_size)
