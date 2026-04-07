"""Stage 24 smoke test: create/edit/get forward run summary."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage24_")
    db_path = Path(tmp_dir) / "stage24.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import import_backtests, init_schema
    from services.backtests_service import set_backtest_candidate
    from services.forward_run_summaries_service import (
        get_forward_run_summary_for_run,
        save_forward_run_summary,
    )
    from services.forward_runs_service import create_forward_run_entry, list_forward_runs_page

    init_schema()
    import_backtests()

    set_backtest_candidate("bt-001", True)
    run = create_forward_run_entry("bt-001", "EURUSD", "H1", "stage24")

    saved = save_forward_run_summary(
        run["id"],
        {
            "totalTrades": 20,
            "winRate": 55.5,
            "pnl": 321.2,
            "maxDrawdown": 4.1,
            "expectancy": 8.3,
            "periodStart": "2026-01-01",
            "periodEnd": "2026-02-01",
        },
    )
    assert saved["forwardRunId"] == run["id"]
    assert saved["totalTrades"] == 20

    edited = save_forward_run_summary(
        run["id"],
        {
            "totalTrades": 25,
            "winRate": 60,
            "pnl": 500,
            "maxDrawdown": 5,
            "expectancy": 10,
            "periodStart": "2026-01-01",
            "periodEnd": "2026-03-01",
        },
    )
    assert edited["totalTrades"] == 25
    assert edited["pnl"] == 500

    fetched = get_forward_run_summary_for_run(run["id"])
    assert fetched is not None
    assert fetched["expectancy"] == 10

    runs = list_forward_runs_page(None, 1, 10)
    matched = next(item for item in runs["items"] if item["id"] == run["id"])
    assert matched["summary"] is not None
    assert matched["summary"]["totalTrades"] == 25

    print("ALL ASSERTIONS PASSED - Stage 24 smoke OK")


if __name__ == "__main__":
    main()
