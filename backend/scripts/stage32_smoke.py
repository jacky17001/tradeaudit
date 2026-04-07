"""Stage 32 smoke test: minimal access protection + key API flow."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402


def main() -> int:
    client = app.test_client()

    # 1) Unauthenticated protected call should fail.
    unauth_resp = client.post("/api/account-audit/summaries/recompute", json={
        "sourceType": "mt5_investor",
        "sourceRefId": 1,
    })
    assert unauth_resp.status_code == 401, f"Expected 401, got {unauth_resp.status_code}"

    # 2) Login with default password.
    login_resp = client.post("/api/auth/login", json={"password": "admin"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code}"
    token = login_resp.get_json().get("token")
    assert token, "Missing token in login response"

    headers = {"Authorization": f"Bearer {token}"}

    # 3) Authorized protected write endpoint should work.
    summary_resp = client.post(
        "/api/account-audit/summaries/recompute",
        headers=headers,
        json={"sourceType": "manual_trade_import", "sourceRefId": 1},
    )
    assert summary_resp.status_code in (200, 400), (
        f"Expected 200/400 after auth, got {summary_resp.status_code}"
    )

    # 4) Authorized forward write endpoint should be reachable.
    run_resp = client.post(
        "/api/forward-runs",
        headers=headers,
        json={
            "strategyId": "non-existing-strategy",
            "symbol": "EURUSD",
            "timeframe": "H1",
        },
    )
    assert run_resp.status_code in (200, 400), (
        f"Expected 200/400 after auth, got {run_resp.status_code}"
    )

    print("ALL ASSERTIONS PASSED - Stage 32 smoke OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
