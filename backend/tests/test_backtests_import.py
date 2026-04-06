import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from db.init_db import init_schema
from db.sqlite import connection_scope
from services.backtests_import_service import import_backtests_rows


class BacktestsImportTests(unittest.TestCase):
    def test_import_rows_replace_mode_returns_expected_counters(self):
        rows = [
            {
                "id": "bt-x01",
                "name": "TestStrategy_A",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "returnPct": "11.5",
                "winRate": "46.2",
                "maxDrawdown": "9.4",
                "profitFactor": "1.34",
                "tradeCount": "42",
            },
            {
                "id": "",
                "name": "InvalidRow",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "returnPct": "bad",
                "winRate": "40",
                "maxDrawdown": "10",
                "profitFactor": "1.1",
                "tradeCount": "20",
            },
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "tradeaudit.db"
            with patch.dict(os.environ, {"TRADEAUDIT_DB_PATH": str(db_path)}):
                init_schema()
                result = import_backtests_rows(rows, mode="replace", source_type="test-import")

                self.assertEqual(result["mode"], "replace")
                self.assertEqual(result["importedCount"], 1)
                self.assertEqual(result["skippedCount"], 1)
                self.assertEqual(result["invalidRowCount"], 1)
                self.assertGreaterEqual(len(result["validationErrors"]), 1)
                self.assertEqual(result["reEvaluatedCount"], 1)
                self.assertEqual(result["snapshotWrittenCount"], 1)

                with connection_scope() as connection:
                    backtests_total = connection.execute(
                        "SELECT COUNT(*) AS total FROM backtests"
                    ).fetchone()["total"]
                    snapshots_total = connection.execute(
                        "SELECT COUNT(*) AS total FROM evaluation_snapshots"
                    ).fetchone()["total"]

                self.assertEqual(backtests_total, 1)
                self.assertEqual(snapshots_total, 1)

    def test_import_replace_mode_overwrites_previous_rows(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "tradeaudit.db"
            with patch.dict(os.environ, {"TRADEAUDIT_DB_PATH": str(db_path)}):
                init_schema()

                first = [
                    {
                        "id": "bt-old",
                        "name": "Old",
                        "symbol": "XAUUSD",
                        "timeframe": "H1",
                        "returnPct": "9.0",
                        "winRate": "41",
                        "maxDrawdown": "11",
                        "profitFactor": "1.2",
                        "tradeCount": "30",
                    }
                ]
                second = [
                    {
                        "id": "bt-new",
                        "name": "New",
                        "symbol": "GBPUSD",
                        "timeframe": "M15",
                        "returnPct": "13.0",
                        "winRate": "49",
                        "maxDrawdown": "7",
                        "profitFactor": "1.5",
                        "tradeCount": "60",
                    }
                ]

                import_backtests_rows(first, mode="replace", source_type="test-import")
                import_backtests_rows(second, mode="replace", source_type="test-import")

                with connection_scope() as connection:
                    ids = [
                        row["id"]
                        for row in connection.execute("SELECT id FROM backtests ORDER BY id").fetchall()
                    ]

                self.assertEqual(ids, ["bt-new"])

    def test_import_rows_collects_validation_errors_but_continues(self):
        rows = [
            {
                "id": "bt-ok",
                "name": "ValidRow",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "returnPct": "8.1",
                "winRate": "44.4",
                "maxDrawdown": "7.2",
                "profitFactor": "1.3",
                "tradeCount": "35",
            },
            {
                "id": "bt-bad-1",
                "name": "BadWinRate",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "returnPct": "5.0",
                "winRate": "120",
                "maxDrawdown": "6.0",
                "profitFactor": "1.1",
                "tradeCount": "20",
            },
            {
                "id": "",
                "name": "BadId",
                "symbol": "EURUSD",
                "timeframe": "H1",
                "returnPct": "4.0",
                "winRate": "40",
                "maxDrawdown": "5.0",
                "profitFactor": "1.0",
                "tradeCount": "10",
            },
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "tradeaudit.db"
            with patch.dict(os.environ, {"TRADEAUDIT_DB_PATH": str(db_path)}):
                init_schema()
                result = import_backtests_rows(rows, mode="replace", source_type="test-import")

                self.assertEqual(result["importedCount"], 1)
                self.assertEqual(result["invalidRowCount"], 2)
                self.assertEqual(result["skippedCount"], 2)
                self.assertGreaterEqual(len(result["validationErrors"]), 2)