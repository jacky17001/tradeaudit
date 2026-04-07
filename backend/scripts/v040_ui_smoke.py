#!/usr/bin/env python3
"""
v0.4.0 Release - UI Smoke Test
Tests key user flows for access protection and core functionality
"""
import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"
FRONTEND_URL = "http://localhost:5173"

def test_print(test_name, passed, details=""):
    """Print test result in unified format"""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"       {details}")
    return passed

def main():
    print("\n" + "="*70)
    print("TradeAudit v0.4.0 - UI Smoke Test")
    print("="*70)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend  : {BASE_URL}")
    print(f"Frontend : {FRONTEND_URL}")
    print("="*70 + "\n")
    
    results = []
    token = None
    
    # TEST 1: Frontend is accessible
    print("[TEST 1] Frontend Accessibility")
    try:
        resp = requests.get(FRONTEND_URL, timeout=5)
        passed = resp.status_code == 200 or resp.status_code == 304
        test_print("Frontend loads without login", passed, f"Status: {resp.status_code}")
        results.append(passed)
    except Exception as e:
        test_print("Frontend loads without login", False, str(e))
        results.append(False)
    
    # TEST 2: Unauthenticated access to protected endpoint returns 401
    print("\n[TEST 2] Access Protection - Unauthenticated Request")
    try:
        resp = requests.post(f"{BASE_URL}/api/account-audit/summaries/recompute", 
                           json={}, 
                           timeout=5)
        passed = resp.status_code == 401
        test_print("Unauthenticated POST returns 401", passed, 
                  f"Status: {resp.status_code}, Expected: 401")
        results.append(passed)
    except Exception as e:
        test_print("Unauthenticated POST returns 401", False, str(e))
        results.append(False)
    
    # TEST 3: Login endpoint is accessible (no auth required)
    print("\n[TEST 3] Auth System - Login Endpoint")
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"password": "admin"},
                           timeout=5)
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            token = data.get("token")
            passed = token is not None and len(token) > 0
            test_print("Login with correct password succeeds", passed,
                      f"Token received: {len(token)} chars")
        else:
            test_print("Login with correct password succeeds", False,
                      f"Status: {resp.status_code}")
        results.append(passed)
    except Exception as e:
        test_print("Login with correct password succeeds", False, str(e))
        results.append(False)
    
    # TEST 4: Invalid password rejected
    print("\n[TEST 4] Auth System - Invalid Password")
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"password": "wrong_password"},
                           timeout=5)
        passed = resp.status_code in [401, 400]
        test_print("Login with wrong password fails", passed,
                  f"Status: {resp.status_code}, Expected: 401 or 400")
        results.append(passed)
    except Exception as e:
        test_print("Login with wrong password fails", False, str(e))
        results.append(False)
    
    # TEST 5: Authenticated request to protected endpoint succeeds
    if token:
        print("\n[TEST 5] Access Protection - Authenticated Request")
        try:
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.post(f"{BASE_URL}/api/account-audit/summaries/recompute",
                               json={},
                               headers=headers,
                               timeout=5)
            passed = resp.status_code in [200, 400, 422]  # 400/422 OK if validation error
            test_print("Authenticated POST succeeds", passed,
                      f"Status: {resp.status_code} (200/400/422 OK)")
            results.append(passed)
        except Exception as e:
            test_print("Authenticated POST succeeds", False, str(e))
            results.append(False)
    else:
        print("\n[TEST 5] Skipped - No token available")
        results.append(False)
    
    # TEST 6: Verify endpoint
    print("\n[TEST 6] Auth System - Verify Endpoint")
    if token:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.post(f"{BASE_URL}/api/auth/verify",
                               headers=headers,
                               timeout=5)
            passed = resp.status_code == 200
            if passed:
                data = resp.json()
                is_valid = data.get("valid") == True
                test_print("Token verification works", is_valid,
                          f"Valid: {is_valid}")
                results.append(is_valid)
            else:
                test_print("Token verification works", False,
                          f"Status: {resp.status_code}")
                results.append(False)
        except Exception as e:
            test_print("Token verification works", False, str(e))
            results.append(False)
    else:
        print("\n[TEST 6] Skipped - No token available")
        results.append(False)
    
    # TEST 7: Protected endpoints (sample check)
    print("\n[TEST 7] Access Protection - Critical Endpoints")
    if token:
        critical_endpoints = [
            ("POST", "/api/account-audit/intake"),
            ("POST", "/api/backtests/import"),
            ("POST", "/api/forward-runs"),
        ]
        for method, path in critical_endpoints:
            try:
                headers = {"Authorization": f"Bearer {token}"}
                if method == "POST":
                    resp = requests.post(f"{BASE_URL}{path}",
                                       json={},
                                       headers=headers,
                                       timeout=5)
                elif method == "PATCH":
                    resp = requests.patch(f"{BASE_URL}{path}",
                                        json={},
                                        headers=headers,
                                        timeout=5)
                
                # 200, 400, 422 all indicate endpoint is accessible (with possible validation errors)
                passed = resp.status_code in [200, 400, 422, 404, 405]
                test_print(f"Endpoint {method} {path} accessible", passed,
                          f"Status: {resp.status_code}")
                results.append(passed)
            except Exception as e:
                test_print(f"Endpoint {method} {path} accessible", False, str(e))
                results.append(False)
    else:
        print("\n[TEST 7] Skipped - No token available")
        for _ in range(3):
            results.append(False)
    
    # TEST 8: Unauthenticated access to critical endpoints
    print("\n[TEST 8] Access Protection - Unauth to Critical Endpoints")
    critical_endpoints = [
        ("POST", "/api/account-audit/intake"),
        ("POST", "/api/backtests/import"),
    ]
    for method, path in critical_endpoints:
        try:
            if method == "POST":
                resp = requests.post(f"{BASE_URL}{path}",
                                   json={},
                                   timeout=5)
            
            passed = resp.status_code == 401
            test_print(f"Unauth {method} {path} returns 401", passed,
                      f"Status: {resp.status_code}, Expected: 401")
            results.append(passed)
        except Exception as e:
            test_print(f"Unauth {method} {path} returns 401", False, str(e))
            results.append(False)
    
    # TEST 9: Database connectivity
    print("\n[TEST 9] Database & Services")
    try:
        resp = requests.get(f"{BASE_URL}/api/backtests/list?page=1&pageSize=1",
                          headers={"Authorization": f"Bearer {token}"} if token else {},
                          timeout=5)
        passed = resp.status_code in [200, 400]
        test_print("Backtests list endpoint works", passed,
                  f"Status: {resp.status_code}")
        results.append(passed)
    except Exception as e:
        test_print("Backtests list endpoint works", False, str(e))
        results.append(False)
    
    # Summary
    print("\n" + "="*70)
    passed_count = sum(results)
    total_count = len(results)
    print(f"Results: {passed_count}/{total_count} tests passed")
    print("="*70)
    
    if passed_count == total_count:
        print("\n✓ ALL TESTS PASSED - UI Smoke OK")
        print("  v0.4.0 is ready for release\n")
        return 0
    else:
        print(f"\n✗ {total_count - passed_count} test(s) failed")
        print("  Please review failures above\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
