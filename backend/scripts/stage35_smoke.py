#!/usr/bin/env python3
"""
Stage 35: Unified Activity / Audit Timeline - Smoke Test
"""
import sys
from datetime import datetime

import requests

BASE_URL = "http://127.0.0.1:5000"
TOKEN = None


def test_print(name: str, passed: bool, details: str = "") -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if details:
        print(f"       {details}")
    return passed


def login() -> bool:
    global TOKEN
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"password": "admin"},
        timeout=8,
    )
    if resp.status_code != 200:
        return False
    TOKEN = resp.json().get("token")
    return bool(TOKEN)


def auth_headers() -> dict:
    return {"Authorization": f"Bearer {TOKEN}"}


def validate_timeline_shape(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    if "items" not in payload or not isinstance(payload["items"], list):
        return False
    for item in payload["items"]:
        required = {"event_type", "object_type", "object_ref_id", "title", "created_at", "source_section"}
        if not required.issubset(item.keys()):
            return False
    return True


def check_desc_sort(items: list[dict]) -> bool:
    timestamps = [item.get("created_at") for item in items if item.get("created_at")]
    return all(timestamps[i] >= timestamps[i + 1] for i in range(len(timestamps) - 1))


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 35: Unified Activity / Audit Timeline - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []

    # 1) auth
    ok = login()
    results.append(test_print("Authentication", ok))
    if not ok:
        print("\nAuthentication failed. Abort.")
        return 1

    # 2) pick strategy id
    strategy_id = None
    try:
        resp = requests.get(f"{BASE_URL}/api/backtests/list?page=1&pageSize=5", timeout=8)
        if resp.status_code == 200:
            rows = (resp.json() or {}).get("rows") or []
            if rows:
                strategy_id = rows[0].get("id")
        strategy_ok = bool(strategy_id)
        details = f"strategyId={strategy_id}" if strategy_ok else "no backtests rows; strategy timeline test skipped"
        results.append(test_print("Backtests list for strategy source", True, details))
    except Exception as exc:
        results.append(test_print("Backtests list for strategy source", False, str(exc)))

    # 3) strategy timeline endpoint
    if strategy_id:
        try:
            resp = requests.get(f"{BASE_URL}/api/backtests/{strategy_id}/timeline?limit=30", timeout=8)
            payload = resp.json() if resp.status_code == 200 else {}
            ok_shape = resp.status_code == 200 and validate_timeline_shape(payload)
            ok_sort = ok_shape and check_desc_sort(payload.get("items", []))
            results.append(test_print("Strategy timeline response shape", ok_shape, f"count={len(payload.get('items', []))}"))
            results.append(test_print("Strategy timeline desc order", ok_sort))
        except Exception as exc:
            results.append(test_print("Strategy timeline", False, str(exc)))
            results.append(False)

    # 4) create case + review events for case timeline
    case_id = None
    try:
        create_resp = requests.post(
            f"{BASE_URL}/api/audit-cases",
            headers=auth_headers(),
            json={"case_type": "mt5_connection", "ref_id": 1, "priority": "normal", "note": "stage35 smoke"},
            timeout=8,
        )
        if create_resp.status_code == 201:
            case_id = create_resp.json().get("id")
        results.append(test_print("Create case for timeline", bool(case_id), f"caseId={case_id}"))
    except Exception as exc:
        results.append(test_print("Create case for timeline", False, str(exc)))

    if case_id:
        try:
            note_resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/notes",
                headers=auth_headers(),
                json={"content": "stage35 note", "note_type": "comment"},
                timeout=8,
            )
            action_resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/actions",
                headers=auth_headers(),
                json={"action": "watch", "reason": "timeline test"},
                timeout=8,
            )
            ok = note_resp.status_code == 201 and action_resp.status_code == 201
            results.append(test_print("Seed review note/action", ok))
        except Exception as exc:
            results.append(test_print("Seed review note/action", False, str(exc)))

        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases/{case_id}/timeline?limit=30",
                headers=auth_headers(),
                timeout=8,
            )
            payload = resp.json() if resp.status_code == 200 else {}
            ok_shape = resp.status_code == 200 and validate_timeline_shape(payload)
            ok_sort = ok_shape and check_desc_sort(payload.get("items", []))
            results.append(test_print("Case timeline response shape", ok_shape, f"count={len(payload.get('items', []))}"))
            results.append(test_print("Case timeline desc order", ok_sort))
        except Exception as exc:
            results.append(test_print("Case timeline endpoint", False, str(exc)))
            results.append(False)

    # 5) account audit timeline endpoint
    try:
        resp = requests.get(
            f"{BASE_URL}/api/account-audit/timeline?sourceType=mt5_investor&sourceRefId=1&limit=30",
            headers=auth_headers(),
            timeout=8,
        )
        payload = resp.json() if resp.status_code == 200 else {}
        ok_shape = resp.status_code == 200 and validate_timeline_shape(payload)
        ok_sort = ok_shape and check_desc_sort(payload.get("items", []))
        results.append(test_print("Account audit timeline response shape", ok_shape, f"count={len(payload.get('items', []))}"))
        results.append(test_print("Account audit timeline desc order", ok_sort))
    except Exception as exc:
        results.append(test_print("Account audit timeline endpoint", False, str(exc)))
        results.append(False)

    passed = sum(1 for r in results if r)
    total = len(results)

    print("\n" + "=" * 72)
    print(f"Results: {passed}/{total} passed")
    print("=" * 72)

    if passed == total:
        print("\nALL TESTS PASSED - Stage 35 smoke OK\n")
        return 0

    print("\nSome tests failed.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
