from datetime import datetime, timezone
from typing import Any

from db.sqlite import connection_scope


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _map_connection_row(row: Any) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "accountNumber": str(row["account_number"]),
        "server": str(row["server"]),
        "connectionLabel": str(row["connection_label"]),
        "status": str(row["status"]),
        "lastTestedAt": row["last_tested_at"],
        "lastSyncedAt": row["last_synced_at"],
        "errorMessage": str(row["error_message"] or ""),
        "readOnlyAccess": bool(row["read_only"]),
        "accountInfo": {
            "accountNumber": str(row["account_number"]),
            "server": str(row["server"]),
            "accountName": str(row["account_name"] or ""),
            "currency": str(row["currency"] or ""),
            "balance": float(row["balance"] or 0),
            "equity": float(row["equity"] or 0),
            "leverage": int(row["leverage"] or 0),
        },
        "syncedTradeCount": int(row["synced_trade_count"] or 0),
        "createdAt": str(row["created_at"]),
        "updatedAt": str(row["updated_at"]),
    }


def create_mt5_connection_record(payload: dict[str, Any]) -> dict[str, Any]:
    now = _now_iso()
    with connection_scope() as connection:
        cursor = connection.execute(
            """
            INSERT INTO account_audit_mt5_connections (
                account_number,
                server,
                connection_label,
                status,
                last_tested_at,
                last_synced_at,
                error_message,
                account_name,
                currency,
                balance,
                equity,
                leverage,
                synced_trade_count,
                read_only,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(payload.get("account_number", "")),
                str(payload.get("server", "")),
                str(payload.get("connection_label", "")),
                str(payload.get("status", "CONNECTED")),
                payload.get("last_tested_at"),
                payload.get("last_synced_at"),
                str(payload.get("error_message", "") or ""),
                str(payload.get("account_name", "") or ""),
                str(payload.get("currency", "") or ""),
                float(payload.get("balance", 0) or 0),
                float(payload.get("equity", 0) or 0),
                int(payload.get("leverage", 0) or 0),
                int(payload.get("synced_trade_count", 0) or 0),
                1,
                now,
                now,
            ),
        )
        connection_id = int(cursor.lastrowid or 0)

    return get_mt5_connection_record(connection_id)


def update_mt5_connection_record(connection_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_mt5_connection_record(connection_id)
    updated_at = _now_iso()
    account_info = payload.get("account_info") or {}

    with connection_scope() as connection:
        connection.execute(
            """
            UPDATE account_audit_mt5_connections
            SET
                connection_label = ?,
                status = ?,
                last_tested_at = ?,
                last_synced_at = ?,
                error_message = ?,
                account_name = ?,
                currency = ?,
                balance = ?,
                equity = ?,
                leverage = ?,
                synced_trade_count = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                str(payload.get("connection_label", current["connectionLabel"])),
                str(payload.get("status", current["status"])),
                payload.get("last_tested_at", current["lastTestedAt"]),
                payload.get("last_synced_at", current["lastSyncedAt"]),
                str(payload.get("error_message", current["errorMessage"]) or ""),
                str(account_info.get("accountName", current["accountInfo"]["accountName"]) or ""),
                str(account_info.get("currency", current["accountInfo"]["currency"]) or ""),
                float(account_info.get("balance", current["accountInfo"]["balance"]) or 0),
                float(account_info.get("equity", current["accountInfo"]["equity"]) or 0),
                int(account_info.get("leverage", current["accountInfo"]["leverage"]) or 0),
                int(payload.get("synced_trade_count", current["syncedTradeCount"]) or 0),
                updated_at,
                connection_id,
            ),
        )

    return get_mt5_connection_record(connection_id)


def get_mt5_connection_record(connection_id: int) -> dict[str, Any]:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                account_number,
                server,
                connection_label,
                status,
                last_tested_at,
                last_synced_at,
                error_message,
                account_name,
                currency,
                balance,
                equity,
                leverage,
                synced_trade_count,
                read_only,
                created_at,
                updated_at
            FROM account_audit_mt5_connections
            WHERE id = ?
            LIMIT 1
            """,
            (connection_id,),
        ).fetchone()

    if row is None:
        raise ValueError(f"MT5 connection {connection_id} does not exist")
    return _map_connection_row(row)


def list_mt5_connection_records(limit: int = 10) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 50)
    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                account_number,
                server,
                connection_label,
                status,
                last_tested_at,
                last_synced_at,
                error_message,
                account_name,
                currency,
                balance,
                equity,
                leverage,
                synced_trade_count,
                read_only,
                created_at,
                updated_at
            FROM account_audit_mt5_connections
            ORDER BY id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
    return [_map_connection_row(row) for row in rows]


def replace_mt5_connection_trades(connection_id: int, trades: list[dict[str, Any]]) -> None:
    created_at = _now_iso()
    with connection_scope() as connection:
        connection.execute("DELETE FROM account_audit_mt5_trades WHERE connection_id = ?", (connection_id,))
        if trades:
            connection.executemany(
                """
                INSERT INTO account_audit_mt5_trades (
                    connection_id,
                    ticket,
                    symbol,
                    order_type,
                    volume,
                    open_time,
                    close_time,
                    profit,
                    commission,
                    swap,
                    comment,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        connection_id,
                        str(trade.get("ticket", "")),
                        str(trade.get("symbol", "")),
                        str(trade.get("orderType", "")),
                        float(trade.get("volume", 0) or 0),
                        trade.get("openTime"),
                        trade.get("closeTime"),
                        float(trade.get("profit", 0) or 0),
                        float(trade.get("commission", 0) or 0),
                        float(trade.get("swap", 0) or 0),
                        str(trade.get("comment", "") or ""),
                        created_at,
                    )
                    for trade in trades
                ],
            )


def list_mt5_connection_trades(connection_id: int, limit: int = 20) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 100)
    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                ticket,
                symbol,
                order_type,
                volume,
                open_time,
                close_time,
                profit,
                commission,
                swap,
                comment
            FROM account_audit_mt5_trades
            WHERE connection_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (connection_id, safe_limit),
        ).fetchall()

    return [
        {
            "id": int(row["id"]),
            "ticket": str(row["ticket"]),
            "symbol": str(row["symbol"]),
            "orderType": str(row["order_type"]),
            "volume": float(row["volume"] or 0),
            "openTime": row["open_time"],
            "closeTime": row["close_time"],
            "profit": float(row["profit"] or 0),
            "commission": float(row["commission"] or 0),
            "swap": float(row["swap"] or 0),
            "comment": str(row["comment"] or ""),
        }
        for row in rows
    ]