import json
import sqlite3
import urllib.request
from pathlib import Path


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    db = Path("db/tradeaudit.db")
    connection = sqlite3.connect(db)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    backtests_rows = [
        dict(row)
        for row in cursor.execute(
            """
            SELECT id, name, tradeCount, winRate, maxDrawdown, profitFactor
            FROM backtests
            ORDER BY id
            """
        ).fetchall()
    ]

    snapshot_count = cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM evaluation_snapshots
        WHERE entityType = 'backtests'
          AND entityId IN ('smk-ok-001', 'smk-ok-002')
        """
    ).fetchone()["total"]

    latest_job = dict(
        cursor.execute(
            """
            SELECT
                id, sourcePath, status,
                importedCount, skippedCount, failedCount, invalidRowCount,
                reEvaluatedCount, snapshotWrittenCount, errorMessage
            FROM import_jobs
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
    )

    connection.close()

    dashboard = fetch_json("http://127.0.0.1:5001/api/dashboard/summary")
    history = fetch_json(
        "http://127.0.0.1:5001/api/evaluations/history?entityType=backtests&entityId=smk-ok-001&limit=5"
    )

    result = {
        "backtestsRows": backtests_rows,
        "snapshotCountForImportedIds": snapshot_count,
        "latestImportJob": latest_job,
        "dashboardHasExpectedKeys": sorted(list(dashboard.keys())),
        "historyItemCountForSmkOk001": len(history.get("items", [])),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
