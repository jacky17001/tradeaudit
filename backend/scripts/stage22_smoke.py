"""Stage 22 smoke test: candidate mark/unmark persists and candidate filter works."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage22_")
    db_path = Path(tmp_dir) / "stage22.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import import_backtests, init_schema
    from services.backtests_service import get_backtests_page, set_backtest_candidate

    init_schema()
    import_backtests()

    before = get_backtests_page(1, 20, candidate_only=True)
    assert before["total"] == 0

    marked = set_backtest_candidate("bt-001", True)
    assert marked["ok"] is True
    assert marked["isCandidate"] is True

    filtered = get_backtests_page(1, 20, candidate_only=True)
    assert filtered["total"] == 1
    assert filtered["items"][0]["id"] == "bt-001"
    assert filtered["items"][0]["isCandidate"] is True

    unmarked = set_backtest_candidate("bt-001", False)
    assert unmarked["ok"] is True
    assert unmarked["isCandidate"] is False

    after = get_backtests_page(1, 20, candidate_only=True)
    assert after["total"] == 0

    print("ALL ASSERTIONS PASSED - Stage 22 smoke OK")


if __name__ == "__main__":
    main()
