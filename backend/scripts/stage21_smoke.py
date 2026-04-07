"""Stage 21 smoke test: activation diff summary is persisted in audit."""

import json
import os
import tempfile
from pathlib import Path


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage21_")
    db_path = Path(tmp_dir) / "stage21.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import init_schema
    from db.sqlite import connection_scope
    from data_sources.import_jobs_repository import insert_import_job
    from data_sources.job_snapshots_repository import insert_job_snapshot_rows
    from services.backtests_activate_service import activate_import_job

    init_schema()

    # Job 1 snapshot
    job1 = insert_import_job({
        "jobType": "backtests-import",
        "sourcePath": "job1.csv",
        "mode": "replace",
        "importedCount": 2,
        "status": "success",
    })
    insert_job_snapshot_rows(job1, [
        {
            "strategy_id": "a",
            "strategy_name": "Alpha",
            "symbol": "EURUSD",
            "timeframe": "H1",
            "return_pct": 10,
            "win_rate": 55,
            "max_drawdown": 7,
            "profit_factor": 1.4,
            "trade_count": 180,
            "score": 70,
            "decision": "NEEDS_IMPROVEMENT",
        },
        {
            "strategy_id": "b",
            "strategy_name": "Beta",
            "symbol": "GBPUSD",
            "timeframe": "H1",
            "return_pct": 8,
            "win_rate": 52,
            "max_drawdown": 9,
            "profit_factor": 1.2,
            "trade_count": 140,
            "score": 66,
            "decision": "NEEDS_IMPROVEMENT",
        },
    ])

    # Job 2 snapshot (later job => current active source before activation)
    job2 = insert_import_job({
        "jobType": "backtests-import",
        "sourcePath": "job2.csv",
        "mode": "replace",
        "importedCount": 2,
        "status": "success",
    })
    insert_job_snapshot_rows(job2, [
        {
            "strategy_id": "a",
            "strategy_name": "Alpha",
            "symbol": "EURUSD",
            "timeframe": "H1",
            "return_pct": 12,
            "win_rate": 58,
            "max_drawdown": 6,
            "profit_factor": 1.5,
            "trade_count": 210,
            "score": 76,
            "decision": "PASS",
        },
        {
            "strategy_id": "c",
            "strategy_name": "Gamma",
            "symbol": "USDJPY",
            "timeframe": "H4",
            "return_pct": 6,
            "win_rate": 48,
            "max_drawdown": 10,
            "profit_factor": 1.0,
            "trade_count": 90,
            "score": 55,
            "decision": "FAIL",
        },
    ])

    # Activate job1 while current active source should be job2.
    result = activate_import_job(job1)
    print("activate result:", result)

    assert result["ok"] is True
    assert result["jobId"] == job1
    summary = result.get("activationDiffSummary")
    assert summary is not None
    assert summary["compared_from_job_id"] == job2
    assert summary["compared_to_job_id"] == job1

    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT activation_diff_summary
            FROM backtest_dataset_activations
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

    assert row is not None
    stored = json.loads(row["activation_diff_summary"]) if row["activation_diff_summary"] else None
    assert stored is not None
    assert stored["compared_from_job_id"] == job2
    assert stored["compared_to_job_id"] == job1
    assert stored["changedStrategiesCount"] is not None

    print("ALL ASSERTIONS PASSED - Stage 21 smoke OK")


if __name__ == "__main__":
    main()
