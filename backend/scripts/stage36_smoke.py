#!/usr/bin/env python3
"""Stage 36 smoke: session hardening + config safety."""
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


def has_error_shape(payload: dict) -> bool:
    return isinstance(payload, dict) and isinstance(payload.get("error"), dict) and "code" in payload["error"] and "message" in payload["error"]


def main() -> int:
    print("\n" + "=" * 70)
    print("Stage 36: Session Hardening + Config Safety - Smoke Test")
    print("=" * 70)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    results = []

    # 1) config status
    try:
        resp = requests.get(f"{BASE_URL}/api/config/status", timeout=8)
        data = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(data.get("configurationWarning"), bool)
            and isinstance(data.get("adminPasswordConfigured"), bool)
            and isinstance(data.get("unsafeAdminPassword"), bool)
        )
        results.append(test_print("Config status shape", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Config status shape", False, str(exc)))

    # 2) auth verify without token
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/verify", timeout=8)
        data = resp.json() if resp.status_code == 401 else {}
        ok = resp.status_code == 401 and has_error_shape(data) and data["error"]["code"] == "UNAUTHORIZED"
        results.append(test_print("Verify without token returns UNAUTHORIZED", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Verify without token", False, str(exc)))

    # 3) auth verify with invalid token
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": "Bearer invalid-token-stage36"},
            timeout=8,
        )
        data = resp.json() if resp.status_code == 401 else {}
        ok = resp.status_code == 401 and has_error_shape(data) and data["error"]["code"] in {"INVALID_SESSION", "SESSION_EXPIRED"}
        results.append(test_print("Verify invalid token returns INVALID_SESSION", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Verify invalid token", False, str(exc)))

    # 4) login invalid password
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "wrong-password"}, timeout=8)
        data = resp.json() if resp.status_code == 401 else {}
        ok = resp.status_code == 401 and has_error_shape(data) and data["error"]["code"] == "UNAUTHORIZED"
        results.append(test_print("Login invalid password response", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Login invalid password", False, str(exc)))

    # 5) login success
    token = None
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
        data = resp.json() if resp.status_code == 200 else {}
        token = data.get("token")
        ok = resp.status_code == 200 and bool(token) and bool(data.get("expiresAt")) and bool(data.get("issuedAt"))
        results.append(test_print("Login success shape", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Login success", False, str(exc)))

    # 6) verify valid token
    if token:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/auth/verify",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
            data = resp.json() if resp.status_code == 200 else {}
            ok = resp.status_code == 200 and data.get("valid") is True
            results.append(test_print("Verify valid token", ok, str(data)))
        except Exception as exc:
            results.append(test_print("Verify valid token", False, str(exc)))

    # 7) protected endpoint without token
    try:
        resp = requests.get(f"{BASE_URL}/api/audit-cases", timeout=8)
        data = resp.json() if resp.status_code == 401 else {}
        ok = resp.status_code == 401 and has_error_shape(data)
        results.append(test_print("Protected endpoint denied without token", ok, str(data)))
    except Exception as exc:
        results.append(test_print("Protected endpoint denied", False, str(exc)))

    # 8) protected endpoint with valid token
    if token:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases?limit=1",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
            ok = resp.status_code == 200
            results.append(test_print("Protected endpoint allowed with token", ok))
        except Exception as exc:
            results.append(test_print("Protected endpoint allowed", False, str(exc)))

    passed = sum(1 for r in results if r)
    total = len(results)

    print("\n" + "=" * 70)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 70)

    if passed == total:
        print("\nALL TESTS PASSED - Stage 36 smoke OK\n")
        return 0

    print("\nSome tests failed.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
