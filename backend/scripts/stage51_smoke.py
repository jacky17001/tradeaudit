#!/usr/bin/env python3
"""Stage 51 smoke: Portfolio / Batch Triage API checks."""

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
    print("Stage 51: Portfolio / Batch Triage - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []
    token = None

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
        resp = requests.get(f"{BASE_URL}/api/portfolio", headers=headers, params={"kind": "strategy"}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and payload.get("kind") == "strategy"
            and isinstance(payload.get("items"), list)
            and "total" in payload
            and "filtersEcho" in payload
        )
        results.append(test_print("Strategy portfolio shape", ok, f"total={payload.get('total')}"))
    except Exception as exc:
        results.append(test_print("Strategy portfolio shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/portfolio", headers=headers, params={"kind": "account"}, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and payload.get("kind") == "account" and isinstance(payload.get("items"), list)
        results.append(test_print("Account portfolio shape", ok, f"total={payload.get('total')}"))
    except Exception as exc:
        results.append(test_print("Account portfolio shape", False, str(exc)))

    try:
        resp = requests.get(
            f"{BASE_URL}/api/portfolio",
            headers=headers,
            params={
                "kind": "strategy",
                "riskLevel": "Low",
                "finalRecommendation": "Watchlist",
                "reviewStatus": "open",
                "nextStep": "recheck later",
            },
            timeout=8,
        )
        payload = resp.json() if resp.status_code == 200 else {}
        echo = payload.get("filtersEcho", {})
        ok = (
            resp.status_code == 200
            and echo.get("riskLevel") == "Low"
            and echo.get("finalRecommendation") == "Watchlist"
            and echo.get("reviewStatus") == "open"
            and echo.get("nextStep") == "recheck later"
        )
        results.append(test_print("Portfolio filter echo", ok))
    except Exception as exc:
        results.append(test_print("Portfolio filter echo", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/portfolio", headers=headers, params={"kind": "bad"}, timeout=8)
        ok = resp.status_code == 400
        results.append(test_print("Invalid kind returns 400", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Invalid kind returns 400", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/portfolio", params={"kind": "strategy"}, timeout=8)
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
