#!/usr/bin/env python3
"""Stage 40 smoke: Recommended Actions endpoint checks."""

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
    return {"kind", "title", "score", "decision", "recommendedActions"}.issubset(set(payload.keys()))


def action_shape_valid(action: dict) -> bool:
    return {
        "actionKey",
        "title",
        "description",
        "priority",
        "reason",
        "targetPath",
    }.issubset(set(action.keys()))


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 40: Recommended Actions - Smoke Test")
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
        resp = requests.get(f"{BASE_URL}/api/recommended-actions?kind=strategy", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        actions = payload.get("recommendedActions") or []
        ok = resp.status_code == 200 and has_required(payload) and payload.get("kind") == "strategy"
        ok = ok and all(action_shape_valid(a) for a in actions)
        results.append(test_print("Strategy actions shape", ok, f"count={len(actions)}"))
    except Exception as exc:
        results.append(test_print("Strategy actions shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/recommended-actions?kind=account", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        actions = payload.get("recommendedActions") or []
        ok = resp.status_code == 200 and has_required(payload) and payload.get("kind") == "account"
        ok = ok and all(action_shape_valid(a) for a in actions)
        results.append(test_print("Account actions shape", ok, f"count={len(actions)}"))
    except Exception as exc:
        results.append(test_print("Account actions shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/recommended-actions", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(payload, dict)
            and "strategy" in payload
            and "account" in payload
            and has_required(payload.get("strategy", {}))
            and has_required(payload.get("account", {}))
        )
        results.append(test_print("Combined actions shape", ok))
    except Exception as exc:
        results.append(test_print("Combined actions shape", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/recommended-actions?kind=bad", headers=headers, timeout=8)
        results.append(test_print("Invalid kind returns 400", resp.status_code == 400, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Invalid kind returns 400", False, str(exc)))

    try:
        resp = requests.get(f"{BASE_URL}/api/recommended-actions", timeout=8)
        results.append(test_print("No token returns 401", resp.status_code == 401, f"status={resp.status_code}"))
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
