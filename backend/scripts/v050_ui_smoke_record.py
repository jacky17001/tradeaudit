#!/usr/bin/env python3
"""v0.5.0 release-prep UI smoke recorder (API-driven fallback)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_URL = "http://127.0.0.1:5000"
OUT_DIR = Path(__file__).resolve().parents[2] / "reports" / "v050_exports"


def write_md(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    result: dict[str, object] = {
        "generatedAt": now_iso(),
        "steps": {},
        "files": {},
    }

    # 1) login
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "admin"}, timeout=8)
    if login_resp.status_code != 200:
        result["steps"]["login"] = {"ok": False, "status": login_resp.status_code}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    token = (login_resp.json() or {}).get("token")
    headers = {"Authorization": f"Bearer {token}"}
    result["steps"]["login"] = {"ok": bool(token), "status": login_resp.status_code}

    # 2) session verify + refresh-like re-verify
    verify1 = requests.post(f"{BASE_URL}/api/auth/verify", headers=headers, timeout=8)
    verify2 = requests.post(f"{BASE_URL}/api/auth/verify", headers=headers, timeout=8)
    result["steps"]["sessionVerify"] = {
        "ok": verify1.status_code == 200 and verify2.status_code == 200,
        "first": verify1.status_code,
        "second": verify2.status_code,
    }

    # 3) source data for account review export
    intake_resp = requests.post(
        f"{BASE_URL}/api/account-audit/intake",
        headers=headers,
        json={
            "sourceType": "MANUAL",
            "manualText": "ticket,symbol,type,volume,open_time,close_time,profit\n1,EURUSD,BUY,0.1,2025-01-01,2025-01-02,10.0",
            "note": "v050 smoke",
        },
        timeout=8,
    )
    intake_id = (intake_resp.json() or {}).get("id") if intake_resp.status_code == 200 else None

    review_data = {}
    review_timeline = {}
    if intake_id:
        review = requests.get(
            f"{BASE_URL}/api/account-audit/review?sourceType=manual_trade_import&sourceRefId={intake_id}",
            headers=headers,
            timeout=8,
        )
        review_data = review.json() if review.status_code == 200 else {}

        review_tl = requests.get(
            f"{BASE_URL}/api/account-audit/timeline?sourceType=manual_trade_import&sourceRefId={intake_id}&limit=10",
            headers=headers,
            timeout=8,
        )
        review_timeline = review_tl.json() if review_tl.status_code == 200 else {}

    # 4) source data for audit case export
    case_resp = requests.post(
        f"{BASE_URL}/api/audit-cases",
        headers=headers,
        json={"case_type": "account_audit", "ref_id": int(intake_id or 1), "priority": "normal", "note": "v050 case"},
        timeout=8,
    )
    case_id = (case_resp.json() or {}).get("id") if case_resp.status_code == 201 else None
    case_detail = {}
    case_decision = {}
    case_notes = {}
    case_timeline = {}
    if case_id:
        requests.post(
            f"{BASE_URL}/api/audit-cases/{case_id}/notes",
            headers=headers,
            json={"content": "v050 note", "note_type": "comment"},
            timeout=8,
        )
        requests.post(
            f"{BASE_URL}/api/audit-cases/{case_id}/actions",
            headers=headers,
            json={"action": "watch", "reason": "v050"},
            timeout=8,
        )
        case_detail = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}", headers=headers, timeout=8).json()
        case_decision = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}/decision", headers=headers, timeout=8).json()
        case_notes = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}/notes?limit=10", headers=headers, timeout=8).json()
        case_timeline = requests.get(f"{BASE_URL}/api/audit-cases/{case_id}/timeline?limit=10", headers=headers, timeout=8).json()

    # 5) source data for lifecycle export
    lifecycle_data = {}
    strategy_timeline = {}
    strategy_id = None
    backtests = requests.get(f"{BASE_URL}/api/backtests/list?page=1&pageSize=1", timeout=8)
    if backtests.status_code == 200:
        rows = (backtests.json() or {}).get("rows") or []
        if rows:
            strategy_id = rows[0].get("id")
    if strategy_id:
        lifecycle_data = requests.get(f"{BASE_URL}/api/backtests/{strategy_id}/lifecycle", timeout=8).json()
        strategy_timeline = requests.get(f"{BASE_URL}/api/backtests/{strategy_id}/timeline?limit=10", timeout=8).json()

    result["steps"]["dataReady"] = {
        "ok": bool(review_data) and bool(case_detail),
        "hasStrategy": bool(strategy_id),
        "caseId": case_id,
        "intakeId": intake_id,
    }

    generated_at = now_iso()

    # account review markdown
    review_md = [
        "# Export Review",
        "",
        f"- Generated at: {generated_at}",
        "",
        "## Object",
        f"- Source Type: {(review_data.get('sourceInfo') or {}).get('sourceType', '--')}",
        f"- Source Ref ID: {(review_data.get('sourceInfo') or {}).get('sourceRefId', '--')}",
        "",
        "## Current Status / Decision",
        f"- Source Status: {(review_data.get('sourceInfo') or {}).get('status', '--')}",
        "",
        "## Summary Metrics",
        f"- Total Trades: {(review_data.get('metricsSummary') or {}).get('totalTrades', '--')}",
        f"- Win Rate: {(review_data.get('metricsSummary') or {}).get('winRate', '--')}",
        "",
        "## Latest Action / Note",
        f"- Latest Note: {(((review_timeline.get('items') or [])[:1] or [{}])[0]).get('description', '--')}",
        "",
        "## Timeline (Recent)",
    ]
    for item in (review_timeline.get("items") or [])[:10]:
        review_md.append(f"- [{item.get('created_at', '--')}] {item.get('title', '--')} | {item.get('description', '')}")

    review_path = OUT_DIR / "account-audit-review-sample.md"
    write_md(review_path, review_md)

    # audit case markdown
    latest_note = ((case_notes.get("items") or [])[:1] or [{}])[0]
    case_md = [
        "# Export Case",
        "",
        f"- Generated at: {generated_at}",
        "",
        "## Object",
        f"- Case ID: {case_detail.get('id', '--')}",
        f"- Type: {case_detail.get('case_type', '--')}",
        f"- Ref ID: {case_detail.get('ref_id', '--')}",
        "",
        "## Current Status / Decision",
        f"- Case Status: {case_detail.get('status', '--')}",
        f"- Latest Decision: {case_decision.get('action', '--')}",
        "",
        "## Summary Metrics",
        f"- Notes Count: {case_notes.get('count', 0)}",
        f"- Timeline Events: {len(case_timeline.get('items') or [])}",
        "",
        "## Latest Action / Note",
        f"- Latest Action: {case_decision.get('action', '--')}",
        f"- Latest Note: {latest_note.get('content', '--')}",
        "",
        "## Timeline (Recent)",
    ]
    for item in (case_timeline.get("items") or [])[:10]:
        case_md.append(f"- [{item.get('created_at', '--')}] {item.get('title', '--')} | {item.get('description', '')}")

    case_path = OUT_DIR / "audit-case-sample.md"
    write_md(case_path, case_md)

    # lifecycle markdown
    lifecycle_md = [
        "# Export Lifecycle",
        "",
        f"- Generated at: {generated_at}",
        "",
        "## Object",
        f"- Strategy ID: {lifecycle_data.get('strategyId', '--')}",
        f"- Strategy Name: {lifecycle_data.get('strategyName', '--')}",
        "",
        "## Current Status / Decision",
        f"- Candidate: {(lifecycle_data.get('candidate') or {}).get('isCandidate', '--')}",
        f"- Latest Run Status: {(lifecycle_data.get('latestForwardRun') or {}).get('status', '--')}",
        "",
        "## Summary Metrics",
        f"- Backtest Final Score: {(lifecycle_data.get('backtest') or {}).get('finalScore', '--')}",
        f"- Forward Total Trades: {(lifecycle_data.get('latestSummary') or {}).get('totalTrades', '--')}",
        "",
        "## Latest Action / Note",
        f"- Run Note: {(lifecycle_data.get('latestForwardRun') or {}).get('note', '--')}",
        f"- Gate Notes: {(lifecycle_data.get('latestGateResult') or {}).get('notes', '--')}",
        "",
        "## Timeline (Recent)",
    ]
    if strategy_timeline.get("items"):
        for item in (strategy_timeline.get("items") or [])[:10]:
            lifecycle_md.append(f"- [{item.get('created_at', '--')}] {item.get('title', '--')} | {item.get('description', '')}")
    else:
        lifecycle_md.append("- (no timeline events)")

    lifecycle_path = OUT_DIR / "strategy-lifecycle-sample.md"
    write_md(lifecycle_path, lifecycle_md)

    result["files"] = {
        "review": str(review_path),
        "case": str(case_path),
        "lifecycle": str(lifecycle_path),
    }
    result["steps"]["markdownReadable"] = {
        "ok": all(path.exists() and path.stat().st_size > 120 for path in [review_path, case_path, lifecycle_path]),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
