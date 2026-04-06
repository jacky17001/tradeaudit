from flask import Blueprint, jsonify, request

from routes.response_utils import error_response
from services.account_audit_service import get_account_audit_summary
from services.backtests_service import get_backtests_page
from services.dashboard_service import get_dashboard_summary
from services.forward_gate_service import get_forward_gate_summary

api_bp = Blueprint("api", __name__, url_prefix="/api")


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


@api_bp.get("/forward-gate/summary")
def forward_gate_summary():
    try:
        return jsonify(get_forward_gate_summary())
    except Exception:
        return error_response("INTERNAL_ERROR", "Failed to load forward gate summary", 500)
