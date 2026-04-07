#!/usr/bin/env python3
"""
Stage 34: Decision Notes / Review Actions - Smoke Test
Tests review notes and review actions functionality
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
    print("Stage 34: Decision Notes / Review Actions - Smoke Test")
    print("="*70)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")
    
    results = []
    case_id = None
    
    # TEST 1: Login
    print("[TEST 1] Authentication")
    passed = login()
    test_print("Login succeeds", passed)
    results.append(passed)
    
    if not passed:
        print("\n✗ Authentication failed")
        return 1
    
    # TEST 2: Create test case
    print("\n[TEST 2] Create Test Case")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/audit-cases",
            headers=get_headers(),
            json={
                "case_type": "strategy",
                "ref_id": 1,
                "priority": "high",
                "note": "Test case for Stage 34"
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
    
    # TEST 3: Add review note
    print("\n[TEST 3] Add Review Note")
    if case_id:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/notes",
                headers=get_headers(),
                json={
                    "content": "This strategy looks promising",
                    "note_type": "comment"
                },
                timeout=5
            )
            passed = resp.status_code == 201
            note_data = resp.json() if passed else {}
            note_id = note_data.get("id")
            test_print("Add note", passed, f"Note ID: {note_id}")
            results.append(passed)
        except Exception as e:
            test_print("Add note", False, str(e))
            results.append(False)
    
    # TEST 4: Get notes for case
    print("\n[TEST 4] Get Notes for Case")
    if case_id:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases/{case_id}/notes",
                headers=get_headers(),
                timeout=5
            )
            passed = resp.status_code == 200
            notes_data = resp.json() if passed else {}
            test_print("Get notes", passed,
                      f"Notes count: {notes_data.get('count', 0)}")
            results.append(passed)
        except Exception as e:
            test_print("Get notes", False, str(e))
            results.append(False)
    
    # TEST 5: Add multiple notes
    print("\n[TEST 5] Add Multiple Notes")
    if case_id:
        note_results = []
        note_types = ["comment", "flag", "question"]
        for note_type in note_types:
            try:
                resp = requests.post(
                    f"{BASE_URL}/api/audit-cases/{case_id}/notes",
                    headers=get_headers(),
                    json={
                        "content": f"Test {note_type}",
                        "note_type": note_type
                    },
                    timeout=5
                )
                note_results.append(resp.status_code == 201)
            except:
                note_results.append(False)
        
        passed = all(note_results)
        test_print(f"Add {len(note_types)} note types", passed,
                  f"Success: {sum(note_results)}/{len(note_types)}")
        results.append(passed)
    
    # TEST 6: Take review action (Watch)
    print("\n[TEST 6] Take Review Action - Watch")
    if case_id:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/actions",
                headers=get_headers(),
                json={
                    "action": "watch",
                    "reason": "Needs more data to decide"
                },
                timeout=5
            )
            passed = resp.status_code == 201
            action_data = resp.json() if passed else {}
            test_print("Take watch action", passed,
                      f"Action: {action_data.get('action')}, New Status: {action_data.get('new_status')}")
            results.append(passed)
        except Exception as e:
            test_print("Take watch action", False, str(e))
            results.append(False)
    
    # TEST 7: Take review action (Approve)
    print("\n[TEST 7] Take Review Action - Approve")
    if case_id:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/audit-cases/{case_id}/actions",
                headers=get_headers(),
                json={
                    "action": "approve",
                    "reason": "Strategy meets all criteria"
                },
                timeout=5
            )
            passed = resp.status_code == 201
            action_data = resp.json() if passed else {}
            test_print("Take approve action", passed,
                      f"Action: {action_data.get('action')}, Status Updated: {action_data.get('case_updated')}")
            results.append(passed)
        except Exception as e:
            test_print("Take approve action", False, str(e))
            results.append(False)
    
    # TEST 8: Get review actions/history
    print("\n[TEST 8] Get Review History")
    if case_id:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases/{case_id}/actions",
                headers=get_headers(),
                timeout=5
            )
            passed = resp.status_code == 200
            history = resp.json() if passed else {}
            test_print("Get history", passed,
                      f"Notes: {history.get('notes_count', 0)}, Actions: {history.get('actions_count', 0)}")
            results.append(passed)
        except Exception as e:
            test_print("Get history", False, str(e))
            results.append(False)
    
    # TEST 9: Get case decision
    print("\n[TEST 9] Get Case Decision")
    if case_id:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/audit-cases/{case_id}/decision",
                headers=get_headers(),
                timeout=5
            )
            passed = resp.status_code == 200
            decision = resp.json() if passed else {}
            test_print("Get decision", passed,
                      f"Has Decision: {decision.get('has_decision')}, Action: {decision.get('action')}")
            results.append(passed)
        except Exception as e:
            test_print("Get decision", False, str(e))
            results.append(False)
    
    # TEST 10: Test all review actions
    print("\n[TEST 10] Test All Review Actions")
    # Create new case for action tests
    try:
        resp = requests.post(
            f"{BASE_URL}/api/audit-cases",
            headers=get_headers(),
            json={"case_type": "backtest", "ref_id": 2},
            timeout=5
        )
        if resp.status_code == 201:
            test_case_id = resp.json()["id"]
            
            action_results = []
            for action in ["reject", "needs_data"]:
                try:
                    resp = requests.post(
                        f"{BASE_URL}/api/audit-cases/{test_case_id}/actions",
                        headers=get_headers(),
                        json={"action": action},
                        timeout=5
                    )
                    action_results.append(resp.status_code == 201)
                except:
                    action_results.append(False)
            
            passed = len(action_results) > 0 and all(action_results)
            test_print("Test reject/needs_data actions", passed,
                      f"Success: {sum(action_results)}/{len(action_results)}")
            results.append(passed)
        else:
            test_print("Test all actions", False, "Could not create test case")
            results.append(False)
    except Exception as e:
        test_print("Test all actions", False, str(e))
        results.append(False)
    
    # Summary
    print("\n" + "="*70)
    passed_count = sum(results)
    total_count = len(results)
    print(f"Results: {passed_count}/{total_count} tests passed")
    print("="*70)
    
    if passed_count == total_count:
        print("\n✓ ALL TESTS PASSED - Stage 34 smoke OK\n")
        return 0
    else:
        print(f"\n✗ {total_count - passed_count} test(s) failed\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
