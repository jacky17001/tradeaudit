"""Stage 30 smoke test: account audit summary recompute/list/detail flow."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage30_")
    db_path = Path(tmp_dir) / "stage30.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import init_schema
    from services.account_audit_mt5_service import create_mt5_connection, sync_mt5_investor_account
    from services.account_audit_summaries_service import (
        get_account_audit_summary_detail,
        list_account_audit_summaries,
        recompute_account_audit_summary,
    )

    init_schema()

    created = create_mt5_connection(
        {
            "accountNumber": "661199",
            "server": "Mock-Server",
            "investorPassword": "investor-pass",
            "connectionLabel": "Stage30 Investor",
        }
    )
    assert created["status"] == "CONNECTED"

    synced = sync_mt5_investor_account(created["id"], {"investorPassword": "investor-pass"})
    assert synced["status"] == "SYNCED"
    assert synced["syncedTradeCount"] >= 1

    recomputed = recompute_account_audit_summary(
        {
            "sourceType": "mt5_investor",
            "sourceRefId": created["id"],
        }
    )
    assert recomputed["sourceType"] == "mt5_investor"
    assert recomputed["sourceRefId"] == created["id"]
    assert recomputed["totalTrades"] is not None

    listed = list_account_audit_summaries("mt5_investor", 10)
    assert any(item["id"] == recomputed["id"] for item in listed)

    detail = get_account_audit_summary_detail(recomputed["id"])
    assert detail["id"] == recomputed["id"]
    assert detail["accountLabel"]

    print("ALL ASSERTIONS PASSED - Stage 30 smoke OK")


if __name__ == "__main__":
    main()
