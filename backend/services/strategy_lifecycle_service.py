from typing import Any

from data_sources.backtest_candidates_repository import is_strategy_candidate
from data_sources.backtests_repository import get_backtest_row
from data_sources.forward_runs_repository import get_latest_forward_run_by_strategy
from data_sources.import_jobs_repository import get_import_job_by_id
from services.backtests_activate_service import get_active_dataset_info
from services.backtests_scoring_service import evaluate_backtest


def get_strategy_lifecycle(strategy_id: str) -> dict[str, Any]:
    clean_strategy_id = str(strategy_id or "").strip()
    if not clean_strategy_id:
        raise ValueError("strategyId is required")

    backtest_row = get_backtest_row(clean_strategy_id)
    if backtest_row is None:
        raise ValueError(f"Strategy {clean_strategy_id} does not exist in current active dataset")

    evaluated_backtest = evaluate_backtest({**backtest_row, "dataSourceType": "sqlite"})
    active_dataset_info = get_active_dataset_info()
    active_source_job_id = active_dataset_info.get("sourceJobId")
    source_job = (
        get_import_job_by_id(active_source_job_id)
        if isinstance(active_source_job_id, int)
        else None
    )
    latest_forward_run = get_latest_forward_run_by_strategy(clean_strategy_id)

    return {
        "strategyId": clean_strategy_id,
        "strategyName": backtest_row["name"],
        "backtest": {
            **evaluated_backtest,
            "id": backtest_row["id"],
            "name": backtest_row["name"],
            "symbol": backtest_row["symbol"],
            "timeframe": backtest_row["timeframe"],
            "returnPct": backtest_row["returnPct"],
            "winRate": backtest_row["winRate"],
            "maxDrawdown": backtest_row["maxDrawdown"],
            "profitFactor": backtest_row["profitFactor"],
            "tradeCount": backtest_row["tradeCount"],
            "rawScore": backtest_row["score"],
            "rawDecision": backtest_row["decision"],
            "isInActiveDataset": True,
        },
        "candidate": {
            "isCandidate": is_strategy_candidate(clean_strategy_id),
        },
        "sourceJobId": active_source_job_id if isinstance(active_source_job_id, int) else None,
        "sourceJob": source_job,
        "latestForwardRun": latest_forward_run,
        "latestSummary": latest_forward_run.get("summary") if latest_forward_run else None,
        "latestGateResult": latest_forward_run.get("gateResult") if latest_forward_run else None,
    }