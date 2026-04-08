import os
import tempfile

from flask import Blueprint, jsonify, request

from data_sources.change_items_repository import get_change_items, get_change_items_count, insert_change_items
from data_sources.evaluation_snapshots_repository import get_evaluation_history
from data_sources.import_jobs_repository import get_recent_import_jobs, insert_import_job
from routes.response_utils import error_response
from services.access_control_service import require_access, create_session, get_access_status
from services.config_safety_service import get_safe_config_status
from services.account_audit_intake_service import (
    create_account_audit_manual_intake,
    create_account_audit_upload_intake,
    list_account_audit_intake_jobs,
)
from services.account_audit_mt5_service import (
    create_mt5_connection,
    get_mt5_connection,
    list_mt5_connections,
    sync_mt5_investor_account,
    test_mt5_investor_connection,
)
from services.account_audit_summaries_service import (
    get_account_audit_summary_detail,
    list_account_audit_summaries,
    recompute_account_audit_summary,
)
from services.account_audit_review_service import get_account_audit_review
from services.account_audit_service import get_account_audit_summary
from services.backtests_import_service import import_backtests_csv
from services.backtests_service import get_backtests_page, set_backtest_candidate
from services.dashboard_service import get_dashboard_summary
from services.forward_gate_service import get_forward_gate_summary
from data_sources.job_snapshots_repository import insert_job_snapshot_rows
from services.backtests_activate_service import activate_import_job, get_active_dataset_info
from services.import_jobs_compare_service import compare_import_jobs
from services.forward_runs_service import (
    change_forward_run_status,
    create_forward_run_entry,
    list_forward_runs_page,
)
from services.forward_run_summaries_service import (
    get_forward_run_summary_for_run,
    save_forward_run_summary,
)
from services.forward_run_gate_results_service import (
    get_forward_run_gate_result_for_run,
    list_gate_results_page,
    save_forward_run_gate_result,
)
from services.audit_cases_service import (
    create_audit_case,
    list_audit_cases,
    get_case_detail,
    update_case,
    get_queue_for_review,
    case_summary,
)
from services.review_service import (
    add_note_to_case,
    list_case_notes,
    take_review_action,
    get_case_review_history,
    get_case_decision,
)
from services.timeline_service import (
    get_case_timeline,
    get_strategy_timeline,
    get_account_audit_timeline,
)
from services.strategy_lifecycle_service import get_strategy_lifecycle
from services.result_overview_service import get_result_overview
from services.scoring_summary_service import get_scoring_summary
from services.recommended_actions_service import get_recommended_actions
from services.audit_report_service import get_audit_report
from services.comparison_report_service import get_comparison_report
from services.final_recommendation_service import get_final_recommendation

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ============================================================================
# Authentication Endpoints
# ============================================================================

@api_bp.post("/auth/login")
def auth_login_route():
    """Login endpoint - validate password and return access token."""
    payload = request.get_json(silent=True) or {}
    password = (payload.get("password") or "").strip()
    
    if not password:
        return error_response("BAD_REQUEST", "Password is required", 400)
    
    session = create_session(password)
    if session is None:
        return error_response("UNAUTHORIZED", "Invalid password", 401)

    return jsonify({
        "ok": True,
        "token": session["token"],
        "issuedAt": session["issuedAt"],
        "expiresAt": session["expiresAt"],
    }), 200


@api_bp.post("/auth/verify")
def auth_verify_route():
    """Verify if current token is valid."""
    status = get_access_status()
    if status["ok"]:
        return jsonify({
            "valid": True,
            "expiresAt": status.get("expiresAt"),
        }), 200
    return error_response(status["code"], status["message"], 401)


@api_bp.get("/config/status")
def config_status_route():
    """Expose safe configuration status for login/access page warnings."""
    return jsonify(get_safe_config_status()), 200


# ============================================================================
# Resource Endpoints
# ============================================================================

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


def _log_import_job(payload: dict) -> int:
    try:
        return insert_import_job(payload)
    except Exception:
        # Logging should not break primary API flow in this lightweight phase.
        return 0


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


