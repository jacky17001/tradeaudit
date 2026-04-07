import unittest
from unittest.mock import patch

from data.mock_api.audit import AUDIT_SUMMARY
from data.mock_api.backtests import BACKTESTS_ITEMS
from data.mock_api.forward_gate import FORWARD_GATE_SUMMARY
from services.account_audit_service import get_account_audit_summary
from services.account_audit_intake_service import create_account_audit_manual_intake
from services.account_audit_mt5_service import test_mt5_investor_connection
from services.account_audit_summaries_service import (
    list_account_audit_summaries,
    recompute_account_audit_summary,
)
from services.backtests_service import get_backtests_page, set_backtest_candidate
from services.forward_gate_service import get_forward_gate_summary


class ServiceTests(unittest.TestCase):
    def test_account_audit_service_fallbacks_to_mock_when_repo_returns_none(self):
        with patch("services.account_audit_service.load_account_audit_summary", return_value=None):
            summary = get_account_audit_summary()

        self.assertEqual(summary["accountName"], AUDIT_SUMMARY["accountName"])
        self.assertIn("finalScore", summary)
        self.assertIn("scoreBreakdown", summary)
        self.assertIn("decision", summary)
        self.assertIn("decisionReason", summary)
        self.assertIn("recommendedAction", summary)
        self.assertIn("explanation", summary)
        self.assertIn("hardFailTriggered", summary)
        self.assertIn("hardFailReasons", summary)
        self.assertIn("strongestFactor", summary)
        self.assertIn("weakestFactor", summary)
        self.assertIn("confidenceLevel", summary)
        self.assertIn("sampleAdequacy", summary)
        self.assertIn("dataSourceType", summary)
        self.assertIn("evaluatedAt", summary)
        self.assertIn("rulesVersion", summary)
        self.assertIn("datasetVersion", summary)
        self.assertIn("previousScore", summary)
        self.assertIn("scoreDelta", summary)
        self.assertIn("previousDecision", summary)
        self.assertIn("decisionChanged", summary)

    def test_account_audit_service_fallbacks_to_mock_when_repo_raises(self):
        with patch(
            "services.account_audit_service.load_account_audit_summary",
            side_effect=RuntimeError("read failure"),
        ):
            summary = get_account_audit_summary()

        self.assertEqual(summary["accountName"], AUDIT_SUMMARY["accountName"])
        self.assertIn("finalScore", summary)
        self.assertIn("hardFailTriggered", summary)
        self.assertIn("evaluatedAt", summary)

    def test_account_audit_service_fallbacks_to_mock_when_sqlite_unavailable(self):
        with patch(
            "services.account_audit_service.load_account_audit_summary",
            side_effect=RuntimeError("sqlite unavailable"),
        ):
            summary = get_account_audit_summary()

        self.assertEqual(summary["accountName"], AUDIT_SUMMARY["accountName"])
        self.assertIn("finalScore", summary)
        self.assertIn("hardFailTriggered", summary)
        self.assertIn("evaluatedAt", summary)

    def test_account_audit_manual_intake_counts_non_empty_lines(self):
        with patch(
            "services.account_audit_intake_service.insert_account_audit_intake_job",
            side_effect=lambda payload: {
                "id": 1,
                "sourceType": payload["source_type"],
                "intakeMethod": payload["intake_method"],
                "sourceLabel": payload["source_label"],
                "originalFilename": payload["original_filename"],
                "detectedRows": payload["detected_rows"],
                "note": payload["note"],
                "status": payload["status"],
                "errorMessage": payload["error_message"],
                "createdAt": "2026-04-07T00:00:00+00:00",
            },
        ):
            result = create_account_audit_manual_intake(
                {
                    "sourceType": "MANUAL",
                    "manualText": "header1,header2\n\n1,2\n3,4\n",
                    "note": "manual stage28",
                }
            )

        self.assertEqual(result["sourceType"], "MANUAL")
        self.assertEqual(result["intakeMethod"], "MANUAL")
        self.assertEqual(result["detectedRows"], 3)

    def test_account_audit_manual_intake_rejects_wrong_source_type(self):
        with self.assertRaises(ValueError):
            create_account_audit_manual_intake(
                {
                    "sourceType": "STATEMENT",
                    "manualText": "1,2,3",
                }
            )

    def test_mt5_investor_connection_returns_read_only_snapshot(self):
        result = test_mt5_investor_connection(
            {
                "accountNumber": "990011",
                "server": "Mock-Server",
                "investorPassword": "investor-ok",
            }
        )

        self.assertTrue(result["ok"])
        self.assertTrue(result["readOnlyAccess"])
        self.assertFalse(result["tradingAllowed"])
        self.assertEqual(result["accountInfo"]["accountNumber"], "990011")

    def test_mt5_investor_connection_rejects_missing_password(self):
        with self.assertRaises(ValueError):
            test_mt5_investor_connection(
                {
                    "accountNumber": "990011",
                    "server": "Mock-Server",
                    "investorPassword": "",
                }
            )

    def test_account_audit_summary_recompute_for_mt5_source(self):
        from services.account_audit_mt5_service import create_mt5_connection, sync_mt5_investor_account

        created = create_mt5_connection(
            {
                "accountNumber": "882211",
                "server": "Mock-Server",
                "investorPassword": "investor-pass",
                "connectionLabel": "Summary Test",
            }
        )
        sync_mt5_investor_account(created["id"], {"investorPassword": "investor-pass"})

        summary = recompute_account_audit_summary(
            {
                "sourceType": "mt5_investor",
                "sourceRefId": created["id"],
            }
        )

        self.assertEqual(summary["sourceType"], "mt5_investor")
        self.assertEqual(summary["sourceRefId"], created["id"])
        self.assertGreaterEqual(int(summary["totalTrades"] or 0), 1)
        self.assertIsNotNone(summary["pnl"])

    def test_account_audit_summary_recompute_for_manual_intake_defaults_missing_metrics_to_null(self):
        intake = create_account_audit_manual_intake(
            {
                "sourceType": "MANUAL",
                "manualText": "ticket,pnl\n1,2\n2,-1\n",
                "note": "summary intake",
            }
        )

        summary = recompute_account_audit_summary(
            {
                "sourceType": "manual_trade_import",
                "sourceRefId": intake["id"],
            }
        )

        self.assertEqual(summary["sourceType"], "manual_trade_import")
        self.assertEqual(summary["sourceRefId"], intake["id"])
        self.assertEqual(summary["totalTrades"], intake["detectedRows"])
        self.assertIsNone(summary["winRate"])
        self.assertIsNone(summary["pnl"])
        self.assertIsNone(summary["maxDrawdown"])

        listed = list_account_audit_summaries("manual_trade_import", 10)
        self.assertTrue(any(item["id"] == summary["id"] for item in listed))

    def test_backtests_service_fallbacks_to_mock_when_real_rows_missing(self):
        with patch("services.backtests_service.query_backtests_page", side_effect=RuntimeError("db down")):
            payload = get_backtests_page(1, 2)

        self.assertEqual(payload["total"], len(BACKTESTS_ITEMS))
        self.assertEqual(len(payload["items"]), 2)
        first = payload["items"][0]
        self.assertIn("scoreBreakdown", first)
        self.assertIn("finalScore", first)
        self.assertIn("decisionReason", first)
        self.assertIn("recommendedAction", first)
        self.assertIn("explanation", first)
        self.assertIn("hardFailTriggered", first)
        self.assertIn("hardFailReasons", first)
        self.assertIn("strongestFactor", first)
        self.assertIn("weakestFactor", first)
        self.assertIn("confidenceLevel", first)
        self.assertIn("sampleAdequacy", first)
        self.assertIn("dataSourceType", first)
        self.assertIn("evaluatedAt", first)
        self.assertIn("rulesVersion", first)
        self.assertIn("datasetVersion", first)
        self.assertIn("previousScore", first)
        self.assertIn("scoreDelta", first)
        self.assertIn("previousDecision", first)
        self.assertIn("decisionChanged", first)

    def test_set_backtest_candidate_marks_strategy(self):
        with patch("services.backtests_service.is_strategy_in_backtests", return_value=True), patch(
            "services.backtests_service.mark_candidate"
        ) as mark_candidate_mock:
            payload = set_backtest_candidate("bt-001", True)

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["strategyId"], "bt-001")
        self.assertTrue(payload["isCandidate"])
        mark_candidate_mock.assert_called_once_with("bt-001")

    def test_set_backtest_candidate_rejects_unknown_strategy(self):
        with patch("services.backtests_service.is_strategy_in_backtests", return_value=False):
            with self.assertRaises(ValueError):
                set_backtest_candidate("missing", True)

    def test_forward_gate_service_fallbacks_to_mock_when_repo_returns_none(self):
        with patch("services.forward_gate_service.load_forward_gate_summary", return_value=None):
            summary = get_forward_gate_summary()

        self.assertEqual(summary["strategyName"], FORWARD_GATE_SUMMARY["strategyName"])
        self.assertIn("finalScore", summary)
        self.assertIn("scoreBreakdown", summary)
        self.assertIn("decision", summary)
        self.assertIn("decisionReason", summary)
        self.assertIn("recommendedAction", summary)
        self.assertIn("explanation", summary)
        self.assertIn("hardFailTriggered", summary)
        self.assertIn("hardFailReasons", summary)
        self.assertIn("strongestFactor", summary)
        self.assertIn("weakestFactor", summary)
        self.assertIn("confidenceLevel", summary)
        self.assertIn("sampleAdequacy", summary)
        self.assertIn("dataSourceType", summary)
        self.assertIn("evaluatedAt", summary)
        self.assertIn("rulesVersion", summary)
        self.assertIn("datasetVersion", summary)
        self.assertIn("previousScore", summary)
        self.assertIn("scoreDelta", summary)
        self.assertIn("previousDecision", summary)
        self.assertIn("decisionChanged", summary)

    def test_forward_gate_service_fallbacks_to_mock_when_sqlite_unavailable(self):
        with patch(
            "services.forward_gate_service.load_forward_gate_summary",
            side_effect=RuntimeError("sqlite unavailable"),
        ):
            summary = get_forward_gate_summary()

        self.assertEqual(summary["strategyName"], FORWARD_GATE_SUMMARY["strategyName"])
        self.assertIn("finalScore", summary)
        self.assertIn("hardFailTriggered", summary)
        self.assertIn("evaluatedAt", summary)
