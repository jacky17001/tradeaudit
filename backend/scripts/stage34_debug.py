#!/usr/bin/env python3
"""Debug Stage 34 endpoints"""
import requests
import json

BASE_URL = "http://127.0.0.1:5000"

# Login
print("1. Logging in...")
resp = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"password": "admin"},
    timeout=5
)
token = resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Token: {token[:20]}...\n")

# Create case
print("2. Creating case...")
resp = requests.post(
    f"{BASE_URL}/api/audit-cases",
    headers=headers,
    json={
        "case_type": "strategy",
        "ref_id": 1,
        "priority": "high",
        "note": "Debug test"
    },
    timeout=5
)
case_id = resp.json()["id"]
print(f"Case ID: {case_id}\n")

# Try adding note
print(f"3. Adding note to case {case_id}...")
resp = requests.post(
    f"{BASE_URL}/api/audit-cases/{case_id}/notes",
    headers=headers,
    json={
        "content": "Test note",
        "note_type": "comment"
    },
    timeout=5
)
print(f"Status: {resp.status_code}")
print(f"Response: {json.dumps(resp.json(), indent=2)}\n")

# Try getting notes
print(f"4. Getting notes for case {case_id}...")
resp = requests.get(
    f"{BASE_URL}/api/audit-cases/{case_id}/notes",
    headers=headers,
    timeout=5
)
print(f"Status: {resp.status_code}")
print(f"Response: {json.dumps(resp.json(), indent=2)}\n")

# Try taking action
print(f"5. Taking action on case {case_id}...")
resp = requests.post(
    f"{BASE_URL}/api/audit-cases/{case_id}/actions",
    headers=headers,
    json={
        "action": "watch",
        "reason": "Need more info"
    },
    timeout=5
)
print(f"Status: {resp.status_code}")
print(f"Response: {json.dumps(resp.json(), indent=2)}\n")
