#!/usr/bin/env python3
"""Stage 51 UI data smoke for portfolio essentials."""

import sys
from datetime import datetime

import requests

BASE_URL = "http://127.0.0.1:5000"


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def main() -> int:
    print("=" * 72)
    print("Stage 51 UI Data Smoke")
    print(datetime.now().isoformat())
    print("=" * 72)

    login = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
    if login.status_code != 200:
        return fail(f"login status={login.status_code}")

    token = login.json().get("token")
    if not token:
        return fail("no token")

    headers = {"Authorization": f"Bearer {token}"}
    for kind in ("strategy", "account"):
        resp = requests.get(f"{BASE_URL}/api/portfolio", params={"kind": kind}, headers=headers, timeout=8)
        if resp.status_code != 200:
            return fail(f"portfolio {kind} status={resp.status_code}")
        payload = resp.json()
        if "items" not in payload:
            return fail(f"portfolio {kind} missing items")
        if payload.get("kind") != kind:
            return fail(f"portfolio {kind} kind mismatch")

    print("PASS: portfolio ui data smoke")
    return 0


if __name__ == "__main__":
    sys.exit(main())
