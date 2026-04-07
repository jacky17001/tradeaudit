"""Stage 28 smoke test: account audit intake supports manual and upload paths."""

import os
import sys
import tempfile
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    tmp_dir = tempfile.mkdtemp(prefix="tradeaudit_stage28_")
    db_path = Path(tmp_dir) / "stage28.db"
    os.environ["TRADEAUDIT_DB_PATH"] = str(db_path)

    from db.init_db import init_schema
    from services.account_audit_intake_service import (
        create_account_audit_manual_intake,
        create_account_audit_upload_intake,
        list_account_audit_intake_jobs,
    )

    init_schema()

    manual_job = create_account_audit_manual_intake(
        {
            "sourceType": "MANUAL",
            "manualText": "ticket,pnl\n1,12.4\n2,-3.5\n",
            "note": "mobile copy",
        }
    )
    assert manual_job["sourceType"] == "MANUAL"
    assert manual_job["intakeMethod"] == "MANUAL"
    assert manual_job["detectedRows"] == 3

    upload_path = Path(tmp_dir) / "statement.csv"
    upload_path.write_text("ticket,pnl\n10,8.5\n11,-1.2\n", encoding="utf-8")
    upload_job = create_account_audit_upload_intake(
        source_type="STATEMENT",
        file_path=str(upload_path),
        original_filename="statement.csv",
        note="stage28 upload",
    )
    assert upload_job["sourceType"] == "STATEMENT"
    assert upload_job["intakeMethod"] == "UPLOAD"
    assert upload_job["detectedRows"] == 3

    jobs = list_account_audit_intake_jobs(5)
    assert len(jobs) == 2
    assert jobs[0]["id"] == upload_job["id"]
    assert jobs[1]["id"] == manual_job["id"]

    print("ALL ASSERTIONS PASSED - Stage 28 smoke OK")


if __name__ == "__main__":
    main()