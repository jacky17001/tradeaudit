from typing import Any

from data_sources.import_jobs_repository import get_import_job_by_id
from data_sources.job_snapshots_repository import get_job_snapshot_rows


_DECISION_RANK = {
    "REJECT": 0,
    "FAIL": 1,
    "NEEDS_IMPROVEMENT": 2,
    "PROMISING": 3,
    "PASS": 4,
}


def _decision_rank(decision: str | None) -> int:
    if not decision:
        return -1
    return _DECISION_RANK.get(str(decision).upper(), 1)


def _build_snapshot_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(row["strategy_id"]): {
            "id": str(row["strategy_id"]),
            "name": str(row["strategy_name"]),
            "score": int(row["score"]),
            "decision": str(row["decision"]),
        }
        for row in rows
    }


def _decision_distribution(snapshot_map: dict[str, dict[str, Any]]) -> dict[str, int]:
    # Keep stable keys while still supporting any new decision values.
    distribution: dict[str, int] = {
        "PASS": 0,
        "PROMISING": 0,
        "NEEDS_IMPROVEMENT": 0,
        "REJECT": 0,
        "FAIL": 0,
    }
    for item in snapshot_map.values():
        key = str(item["decision"] or "").upper()
        if key not in distribution:
            distribution[key] = 0
        distribution[key] += 1
    return distribution


def _job_meta(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "jobId": int(job["id"]),
        "createdAt": job["triggeredAt"],
        "source": job["sourcePath"],
        "mode": job["mode"],
        "status": job["status"],
        "importSummary": {
            "importedCount": int(job["importedCount"]),
            "skippedCount": int(job["skippedCount"]),
            "failedCount": int(job["failedCount"]),
            "invalidRowCount": int(job["invalidRowCount"]),
            "snapshotWrittenCount": int(job["snapshotWrittenCount"]),
            "reEvaluatedCount": int(job["reEvaluatedCount"]),
        },
    }


def compare_import_jobs(left_job_id: int, right_job_id: int) -> dict[str, Any]:
    if left_job_id == right_job_id:
        raise ValueError("leftJobId and rightJobId must be different")

    left_job = get_import_job_by_id(left_job_id)
    right_job = get_import_job_by_id(right_job_id)
    if left_job is None or right_job is None:
        raise ValueError("One or both import jobs do not exist")

    left_rows = get_job_snapshot_rows(left_job_id)
    right_rows = get_job_snapshot_rows(right_job_id)
    if not left_rows or not right_rows:
        raise ValueError(
            "One or both jobs have no snapshot rows. Compare is available for jobs imported after Stage 19."
        )

    left_map = _build_snapshot_map(left_rows)
    right_map = _build_snapshot_map(right_rows)

    left_ids = set(left_map.keys())
    right_ids = set(right_map.keys())
    common_ids = left_ids & right_ids

    new_ids = sorted(right_ids - left_ids)
    removed_ids = sorted(left_ids - right_ids)

    changed_count = 0
    decision_changed_count = 0
    decision_upgrade_count = 0
    decision_downgrade_count = 0
    score_deltas: list[dict[str, Any]] = []
    top_changed: list[dict[str, Any]] = []

    for strategy_id in new_ids:
        r = right_map[strategy_id]
        top_changed.append({
            "strategyId": strategy_id,
            "strategyName": r["name"],
            "leftScore": None,
            "rightScore": r["score"],
            "delta": None,
            "leftDecision": None,
            "rightDecision": r["decision"],
            "changeType": "NEW",
        })

    for strategy_id in removed_ids:
        l = left_map[strategy_id]
        top_changed.append({
            "strategyId": strategy_id,
            "strategyName": l["name"],
            "leftScore": l["score"],
            "rightScore": None,
            "delta": None,
            "leftDecision": l["decision"],
            "rightDecision": None,
            "changeType": "REMOVED",
        })

    for strategy_id in sorted(common_ids):
        l = left_map[strategy_id]
        r = right_map[strategy_id]

        score_changed = l["score"] != r["score"]
        decision_changed = l["decision"] != r["decision"]

        if score_changed:
            score_deltas.append({
                "id": strategy_id,
                "name": r["name"] or l["name"] or strategy_id,
                "delta": r["score"] - l["score"],
            })

        if score_changed or decision_changed:
            changed_count += 1
            top_changed.append({
                "strategyId": strategy_id,
                "strategyName": r["name"] or l["name"] or strategy_id,
                "leftScore": l["score"],
                "rightScore": r["score"],
                "delta": r["score"] - l["score"],
                "leftDecision": l["decision"],
                "rightDecision": r["decision"],
                "changeType": "UPDATED",
            })

        if decision_changed:
            decision_changed_count += 1
            l_rank = _decision_rank(l["decision"])
            r_rank = _decision_rank(r["decision"])
            if r_rank > l_rank:
                decision_upgrade_count += 1
            elif r_rank < l_rank:
                decision_downgrade_count += 1

    score_deltas.sort(key=lambda item: item["delta"])
    biggest_decrease = score_deltas[0] if score_deltas else None
    biggest_increase = score_deltas[-1] if score_deltas else None

    top_changed.sort(
        key=lambda item: (
            0 if item["changeType"] == "UPDATED" else 1,
            abs(int(item["delta"] or 0)),
        ),
        reverse=True,
    )

    return {
        "leftJob": _job_meta(left_job),
        "rightJob": _job_meta(right_job),
        "totalStrategiesLeft": len(left_ids),
        "totalStrategiesRight": len(right_ids),
        "newStrategiesCount": len(new_ids),
        "removedStrategiesCount": len(removed_ids),
        "changedStrategiesCount": changed_count,
        "decisionChangedCount": decision_changed_count,
        "decisionUpgradeCount": decision_upgrade_count,
        "decisionDowngradeCount": decision_downgrade_count,
        "biggestScoreIncrease": biggest_increase,
        "biggestScoreDecrease": biggest_decrease,
        "decisionDistribution": {
            "left": _decision_distribution(left_map),
            "right": _decision_distribution(right_map),
        },
        "topChangedStrategies": top_changed[:20],
    }
