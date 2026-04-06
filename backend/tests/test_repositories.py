import unittest
import sqlite3
from contextlib import nullcontext
from unittest.mock import patch

from db.init_db import import_account_audit, import_backtests, import_forward_gate, init_schema
from data_sources.account_audit_repository import load_account_audit_summary
from data_sources.backtests_repository import query_backtests_page, query_backtests_summary
from data_sources.forward_gate_repository import load_forward_gate_summary


class RepositoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_schema()
        import_backtests()
        import_account_audit()
        import_forward_gate()

    def test_backtests_repository_reads_from_sqlite_with_pagination(self):
        page_payload = query_backtests_page(page=1, page_size=2)
        self.assertEqual(page_payload["total"], 12)
        self.assertEqual(len(page_payload["items"]), 2)
        self.assertIn("id", page_payload["items"][0])

    def test_backtests_repository_aggregates_from_sqlite(self):
        summary = query_backtests_summary()
        self.assertIn("totalAudits", summary)
        self.assertIn("averageScore", summary)
        self.assertIn("passRate", summary)
        self.assertGreaterEqual(summary["totalAudits"], 1)

    def test_account_audit_repository_reads_from_sqlite(self):
        summary = load_account_audit_summary()
        self.assertIsNotNone(summary)
        self.assertIn("accountName", summary)
        self.assertIn("riskScore", summary)

    def test_account_audit_repository_empty_table_returns_none(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE account_audit (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                accountName TEXT NOT NULL,
                broker TEXT NOT NULL,
                balance INTEGER NOT NULL,
                equity INTEGER NOT NULL,
                riskScore INTEGER NOT NULL,
                maxDrawdown REAL NOT NULL,
                winRate INTEGER NOT NULL,
                profitFactor REAL NOT NULL,
                aiExplanation TEXT NOT NULL
            )
            """
        )

        with patch(
            "data_sources.account_audit_repository.connection_scope",
            return_value=nullcontext(conn),
        ):
            summary = load_account_audit_summary()

        self.assertIsNone(summary)

    def test_forward_gate_repository_reads_from_sqlite(self):
        summary = load_forward_gate_summary()
        self.assertIsNotNone(summary)
        self.assertIn("strategyName", summary)
        self.assertIn("gateDecision", summary)

    def test_forward_gate_repository_empty_table_returns_none(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE forward_gate (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                strategyName TEXT NOT NULL,
                symbol TEXT NOT NULL,
                forwardStatus TEXT NOT NULL,
                gateDecision TEXT NOT NULL,
                lastUpdated TEXT NOT NULL,
                tradesObserved INTEGER NOT NULL,
                passRate INTEGER NOT NULL,
                maxDrawdown REAL NOT NULL,
                summary TEXT NOT NULL
            )
            """
        )

        with patch(
            "data_sources.forward_gate_repository.connection_scope",
            return_value=nullcontext(conn),
        ):
            summary = load_forward_gate_summary()

        self.assertIsNone(summary)
