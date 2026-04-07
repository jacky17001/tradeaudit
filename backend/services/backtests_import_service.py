import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from data_sources.evaluation_snapshots_repository import attach_previous_from_history
from db.sqlite import connection_scope
from services.backtests_scoring_service import evaluate_backtest


REQUIRED_FIELDS = (
    "id",
    "name",
    "symbol",
    "timeframe",
    "returnPct",
    "winRate",
    "maxDrawdown",
    "profitFactor",
    "tradeCount",
)
VALIDATION_ERRORS_LIMIT = 10


def _to_float(value: Any) -> float:
    return float(value)


def _to_int(value: Any) -> int:
    return int(float(value))


def _validate_and_normalize_row(
    raw: dict[str, Any],
    row_number: int,
) -> tuple[dict[str, Any] | None, str | None]:
    missing_fields = [field for field in REQUIRED_FIELDS if str(raw.get(field, "") or "").strip() == ""]
    if missing_fields:
        return None, f"row {row_number}: missing required fields: {', '.join(missing_fields)}"

    normalized_text = {
        "id": str(raw.get("id", "") or "").strip(),
        "name": str(raw.get("name", "") or "").strip(),
        "symbol": str(raw.get("symbol", "") or "").strip(),
        "timeframe": str(raw.get("timeframe", "") or "").strip(),
    }
    if not normalized_text["id"]:
        return None, f"row {row_number}: id must not be empty"

    try:
        return_pct = _to_float(raw.get("returnPct", 0))
        win_rate = _to_float(raw.get("winRate", 0))
        max_drawdown = _to_float(raw.get("maxDrawdown", 0))
        profit_factor = _to_float(raw.get("profitFactor", 0))
        trade_count = _to_int(raw.get("tradeCount", 0) or 0)
    except (TypeError, ValueError):
        return None, f"row {row_number}: numeric fields are not parseable"

    if trade_count < 0:
        return None, f"row {row_number}: tradeCount must be >= 0"
    if max_drawdown < 0:
        return None, f"row {row_number}: maxDrawdown must be >= 0"
    if profit_factor < 0:
        return None, f"row {row_number}: profitFactor must be >= 0"
    if win_rate < 0 or win_rate > 100:
        return None, f"row {row_number}: winRate must be between 0 and 100"

    return {
        **normalized_text,
        "returnPct": return_pct,
        "winRate": win_rate,
        "maxDrawdown": max_drawdown,
        "profitFactor": profit_factor,
        "tradeCount": trade_count,
    }, None


