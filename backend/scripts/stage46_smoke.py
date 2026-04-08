#!/usr/bin/env python3
"""Stage 46 smoke: Final Recommendation endpoint checks."""

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


def has_required(payload: dict) -> bool:
    required = {
        "kind",
        "finalRecommendation",
        "finalStatus",
        "reviewerNote",
        "decisionSnapshot",
        "whyThisRecommendation",
        "supportingSignals",
        "recommendedNextStep",
        "detailRef",
        "detailPath",
    }
    return required.issubset(set(payload.keys()))


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 46: Final Recommendation - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []
    token = None

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

    try:
        resp = requests.get(f"{BASE_URL}/api/final-recommendation?kind=strategy", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and payload.get("kind") == "strategy" and has_required(payload)
        results.append(test_print("Strategy final recommendation shape", ok))
    except Exception as exc:
        results.append(test_print("Strategy final recommendation shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/final-recommendation?kind=account", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and payload.get("kind") == "account" and has_required(payload)
        results.append(test_print("Account final recommendation shape", ok))
    except Exception as exc:
        results.append(test_print("Account final recommendation shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/final-recommendation", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and "strategy" in payload
            and "account" in payload
            and has_required(payload.get("strategy", {}))
            and has_required(payload.get("account", {}))
        )
        results.append(test_print("Combined final recommendation shape", ok))
    except Exception as exc:
        results.append(test_print("Combined final recommendation shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/final-recommendation?kind=bad", headers=headers, timeout=8)
        ok = resp.status_code == 400
        results.append(test_print("Invalid kind returns 400", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Invalid kind returns 400", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/final-recommendation?kind=strategy", timeout=8)
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
