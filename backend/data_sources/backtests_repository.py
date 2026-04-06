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


def query_backtests_page(page: int, page_size: int) -> dict[str, Any]:
    offset = (page - 1) * page_size

    with connection_scope() as connection:
        rows_cursor = connection.execute(
            """
            SELECT
                id, name, symbol, timeframe,
                returnPct, winRate, maxDrawdown, profitFactor,
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
                "score": _to_int(row["score"]),
                "decision": row["decision"],
            }
            for row in rows_cursor.fetchall()
        ]
        total = _to_int(count_cursor.fetchone()["total"])

    return {"items": items, "total": total}


def query_backtests_summary() -> dict[str, int]:
    with connection_scope() as connection:
        summary_cursor = connection.execute(
            """
            SELECT
                COUNT(*) AS totalAudits,
                COALESCE(ROUND(AVG(score), 0), 0) AS averageScore,
                COALESCE(ROUND(100.0 * SUM(CASE WHEN decision = 'PASS' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 0), 0) AS passRate
            FROM backtests
            """
        )
        row = summary_cursor.fetchone()

    return {
        "totalAudits": _to_int(row["totalAudits"]),
        "averageScore": _to_int(row["averageScore"]),
        "passRate": _to_int(row["passRate"]),
    }
