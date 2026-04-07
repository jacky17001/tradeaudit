#!/usr/bin/env python3
"""
Stage 33: Audit Cases / Review Queue - Smoke Test
Tests audit case creation, listing, and review queue functionality
"""
import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"
TOKEN = None

def test_print(test_name, passed, details=""):
    """Print test result"""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"       {details}")
    return passed

def login():
    """Get auth token"""
    global TOKEN
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"password": "admin"},
        timeout=5
    )
    if resp.status_code == 200:
        TOKEN = resp.json()["token"]
        return True
    return False

def get_headers():
    """Return auth headers"""
    return {"Authorization": f"Bearer {TOKEN}"}

def main():
    print("\n" + "="*70)
    print("Stage 33: Audit Cases / Review Queue - Smoke Test")
    print("="*70)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")
    
    results = []
    
    # TEST 1: Login
    print("[TEST 1] Authentication")
    passed = login()
    test_print("Login succeeds", passed, f"Token: {TOKEN[:20]}..." if TOKEN else "No token")
    results.append(passed)
    
    if not passed:
        print("\n✗ Authentication failed, cannot proceed")
        return 1
    
    # TEST 2: Get case summary (empty state)
    print("\n[TEST 2] Case Summary")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/audit-cases/stats/summary",
            headers=get_headers(),
            timeout=5
        )
        passed = resp.status_code == 200
        summary = resp.json() if passed else {}
        test_print("Get summary", passed, 
                  f"Total: {summary.get('total', 0)}, Open: {summary.get('open', 0)}")
        results.append(passed)
        initial_summary = summary
    except Exception as e:
        test_print("Get summary", False, str(e))
        results.append(False)
        return 1
    
    # TEST 3: Create audit case
    print("\n[TEST 3] Create Audit Case")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/audit-cases",
            headers=get_headers(),
            json={
                "case_type": "strategy",
                "ref_id": 1,
                "priority": "high",
                "note": "Test case for smoke test"
            },
            timeout=5
        )
        passed = resp.status_code == 201
        case_data = resp.json() if passed else {}
        case_id = case_data.get("id")
        test_print("Create case", passed, f"Case ID: {case_id}")
        results.append(passed)
    except Exception as e:
        test_print("Create case", False, str(e))
        results.append(False)
        return 1
    
    # TEST 4: Get audit cases list
    print("\n[TEST 4] List Audit Cases")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/audit-cases?limit=50",
            headers=get_headers(),
            timeout=5
        )
        passed = resp.status_code == 200 and "items" in resp.json()
        list_data = resp.json() if passed else {}
        test_print("List cases", passed,
                  f"Count: {list_data.get('count', 0)}, Total: {list_data.get('total', 0)}")
        results.append(passed)
    except Exception as e:
        test_print("List cases", False, str(e))
        results.append(False)
        return 1
    
    # TEST 5: Get case detail
    print("\n[TEST 5] Get Case Detail")
    if case_id:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases/{case_id}",
                headers=get_headers(),
                timeout=5
            )
            passed = resp.status_code == 200
            case_detail = resp.json() if passed else {}
            test_print("Get case detail", passed,
                      f"Case #{case_detail.get('id')}: {case_detail.get('status')}")
            results.append(passed)
        except Exception as e:
            test_print("Get case detail", False, str(e))
            results.append(False)
    
    # TEST 6: Update audit case
    print("\n[TEST 6] Update Audit Case")
    if case_id:
        try:
            resp = requests.patch(
                f"{BASE_URL}/api/audit-cases/{case_id}",
                headers=get_headers(),
                json={
                    "status": "in_progress",
                    "priority": "normal"
                },
                timeout=5
            )
            passed = resp.status_code == 200
            updated = resp.json() if passed else {}
            test_print("Update case", passed,
                      f"Status: {updated.get('status')}, Priority: {updated.get('priority')}")
            results.append(passed)
        except Exception as e:
            test_print("Update case", False, str(e))
            results.append(False)
    
    # TEST 7: Get review queue
    print("\n[TEST 7] Review Queue")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/review-queue?limit=50",
            headers=get_headers(),
            timeout=5
        )
        passed = resp.status_code == 200 and "items" in resp.json()
        queue_data = resp.json() if passed else {}
        test_print("Get review queue", passed,
                  f"Count: {queue_data.get('count', 0)}")
        results.append(passed)
    except Exception as e:
        test_print("Get review queue", False, str(e))
        results.append(False)
        return 1
    
    # TEST 8: List with filter
    print("\n[TEST 8] List with Status Filter")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/audit-cases?status=in_progress",
            headers=get_headers(),
            timeout=5
        )
        passed = resp.status_code == 200
        filtered = resp.json() if passed else {}
        test_print("List with filter", passed,
                  f"Filtered count: {filtered.get('count', 0)}")
        results.append(passed)
    except Exception as e:
        test_print("List with filter", False, str(e))
        results.append(False)
    
    # TEST 9: Create multiple case types
    print("\n[TEST 9] Create Multiple Case Types")
    case_types = ["backtest", "account_audit", "mt5_connection"]
    type_results = []
    for case_type in case_types:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/audit-cases",
                headers=get_headers(),
                json={
                    "case_type": case_type,
                    "ref_id": 999,
                    "priority": "normal"
                },
                timeout=5
            )
            type_results.append(resp.status_code == 201)
        except:
            type_results.append(False)
    
    passed = all(type_results)
    test_print(f"Create {len(case_types)} case types", passed,
              f"Success: {sum(type_results)}/{len(case_types)}")
    results.append(passed)
    
    # TEST 10: Check updated summary
    print("\n[TEST 10] Verify Case Summary Updated")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/audit-cases/stats/summary",
            headers=get_headers(),
            timeout=5
        )
        passed = resp.status_code == 200
        final_summary = resp.json() if passed else {}
        increased = final_summary.get("total", 0) > initial_summary.get("total", 0)
        test_print("Summary increased", passed and increased,
                  f"Initial: {initial_summary.get('total', 0)}, Final: {final_summary.get('total', 0)}")
        results.append(passed and increased)
    except Exception as e:
        test_print("Summary increased", False, str(e))
        results.append(False)
    
    # Summary
    print("\n" + "="*70)
    passed_count = sum(results)
    total_count = len(results)
    print(f"Results: {passed_count}/{total_count} tests passed")
    print("="*70)
    
    if passed_count == total_count:
        print("\n✓ ALL TESTS PASSED - Stage 33 smoke OK\n")
        return 0
    else:
        print(f"\n✗ {total_count - passed_count} test(s) failed\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
