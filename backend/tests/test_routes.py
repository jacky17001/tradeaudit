import unittest
from pathlib import Path
import tempfile
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
        self.assertGreater(len(payload["items"]), 0)
        item = payload["items"][0]
        self.assertIn("scoreBreakdown", item)
        self.assertIn("finalScore", item)
        self.assertIn("decision", item)
        self.assertIn("decisionReason", item)
        self.assertIn("recommendedAction", item)
        self.assertIn("explanation", item)
        self.assertIn("hardFailTriggered", item)
        self.assertIn("hardFailReasons", item)
        self.assertIn("strongestFactor", item)
        self.assertIn("weakestFactor", item)
        self.assertIn("confidenceLevel", item)
        self.assertIn("sampleAdequacy", item)
        self.assertIn("dataSourceType", item)
        self.assertIn("evaluatedAt", item)
        self.assertIn("rulesVersion", item)
        self.assertIn("datasetVersion", item)
        self.assertIn("previousScore", item)
        self.assertIn("scoreDelta", item)
        self.assertIn("previousDecision", item)
        self.assertIn("decisionChanged", item)

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
        self.assertIn("finalScore", payload)
        self.assertIn("scoreBreakdown", payload)
        self.assertIn("decision", payload)
        self.assertIn("decisionReason", payload)
        self.assertIn("recommendedAction", payload)
        self.assertIn("explanation", payload)
        self.assertIn("hardFailTriggered", payload)
        self.assertIn("hardFailReasons", payload)
        self.assertIn("strongestFactor", payload)
        self.assertIn("weakestFactor", payload)
        self.assertIn("confidenceLevel", payload)
        self.assertIn("sampleAdequacy", payload)
        self.assertIn("dataSourceType", payload)
        self.assertIn("evaluatedAt", payload)
        self.assertIn("rulesVersion", payload)
        self.assertIn("datasetVersion", payload)
        self.assertIn("previousScore", payload)
        self.assertIn("scoreDelta", payload)
        self.assertIn("previousDecision", payload)
        self.assertIn("decisionChanged", payload)

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
        self.assertIn("finalScore", payload)
        self.assertIn("scoreBreakdown", payload)
        self.assertIn("decision", payload)
        self.assertIn("decisionReason", payload)
        self.assertIn("recommendedAction", payload)
        self.assertIn("explanation", payload)
        self.assertIn("hardFailTriggered", payload)
        self.assertIn("hardFailReasons", payload)
        self.assertIn("strongestFactor", payload)
        self.assertIn("weakestFactor", payload)
        self.assertIn("confidenceLevel", payload)
        self.assertIn("sampleAdequacy", payload)
        self.assertIn("dataSourceType", payload)
        self.assertIn("evaluatedAt", payload)
        self.assertIn("rulesVersion", payload)
        self.assertIn("datasetVersion", payload)
        self.assertIn("previousScore", payload)
        self.assertIn("scoreDelta", payload)
        self.assertIn("previousDecision", payload)
        self.assertIn("decisionChanged", payload)

    def test_evaluation_history_route_returns_items_shape(self):
        # Generate at least one snapshot for the target entity.
        self.client.get("/api/backtests/list?page=1&pageSize=1")

        response = self.client.get(
            "/api/evaluations/history?entityType=backtests&entityId=bt-001&limit=3"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["entityType"], "backtests")
        self.assertEqual(payload["entityId"], "bt-001")
        self.assertIn("items", payload)

        if payload["items"]:
            first = payload["items"][0]
            self.assertIn("finalScore", first)
            self.assertIn("decision", first)
            self.assertIn("evaluatedAt", first)
            self.assertIn("rulesVersion", first)
            self.assertIn("datasetVersion", first)

    def test_evaluation_history_route_requires_entity_params(self):
        response = self.client.get("/api/evaluations/history")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_backtests_import_route_returns_result_and_keeps_chain_usable(self):
        csv_content = "\n".join(
            [
                "id,name,symbol,timeframe,returnPct,winRate,maxDrawdown,profitFactor,tradeCount",
                "bt-http-001,HTTPImport_A,EURUSD,H1,12.2,45.5,8.4,1.35,42",
                "bt-http-002,HTTPImport_B,GBPUSD,M15,9.8,41.0,10.1,1.18,31",
            ]
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "import.csv"
            csv_path.write_text(csv_content, encoding="utf-8")

            response = self.client.post(
                "/api/backtests/import",
                json={"filePath": str(csv_path), "mode": "replace"},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()

            self.assertIn("importedCount", payload)
            self.assertIn("skippedCount", payload)
            self.assertIn("failedCount", payload)
            self.assertIn("invalidRowCount", payload)
            self.assertIn("validationErrors", payload)
            self.assertIn("reEvaluatedCount", payload)
            self.assertIn("snapshotWrittenCount", payload)
            self.assertGreaterEqual(payload["importedCount"], 1)

            list_resp = self.client.get("/api/backtests/list?page=1&pageSize=2")
            self.assertEqual(list_resp.status_code, 200)
            items = list_resp.get_json()["items"]
            self.assertGreaterEqual(len(items), 1)
            imported_id = items[0]["id"]

            history_resp = self.client.get(
                f"/api/evaluations/history?entityType=backtests&entityId={imported_id}&limit=3"
            )
            self.assertEqual(history_resp.status_code, 200)
            self.assertIn("items", history_resp.get_json())

    def test_backtests_import_route_requires_file_path(self):
        response = self.client.post("/api/backtests/import", json={})
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_import_jobs_route_returns_recent_items(self):
        response = self.client.get("/api/import-jobs?limit=5")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("items", payload)

        if payload["items"]:
            first = payload["items"][0]
            self.assertIn("triggeredAt", first)
            self.assertIn("sourcePath", first)
            self.assertIn("mode", first)
            self.assertIn("status", first)
            self.assertIn("importedCount", first)
            self.assertIn("failedCount", first)
            self.assertIn("invalidRowCount", first)
            self.assertIn("snapshotWrittenCount", first)

    def test_backtests_import_route_returns_validation_feedback_for_invalid_rows(self):
        csv_content = "\n".join(
            [
                "id,name,symbol,timeframe,returnPct,winRate,maxDrawdown,profitFactor,tradeCount",
                "bt-ok-001,Good,EURUSD,H1,12.2,45.5,8.4,1.35,42",
                "bt-bad-001,Bad,GBPUSD,M15,9.8,145,10.1,1.18,31",
            ]
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            csv_path = Path(tmp_dir) / "import-invalid.csv"
            csv_path.write_text(csv_content, encoding="utf-8")

            response = self.client.post(
                "/api/backtests/import",
                json={"filePath": str(csv_path), "mode": "replace"},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.get_json()
            self.assertEqual(payload["importedCount"], 1)
            self.assertEqual(payload["invalidRowCount"], 1)
            self.assertGreaterEqual(len(payload["validationErrors"]), 1)

    def test_import_jobs_route_invalid_limit_returns_bad_request(self):
        response = self.client.get("/api/import-jobs?limit=abc")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_backtests_import_route_failure_writes_failed_import_job(self):
        # Trigger failed import with a missing file.
        self.client.post(
            "/api/backtests/import",
            json={"filePath": "C:/not-exists/missing.csv", "mode": "replace"},
        )

        recent = self.client.get("/api/import-jobs?limit=1")
        self.assertEqual(recent.status_code, 200)
        payload = recent.get_json()
        self.assertGreaterEqual(len(payload["items"]), 1)
        first = payload["items"][0]
        self.assertEqual(first["status"], "failed")
        self.assertIn("errorMessage", first)
