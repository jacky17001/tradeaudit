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
    prepared_for_snapshot: list[tuple[str, dict[str, Any]]] = []

    with connection_scope() as connection:
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
                prepared_for_snapshot.append((normalized["id"], evaluated))
            except Exception:
                failed_count += 1

    for entity_id, evaluated in prepared_for_snapshot:
        try:
            attach_previous_from_history("backtests", entity_id, evaluated)
            snapshot_written_count += 1
        except Exception:
            failed_count += 1

    return {
        "mode": mode,
        "importedCount": imported_count,
        "skippedCount": skipped_count,
        "failedCount": failed_count,
        "invalidRowCount": invalid_row_count,
        "validationErrors": validation_errors,
        "reEvaluatedCount": reevaluated_count,
        "snapshotWrittenCount": snapshot_written_count,
    }


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