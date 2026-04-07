"""Stage 20 smoke test: compare two import jobs snapshots."""

import os
import tempfile
from pathlib import Path


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage20_")
    db_path = Path(tmp_dir) / "stage20.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import init_schema
    from data_sources.import_jobs_repository import insert_import_job
    from data_sources.job_snapshots_repository import insert_job_snapshot_rows
    from services.import_jobs_compare_service import compare_import_jobs

    init_schema()

    left_job_id = insert_import_job(
        {
            "jobType": "backtests-import",
            "sourcePath": "left.csv",
            "mode": "replace",
            "importedCount": 3,
            "status": "success",
        }
    )
    right_job_id = insert_import_job(
        {
            "jobType": "backtests-import",
            "sourcePath": "right.csv",
            "mode": "replace",
            "importedCount": 3,
            "status": "success",
        }
    )

    insert_job_snapshot_rows(
        left_job_id,
        [
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
                "return_pct": 6,
                "win_rate": 48,
                "max_drawdown": 11,
                "profit_factor": 1.1,
                "trade_count": 90,
                "score": 58,
                "decision": "FAIL",
            },
            {
                "strategy_id": "c",
                "strategy_name": "Gamma",
                "symbol": "USDJPY",
                "timeframe": "H4",
                "return_pct": 12,
                "win_rate": 59,
                "max_drawdown": 9,
                "profit_factor": 1.5,
                "trade_count": 150,
                "score": 80,
                "decision": "PASS",
            },
        ],
    )

    insert_job_snapshot_rows(
        right_job_id,
        [
            {
                "strategy_id": "a",
                "strategy_name": "Alpha",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "return_pct": 11,
                "win_rate": 57,
                "max_drawdown": 6,
                "profit_factor": 1.45,
                "trade_count": 200,
                "score": 75,
                "decision": "PASS",
            },
            {
                "strategy_id": "b",
                "strategy_name": "Beta",
                "symbol": "GBPUSD",
                "timeframe": "H1",
                "return_pct": 5,
                "win_rate": 47,
                "max_drawdown": 12,
                "profit_factor": 1.0,
                "trade_count": 95,
                "score": 56,
                "decision": "FAIL",
            },
            {
                "strategy_id": "d",
                "strategy_name": "Delta",
                "symbol": "AUDUSD",
                "timeframe": "H4",
                "return_pct": 8,
                "win_rate": 52,
                "max_drawdown": 8,
                "profit_factor": 1.25,
                "trade_count": 120,
                "score": 67,
                "decision": "NEEDS_IMPROVEMENT",
            },
        ],
    )

    result = compare_import_jobs(left_job_id, right_job_id)
    print("compare summary:", {
        "new": result["newStrategiesCount"],
        "removed": result["removedStrategiesCount"],
        "changed": result["changedStrategiesCount"],
        "decisionChanged": result["decisionChangedCount"],
        "upgrades": result["decisionUpgradeCount"],
        "downgrades": result["decisionDowngradeCount"],
    })

    assert result["totalStrategiesLeft"] == 3
    assert result["totalStrategiesRight"] == 3
    assert result["newStrategiesCount"] == 1  # d
    assert result["removedStrategiesCount"] == 1  # c
    assert result["changedStrategiesCount"] == 2  # a(score+decision), b(score)
    assert result["decisionChangedCount"] == 1  # a
    assert result["decisionUpgradeCount"] == 1
    assert result["decisionDowngradeCount"] == 0

    assert result["biggestScoreIncrease"] is not None
    assert result["biggestScoreIncrease"]["id"] == "a"
    assert result["biggestScoreIncrease"]["delta"] == 5

    assert len(result["topChangedStrategies"]) >= 3
    top_ids = {item["strategyId"] for item in result["topChangedStrategies"]}
    assert {"a", "c", "d"}.issubset(top_ids)

    print("ALL ASSERTIONS PASSED - Stage 20 smoke OK")


if __name__ == "__main__":
    main()
