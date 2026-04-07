"""Stage 23 smoke test: create/list/update forward runs registry."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage23_")
    db_path = Path(tmp_dir) / "stage23.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import import_backtests, init_schema
    from services.backtests_service import set_backtest_candidate
    from services.forward_runs_service import (
        change_forward_run_status,
        create_forward_run_entry,
        list_forward_runs_page,
    )

    init_schema()
    import_backtests()

    set_backtest_candidate("bt-001", True)

    created = create_forward_run_entry("bt-001", "EURUSD", "H1", "stage23")
    assert created["strategyId"] == "bt-001"
    assert created["status"] == "RUNNING"

    listed = list_forward_runs_page("RUNNING", 1, 20)
    assert listed["total"] >= 1
    assert any(item["id"] == created["id"] for item in listed["items"])

    paused = change_forward_run_status(created["id"], "PAUSED")
    assert paused["status"] == "PAUSED"

    completed = change_forward_run_status(created["id"], "COMPLETED")
    assert completed["status"] == "COMPLETED"
    assert completed["endedAt"] is not None

    print("ALL ASSERTIONS PASSED - Stage 23 smoke OK")


if __name__ == "__main__":
    main()
