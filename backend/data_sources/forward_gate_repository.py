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


def load_forward_gate_summary() -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                strategyName, symbol,
                forwardStatus, gateDecision,
                lastUpdated,
                tradesObserved, passRate, maxDrawdown,
                summary
            FROM forward_gate
            ORDER BY id ASC
            LIMIT 1
            """
        ).fetchone()

    if row is None:
        return None

    return {
        "strategyName": row["strategyName"],
        "symbol": row["symbol"],
        "forwardStatus": row["forwardStatus"],
        "gateDecision": row["gateDecision"],
        "lastUpdated": row["lastUpdated"],
        "tradesObserved": _to_int(row["tradesObserved"]),
        "passRate": _to_int(row["passRate"]),
        "maxDrawdown": _to_float(row["maxDrawdown"]),
        "summary": row["summary"],
    }