def import_backtests_rows(
    rows: list[dict[str, Any]],
    *,
    mode: str = "replace",
    source_type: str = "import-csv",
) -> dict[str, Any]:
    if mode != "replace":
        raise ValueError("Only 'replace' import mode is supported in v0.2.0")

    imported_count = 0
    skipped_count = 0
    failed_count = 0
    invalid_row_count = 0
    reevaluated_count = 0
    snapshot_written_count = 0
    validation_errors: list[str] = []

    batch_tag = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    prepared_for_snapshot: list[tuple[str, str, dict[str, Any]]] = []  # (id, name, evaluated)
    snapshot_rows_buffer: list[dict[str, Any]] = []
    with connection_scope() as connection:
        before_rows = connection.execute(
            "SELECT id, name, score, decision FROM backtests"
        ).fetchall()
        before_map: dict[str, dict[str, Any]] = {
            str(r["id"]): {"name": str(r["name"]), "score": int(r["score"] or 0), "decision": str(r["decision"] or "")}
            for r in before_rows
        }

        connection.execute("DELETE FROM backtests")

        for index, raw in enumerate(rows, start=2):
            normalized, validation_error = _validate_and_normalize_row(raw, index)
            if normalized is None:
                skipped_count += 1
                invalid_row_count += 1
                if validation_error and len(validation_errors) < VALIDATION_ERRORS_LIMIT:
                    validation_errors.append(validation_error)
                continue

            try:
                evaluated = evaluate_backtest(
                    {
                        **normalized,
                        "dataSourceType": source_type,
                        "datasetVersion": f"{source_type}:{batch_tag}:{normalized['id']}",
                    }
                )

                connection.execute(
                    """
                    INSERT OR REPLACE INTO backtests (
                        id, name, symbol, timeframe,
                        returnPct, winRate, maxDrawdown, profitFactor,
                        tradeCount, score, decision
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        normalized["id"],
                        normalized["name"],
                        normalized["symbol"],
                        normalized["timeframe"],
                        normalized["returnPct"],
                        normalized["winRate"],
                        normalized["maxDrawdown"],
                        normalized["profitFactor"],
                        normalized["tradeCount"],
                        int(evaluated["finalScore"]),
                        str(evaluated["decision"]),
                    ),
                )

                imported_count += 1
                reevaluated_count += 1
                prepared_for_snapshot.append((normalized["id"], normalized["name"], evaluated))
                snapshot_rows_buffer.append({
                    "strategy_id": normalized["id"],
                    "strategy_name": normalized["name"],
                    "symbol": normalized["symbol"],
                    "timeframe": normalized["timeframe"],
                    "return_pct": normalized["returnPct"],
                    "win_rate": normalized["winRate"],
                    "max_drawdown": normalized["maxDrawdown"],
                    "profit_factor": normalized["profitFactor"],
                    "trade_count": normalized["tradeCount"],
                    "score": int(evaluated["finalScore"]),
                    "decision": str(evaluated["decision"]),
                })
            except Exception:
                failed_count += 1

    for entity_id, _name, evaluated in prepared_for_snapshot:
        try:
            attach_previous_from_history("backtests", entity_id, evaluated)
            snapshot_written_count += 1
        except Exception:
            failed_count += 1

    after_map: dict[str, dict[str, Any]] = {
        entity_id: {
            "name": name,
            "score": int(evaluated.get("finalScore", 0)),
            "decision": str(evaluated.get("decision", "")),
        }
        for entity_id, name, evaluated in prepared_for_snapshot
    }

    changes_summary = _compute_changes_summary(before_map, after_map)
    change_items = _build_change_items(before_map, after_map)

    return {
        "mode": mode,
        "importedCount": imported_count,
        "skippedCount": skipped_count,
        "failedCount": failed_count,
        "invalidRowCount": invalid_row_count,
        "validationErrors": validation_errors,
        "reEvaluatedCount": reevaluated_count,
        "snapshotWrittenCount": snapshot_written_count,
        "changesSummary": changes_summary,
        "changeItems": change_items,
        "snapshotRows": snapshot_rows_buffer,
    }


_DECISION_CHANGES_LIMIT = 3


def _compute_changes_summary(
    before_map: dict[str, dict[str, Any]],
    after_map: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    before_ids = set(before_map.keys())
    after_ids = set(after_map.keys())
    common_ids = before_ids & after_ids

    new_count = len(after_ids - before_ids)
    removed_count = len(before_ids - after_ids)

    changed_count = 0
    decision_changed_count = 0
    decision_changes: list[dict[str, Any]] = []
    score_deltas: list[dict[str, Any]] = []

    for id_ in sorted(common_ids):
        b = before_map[id_]
        a = after_map[id_]
        score_changed = b["score"] != a["score"]
        decision_changed = b["decision"] != a["decision"]

        if score_changed or decision_changed:
            changed_count += 1

        if decision_changed:
            decision_changed_count += 1
            if len(decision_changes) < _DECISION_CHANGES_LIMIT:
                decision_changes.append({
                    "id": id_,
                    "name": a["name"] or id_,
                    "oldDecision": b["decision"],
                    "newDecision": a["decision"],
                })

        if score_changed:
            score_deltas.append({
                "id": id_,
                "name": a["name"] or id_,
                "delta": a["score"] - b["score"],
            })

    score_deltas.sort(key=lambda x: x["delta"])
    biggest_decrease = score_deltas[0] if score_deltas else None
    biggest_increase = score_deltas[-1] if score_deltas else None

    return {
        "totalStrategiesBefore": len(before_ids),
        "totalStrategiesAfter": len(after_ids),
        "newStrategiesCount": new_count,
        "removedStrategiesCount": removed_count,
        "changedStrategiesCount": changed_count,
        "decisionChangedCount": decision_changed_count,
        "decisionChanges": decision_changes,
        "biggestScoreIncrease": biggest_increase,
        "biggestScoreDecrease": biggest_decrease,
    }


def _build_change_items(
    before_map: dict[str, dict[str, Any]],
    after_map: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build per-strategy change items for persistence.

    Rules:
    - after has it, before does not  => NEW
    - before has it, after does not  => REMOVED
    - both have it, score or decision differs => UPDATED
    - unchanged strategies are omitted
    """
    items: list[dict[str, Any]] = []
    before_ids = set(before_map.keys())
    after_ids = set(after_map.keys())

    for id_ in sorted(after_ids - before_ids):
        a = after_map[id_]
        items.append({
            "strategy_id": id_,
            "strategy_name": a["name"] or id_,
            "change_type": "NEW",
            "before_score": None,
            "after_score": int(a["score"]),
            "score_delta": None,
            "before_decision": None,
            "after_decision": str(a["decision"]),
        })

    for id_ in sorted(before_ids - after_ids):
        b = before_map[id_]
        items.append({
            "strategy_id": id_,
            "strategy_name": b["name"] or id_,
            "change_type": "REMOVED",
            "before_score": int(b["score"]),
            "after_score": None,
            "score_delta": None,
            "before_decision": str(b["decision"]),
            "after_decision": None,
        })

    for id_ in sorted(before_ids & after_ids):
        b = before_map[id_]
        a = after_map[id_]
        if b["score"] != a["score"] or b["decision"] != a["decision"]:
            items.append({
                "strategy_id": id_,
                "strategy_name": a["name"] or id_,
                "change_type": "UPDATED",
                "before_score": int(b["score"]),
                "after_score": int(a["score"]),
                "score_delta": int(a["score"]) - int(b["score"]),
                "before_decision": str(b["decision"]),
                "after_decision": str(a["decision"]),
            })

    return items


def import_backtests_csv(
    csv_path: str | Path,
    *,
    mode: str = "replace",
    source_type: str = "import-csv",
) -> dict[str, Any]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file does not exist: {path}")

    with path.open("r", encoding="utf-8", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))

    return import_backtests_rows(rows, mode=mode, source_type=source_type)