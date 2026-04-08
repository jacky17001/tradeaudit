#!/usr/bin/env python3
"""Stage 50 smoke: Report Snapshots API checks."""

import sys
from datetime import datetime

import requests

BASE_URL = "http://127.0.0.1:5000"


def test_print(name: str, passed: bool, details: str = "") -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if details:
        print(f"       {details}")
    return passed


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 50: Report Snapshots - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []
    token = None
    snapshot_id = None

    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        token = payload.get("token")
        results.append(test_print("Login", resp.status_code == 200 and bool(token)))
    except Exception as exc:
        results.append(test_print("Login", False, str(exc)))

    if not token:
        print("\nAuthentication failed. Abort.")
        return 1

    headers = {"Authorization": f"Bearer {token}"}

    try:
        create_payload = {
            "snapshot_type": "audit_report",
            "object_type": "strategy",
            "object_ref_id": 1,
            "title": "Strategy Audit Snapshot",
            "payload_json": {
                "score": 75,
                "verdict": "Qualified",
                "riskLevel": "Low",
                "trustLevel": "Medium",
                "whyThisResult": "Smoke baseline",
                "strengths": ["stable return"],
                "risks": ["sample size"],
                "recommendedActions": [{"title": "continue forward"}],
                "timelineHighlights": [{"title": "Imported", "createdAt": "2026-04-08"}],
            },
            "note": "stage50 smoke",
        }
        resp = requests.post(f"{BASE_URL}/api/report-snapshots", json=create_payload, headers=headers, timeout=8)
        payload = resp.json() if resp.status_code in (200, 201) else {}
        snapshot_id = payload.get("id")
        ok = resp.status_code == 201 and bool(snapshot_id)
        results.append(test_print("Create snapshot", ok, f"snapshotId={snapshot_id}"))
    except Exception as exc:
        results.append(test_print("Create snapshot", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/report-snapshots", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and isinstance(payload.get("items"), list) and "total" in payload
        results.append(test_print("List snapshots", ok, f"count={payload.get('count')} total={payload.get('total')}"))
    except Exception as exc:
        results.append(test_print("List snapshots", False, str(exc)))

    try:
        resp = requests.get(
            f"{BASE_URL}/api/report-snapshots",
            headers=headers,
            params={"snapshotType": "audit_report", "objectType": "strategy", "objectRefId": "1"},
            timeout=8,
        )
        payload = resp.json() if resp.status_code == 200 else {}
        filters = payload.get("filters", {})
        ok = (
            resp.status_code == 200
            and filters.get("snapshotType") == "audit_report"
            and filters.get("objectType") == "strategy"
            and filters.get("objectRefId") == 1
        )
        results.append(test_print("List snapshots with filters", ok))
    except Exception as exc:
        results.append(test_print("List snapshots with filters", False, str(exc)))

    if snapshot_id:
        try:
            resp = requests.get(f"{BASE_URL}/api/report-snapshots/{snapshot_id}", headers=headers, timeout=8)
            payload = resp.json() if resp.status_code == 200 else {}
            ok = resp.status_code == 200 and payload.get("id") == snapshot_id and isinstance(payload.get("payload_json"), dict)
            results.append(test_print("Get snapshot detail", ok))
        except Exception as exc:
            results.append(test_print("Get snapshot detail", False, str(exc)))

    try:
        bad_payload = {
            "snapshot_type": "audit_report",
            "object_type": "strategy",
            "object_ref_id": 1,
            "title": "Bad Snapshot",
            "payload_json": {"score": 77},
        }
        resp = requests.post(f"{BASE_URL}/api/report-snapshots", json=bad_payload, headers=headers, timeout=8)
        ok = resp.status_code == 400
        results.append(test_print("Invalid payload returns 400", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Invalid payload returns 400", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/report-snapshots", timeout=8)
        ok = resp.status_code == 401
        results.append(test_print("No token returns 401", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("No token returns 401", False, str(exc)))

    print("\n" + "=" * 72)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Result: {passed}/{total} passed")
    print("=" * 72)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
