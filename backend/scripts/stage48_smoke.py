#!/usr/bin/env python3
"""Stage 48 smoke: Review Status Board endpoint checks."""

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
    print("Stage 48: Review Status Board - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []
    token = None

    # --- Login ---
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
        data = resp.json() if resp.status_code == 200 else {}
        token = data.get("token")
        results.append(test_print("Login", resp.status_code == 200 and bool(token)))
    except Exception as exc:
        results.append(test_print("Login", False, str(exc)))

    if not token:
        print("\nAuthentication failed. Abort.")
        return 1

    headers = {"Authorization": f"Bearer {token}"}

    # --- review-board/summary shape ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/summary", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(payload.get("byStatus"), dict)
            and "total" in payload
            and isinstance(payload.get("statuses"), list)
        )
        results.append(test_print("Board summary shape", ok,
                                  f"total={payload.get('total')} statuses={payload.get('statuses')}"))
    except Exception as exc:
        results.append(test_print("Board summary shape", False, str(exc)))

    # --- review-board/cases basic list ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/cases",
                            headers=headers, params={"limit": 10}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(payload.get("items"), list)
            and "total" in payload
            and "count" in payload
            and "summary" in payload
        )
        results.append(test_print("Board cases list shape", ok,
                                  f"count={payload.get('count')} total={payload.get('total')}"))
    except Exception as exc:
        results.append(test_print("Board cases list shape", False, str(exc)))

    # --- status filter ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/cases",
                            headers=headers, params={"status": "open", "limit": 10}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        filter_applied = payload.get("summary", {}).get("filters", {}).get("status") == "open"
        ok = resp.status_code == 200 and filter_applied
        results.append(test_print("Status filter echoed in response", ok))
    except Exception as exc:
        results.append(test_print("Status filter echoed in response", False, str(exc)))

    # --- priority filter ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/cases",
                            headers=headers, params={"priority": "high", "limit": 10}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        filter_applied = payload.get("summary", {}).get("filters", {}).get("priority") == "high"
        ok = resp.status_code == 200 and filter_applied
        results.append(test_print("Priority filter echoed in response", ok))
    except Exception as exc:
        results.append(test_print("Priority filter echoed in response", False, str(exc)))

    # --- options shape ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/options", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(payload.get("statuses"), list)
            and len(payload.get("statuses", [])) > 0
            and isinstance(payload.get("caseTypes"), list)
            and isinstance(payload.get("priorities"), list)
        )
        results.append(test_print("Board options shape", ok,
                                  f"statuses={payload.get('statuses')} priorities={payload.get('priorities')}"))
    except Exception as exc:
        results.append(test_print("Board options shape", False, str(exc)))

    # --- no-token returns 401 ---
    try:
        resp = requests.get(f"{BASE_URL}/api/review-board/summary", timeout=8)
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
