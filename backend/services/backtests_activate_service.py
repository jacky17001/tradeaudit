from datetime import datetime, timezone
from typing import Any

from data_sources.job_snapshots_repository import (
    get_job_snapshot_rows,
    has_job_snapshot,
    insert_activation,
)
from db.sqlite import connection_scope


def activate_import_job(job_id: int) -> dict[str, Any]:
    """Replace the current backtests dataset with the snapshot from a historical import job.

    Raises ValueError if no snapshot exists for the given job.
    """
    if not has_job_snapshot(job_id):
        raise ValueError(
            f"No snapshot data found for import job {job_id}. "
            "Only jobs imported after Stage 19 have restorable snapshots."
        )

    # Snapshot current active source before activation for audit diff summary.
    current_active_info = get_active_dataset_info()
    compared_from_job_id = current_active_info.get("sourceJobId")

    rows = get_job_snapshot_rows(job_id)
    if not rows:
        raise ValueError(f"Snapshot for job {job_id} is empty.")

    activation_diff_summary: dict[str, Any] | None = None
    if isinstance(compared_from_job_id, int):
        activation_diff_summary = {
            "compared_from_job_id": compared_from_job_id,
            "compared_to_job_id": job_id,
            "newStrategiesCount": None,
            "removedStrategiesCount": None,
            "changedStrategiesCount": None,
            "decisionChangedCount": None,
            "decisionUpgradeCount": None,
            "decisionDowngradeCount": None,
            "biggestScoreIncrease": None,
            "biggestScoreDecrease": None,
        }

        if compared_from_job_id != job_id:
            try:
                from services.import_jobs_compare_service import compare_import_jobs

                compare_result = compare_import_jobs(compared_from_job_id, job_id)
                activation_diff_summary.update({
                    "newStrategiesCount": compare_result.get("newStrategiesCount"),
                    "removedStrategiesCount": compare_result.get("removedStrategiesCount"),
                    "changedStrategiesCount": compare_result.get("changedStrategiesCount"),
                    "decisionChangedCount": compare_result.get("decisionChangedCount"),
                    "decisionUpgradeCount": compare_result.get("decisionUpgradeCount"),
                    "decisionDowngradeCount": compare_result.get("decisionDowngradeCount"),
                    "biggestScoreIncrease": compare_result.get("biggestScoreIncrease"),
                    "biggestScoreDecrease": compare_result.get("biggestScoreDecrease"),
                })
            except Exception:
                # Keep activation stable even when compare summary cannot be generated.
                pass

    with connection_scope() as connection:
        connection.execute("DELETE FROM backtests")
        connection.executemany(
            """
            INSERT INTO backtests (
                id, name, symbol, timeframe,
                returnPct, winRate, maxDrawdown, profitFactor,
                tradeCount, score, decision
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["strategy_id"],
                    row["strategy_name"],
                    row["symbol"],
                    row["timeframe"],
                    row["return_pct"],
                    row["win_rate"],
                    row["max_drawdown"],
                    row["profit_factor"],
                    row["trade_count"],
                    row["score"],
                    row["decision"],
                )
                for row in rows
            ],
        )

    activated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    insert_activation(
        job_id,
        len(rows),
        activated_at,
        activation_diff_summary=activation_diff_summary,
    )

    return {
        "ok": True,
        "jobId": job_id,
        "activatedAt": activated_at,
        "strategiesCount": len(rows),
        "activationDiffSummary": activation_diff_summary,
        "message": f"Activated {len(rows)} strategies from import job {job_id}",
    }


def get_active_dataset_info() -> dict[str, Any]:
    """Return metadata about the currently active backtests dataset."""
    from data_sources.job_snapshots_repository import get_latest_activation

    activation = get_latest_activation()

    with connection_scope() as connection:
        latest_import_row = connection.execute(
            """
            SELECT id, triggeredAt, importedCount, sourcePath, mode
            FROM import_jobs
            WHERE status = 'success'
            ORDER BY id DESC
            LIMIT 1
            """,
        ).fetchone()

    if activation is None and latest_import_row is None:
        return {"sourceJobId": None}

    use_activation = False
    if activation is not None and latest_import_row is not None:
        # ISO 8601 strings are safely comparable lexicographically
        use_activation = activation["activated_at"] >= str(latest_import_row["triggeredAt"])
    elif activation is not None:
        use_activation = True

    if use_activation:
        with connection_scope() as connection:
            src = connection.execute(
                "SELECT id, triggeredAt, importedCount, sourcePath, mode FROM import_jobs WHERE id = ?",
                (activation["source_import_job_id"],),
            ).fetchone()

        return {
            "sourceJobId": activation["source_import_job_id"],
            "activatedAt": activation["activated_at"],
            "strategiesCount": activation["strategies_count"],
            "sourcePath": str(src["sourcePath"]) if src else "--",
            "mode": str(src["mode"]) if src else "--",
            "triggeredAt": str(src["triggeredAt"]) if src else None,
            "isActivation": True,
        }
    else:
        r = latest_import_row
        return {
            "sourceJobId": int(r["id"]),
            "activatedAt": str(r["triggeredAt"]),
            "strategiesCount": int(r["importedCount"] or 0),
            "sourcePath": str(r["sourcePath"] or ""),
            "mode": str(r["mode"] or ""),
            "triggeredAt": str(r["triggeredAt"]),
            "isActivation": False,
        }
