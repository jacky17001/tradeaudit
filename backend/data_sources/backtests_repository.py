from typing import Any

from db.sqlite import connection_scope
from services.backtests_scoring_service import evaluate_backtest


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


def query_backtests_page(page: int, page_size: int) -> dict[str, Any]:
    offset = (page - 1) * page_size

    with connection_scope() as connection:
        rows_cursor = connection.execute(
            """
            SELECT
                id, name, symbol, timeframe,
                returnPct, winRate, maxDrawdown, profitFactor,
                tradeCount,
                score, decision
            FROM backtests
            ORDER BY id
            LIMIT ? OFFSET ?
            """,
            (page_size, offset),
        )
        count_cursor = connection.execute("SELECT COUNT(*) AS total FROM backtests")

        items = [
            {
                "id": row["id"],
                "name": row["name"],
                "symbol": row["symbol"],
                "timeframe": row["timeframe"],
                "returnPct": _to_float(row["returnPct"]),
                "winRate": _to_float(row["winRate"]),
                "maxDrawdown": _to_float(row["maxDrawdown"]),
                "profitFactor": _to_float(row["profitFactor"]),
                "tradeCount": _to_int(row["tradeCount"]),
                "score": _to_int(row["score"]),
                "decision": row["decision"],
            }
            for row in rows_cursor.fetchall()
        ]
        total = _to_int(count_cursor.fetchone()["total"])

    return {"items": items, "total": total}


def query_backtests_summary() -> dict[str, int]:
    with connection_scope() as connection:
        rows_cursor = connection.execute(
            """
            SELECT
                returnPct, winRate, maxDrawdown, profitFactor, tradeCount
            FROM backtests
            """
        )
        rows = rows_cursor.fetchall()

    total = len(rows)
    if total == 0:
        return {
            "totalAudits": 0,
            "averageScore": 0,
            "passRate": 0,
        }

    evaluated = [
        evaluate_backtest(
            {
                "returnPct": _to_float(row["returnPct"]),
                "winRate": _to_float(row["winRate"]),
                "maxDrawdown": _to_float(row["maxDrawdown"]),
                "profitFactor": _to_float(row["profitFactor"]),
                "tradeCount": _to_int(row["tradeCount"]),
            }
        )
        for row in rows
    ]
    score_sum = sum(item["finalScore"] for item in evaluated)
    pass_count = sum(1 for item in evaluated if item["decision"] == "PASS")

    return {
        "totalAudits": total,
        "averageScore": round(score_sum / total),
        "passRate": round((100.0 * pass_count) / total),
    }
