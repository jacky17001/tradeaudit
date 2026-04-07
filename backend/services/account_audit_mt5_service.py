from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from data_sources.account_audit_mt5_repository import (
    create_mt5_connection_record,
    get_mt5_connection_record,
    list_mt5_connection_records,
    list_mt5_connection_trades,
    replace_mt5_connection_trades,
    update_mt5_connection_record,
)
from services.account_audit_mt5_gateway import fetch_mt5_read_only_snapshot

_PASSWORD_CACHE: dict[int, dict[str, Any]] = {}
_PASSWORD_TTL_SECONDS = 1800


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalize_required_text(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    return text


def _normalize_label(value: Any, account_number: str, server: str) -> str:
    text = str(value or "").strip()
    return text or f"MT5 {account_number}@{server}"


def _cache_password(connection_id: int, investor_password: str) -> None:
    _PASSWORD_CACHE[connection_id] = {
        "password": investor_password,
        "cachedAt": datetime.now(timezone.utc).timestamp(),
    }


def _get_cached_password(connection_id: int) -> str | None:
    item = _PASSWORD_CACHE.get(connection_id)
    if item is None:
        return None
    age_seconds = datetime.now(timezone.utc).timestamp() - float(item.get("cachedAt", 0))
    if age_seconds > _PASSWORD_TTL_SECONDS:
        _PASSWORD_CACHE.pop(connection_id, None)
        return None
    return str(item.get("password", "") or "")


def _build_test_response(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "status": "SUCCESS",
        "readOnlyAccess": True,
        "tradingAllowed": False,
        "providerMode": snapshot.get("providerMode", "mock"),
        "accountInfo": snapshot["accountInfo"],
        "tradesPreview": snapshot.get("trades", [])[:5],
        "tradesCount": len(snapshot.get("trades", [])),
        "message": "Read-only investor connection successful. This connection does not allow trading.",
    }


def test_mt5_investor_connection(payload: dict[str, Any]) -> dict[str, Any]:
    account_number = _normalize_required_text(payload.get("accountNumber"), "accountNumber")
    server = _normalize_required_text(payload.get("server"), "server")
    investor_password = _normalize_required_text(payload.get("investorPassword"), "investorPassword")

    snapshot = fetch_mt5_read_only_snapshot(account_number, server, investor_password)
    return _build_test_response(snapshot)


test_mt5_investor_connection.__test__ = False


def create_mt5_connection(payload: dict[str, Any]) -> dict[str, Any]:
    account_number = _normalize_required_text(payload.get("accountNumber"), "accountNumber")
    server = _normalize_required_text(payload.get("server"), "server")
    investor_password = _normalize_required_text(payload.get("investorPassword"), "investorPassword")
    connection_label = _normalize_label(payload.get("connectionLabel"), account_number, server)

    snapshot = fetch_mt5_read_only_snapshot(account_number, server, investor_password)
    tested_at = _now_iso()

    created = create_mt5_connection_record(
        {
            "account_number": account_number,
            "server": server,
            "connection_label": connection_label,
            "status": "CONNECTED",
            "last_tested_at": tested_at,
            "error_message": "",
            "account_name": snapshot["accountInfo"].get("accountName", ""),
            "currency": snapshot["accountInfo"].get("currency", ""),
            "balance": snapshot["accountInfo"].get("balance", 0),
            "equity": snapshot["accountInfo"].get("equity", 0),
            "leverage": snapshot["accountInfo"].get("leverage", 0),
            "synced_trade_count": 0,
        }
    )
    _cache_password(created["id"], investor_password)
    created["providerMode"] = snapshot.get("providerMode", "mock")
    created["message"] = "Read-only connection saved. This connection does not allow trading."
    return created


def sync_mt5_investor_account(connection_id: int, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    connection = get_mt5_connection_record(connection_id)
    payload = payload or {}

    investor_password = str(payload.get("investorPassword", "") or "").strip()
    if not investor_password:
        investor_password = _get_cached_password(connection_id) or ""
    if not investor_password:
        raise ValueError(
            "Investor password is required to sync this connection again. Passwords are not stored in plaintext."
        )

    snapshot = fetch_mt5_read_only_snapshot(
        connection["accountNumber"],
        connection["server"],
        investor_password,
    )
    synced_at = _now_iso()

    replace_mt5_connection_trades(connection_id, snapshot.get("trades", []))
    updated = update_mt5_connection_record(
        connection_id,
        {
            "status": "SYNCED",
            "last_tested_at": synced_at,
            "last_synced_at": synced_at,
            "error_message": "",
            "account_info": snapshot["accountInfo"],
            "synced_trade_count": len(snapshot.get("trades", [])),
        },
    )
    _cache_password(connection_id, investor_password)

    trades = list_mt5_connection_trades(connection_id, limit=20)
    updated["providerMode"] = snapshot.get("providerMode", "mock")
    updated["recentTrades"] = trades
    updated["message"] = "Read-only sync completed. Account info and closed trades were refreshed."
    return updated


def get_mt5_connection(connection_id: int) -> dict[str, Any]:
    connection = get_mt5_connection_record(connection_id)
    connection["recentTrades"] = list_mt5_connection_trades(connection_id, limit=20)
    connection["readOnlyMessage"] = "Read-only access. This connection does not allow trading."
    return connection


def list_mt5_connections(limit: int = 10) -> list[dict[str, Any]]:
    items = list_mt5_connection_records(limit)
    for item in items:
        item["readOnlyMessage"] = "Read-only access"
    return items