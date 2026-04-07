from pathlib import Path

from data_sources.account_audit_intake_repository import (
    insert_account_audit_intake_job,
    list_account_audit_intake_jobs as repo_list_account_audit_intake_jobs,
)

ALLOWED_SOURCE_TYPES = {"STATEMENT", "ACCOUNT_HISTORY", "MANUAL"}


def _normalize_source_type(value: str | None) -> str:
    normalized = str(value or "").strip().upper()
    if not normalized:
        raise ValueError("sourceType is required")
    if normalized not in ALLOWED_SOURCE_TYPES:
        raise ValueError("sourceType must be STATEMENT, ACCOUNT_HISTORY, or MANUAL")
    return normalized


def _count_non_empty_lines(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip())


def list_account_audit_intake_jobs(limit: int = 5) -> list[dict]:
    return repo_list_account_audit_intake_jobs(limit)


def create_account_audit_manual_intake(payload: dict) -> dict:
    source_type = _normalize_source_type(payload.get("sourceType"))
    manual_text = str(payload.get("manualText", "") or "")
    note = str(payload.get("note", "") or "").strip()

    if source_type != "MANUAL":
        raise ValueError("Manual intake must use sourceType MANUAL")
    if not manual_text.strip():
        raise ValueError("manualText is required")

    detected_rows = _count_non_empty_lines(manual_text)
    if detected_rows <= 0:
        raise ValueError("manualText must contain at least one non-empty line")

    return insert_account_audit_intake_job(
        {
            "source_type": source_type,
            "intake_method": "MANUAL",
            "source_label": "manual-trade-history",
            "original_filename": "",
            "detected_rows": detected_rows,
            "note": note,
            "status": "SUCCESS",
            "error_message": "",
        }
    )


def create_account_audit_upload_intake(
    *,
    source_type: str,
    file_path: str,
    original_filename: str,
    note: str = "",
) -> dict:
    normalized_source_type = _normalize_source_type(source_type)
    if normalized_source_type == "MANUAL":
        raise ValueError("Upload intake only supports STATEMENT or ACCOUNT_HISTORY")

    path = Path(file_path)
    if not path.exists():
        raise ValueError("Uploaded file was not found")

    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    detected_rows = _count_non_empty_lines(raw_text)
    if detected_rows <= 0:
        raise ValueError("Uploaded file is empty")

    return insert_account_audit_intake_job(
        {
            "source_type": normalized_source_type,
            "intake_method": "UPLOAD",
            "source_label": original_filename or path.name,
            "original_filename": original_filename or path.name,
            "detected_rows": detected_rows,
            "note": str(note or "").strip(),
            "status": "SUCCESS",
            "error_message": "",
        }
    )