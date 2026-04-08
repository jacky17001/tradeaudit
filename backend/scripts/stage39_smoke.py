#!/usr/bin/env python3
"""Stage 39 smoke: Scoring Summary endpoint and shape checks."""

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
        "title",
        "score",
        "decision",
        "strongestFactor",
        "weakestFactor",
        "confidence",
        "dataAdequacy",
        "keyStrengths",
        "keyRisks",
        "explanation",
        "nextStep",
        "detailRef",
        "detailPath",
    }
    return required.issubset(set(payload.keys()))


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 39: Scoring Summary - Smoke Test")
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
        resp = requests.get(f"{BASE_URL}/api/scoring-summary?kind=strategy", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and has_required(payload) and payload.get("kind") == "strategy"
        results.append(test_print("Strategy scoring summary shape", ok))
    except Exception as exc:
        results.append(test_print("Strategy scoring summary shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/scoring-summary?kind=account", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and has_required(payload) and payload.get("kind") == "account"
        results.append(test_print("Account scoring summary shape", ok))
    except Exception as exc:
        results.append(test_print("Account scoring summary shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/scoring-summary", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(payload, dict)
            and "strategy" in payload
            and "account" in payload
            and has_required(payload.get("strategy", {}))
            and has_required(payload.get("account", {}))
        )
        results.append(test_print("Combined scoring summary shape", ok))
    except Exception as exc:
        results.append(test_print("Combined scoring summary shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/scoring-summary?kind=bad", headers=headers, timeout=8)
        ok = resp.status_code == 400
        results.append(test_print("Invalid kind returns 400", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Invalid kind returns 400", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/scoring-summary", timeout=8)
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
