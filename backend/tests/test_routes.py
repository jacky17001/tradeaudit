import unittest
from unittest.mock import patch

from app import app


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_backtests_route_returns_200_and_expected_fields(self):
        response = self.client.get("/api/backtests/list?page=1&pageSize=2")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertIn("items", payload)
        self.assertIn("page", payload)
        self.assertIn("pageSize", payload)
        self.assertIn("total", payload)

    def test_backtests_pagination_boundary_clamps_values(self):
        response = self.client.get("/api/backtests/list?page=0&pageSize=0")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["pageSize"], 1)

    def test_backtests_pagination_invalid_type_returns_bad_request(self):
        response = self.client.get("/api/backtests/list?page=abc&pageSize=10")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")
        self.assertIn("Invalid page", payload["error"]["message"])

    def test_dashboard_route_returns_summary_shape(self):
        response = self.client.get("/api/dashboard/summary")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("totalAudits", payload)
        self.assertIn("averageScore", payload)
        self.assertIn("passRate", payload)
        self.assertIn("recentReports", payload)

    def test_dashboard_route_internal_error_response_shape(self):
        with patch("routes.api.get_dashboard_summary", side_effect=RuntimeError("boom")):
            response = self.client.get("/api/dashboard/summary")

        self.assertEqual(response.status_code, 500)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "INTERNAL_ERROR")
        self.assertIn("Failed to load dashboard summary", payload["error"]["message"])

    def test_account_audit_route_returns_200_and_expected_fields(self):
        response = self.client.get("/api/account-audit/summary")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("accountName", payload)
        self.assertIn("broker", payload)
        self.assertIn("balance", payload)
        self.assertIn("equity", payload)
        self.assertIn("riskScore", payload)
        self.assertIn("maxDrawdown", payload)
        self.assertIn("winRate", payload)
        self.assertIn("profitFactor", payload)
        self.assertIn("aiExplanation", payload)

    def test_forward_gate_route_returns_200_and_expected_fields(self):
        response = self.client.get("/api/forward-gate/summary")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("strategyName", payload)
        self.assertIn("symbol", payload)
        self.assertIn("forwardStatus", payload)
        self.assertIn("gateDecision", payload)
        self.assertIn("lastUpdated", payload)
        self.assertIn("tradesObserved", payload)
        self.assertIn("passRate", payload)
        self.assertIn("maxDrawdown", payload)
        self.assertIn("summary", payload)
