#!/usr/bin/env python3
"""Stage 49 smoke: Follow-up Tasks API checks."""

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
    print("Stage 49: Follow-up Tasks - Smoke Test")
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
    task_id = None

    # create
    try:
        create_payload = {
            "object_type": "audit_case",
            "object_ref_id": 1,
            "action_key": "review_manually",
            "title": "Review manually",
            "status": "open",
            "priority": "high",
            "due_label": "today",
            "note": "stage49 smoke",
        }
        resp = requests.post(f"{BASE_URL}/api/follow-up-tasks", json=create_payload, headers=headers, timeout=8)
        payload = resp.json() if resp.status_code in (200, 201) else {}
        task_id = payload.get("id")
        ok = resp.status_code == 201 and bool(task_id) and payload.get("status") == "open"
        results.append(test_print("Create follow-up task", ok, f"taskId={task_id}"))
    except Exception as exc:
        results.append(test_print("Create follow-up task", False, str(exc)))

    # list
    try:
        resp = requests.get(f"{BASE_URL}/api/follow-up-tasks", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and isinstance(payload.get("items"), list) and "total" in payload
        results.append(test_print("List follow-up tasks", ok, f"count={payload.get('count')} total={payload.get('total')}"))
    except Exception as exc:
        results.append(test_print("List follow-up tasks", False, str(exc)))

    # filter
    try:
        resp = requests.get(
            f"{BASE_URL}/api/follow-up-tasks",
            headers=headers,
            params={"status": "open", "priority": "high"},
            timeout=8,
        )
        payload = resp.json() if resp.status_code == 200 else {}
        filters = payload.get("filters", {})
        ok = resp.status_code == 200 and filters.get("status") == "open" and filters.get("priority") == "high"
        results.append(test_print("List with filters", ok))
    except Exception as exc:
        results.append(test_print("List with filters", False, str(exc)))

    # patch status
    if task_id:
        try:
            resp = requests.patch(
                f"{BASE_URL}/api/follow-up-tasks/{task_id}",
                headers=headers,
                json={"status": "done", "note": "completed in smoke"},
                timeout=8,
            )
            payload = resp.json() if resp.status_code == 200 else {}
            ok = resp.status_code == 200 and payload.get("status") == "done"
            results.append(test_print("Update task status", ok, f"status={payload.get('status')}"))
        except Exception as exc:
            results.append(test_print("Update task status", False, str(exc)))

    # options
    try:
        resp = requests.get(f"{BASE_URL}/api/follow-up-tasks/options", headers=headers, timeout=8)
        payload = resp.json() if resp.status_code == 200 else {}
        ok = resp.status_code == 200 and isinstance(payload.get("statuses"), list)
        results.append(test_print("Task options shape", ok))
    except Exception as exc:
        results.append(test_print("Task options shape", False, str(exc)))

    # no token
    try:
        resp = requests.get(f"{BASE_URL}/api/follow-up-tasks", timeout=8)
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
