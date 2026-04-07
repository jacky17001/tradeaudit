#!/usr/bin/env python3
"""Stage 37 smoke: release polish + basic export data coverage."""

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
    return isinstance(payload, dict) and isinstance(payload.get("error"), dict)


def main() -> int:
    print("\n" + "=" * 72)
    print("Stage 37: Release Polish + Export Basics - Smoke Test")
    print("=" * 72)
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    results = []

    # 1) auth login
    token = None
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
        data = resp.json() if resp.status_code == 200 else {}
        token = data.get("token")
        ok = resp.status_code == 200 and bool(token)
        results.append(test_print("Login", ok))
    except Exception as exc:
        results.append(test_print("Login", False, str(exc)))

    if not token:
        print("\nAuthentication failed. Abort.")
        return 1

    headers = {"Authorization": f"Bearer {token}"}

    # 2) lifecycle endpoint shape
    strategy_id = None
    try:
        list_resp = requests.get(f"{BASE_URL}/api/backtests/list?page=1&pageSize=1", timeout=8)
        rows = (list_resp.json() or {}).get("rows") if list_resp.status_code == 200 else []
        strategy_id = rows[0].get("id") if rows else None
        if strategy_id:
            life_resp = requests.get(f"{BASE_URL}/api/backtests/{strategy_id}/lifecycle", timeout=8)
            life_data = life_resp.json() if life_resp.status_code == 200 else {}
            ok = life_resp.status_code == 200 and isinstance(life_data, dict) and "strategyId" in life_data
            results.append(test_print("Lifecycle response shape", ok, f"strategyId={strategy_id}"))
        else:
            results.append(test_print("Lifecycle response shape", True, "No strategy row available (skipped)"))
    except Exception as exc:
        results.append(test_print("Lifecycle response shape", False, str(exc)))

    # 3) create manual intake for review source
    intake_id = None
    try:
        resp = requests.post(
            f"{BASE_URL}/api/account-audit/intake",
            headers=headers,
            json={
                "sourceType": "MANUAL",
                "manualText": "ticket,symbol,type,volume,open_time,close_time,profit\n1,EURUSD,BUY,0.1,2025-01-01,2025-01-02,12.5",
                "note": "stage37 smoke",
            },
            timeout=8,
        )
        data = resp.json() if resp.status_code == 200 else {}
        intake_id = data.get("id")
        ok = resp.status_code == 200 and bool(intake_id)
        results.append(test_print("Manual intake create", ok, f"intakeId={intake_id}"))
    except Exception as exc:
        results.append(test_print("Manual intake create", False, str(exc)))

    # 4) account audit review endpoint
    if intake_id:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/account-audit/review?sourceType=manual_trade_import&sourceRefId={intake_id}",
                headers=headers,
                timeout=8,
            )
            data = resp.json() if resp.status_code == 200 else {}
            ok = resp.status_code == 200 and isinstance(data.get("sourceInfo"), dict)
            results.append(test_print("Account audit review shape", ok))
        except Exception as exc:
            results.append(test_print("Account audit review shape", False, str(exc)))

    # 5) create audit case for detail/decision export source
    case_id = None
    try:
        resp = requests.post(
            f"{BASE_URL}/api/audit-cases",
            headers=headers,
            json={
                "case_type": "account_audit",
                "ref_id": intake_id or 1,
                "priority": "normal",
                "note": "stage37 export case",
            },
            timeout=8,
        )
        data = resp.json() if resp.status_code == 201 else {}
        case_id = data.get("id")
        ok = resp.status_code == 201 and bool(case_id)
        results.append(test_print("Audit case create", ok, f"caseId={case_id}"))
    except Exception as exc:
        results.append(test_print("Audit case create", False, str(exc)))

    # 6) note + action
    if case_id:
        try:
            note_resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/notes",
                headers=headers,
                json={"content": "stage37 note", "note_type": "comment"},
                timeout=8,
            )
            action_resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/actions",
                headers=headers,
                json={"action": "watch", "reason": "stage37"},
                timeout=8,
            )
            ok = note_resp.status_code == 201 and action_resp.status_code == 201
            results.append(test_print("Note and action create", ok))
        except Exception as exc:
            results.append(test_print("Note and action create", False, str(exc)))

        try:
            dec_resp = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}/decision", headers=headers, timeout=8)
            dec_data = dec_resp.json() if dec_resp.status_code == 200 else {}
            ok = dec_resp.status_code == 200 and isinstance(dec_data.get("has_decision"), bool)
            results.append(test_print("Case decision shape", ok, str(dec_data)))
        except Exception as exc:
            results.append(test_print("Case decision shape", False, str(exc)))

    # 7) timeline endpoint shape
    if case_id:
        try:
            tl_resp = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}/timeline?limit=10", headers=headers, timeout=8)
            tl_data = tl_resp.json() if tl_resp.status_code == 200 else {}
            ok = tl_resp.status_code == 200 and isinstance(tl_data.get("items"), list)
            results.append(test_print("Case timeline shape", ok, f"count={len(tl_data.get('items', []))}"))
        except Exception as exc:
            results.append(test_print("Case timeline shape", False, str(exc)))

    # 8) unauthorized shape regression
    try:
        unauth = requests.get(f"{BASE_URL}/api/audit-cases", timeout=8)
        body = unauth.json() if unauth.status_code == 401 else {}
        ok = unauth.status_code == 401 and has_error_shape(body)
        results.append(test_print("Unauthorized response shape", ok))
    except Exception as exc:
        results.append(test_print("Unauthorized response shape", False, str(exc)))

    passed = sum(1 for item in results if item)
    total = len(results)
    print("\n" + "=" * 72)
    print(f"Results: {passed}/{total} passed")
    print("=" * 72)

    if passed == total:
        print("\nALL TESTS PASSED - Stage 37 smoke OK\n")
        return 0

    print("\nSome tests failed.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