@api_bp.get("/result-overview")
@require_access
def result_overview_route():
    try:
        return jsonify(get_result_overview())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load result overview", 500)


@api_bp.get("/scoring-summary")
@require_access
def scoring_summary_route():
    kind = (request.args.get("kind") or "").strip().lower()
    if kind and kind not in {"strategy", "account"}:
        return error_response("BAD_REQUEST", "kind must be strategy or account", 400)

    try:
        return jsonify(get_scoring_summary(kind or None))
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load scoring summary", 500)


@api_bp.get("/recommended-actions")
@require_access
def recommended_actions_route():
    kind = (request.args.get("kind") or "").strip().lower()
    if kind and kind not in {"strategy", "account"}:
        return error_response("BAD_REQUEST", "kind must be strategy or account", 400)

    try:
        return jsonify(get_recommended_actions(kind or None))
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load recommended actions", 500)


@api_bp.get("/audit-report")
@require_access
def audit_report_route():
    kind = (request.args.get("kind") or "").strip().lower()
    if kind and kind not in {"strategy", "account"}:
        return error_response("BAD_REQUEST", "kind must be strategy or account", 400)

    try:
        return jsonify(get_audit_report(kind or None))
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load audit report", 500)


@api_bp.get("/comparison-report")
@require_access
def comparison_report_route():
    kind = (request.args.get("kind") or "").strip().lower()
    if kind not in {"strategy", "account"}:
        return error_response("BAD_REQUEST", "kind must be strategy or account", 400)

    left = (request.args.get("left") or "").strip() or None
    right = (request.args.get("right") or "").strip() or None

    try:
        return jsonify(get_comparison_report(kind=kind, left=left, right=right))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load comparison report", 500)


@api_bp.get("/final-recommendation")
@require_access
def final_recommendation_route():
    kind = (request.args.get("kind") or "").strip().lower() or None
    if kind and kind not in {"strategy", "account"}:
        return error_response("BAD_REQUEST", "kind must be strategy or account", 400)

    try:
        return jsonify(get_final_recommendation(kind=kind))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load final recommendation", 500)


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


@api_bp.get("/account-audit/intake-jobs")
def account_audit_intake_jobs_route():
    raw_limit = request.args.get("limit")

    try:
        limit = int(raw_limit) if raw_limit is not None else 5
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid limit parameter", 400)

    safe_limit = min(max(limit, 1), 20)

    try:
        return jsonify({"items": list_account_audit_intake_jobs(safe_limit)})
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit intake jobs", 500)


