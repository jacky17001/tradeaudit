"""Stage 19 smoke test: import snapshot activation loop."""

import os
import tempfile
from pathlib import Path


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage19_")
    db_path = Path(tmp_dir) / "stage19.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    # Import after DB path env is set.
    from db.init_db import init_schema
    from db.sqlite import connection_scope
    from data_sources.import_jobs_repository import insert_import_job
    from data_sources.job_snapshots_repository import insert_job_snapshot_rows
    from services.backtests_activate_service import activate_import_job, get_active_dataset_info

    init_schema()

    # Seed current dataset with one row to verify replacement happens.
    with connection_scope() as connection:
        connection.execute(
            """
            INSERT INTO backtests (
                id, name, symbol, timeframe,
                returnPct, winRate, maxDrawdown, profitFactor,
                tradeCount, score, decision
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("seed-1", "Seed Strategy", "EURUSD", "H1", 5.0, 50.0, 8.0, 1.2, 100, 55, "NEEDS_IMPROVEMENT"),
        )

    # Create import job + snapshot rows that we will activate.
    job_id = insert_import_job(
        {
            "jobType": "backtests-import",
            "sourcePath": "smoke-stage19.csv",
            "mode": "replace",
            "importedCount": 2,
            "status": "success",
        }
    )

    insert_job_snapshot_rows(
        job_id,
        [
            {
                "strategy_id": "s1",
                "strategy_name": "Alpha",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "return_pct": 12.5,
                "win_rate": 57.2,
                "max_drawdown": 6.8,
                "profit_factor": 1.48,
                "trade_count": 210,
                "score": 78,
                "decision": "PASS",
            },
            {
                "strategy_id": "s2",
                "strategy_name": "Beta",
                "symbol": "GBPUSD",
                "timeframe": "H4",
                "return_pct": 4.2,
                "win_rate": 49.1,
                "max_drawdown": 11.3,
                "profit_factor": 1.05,
                "trade_count": 130,
                "score": 58,
                "decision": "NEEDS_IMPROVEMENT",
            },
        ],
    )

    activation_result = activate_import_job(job_id)
    print("activation_result:", activation_result)

    assert activation_result["ok"] is True
    assert activation_result["jobId"] == job_id
    assert activation_result["strategiesCount"] == 2

    with connection_scope() as connection:
        rows = connection.execute(
            "SELECT id, name, score, decision FROM backtests ORDER BY id"
        ).fetchall()
        activations = connection.execute(
            "SELECT source_import_job_id, strategies_count FROM backtest_dataset_activations ORDER BY id DESC LIMIT 1"
        ).fetchone()

    assert len(rows) == 2, rows
    assert [r["id"] for r in rows] == ["s1", "s2"]
    assert rows[0]["name"] == "Alpha"
    assert rows[1]["name"] == "Beta"

    assert activations is not None
    assert int(activations["source_import_job_id"]) == job_id
    assert int(activations["strategies_count"]) == 2

    active_info = get_active_dataset_info()
    print("active_info:", active_info)
    assert active_info["sourceJobId"] == job_id

    print("ALL ASSERTIONS PASSED - Stage 19 smoke OK")


if __name__ == "__main__":
    main()
