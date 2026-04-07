from datetime import datetime, timezone

from db.sqlite import connection_scope


def mark_candidate(strategy_id: str) -> None:
    marked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connection_scope() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO backtest_candidates (strategy_id, marked_at) VALUES (?, ?)",
            (strategy_id, marked_at),
        )


def unmark_candidate(strategy_id: str) -> None:
    with connection_scope() as connection:
        connection.execute(
            "DELETE FROM backtest_candidates WHERE strategy_id = ?",
            (strategy_id,),
        )


def is_strategy_in_backtests(strategy_id: str) -> bool:
    with connection_scope() as connection:
        row = connection.execute(
            "SELECT COUNT(*) as cnt FROM backtests WHERE id = ?",
            (strategy_id,),
        ).fetchone()
    return int(row["cnt"] or 0) > 0


def is_strategy_candidate(strategy_id: str) -> bool:
    with connection_scope() as connection:
        row = connection.execute(
            "SELECT COUNT(*) as cnt FROM backtest_candidates WHERE strategy_id = ?",
            (strategy_id,),
        ).fetchone()
    return int(row["cnt"] or 0) > 0
