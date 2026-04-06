from flask import Blueprint, jsonify, request

from data_sources.evaluation_snapshots_repository import get_evaluation_history
from data_sources.import_jobs_repository import get_recent_import_jobs, insert_import_job
from routes.response_utils import error_response
from services.account_audit_service import get_account_audit_summary
from services.backtests_import_service import import_backtests_csv
from services.backtests_service import get_backtests_page
from services.dashboard_service import get_dashboard_summary
from services.forward_gate_service import get_forward_gate_summary

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _build_validation_summary(result: dict) -> str:
    invalid_count = int(result.get("invalidRowCount", 0) or 0)
    validation_errors = result.get("validationErrors") or []
    if invalid_count <= 0:
        return ""

    first_error = ""
    if isinstance(validation_errors, list) and validation_errors:
        first_error = str(validation_errors[0])

    if first_error:
        return f"Validation issues: {invalid_count} invalid rows. First: {first_error}"
    return f"Validation issues: {invalid_count} invalid rows"


def _log_import_job(payload: dict) -> None:
    try:
        insert_import_job(payload)
    except Exception:
        # Logging should not break primary API flow in this lightweight phase.
        pass


def parse_pagination_args(raw_page: str | None, raw_page_size: str | None) -> tuple[int, int]:
    """
    Pagination rule (consistent and deterministic):
    - page must be integer; if < 1, clamp to 1
    - pageSize must be integer; if <= 0, clamp to 1
    - pageSize upper bound is 100
    """
    try:
        page = int(raw_page or "1")
    except ValueError as exc:
        raise ValueError("Invalid page parameter") from exc

    try:
        page_size = int(raw_page_size or "10")
    except ValueError as exc:
        raise ValueError("Invalid pageSize parameter") from exc

    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    return safe_page, safe_page_size


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "tradeaudit-api"})


@api_bp.get("/dashboard/summary")
def dashboard_summary():
    try:
        return jsonify(get_dashboard_summary())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load dashboard summary", 500)


@api_bp.get("/account-audit/summary")
def account_audit_summary():
    try:
        return jsonify(get_account_audit_summary())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit summary", 500)


@api_bp.get("/backtests/list")
def backtests_list():
    try:
        page, page_size = parse_pagination_args(
            request.args.get("page"), request.args.get("pageSize")
        )
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)

    try:
        return jsonify(get_backtests_page(page, page_size))
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load backtests list", 500)


@api_bp.post("/backtests/import")
def backtests_import():
    payload = request.get_json(silent=True) or {}

    file_path = str(payload.get("filePath", "") or "").strip()
    mode = str(payload.get("mode", "replace") or "replace").strip().lower()

    if not file_path:
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "failed",
                "errorMessage": "filePath is required",
            }
        )
        return error_response("BAD_REQUEST", "filePath is required", 400)

    if mode not in ("replace",):
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "failed",
                "errorMessage": "Unsupported mode. Use 'replace'.",
            }
        )
        return error_response("BAD_REQUEST", "Unsupported mode. Use 'replace'.", 400)

    try:
        result = import_backtests_csv(file_path, mode=mode, source_type="import-http")
        validation_summary = _build_validation_summary(result)
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "success",
                "errorMessage": validation_summary,
                **result,
            }
        )
        return jsonify(result)
    except FileNotFoundError as exc:
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "failed",
                "errorMessage": str(exc),
            }
        )
        return error_response("BAD_REQUEST", str(exc), 400)
    except ValueError as exc:
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "failed",
                "errorMessage": str(exc),
            }
        )
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "failed",
                "errorMessage": "Failed to import backtests CSV",
            }
        )
        return error_response("INTERNAL_ERROR", "Failed to import backtests CSV", 500)


@api_bp.get("/import-jobs")
def import_jobs_recent():
    raw_limit = request.args.get("limit")

    try:
        limit = int(raw_limit) if raw_limit is not None else 5
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid limit parameter", 400)

    try:
        items = get_recent_import_jobs(limit)
        return jsonify({"items": items})
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load import jobs", 500)


@api_bp.get("/forward-gate/summary")
def forward_gate_summary():
    try:
        return jsonify(get_forward_gate_summary())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load forward gate summary", 500)


@api_bp.get("/evaluations/history")
def evaluations_history():
    entity_type = (request.args.get("entityType") or "").strip()
    entity_id = (request.args.get("entityId") or "").strip()
    raw_limit = request.args.get("limit")

    if not entity_type or not entity_id:
        return error_response(
            "BAD_REQUEST",
            "entityType and entityId are required",
            400,
        )

    try:
        limit = int(raw_limit) if raw_limit is not None else 10
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid limit parameter", 400)

    try:
        items = get_evaluation_history(entity_type, entity_id, limit=limit)
        return jsonify({
            "entityType": entity_type,
            "entityId": entity_id,
            "items": items,
        })
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load evaluation history", 500)
