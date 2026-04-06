from typing import Any

from db.sqlite import connection_scope


def _to_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def load_account_audit_summary() -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                accountName, broker,
                balance, equity, riskScore,
                maxDrawdown, winRate, profitFactor,
                aiExplanation
            FROM account_audit
            ORDER BY id ASC
            LIMIT 1
            """
        ).fetchone()

    if row is None:
        return None

    return {
        "accountName": row["accountName"],
        "broker": row["broker"],
        "balance": _to_int(row["balance"]),
        "equity": _to_int(row["equity"]),
        "riskScore": _to_int(row["riskScore"]),
        "maxDrawdown": _to_float(row["maxDrawdown"]),
        "winRate": _to_int(row["winRate"]),
        "profitFactor": _to_float(row["profitFactor"]),
        "aiExplanation": row["aiExplanation"],
    }
