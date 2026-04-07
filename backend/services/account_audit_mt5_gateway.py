from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib

try:
    import MetaTrader5 as mt5  # type: ignore
except Exception:  # pragma: no cover - environment dependent
    mt5 = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _should_use_mock(server: str) -> bool:
    normalized = str(server or "").strip().lower()
    return normalized.startswith("mock") or normalized.startswith("demo") or "mock" in normalized


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") if dt else None


def _normalize_mock_success(account_number: str, server: str, investor_password: str) -> bool:
    if not account_number.strip() or not server.strip() or not investor_password.strip():
        return False
    lowered = f"{account_number}|{server}|{investor_password}".lower()
    return "fail" not in lowered and "error" not in lowered


def _build_mock_payload(account_number: str, server: str) -> dict:
    seed_text = f"{account_number}:{server}"
    seed = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:8], 16)
    balance = round(5000 + (seed % 20000) / 10, 2)
    equity = round(balance - ((seed % 900) / 10), 2)
    leverage = 100 + (seed % 4) * 100
    account_name = f"Investor {account_number[-4:]}"
    currency = "USD"
    base_time = _utcnow() - timedelta(days=12)

    trades = []
    symbols = ["EURUSD", "XAUUSD", "GBPUSD", "USDJPY"]
    order_types = ["BUY", "SELL"]
    for index in range(6):
        open_time = base_time + timedelta(days=index, hours=2)
        close_time = open_time + timedelta(hours=4 + index)
        trades.append(
            {
                "ticket": f"{account_number}-{1000 + index}",
                "symbol": symbols[index % len(symbols)],
                "orderType": order_types[index % len(order_types)],
                "volume": round(0.1 + (index * 0.05), 2),
                "openTime": _iso(open_time),
                "closeTime": _iso(close_time),
                "profit": round(((-1) ** index) * (25.5 + index * 3.2), 2),
                "commission": round(0.8 + index * 0.1, 2),
                "swap": round((-1) ** (index + 1) * 0.3, 2),
                "comment": "Mock read-only sync",
            }
        )

    return {
        "providerMode": "mock",
        "readOnlyAccess": True,
        "tradingAllowed": False,
        "accountInfo": {
            "accountNumber": account_number,
            "server": server,
            "accountName": account_name,
            "currency": currency,
            "balance": balance,
            "equity": equity,
            "leverage": leverage,
        },
        "trades": trades,
    }


def _run_mock_connection(account_number: str, server: str, investor_password: str) -> dict:
    if not _normalize_mock_success(account_number, server, investor_password):
        raise ValueError("MT5 connection failed. Check account number, server, or investor password.")
    return _build_mock_payload(account_number, server)


def _run_metatrader5_connection(account_number: str, server: str, investor_password: str) -> dict:
    if mt5 is None:  # pragma: no cover - environment dependent
        raise ValueError("MetaTrader5 package is not available in this environment.")

    if not mt5.initialize():  # pragma: no cover - environment dependent
        raise ValueError(f"MT5 initialize failed: {mt5.last_error()}")

    try:
        login_ok = mt5.login(login=int(account_number), password=investor_password, server=server)
        if not login_ok:
            raise ValueError(f"MT5 login failed: {mt5.last_error()}")

        account_info = mt5.account_info()
        if account_info is None:
            raise ValueError("MT5 account info is unavailable.")

        utc_to = _utcnow().replace(tzinfo=None)
        utc_from = utc_to - timedelta(days=365)
        deals = mt5.history_deals_get(utc_from, utc_to) or []
        trades = []
        for deal in deals[:100]:
            trades.append(
                {
                    "ticket": str(getattr(deal, "ticket", "")),
                    "symbol": str(getattr(deal, "symbol", "")),
                    "orderType": str(getattr(deal, "type", "")),
                    "volume": float(getattr(deal, "volume", 0) or 0),
                    "openTime": None,
                    "closeTime": _iso(datetime.fromtimestamp(getattr(deal, "time", 0), tz=timezone.utc)),
                    "profit": float(getattr(deal, "profit", 0) or 0),
                    "commission": float(getattr(deal, "commission", 0) or 0),
                    "swap": float(getattr(deal, "swap", 0) or 0),
                    "comment": str(getattr(deal, "comment", "") or ""),
                }
            )

        return {
            "providerMode": "metatrader5",
            "readOnlyAccess": True,
            "tradingAllowed": False,
            "accountInfo": {
                "accountNumber": account_number,
                "server": server,
                "accountName": str(getattr(account_info, "name", "") or ""),
                "currency": str(getattr(account_info, "currency", "") or ""),
                "balance": float(getattr(account_info, "balance", 0) or 0),
                "equity": float(getattr(account_info, "equity", 0) or 0),
                "leverage": int(getattr(account_info, "leverage", 0) or 0),
            },
            "trades": trades,
        }
    finally:  # pragma: no cover - environment dependent
        mt5.shutdown()


def fetch_mt5_read_only_snapshot(account_number: str, server: str, investor_password: str) -> dict:
    if _should_use_mock(server):
        return _run_mock_connection(account_number, server, investor_password)
    if mt5 is not None:  # pragma: no cover - environment dependent
        return _run_metatrader5_connection(account_number, server, investor_password)
    return _run_mock_connection(account_number, server, investor_password)