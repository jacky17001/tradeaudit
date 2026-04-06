from typing import Any

from db.sqlite import connection_scope


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_bool_or_none(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)


def _to_snapshot_dict(row: Any) -> dict[str, Any]:
    return {
        "id": _to_int(row["id"]),
        "entityType": row["entityType"],
        "entityId": row["entityId"],
        "finalScore": _to_int(row["finalScore"]),
        "decision": row["decision"],
        "explanation": row["explanation"],
        "evaluatedAt": row["evaluatedAt"],
        "rulesVersion": row["rulesVersion"],
        "datasetVersion": row["datasetVersion"],
        "confidenceLevel": row["confidenceLevel"],
        "sampleAdequacy": row["sampleAdequacy"],
        "dataSourceType": row["dataSourceType"],
    }


def fetch_latest_snapshot(entity_type: str, entity_id: str) -> dict[str, Any] | None:
    with connection_scope() as connection:
        row = connection.execute(
            """
            SELECT
                id, entityType, entityId,
                finalScore, decision, explanation,
                evaluatedAt, rulesVersion, datasetVersion,
                confidenceLevel, sampleAdequacy, dataSourceType
            FROM evaluation_snapshots
            WHERE entityType = ? AND entityId = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (entity_type, entity_id),
        ).fetchone()

    if row is None:
        return None
    return _to_snapshot_dict(row)


def insert_snapshot(entity_type: str, entity_id: str, evaluation: dict[str, Any]) -> None:
    with connection_scope() as connection:
        connection.execute(
            """
            INSERT INTO evaluation_snapshots (
                entityType, entityId,
                finalScore, decision, explanation,
                evaluatedAt, rulesVersion, datasetVersion,
                confidenceLevel, sampleAdequacy, dataSourceType
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_type,
                entity_id,
                _to_int(evaluation.get("finalScore"), 0),
                str(evaluation.get("decision", "UNKNOWN")),
                str(evaluation.get("explanation", "")),
                str(evaluation.get("evaluatedAt", "")),
                str(evaluation.get("rulesVersion", "unknown")),
                str(evaluation.get("datasetVersion", "unknown")),
                str(evaluation.get("confidenceLevel", "UNKNOWN")),
                str(evaluation.get("sampleAdequacy", "UNKNOWN")),
                str(evaluation.get("dataSourceType", "unknown")),
            ),
        )


def attach_previous_from_history(
    entity_type: str,
    entity_id: str,
    evaluation: dict[str, Any],
) -> dict[str, Any]:
    previous = fetch_latest_snapshot(entity_type, entity_id)

    previous_score = previous["finalScore"] if previous else None
    previous_decision = previous["decision"] if previous else None
    score_delta = (
        _to_int(evaluation.get("finalScore"), 0) - previous_score
        if previous_score is not None
        else None
    )
    decision_changed = (
        previous_decision != evaluation.get("decision")
        if previous_decision is not None
        else None
    )

    enriched = {
        **evaluation,
        "previousScore": previous_score,
        "scoreDelta": score_delta,
        "previousDecision": previous_decision,
        "decisionChanged": _to_bool_or_none(decision_changed),
    }

    insert_snapshot(entity_type, entity_id, enriched)
    return enriched


def get_evaluation_history(entity_type: str, entity_id: str, limit: int = 10) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 50))

    with connection_scope() as connection:
        rows = connection.execute(
            """
            SELECT
                id, entityType, entityId,
                finalScore, decision, explanation,
                evaluatedAt, rulesVersion, datasetVersion,
                confidenceLevel, sampleAdequacy, dataSourceType
            FROM evaluation_snapshots
            WHERE entityType = ? AND entityId = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (entity_type, entity_id, safe_limit),
        ).fetchall()

    return [_to_snapshot_dict(row) for row in rows]