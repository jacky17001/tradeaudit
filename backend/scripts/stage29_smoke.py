"""Stage 29 smoke test: MT5 investor read-only test/connect/sync flow."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage29_")
    db_path = Path(tmp_dir) / "stage29.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import init_schema
    from services.account_audit_mt5_service import (
        create_mt5_connection,
        get_mt5_connection,
        list_mt5_connections,
        sync_mt5_investor_account,
        test_mt5_investor_connection,
    )

    init_schema()

    tested = test_mt5_investor_connection(
        {
            "accountNumber": "771122",
            "server": "Mock-Server",
            "investorPassword": "investor-pass",
        }
    )
    assert tested["ok"] is True
    assert tested["readOnlyAccess"] is True
    assert tested["tradingAllowed"] is False

    created = create_mt5_connection(
        {
            "accountNumber": "771122",
            "server": "Mock-Server",
            "investorPassword": "investor-pass",
            "connectionLabel": "Stage29 Investor",
        }
    )
    assert created["status"] == "CONNECTED"

    synced = sync_mt5_investor_account(created["id"], {"investorPassword": "investor-pass"})
    assert synced["status"] == "SYNCED"
    assert synced["syncedTradeCount"] >= 1
    assert len(synced["recentTrades"]) >= 1

    listed = list_mt5_connections(10)
    assert any(item["id"] == created["id"] for item in listed)

    detail = get_mt5_connection(created["id"])
    assert detail["id"] == created["id"]
    assert detail["readOnlyAccess"] is True
    assert len(detail["recentTrades"]) >= 1

    print("ALL ASSERTIONS PASSED - Stage 29 smoke OK")


if __name__ == "__main__":
    main()