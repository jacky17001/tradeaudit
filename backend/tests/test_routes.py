import unittest
from pathlib import Path
import tempfile
from io import BytesIO
from unittest.mock import patch

from app import app
from data_sources.import_jobs_repository import insert_import_job


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Login and get access token for protected routes
        login_resp = self.client.post("/api/auth/login", json={"password": "admin"})
        self.assertEqual(login_resp.status_code, 200)
        self.access_token = login_resp.get_json()["token"]

    def _get_auth_headers(self):
        """Return headers with access token for authenticated requests."""
        return {"Authorization": f"Bearer {self.access_token}"}
    
    def _post_auth(self, path, **kwargs):
        """POST request with automatic auth header."""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_auth_headers())
        return self.client.post(path, headers=headers, **kwargs)
    
    def _patch_auth(self, path, **kwargs):
        """PATCH request with automatic auth header."""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_auth_headers())
        return self.client.patch(path, headers=headers, **kwargs)
    
    def _put_auth(self, path, **kwargs):
        """PUT request with automatic auth header."""
        headers = kwargs.pop('headers', {})
        headers.update(self._get_auth_headers())
        return self.client.put(path, headers=headers, **kwargs)

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

    def test_backtests_candidate_mark_and_filter_flow(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")

        mark_resp = self._post_auth(f"/api/backtests/{strategy_id}/candidate")
        self.assertEqual(mark_resp.status_code, 200)
        mark_payload = mark_resp.get_json()
        self.assertEqual(mark_payload["strategyId"], strategy_id)
        self.assertTrue(mark_payload["isCandidate"])

        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=20&candidateOnly=true")
        self.assertEqual(list_resp.status_code, 200)
        list_payload = list_resp.get_json()
        self.assertTrue(any(item["id"] == strategy_id for item in list_payload["items"]))
        self.assertTrue(all(item["isCandidate"] for item in list_payload["items"]))

        unmark_resp = self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        self.assertEqual(unmark_resp.status_code, 200)
        self.assertFalse(unmark_resp.get_json()["isCandidate"])

    def test_backtests_candidate_mark_rejects_unknown_strategy(self):
        response = self._post_auth("/api/backtests/not-found/candidate")
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_account_audit_manual_intake_create_and_list(self):
        create_resp = self._post_auth(
            "/api/account-audit/intake",
            json={
                "sourceType": "MANUAL",
                "manualText": "ticket,open,close\n1,2026-01-01,2026-01-02\n2,2026-01-03,2026-01-04",
                "note": "mobile copy paste",
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        created = create_resp.get_json()
        self.assertEqual(created["sourceType"], "MANUAL")
        self.assertEqual(created["intakeMethod"], "MANUAL")
        self.assertGreaterEqual(created["detectedRows"], 2)

        list_resp = self.client.get("/api/account-audit/intake-jobs?limit=5")
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.get_json()["items"]
        self.assertTrue(any(item["id"] == created["id"] for item in items))

    def test_account_audit_upload_intake_accepts_statement_file(self):
        response = self._post_auth(
            "/api/account-audit/intake-upload",
            data={
                "sourceType": "STATEMENT",
                "note": "statement export",
                "file": (BytesIO(b"ticket,pnl\n1,12.5\n2,-5.0\n"), "statement.csv"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["sourceType"], "STATEMENT")
        self.assertEqual(payload["intakeMethod"], "UPLOAD")
        self.assertEqual(payload["originalFilename"], "statement.csv")
        self.assertEqual(payload["status"], "SUCCESS")

    def test_account_audit_mt5_test_connect_sync_and_detail_flow(self):
        test_resp = self._post_auth(
            "/api/account-audit/mt5/test-connection",
            json={
                "accountNumber": "880011",
                "server": "Mock-Server",
                "investorPassword": "investor-pass",
            },
        )
        self.assertEqual(test_resp.status_code, 200)
        tested = test_resp.get_json()
        self.assertTrue(tested["ok"])
        self.assertTrue(tested["readOnlyAccess"])
        self.assertFalse(tested["tradingAllowed"])

        connect_resp = self._post_auth(
            "/api/account-audit/mt5/connect",
            json={
                "accountNumber": "880011",
                "server": "Mock-Server",
                "investorPassword": "investor-pass",
                "connectionLabel": "Primary Investor",
            },
        )
        self.assertEqual(connect_resp.status_code, 200)
        connection = connect_resp.get_json()
        self.assertEqual(connection["status"], "CONNECTED")
        self.assertEqual(connection["connectionLabel"], "Primary Investor")

        sync_resp = self._post_auth(
            f"/api/account-audit/mt5/{connection['id']}/sync",
            json={"investorPassword": "investor-pass"},
        )
        self.assertEqual(sync_resp.status_code, 200)
        synced = sync_resp.get_json()
        self.assertEqual(synced["status"], "SYNCED")
        self.assertGreaterEqual(synced["syncedTradeCount"], 1)
        self.assertTrue(len(synced["recentTrades"]) >= 1)

        list_resp = self.client.get("/api/account-audit/mt5/connections?limit=10")
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.get_json()["items"]
        self.assertTrue(any(item["id"] == connection["id"] for item in items))

        detail_resp = self.client.get(f"/api/account-audit/mt5/{connection['id']}")
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.get_json()
        self.assertEqual(detail["id"], connection["id"])
        self.assertGreaterEqual(len(detail["recentTrades"]), 1)

    def test_account_audit_mt5_test_connection_returns_bad_request_on_failure(self):
        response = self._post_auth(
            "/api/account-audit/mt5/test-connection",
            json={
                "accountNumber": "880011",
                "server": "Mock-Server",
                "investorPassword": "fail-me",
            },
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_account_audit_summary_recompute_list_and_detail_flow(self):
        connect_resp = self._post_auth(
            "/api/account-audit/mt5/connect",
            json={
                "accountNumber": "990101",
                "server": "Mock-Server",
                "investorPassword": "investor-pass",
                "connectionLabel": "Stage30 Investor",
            },
        )
        self.assertEqual(connect_resp.status_code, 200)
        connection = connect_resp.get_json()

        sync_resp = self._post_auth(
            f"/api/account-audit/mt5/{connection['id']}/sync",
            json={"investorPassword": "investor-pass"},
        )
        self.assertEqual(sync_resp.status_code, 200)

        recompute_resp = self._post_auth(
            "/api/account-audit/summaries/recompute",
            json={"sourceType": "mt5_investor", "sourceRefId": connection["id"]},
        )
        self.assertEqual(recompute_resp.status_code, 200)
        summary = recompute_resp.get_json()
        self.assertEqual(summary["sourceType"], "mt5_investor")
        self.assertEqual(summary["sourceRefId"], connection["id"])
        self.assertIsNotNone(summary["totalTrades"])

        list_resp = self.client.get("/api/account-audit/summaries?sourceType=mt5_investor&limit=10")
        self.assertEqual(list_resp.status_code, 200)
        items = list_resp.get_json()["items"]
        self.assertTrue(any(item["id"] == summary["id"] for item in items))

        detail_resp = self.client.get(f"/api/account-audit/summaries/{summary['id']}")
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.get_json()
        self.assertEqual(detail["id"], summary["id"])
        self.assertEqual(detail["sourceType"], "mt5_investor")

    def test_account_audit_summary_recompute_rejects_invalid_source_type(self):
        response = self._post_auth(
            "/api/account-audit/summaries/recompute",
            json={"sourceType": "unknown", "sourceRefId": 1},
        )
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_forward_runs_flow_create_list_and_update_status(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        mark_resp = self._post_auth(f"/api/backtests/{strategy_id}/candidate")
        self.assertEqual(mark_resp.status_code, 200)

        create_resp = self._post_auth(
            "/api/forward-runs",
            json={
                "strategyId": strategy_id,
                "symbol": "EURUSD",
                "timeframe": "H1",
                "note": "stage23 smoke",
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        created = create_resp.get_json()
        self.assertEqual(created["strategyId"], strategy_id)
        self.assertEqual(created["status"], "RUNNING")
        self.assertIn("sourceJobId", created)

        list_resp = self.client.get("/api/forward-runs?status=RUNNING&page=1&pageSize=20")
        self.assertEqual(list_resp.status_code, 200)
        list_payload = list_resp.get_json()
        self.assertTrue(any(item["id"] == created["id"] for item in list_payload["items"]))

        patch_resp = self._patch_auth(
            f"/api/forward-runs/{created['id']}/status",
            json={"status": "PAUSED"},
        )
        self.assertEqual(patch_resp.status_code, 200)
        paused = patch_resp.get_json()
        self.assertEqual(paused["status"], "PAUSED")

    def test_forward_runs_create_requires_candidate(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        create_resp = self._post_auth(
            "/api/forward-runs",
            json={
                "strategyId": strategy_id,
                "symbol": "EURUSD",
                "timeframe": "H1",
            },
        )
        self.assertEqual(create_resp.status_code, 400)
        payload = create_resp.get_json()
        self.assertEqual(payload["error"]["code"], "BAD_REQUEST")

    def test_forward_run_summary_save_and_get(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        self._post_auth(f"/api/backtests/{strategy_id}/candidate")

        create_resp = self._post_auth(
            "/api/forward-runs",
            json={
                "strategyId": strategy_id,
                "symbol": "EURUSD",
                "timeframe": "H1",
                "note": "summary test",
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        run_id = create_resp.get_json()["id"]

        save_resp = self._put_auth(
            f"/api/forward-runs/{run_id}/summary",
            json={
                "totalTrades": 42,
                "winRate": 57.2,
                "pnl": 1234.5,
                "maxDrawdown": 6.4,
                "expectancy": 12.8,
                "periodStart": "2026-01-01",
                "periodEnd": "2026-03-31",
            },
        )
        self.assertEqual(save_resp.status_code, 200)
        saved = save_resp.get_json()
        self.assertEqual(saved["forwardRunId"], run_id)
        self.assertEqual(saved["totalTrades"], 42)

        get_resp = self.client.get(f"/api/forward-runs/{run_id}/summary")
        self.assertEqual(get_resp.status_code, 200)
        fetched = get_resp.get_json()
        self.assertEqual(fetched["forwardRunId"], run_id)
        self.assertEqual(fetched["pnl"], 1234.5)

        list_runs_resp = self.client.get("/api/forward-runs?page=1&pageSize=10")
        self.assertEqual(list_runs_resp.status_code, 200)
        list_payload = list_runs_resp.get_json()
        target = next(item for item in list_payload["items"] if item["id"] == run_id)
        self.assertIsNotNone(target.get("summary"))
        self.assertEqual(target["summary"]["totalTrades"], 42)

    def test_forward_run_gate_result_save_and_list(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        self._post_auth(f"/api/backtests/{strategy_id}/candidate")

        create_resp = self._post_auth(
            "/api/forward-runs",
            json={
                "strategyId": strategy_id,
                "symbol": "EURUSD",
                "timeframe": "H1",
                "note": "gate result test",
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        run_id = create_resp.get_json()["id"]

        save_resp = self._put_auth(
            f"/api/forward-runs/{run_id}/gate-result",
            json={
                "gateDecision": "PROMISING",
                "confidence": "MEDIUM",
                "hardFail": False,
                "sampleAdequacy": "MEDIUM",
                "strongestFactor": "win rate",
                "weakestFactor": "sample size",
                "notes": "stage25 test",
            },
        )
        self.assertEqual(save_resp.status_code, 200)
        saved = save_resp.get_json()
        self.assertEqual(saved["forwardRunId"], run_id)
        self.assertEqual(saved["gateDecision"], "PROMISING")

        get_resp = self.client.get(f"/api/forward-runs/{run_id}/gate-result")
        self.assertEqual(get_resp.status_code, 200)
        fetched = get_resp.get_json()
        self.assertEqual(fetched["forwardRunId"], run_id)
        self.assertEqual(fetched["confidence"], "MEDIUM")

        list_gate_resp = self.client.get("/api/gate-results?page=1&pageSize=10&decision=PROMISING")
        self.assertEqual(list_gate_resp.status_code, 200)
        gate_payload = list_gate_resp.get_json()
        target = next(item for item in gate_payload["items"] if item["forwardRunId"] == run_id)
        self.assertEqual(target["strategyId"], strategy_id)

        list_runs_resp = self.client.get("/api/forward-runs?page=1&pageSize=10")
        self.assertEqual(list_runs_resp.status_code, 200)
        list_payload = list_runs_resp.get_json()
        run_target = next(item for item in list_payload["items"] if item["id"] == run_id)
        self.assertIsNotNone(run_target.get("gateResult"))
        self.assertEqual(run_target["gateResult"]["gateDecision"], "PROMISING")

    def test_backtests_lifecycle_route_returns_aggregated_sections(self):
        list_resp = self.client.get("/api/backtests/list?page=1&pageSize=1")
        self.assertEqual(list_resp.status_code, 200)
        strategy_id = list_resp.get_json()["items"][0]["id"]

        job_id = insert_import_job(
            {
                "jobType": "backtests-import",
                "sourcePath": "backend/data_sources/backtests.csv",
                "mode": "replace",
                "status": "success",
                "importedCount": 3,
            }
        )

        self.client.delete(f"/api/backtests/{strategy_id}/candidate")
        self._post_auth(f"/api/backtests/{strategy_id}/candidate")

        create_resp = self._post_auth(
            "/api/forward-runs",
            json={
                "strategyId": strategy_id,
                "symbol": "EURUSD",
                "timeframe": "H1",
                "note": "lifecycle route test",
            },
        )
        self.assertEqual(create_resp.status_code, 200)
        run_id = create_resp.get_json()["id"]

        self._put_auth(
            f"/api/forward-runs/{run_id}/summary",
            json={
                "totalTrades": 18,
                "winRate": 61.5,
                "pnl": 420.0,
                "maxDrawdown": 4.2,
                "expectancy": 9.5,
                "periodStart": "2026-04-01",
                "periodEnd": "2026-04-30",
            },
        )
        self._put_auth(
            f"/api/forward-runs/{run_id}/gate-result",
            json={
                "gateDecision": "PASS",
                "confidence": "HIGH",
                "hardFail": False,
                "sampleAdequacy": "HIGH",
                "strongestFactor": "stability",
                "weakestFactor": "sample size",
                "notes": "stage26 route test",
            },
        )

        response = self.client.get(f"/api/backtests/{strategy_id}/lifecycle")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()

        self.assertEqual(payload["strategyId"], strategy_id)
        self.assertTrue(payload["candidate"]["isCandidate"])
        self.assertEqual(payload["sourceJobId"], job_id)
        self.assertIsNotNone(payload["sourceJob"])
        self.assertEqual(payload["sourceJob"]["id"], job_id)
        self.assertEqual(payload["latestForwardRun"]["id"], run_id)
        self.assertEqual(payload["latestSummary"]["totalTrades"], 18)
        self.assertEqual(payload["latestGateResult"]["gateDecision"], "PASS")
        self.assertTrue(payload["backtest"]["isInActiveDataset"])

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

            response = self._post_auth(
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
        response = self._post_auth("/api/backtests/import", json={})
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

            response = self._post_auth(
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
        self._post_auth(
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
