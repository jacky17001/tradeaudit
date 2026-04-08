#!/usr/bin/env python3
"""Stage 38 smoke: Result Overview endpoint validation."""

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
    print("Stage 38: Result Overview - Smoke Test")
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

    # 2) result-overview returns 200 with correct shape
    overview = None
    try:
        resp = requests.get(f"{BASE_URL}/api/result-overview", headers=headers, timeout=8)
        overview = resp.json() if resp.status_code == 200 else {}
        ok = (
            resp.status_code == 200
            and isinstance(overview, dict)
            and "strategyOverview" in overview
            and "accountOverview" in overview
        )
        results.append(test_print("result-overview shape", ok, f"keys={list(overview.keys())}"))
    except Exception as exc:
        results.append(test_print("result-overview shape", False, str(exc)))
        return 1

    # 3) strategyOverview has required fields
    try:
        so = overview.get("strategyOverview", {})
        required = ["title", "score", "verdict", "riskLevel", "trustLevel", "recommendedNextStep"]
        ok = isinstance(so, dict) and all(k in so for k in required)
        results.append(test_print("strategyOverview has required fields", ok, f"keys={list(so.keys())}"))
    except Exception as exc:
        results.append(test_print("strategyOverview has required fields", False, str(exc)))

    # 4) accountOverview has required fields
    try:
        ao = overview.get("accountOverview", {})
        required = ["title", "score", "verdict", "riskLevel", "trustLevel", "recommendedNextStep"]
        ok = isinstance(ao, dict) and all(k in ao for k in required)
        results.append(test_print("accountOverview has required fields", ok, f"keys={list(ao.keys())}"))
    except Exception as exc:
        results.append(test_print("accountOverview has required fields", False, str(exc)))

    # 5) verdict values are in expected set
    VALID_VERDICTS = {"Qualified", "Marginal", "Rejected", "No Data", "Unknown"}
    try:
        so_verdict = overview.get("strategyOverview", {}).get("verdict", "")
        ao_verdict = overview.get("accountOverview", {}).get("verdict", "")
        ok = so_verdict in VALID_VERDICTS and ao_verdict in VALID_VERDICTS
        results.append(
            test_print("Verdict values are valid", ok, f"strategy={so_verdict} account={ao_verdict}")
        )
    except Exception as exc:
        results.append(test_print("Verdict values are valid", False, str(exc)))

    # 6) riskLevel values valid
    VALID_RISK = {"High", "Medium", "Low", "Unknown"}
    try:
        so_risk = overview.get("strategyOverview", {}).get("riskLevel", "")
        ao_risk = overview.get("accountOverview", {}).get("riskLevel", "")
        ok = so_risk in VALID_RISK and ao_risk in VALID_RISK
        results.append(
            test_print("RiskLevel values are valid", ok, f"strategy={so_risk} account={ao_risk}")
        )
    except Exception as exc:
        results.append(test_print("RiskLevel values are valid", False, str(exc)))

    # 7) recommendedNextStep values valid
    VALID_NEXT = {"continue forward", "continue monitoring", "review required", "collect more data", "not enough data"}
    try:
        so_next = overview.get("strategyOverview", {}).get("recommendedNextStep", "")
        ao_next = overview.get("accountOverview", {}).get("recommendedNextStep", "")
        ok = so_next in VALID_NEXT and ao_next in VALID_NEXT
        results.append(
            test_print("NextStep values are valid", ok, f"strategy={so_next!r} account={ao_next!r}")
        )
    except Exception as exc:
        results.append(test_print("NextStep values are valid", False, str(exc)))

    # 8) Unauthenticated request should return 401
    try:
        resp = requests.get(f"{BASE_URL}/api/result-overview", timeout=8)
        ok = resp.status_code == 401
        results.append(test_print("Unauthenticated request returns 401", ok, f"status={resp.status_code}"))
    except Exception as exc:
        results.append(test_print("Unauthenticated request returns 401", False, str(exc)))

    # Summary
    print("\n" + "=" * 72)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Result: {passed}/{total} passed")
    print("=" * 72)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
