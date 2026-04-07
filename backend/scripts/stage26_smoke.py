"""Stage 26 smoke test: aggregate lifecycle across backtests, candidate, forward, summary, and gate."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage26_")
    db_path = Path(tmp_dir) / "stage26.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from data_sources.import_jobs_repository import insert_import_job
    from db.init_db import import_backtests, init_schema
    from services.backtests_service import set_backtest_candidate
    from services.forward_run_gate_results_service import save_forward_run_gate_result
    from services.forward_run_summaries_service import save_forward_run_summary
    from services.forward_runs_service import create_forward_run_entry
    from services.strategy_lifecycle_service import get_strategy_lifecycle

    init_schema()
    import_backtests()

    job_id = insert_import_job(
        {
            "jobType": "backtests-import",
            "sourcePath": "backend/data_sources/backtests.csv",
            "mode": "replace",
            "status": "success",
            "importedCount": 3,
        }
    )

    set_backtest_candidate("bt-001", True)
    run = create_forward_run_entry("bt-001", "EURUSD", "H1", "stage26")

    save_forward_run_summary(
        run["id"],
        {
            "totalTrades": 24,
            "winRate": 58.3,
            "pnl": 610.0,
            "maxDrawdown": 5.1,
            "expectancy": 11.4,
            "periodStart": "2026-04-01",
            "periodEnd": "2026-05-01",
        },
    )
    save_forward_run_gate_result(
        run["id"],
        {
            "gateDecision": "PROMISING",
            "confidence": "MEDIUM",
            "hardFail": False,
            "sampleAdequacy": "MEDIUM",
            "strongestFactor": "discipline",
            "weakestFactor": "sample size",
            "notes": "stage26 smoke",
        },
    )

    lifecycle = get_strategy_lifecycle("bt-001")
    assert lifecycle["strategyId"] == "bt-001"
    assert lifecycle["candidate"]["isCandidate"] is True
    assert lifecycle["sourceJobId"] == job_id
    assert lifecycle["sourceJob"] is not None
    assert lifecycle["latestForwardRun"] is not None
    assert lifecycle["latestForwardRun"]["sourceJobId"] == job_id
    assert lifecycle["latestSummary"] is not None
    assert lifecycle["latestSummary"]["totalTrades"] == 24
    assert lifecycle["latestGateResult"] is not None
    assert lifecycle["latestGateResult"]["gateDecision"] == "PROMISING"

    print("ALL ASSERTIONS PASSED - Stage 26 smoke OK")


if __name__ == "__main__":
    main()