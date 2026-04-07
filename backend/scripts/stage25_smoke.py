"""Stage 25 smoke test: create/edit/get gate result and list by decision."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage25_")
    db_path = Path(tmp_dir) / "stage25.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import import_backtests, init_schema
    from services.backtests_service import set_backtest_candidate
    from services.forward_run_gate_results_service import (
        get_forward_run_gate_result_for_run,
        list_gate_results_page,
        save_forward_run_gate_result,
    )
    from services.forward_runs_service import create_forward_run_entry, list_forward_runs_page

    init_schema()
    import_backtests()

    set_backtest_candidate("bt-001", True)
    run = create_forward_run_entry("bt-001", "EURUSD", "H1", "stage25")

    saved = save_forward_run_gate_result(
        run["id"],
        {
            "gateDecision": "PROMISING",
            "confidence": "MEDIUM",
            "hardFail": False,
            "sampleAdequacy": "MEDIUM",
            "strongestFactor": "win rate",
            "weakestFactor": "sample size",
            "notes": "first pass",
        },
    )
    assert saved["forwardRunId"] == run["id"]
    assert saved["gateDecision"] == "PROMISING"

    edited = save_forward_run_gate_result(
        run["id"],
        {
            "gateDecision": "PASS",
            "confidence": "HIGH",
            "hardFail": False,
            "sampleAdequacy": "HIGH",
            "strongestFactor": "consistency",
            "weakestFactor": "none",
            "notes": "upgraded",
        },
    )
    assert edited["gateDecision"] == "PASS"
    assert edited["confidence"] == "HIGH"

    fetched = get_forward_run_gate_result_for_run(run["id"])
    assert fetched is not None
    assert fetched["notes"] == "upgraded"

    listed = list_gate_results_page("PASS", 1, 10)
    matched = next(item for item in listed["items"] if item["forwardRunId"] == run["id"])
    assert matched["strategyId"] == "bt-001"

    runs = list_forward_runs_page(None, 1, 10)
    run_matched = next(item for item in runs["items"] if item["id"] == run["id"])
    assert run_matched["gateResult"] is not None
    assert run_matched["gateResult"]["gateDecision"] == "PASS"

    print("ALL ASSERTIONS PASSED - Stage 25 smoke OK")


if __name__ == "__main__":
    main()
