import unittest
from unittest.mock import patch

from data.mock_api.audit import AUDIT_SUMMARY
from data.mock_api.backtests import BACKTESTS_ITEMS
from data.mock_api.forward_gate import FORWARD_GATE_SUMMARY
from services.account_audit_service import get_account_audit_summary
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