@api_bp.post("/account-audit/intake")
@require_access
def account_audit_manual_intake_route():
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(create_account_audit_manual_intake(payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to create account audit intake", 500)


@api_bp.post("/account-audit/intake-upload")
@require_access
def account_audit_upload_intake_route():
    uploaded = request.files.get("file")
    source_type = str(request.form.get("sourceType", "") or "")
    note = str(request.form.get("note", "") or "")

    if not uploaded or not uploaded.filename:
        return error_response("BAD_REQUEST", "No file provided", 400)

    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".upload")
        os.close(fd)
        uploaded.save(tmp_path)
        return jsonify(
            create_account_audit_upload_intake(
                source_type=source_type,
                file_path=tmp_path,
                original_filename=uploaded.filename[:200],
                note=note,
            )
        )
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to upload account audit intake", 500)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@api_bp.post("/account-audit/mt5/test-connection")
def account_audit_mt5_test_connection_route():
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(test_mt5_investor_connection(payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to test MT5 investor connection", 500)


@api_bp.post("/account-audit/mt5/connect")
@require_access
def account_audit_mt5_connect_route():
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(create_mt5_connection(payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to save MT5 investor connection", 500)


@api_bp.post("/account-audit/mt5/<int:connection_id>/sync")
@require_access
def account_audit_mt5_sync_route(connection_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(sync_mt5_investor_account(connection_id, payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to sync MT5 investor connection", 500)


@api_bp.get("/account-audit/mt5/connections")
def account_audit_mt5_connections_route():
    raw_limit = request.args.get("limit")

    try:
        limit = int(raw_limit) if raw_limit is not None else 10
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid limit parameter", 400)

    safe_limit = min(max(limit, 1), 50)

    try:
        return jsonify({"items": list_mt5_connections(safe_limit)})
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load MT5 investor connections", 500)


@api_bp.get("/account-audit/mt5/<int:connection_id>")
def account_audit_mt5_connection_route(connection_id: int):
    try:
        return jsonify(get_mt5_connection(connection_id))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load MT5 investor connection details", 500)


@api_bp.post("/account-audit/summaries/recompute")
@require_access
def account_audit_summaries_recompute_route():
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(recompute_account_audit_summary(payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to recompute account audit summary", 500)


@api_bp.get("/account-audit/summaries")
def account_audit_summaries_list_route():
    raw_limit = request.args.get("limit")
    source_type_filter = (request.args.get("sourceType") or "").strip() or None

    try:
        limit = int(raw_limit) if raw_limit is not None else 20
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid limit parameter", 400)

    safe_limit = min(max(limit, 1), 100)

    try:
        return jsonify({"items": list_account_audit_summaries(source_type_filter, safe_limit)})
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit summaries", 500)


@api_bp.get("/account-audit/summaries/<int:summary_id>")
def account_audit_summary_detail_route(summary_id: int):
    try:
        return jsonify(get_account_audit_summary_detail(summary_id))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit summary detail", 500)


@api_bp.get("/account-audit/review")
@require_access
def account_audit_review_route():
    source_type = (request.args.get("sourceType") or "").strip()
    source_ref_id_str = request.args.get("sourceRefId", "").strip()

    if not source_type:
        return error_response("BAD_REQUEST", "sourceType is required", 400)
    
    if not source_ref_id_str:
        return error_response("BAD_REQUEST", "sourceRefId is required", 400)

    try:
        source_ref_id = int(source_ref_id_str)
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid sourceRefId format", 400)

    try:
        return jsonify(get_account_audit_review(source_type, source_ref_id))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit review", 500)


@api_bp.get("/backtests/list")
def backtests_list():
    try:
        page, page_size = parse_pagination_args(
            request.args.get("page"), request.args.get("pageSize")
        )
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)

    candidate_only = str(request.args.get("candidateOnly", "false")).strip().lower() == "true"

    try:
        return jsonify(get_backtests_page(page, page_size, candidate_only=candidate_only))
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load backtests list", 500)


@api_bp.post("/backtests/<string:strategy_id>/candidate")
@require_access
def mark_backtest_candidate(strategy_id: str):
    try:
        return jsonify(set_backtest_candidate(strategy_id, True))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to mark candidate", 500)


@api_bp.delete("/backtests/<string:strategy_id>/candidate")
def unmark_backtest_candidate_route(strategy_id: str):
    try:
        return jsonify(set_backtest_candidate(strategy_id, False))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to unmark candidate", 500)


@api_bp.get("/backtests/<string:strategy_id>/lifecycle")
def backtests_strategy_lifecycle(strategy_id: str):
    try:
        return jsonify(get_strategy_lifecycle(strategy_id))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load strategy lifecycle", 500)


@api_bp.post("/backtests/import")
@require_access
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
        job_id = _log_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": file_path,
                "mode": mode,
                "status": "success",
                "errorMessage": validation_summary,
                **result,
            }
        )
        if job_id:
            try:
                insert_change_items(job_id, result.get("changeItems") or [])
            except Exception:
                pass
        if job_id:
            try:
                insert_job_snapshot_rows(job_id, result.get("snapshotRows") or [])
            except Exception:
                pass
        _STRIP_KEYS = {"changeItems", "snapshotRows"}
        response_data = {k: v for k, v in result.items() if k not in _STRIP_KEYS}
        response_data["jobId"] = job_id
        return jsonify(response_data)
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


@api_bp.post("/backtests/import-upload")
@require_access
def backtests_import_upload():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return error_response("BAD_REQUEST", "No file provided", 400)

    original_name = uploaded.filename[:200]
    if not original_name.lower().endswith(".csv"):
        return error_response("BAD_REQUEST", "Only CSV files are accepted", 400)

    mode = "replace"
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".csv")
        os.close(fd)
        uploaded.save(tmp_path)
        result = import_backtests_csv(tmp_path, mode=mode, source_type="import-upload")
        validation_summary = _build_validation_summary(result)
        job_id = _log_import_job(
            {
                "jobType": "backtests-import-upload",
                "sourcePath": original_name,
                "mode": mode,
                "status": "success",
                "errorMessage": validation_summary,
                **result,
            }
        )
        if job_id:
            try:
                insert_change_items(job_id, result.get("changeItems") or [])
            except Exception:
                pass
        if job_id:
            try:
                insert_job_snapshot_rows(job_id, result.get("snapshotRows") or [])
            except Exception:
                pass
        response_data = {k: v for k, v in result.items() if k not in {"changeItems", "snapshotRows"}}
        response_data["jobId"] = job_id
        return jsonify(response_data)
    except (FileNotFoundError, ValueError, UnicodeDecodeError) as exc:
        _log_import_job(
            {
                "jobType": "backtests-import-upload",
                "sourcePath": original_name,
                "mode": mode,
                "status": "failed",
                "errorMessage": str(exc),
            }
        )
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        _log_import_job(
            {
                "jobType": "backtests-import-upload",
                "sourcePath": original_name,
                "mode": mode,
                "status": "failed",
                "errorMessage": "Failed to import uploaded CSV",
            }
        )
        return error_response("INTERNAL_ERROR", "Failed to import uploaded CSV", 500)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


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


@api_bp.get("/import-jobs/<int:job_id>/changes")
def import_job_changes(job_id: int):
    change_type = (request.args.get("changeType") or "").strip().upper() or None
    raw_limit = request.args.get("limit")
    raw_offset = request.args.get("offset")

    try:
        limit = int(raw_limit) if raw_limit is not None else 100
        offset = int(raw_offset) if raw_offset is not None else 0
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid pagination parameters", 400)

    safe_limit = min(max(limit, 1), 500)
    safe_offset = max(offset, 0)

    if change_type and change_type not in ("NEW", "REMOVED", "UPDATED"):
        return error_response("BAD_REQUEST", "changeType must be NEW, REMOVED, or UPDATED", 400)

    try:
        items = get_change_items(job_id, change_type=change_type, limit=safe_limit, offset=safe_offset)
        total = get_change_items_count(job_id, change_type=change_type)
        return jsonify({
            "jobId": job_id,
            "items": items,
            "total": total,
            "limit": safe_limit,
            "offset": safe_offset,
        })
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load change items", 500)


@api_bp.post("/import-jobs/<int:job_id>/activate")
@require_access
def activate_import_job_route(job_id: int):
    try:
        result = activate_import_job(job_id)
        return jsonify(result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to activate import job", 500)


@api_bp.get("/backtests/active-dataset")
def backtests_active_dataset():
    try:
        return jsonify(get_active_dataset_info())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load active dataset info", 500)


# Audit Cases Routes (Stage 33)
@api_bp.get("/audit-cases")
@require_access
def get_audit_cases_route():
    try:
        limit = min(int(request.args.get("limit", 50)), 200)
        status_filter = request.args.get("status")
        priority_filter = request.args.get("priority")
        
        result = list_audit_cases(limit, status_filter, priority_filter)
        return jsonify(result)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load audit cases", 500)


@api_bp.post("/audit-cases")
@require_access
def create_audit_case_route():
    try:
        data = request.get_json() or {}
        case_type = data.get("case_type")
        ref_id = data.get("ref_id")
        
        if not case_type or not ref_id:
            return error_response("BAD_REQUEST", "case_type and ref_id are required", 400)
        
        priority = data.get("priority", "normal")
        status = data.get("status", "open")
        note = data.get("note")
        
        result = create_audit_case(case_type, ref_id, priority, status, note)
        return jsonify(result), 201
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to create audit case", 500)


@api_bp.get("/audit-cases/<int:case_id>")
@require_access
def get_audit_case_route(case_id: int):
    try:
        result = get_case_detail(case_id)
        return jsonify(result)
    except ValueError as exc:
        return error_response("NOT_FOUND", str(exc), 404)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load audit case", 500)


@api_bp.patch("/audit-cases/<int:case_id>")
@require_access
def update_audit_case_route(case_id: int):
    try:
        data = request.get_json() or {}
        priority = data.get("priority")
        status = data.get("status")
        note = data.get("note")
        
        result = update_case(case_id, priority, status, note)
        return jsonify(result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to update audit case", 500)


@api_bp.get("/review-queue")
@require_access
def review_queue_route():
    try:
        limit = min(int(request.args.get("limit", 50)), 200)
        result = get_queue_for_review(limit)
        return jsonify(result)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load review queue", 500)


@api_bp.get("/audit-cases/stats/summary")
@require_access
def audit_cases_summary_route():
    try:
        result = case_summary()
        return jsonify(result)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load case summary", 500)


# Review Notes & Actions Routes (Stage 34)
@api_bp.post("/audit-cases/<int:case_id>/notes")
@require_access
def add_case_note_route(case_id: int):
    try:
        data = request.get_json() or {}
        content = data.get("content")
        note_type = data.get("note_type", "comment")
        
        if not content:
            return error_response("BAD_REQUEST", "content is required", 400)
        
        result = add_note_to_case(case_id, content, note_type)
        return jsonify(result), 201
    except ValueError as exc:
        return error_response("NOT_FOUND" if "not found" in str(exc) else "BAD_REQUEST", str(exc), 404 if "not found" in str(exc) else 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to add note", 500)


@api_bp.get("/audit-cases/<int:case_id>/notes")
@require_access
def list_case_notes_route(case_id: int):
    try:
        limit = min(int(request.args.get("limit", 100)), 500)
        result = list_case_notes(case_id, limit)
        return jsonify(result)
    except ValueError as exc:
        return error_response("NOT_FOUND", str(exc), 404)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load notes", 500)


@api_bp.post("/audit-cases/<int:case_id>/actions")
@require_access
def take_case_action_route(case_id: int):
    try:
        data = request.get_json() or {}
        action = data.get("action")
        reason = data.get("reason")
        
        if not action:
            return error_response("BAD_REQUEST", "action is required", 400)
        
        result = take_review_action(case_id, action, reason)
        return jsonify(result), 201
    except ValueError as exc:
        error_type = "NOT_FOUND" if "not found" in str(exc) else "BAD_REQUEST"
        status_code = 404 if error_type == "NOT_FOUND" else 400
        return error_response(error_type, str(exc), status_code)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to record action", 500)


@api_bp.get("/audit-cases/<int:case_id>/actions")
@require_access
def list_case_actions_route(case_id: int):
    try:
        result = get_case_review_history(case_id)
        return jsonify(result)
    except ValueError as exc:
        return error_response("NOT_FOUND", str(exc), 404)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load actions", 500)


@api_bp.get("/audit-cases/<int:case_id>/decision")
@require_access
def get_case_decision_route(case_id: int):
    try:
        result = get_case_decision(case_id)
        return jsonify(result)
    except ValueError as exc:
        return error_response("NOT_FOUND", str(exc), 404)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load decision", 500)


# Unified Activity Timeline Routes (Stage 35)
@api_bp.get("/audit-cases/<int:case_id>/timeline")
@require_access
def audit_case_timeline_route(case_id: int):
    try:
        limit = min(int(request.args.get("limit", 100)), 300)
        result = get_case_timeline(case_id, max(limit, 1))
        return jsonify(result)
    except ValueError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 400
        error_type = "NOT_FOUND" if status_code == 404 else "BAD_REQUEST"
        return error_response(error_type, str(exc), status_code)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load case timeline", 500)


@api_bp.get("/backtests/<string:strategy_id>/timeline")
def strategy_timeline_route(strategy_id: str):
    try:
        limit = min(int(request.args.get("limit", 100)), 300)
        result = get_strategy_timeline(strategy_id, max(limit, 1))
        return jsonify(result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load strategy timeline", 500)


@api_bp.get("/account-audit/timeline")
@require_access
def account_audit_timeline_route():
    source_type = (request.args.get("sourceType") or "").strip()
    source_ref_id_raw = (request.args.get("sourceRefId") or "").strip()

    if not source_type:
        return error_response("BAD_REQUEST", "sourceType is required", 400)
    if not source_ref_id_raw:
        return error_response("BAD_REQUEST", "sourceRefId is required", 400)

    try:
        source_ref_id = int(source_ref_id_raw)
        limit = min(int(request.args.get("limit", 100)), 300)
        result = get_account_audit_timeline(source_type, source_ref_id, max(limit, 1))
        return jsonify(result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load account audit timeline", 500)


@api_bp.get("/import-jobs/compare")
@require_access
def import_jobs_compare():
    raw_left_job_id = request.args.get("leftJobId")
    raw_right_job_id = request.args.get("rightJobId")

    if not raw_left_job_id or not raw_right_job_id:
        return error_response("BAD_REQUEST", "leftJobId and rightJobId are required", 400)

    try:
        left_job_id = int(raw_left_job_id)
        right_job_id = int(raw_right_job_id)
    except ValueError:
        return error_response("BAD_REQUEST", "Invalid leftJobId or rightJobId", 400)

    try:
        return jsonify(compare_import_jobs(left_job_id, right_job_id))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to compare import jobs", 500)


@api_bp.post("/forward-runs")
@require_access
def create_forward_run_route():
    payload = request.get_json(silent=True) or {}
    strategy_id = str(payload.get("strategyId", "") or "")
    symbol = str(payload.get("symbol", "") or "")
    timeframe = str(payload.get("timeframe", "") or "")
    note = str(payload.get("note", "") or "")

    try:
        result = create_forward_run_entry(strategy_id, symbol, timeframe, note)
        return jsonify(result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to create forward run", 500)


@api_bp.get("/forward-runs")
def list_forward_runs_route():
    try:
        page, page_size = parse_pagination_args(
            request.args.get("page"), request.args.get("pageSize")
        )
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)

    status = request.args.get("status")

    try:
        return jsonify(list_forward_runs_page(status, page, page_size))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load forward runs", 500)


@api_bp.patch("/forward-runs/<int:run_id>/status")
@require_access
def patch_forward_run_status_route(run_id: int):
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status", "") or "")

    try:
        return jsonify(change_forward_run_status(run_id, status))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to update forward run status", 500)


@api_bp.put("/forward-runs/<int:run_id>/summary")
@api_bp.post("/forward-runs/<int:run_id>/summary")
@require_access
def upsert_forward_run_summary_route(run_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(save_forward_run_summary(run_id, payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to save forward run summary", 500)


@api_bp.get("/forward-runs/<int:run_id>/summary")
def get_forward_run_summary_route(run_id: int):
    try:
        summary = get_forward_run_summary_for_run(run_id)
        if summary is None:
            return jsonify({"forwardRunId": run_id, "summary": None})
        return jsonify(summary)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load forward run summary", 500)


@api_bp.put("/forward-runs/<int:run_id>/gate-result")
@api_bp.post("/forward-runs/<int:run_id>/gate-result")
@require_access
def upsert_forward_run_gate_result_route(run_id: int):
    payload = request.get_json(silent=True) or {}

    try:
        return jsonify(save_forward_run_gate_result(run_id, payload))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to save gate result", 500)


@api_bp.get("/forward-runs/<int:run_id>/gate-result")
def get_forward_run_gate_result_route(run_id: int):
    try:
        gate_result = get_forward_run_gate_result_for_run(run_id)
        if gate_result is None:
            return jsonify({"forwardRunId": run_id, "gateResult": None})
        return jsonify(gate_result)
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load gate result", 500)


@api_bp.get("/gate-results")
def list_gate_results_route():
    try:
        page, page_size = parse_pagination_args(
            request.args.get("page"), request.args.get("pageSize")
        )
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)

    decision = request.args.get("decision")

    try:
        return jsonify(list_gate_results_page(decision, page, page_size))
    except ValueError as exc:
        return error_response("BAD_REQUEST", str(exc), 400)
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load gate results", 500)
