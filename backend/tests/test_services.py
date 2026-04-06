import unittest
from unittest.mock import patch

from data.mock_api.audit import AUDIT_SUMMARY
from data.mock_api.backtests import BACKTESTS_ITEMS
from data.mock_api.forward_gate import FORWARD_GATE_SUMMARY
from services.account_audit_service import get_account_audit_summary
from services.backtests_service import get_backtests_page
from services.forward_gate_service import get_forward_gate_summary


class ServiceTests(unittest.TestCase):
    def test_account_audit_service_fallbacks_to_mock_when_repo_returns_none(self):
        with patch("services.account_audit_service.load_account_audit_summary", return_value=None):
            summary = get_account_audit_summary()

        self.assertEqual(summary, AUDIT_SUMMARY)

    def test_account_audit_service_fallbacks_to_mock_when_repo_raises(self):
        with patch(
            "services.account_audit_service.load_account_audit_summary",
            side_effect=RuntimeError("read failure"),
        ):
            summary = get_account_audit_summary()

        self.assertEqual(summary, AUDIT_SUMMARY)

    def test_account_audit_service_fallbacks_to_mock_when_sqlite_unavailable(self):
        with patch(
            "services.account_audit_service.load_account_audit_summary",
            side_effect=RuntimeError("sqlite unavailable"),
        ):
            summary = get_account_audit_summary()

        self.assertEqual(summary, AUDIT_SUMMARY)

    def test_backtests_service_fallbacks_to_mock_when_real_rows_missing(self):
        with patch("services.backtests_service.query_backtests_page", side_effect=RuntimeError("db down")):
            payload = get_backtests_page(1, 2)

        self.assertEqual(payload["total"], len(BACKTESTS_ITEMS))
        self.assertEqual(len(payload["items"]), 2)

    def test_forward_gate_service_fallbacks_to_mock_when_repo_returns_none(self):
        with patch("services.forward_gate_service.load_forward_gate_summary", return_value=None):
            summary = get_forward_gate_summary()

        self.assertEqual(summary, FORWARD_GATE_SUMMARY)

    def test_forward_gate_service_fallbacks_to_mock_when_sqlite_unavailable(self):
        with patch(
            "services.forward_gate_service.load_forward_gate_summary",
            side_effect=RuntimeError("sqlite unavailable"),
        ):
            summary = get_forward_gate_summary()

        self.assertEqual(summary, FORWARD_GATE_SUMMARY)
