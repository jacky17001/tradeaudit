import argparse
import csv
import logging
import sqlite3
from pathlib import Path

from db.sqlite import connection_scope, resolve_db_path
from services.backtests_import_service import import_backtests_csv

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = BASE_DIR / 'db' / 'schema.sql'
BACKTESTS_CSV_PATH = BASE_DIR / 'data_sources' / 'backtests.csv'
ACCOUNT_AUDIT_CSV_PATH = BASE_DIR / 'data_sources' / 'account_audit.csv'
FORWARD_GATE_CSV_PATH = BASE_DIR / 'data_sources' / 'forward_gate.csv'
ALL_TABLES = ('backtests', 'account_audit', 'forward_gate')


def init_schema() -> None:
    with connection_scope() as connection:
        schema_sql = SCHEMA_PATH.read_text(encoding='utf-8')
        connection.executescript(schema_sql)

        # Lightweight migration for existing DBs created before tradeCount column was added.
        existing_columns = {
            row['name']
            for row in connection.execute('PRAGMA table_info(backtests)').fetchall()
        }
        if 'tradeCount' not in existing_columns:
            connection.execute(
                'ALTER TABLE backtests ADD COLUMN tradeCount INTEGER NOT NULL DEFAULT 0'
            )

        import_job_columns = {
            row['name']
            for row in connection.execute('PRAGMA table_info(import_jobs)').fetchall()
        }
        if import_job_columns and 'invalidRowCount' not in import_job_columns:
            connection.execute(
                'ALTER TABLE import_jobs ADD COLUMN invalidRowCount INTEGER NOT NULL DEFAULT 0'
            )

        # Migration: create backtest_change_items table if it doesn't exist yet.
        change_items_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='backtest_change_items'"
            ).fetchall()
        }
        if 'backtest_change_items' not in change_items_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS backtest_change_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    import_job_id INTEGER NOT NULL,
                    strategy_id TEXT NOT NULL,
                    strategy_name TEXT NOT NULL,
                    change_type TEXT NOT NULL,
                    before_score INTEGER,
                    after_score INTEGER,
                    score_delta INTEGER,
                    before_decision TEXT,
                    after_decision TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_change_items_job_id
                ON backtest_change_items (import_job_id);
                """
            )

        job_snapshots_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='backtest_job_snapshots'"
            ).fetchall()
        }
        if 'backtest_job_snapshots' not in job_snapshots_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS backtest_job_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    import_job_id INTEGER NOT NULL,
                    strategy_id TEXT NOT NULL,
                    strategy_name TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    return_pct REAL NOT NULL,
                    win_rate REAL NOT NULL,
                    max_drawdown REAL NOT NULL,
                    profit_factor REAL NOT NULL,
                    trade_count INTEGER NOT NULL DEFAULT 0,
                    score INTEGER NOT NULL,
                    decision TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_job_snapshots_job_id
                ON backtest_job_snapshots (import_job_id);
                """
            )

        activations_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='backtest_dataset_activations'"
            ).fetchall()
        }
        if 'backtest_dataset_activations' not in activations_tables:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS backtest_dataset_activations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_import_job_id INTEGER NOT NULL,
                    activated_at TEXT NOT NULL,
                    activated_by TEXT,
                    note TEXT,
                    activation_diff_summary TEXT,
                    strategies_count INTEGER NOT NULL DEFAULT 0
                )
                """
            )
        else:
            activation_columns = {
                row['name']
                for row in connection.execute('PRAGMA table_info(backtest_dataset_activations)').fetchall()
            }
            if 'activation_diff_summary' not in activation_columns:
                connection.execute(
                    'ALTER TABLE backtest_dataset_activations ADD COLUMN activation_diff_summary TEXT'
                )

        candidate_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='backtest_candidates'"
            ).fetchall()
        }
        if 'backtest_candidates' not in candidate_tables:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS backtest_candidates (
                    strategy_id TEXT PRIMARY KEY,
                    marked_at TEXT NOT NULL
                )
                """
            )

        forward_runs_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='forward_runs'"
            ).fetchall()
        }
        if 'forward_runs' not in forward_runs_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS forward_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    strategy_id TEXT NOT NULL,
                    strategy_name TEXT NOT NULL,
                    source_job_id INTEGER,
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    status TEXT NOT NULL,
                    note TEXT,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_forward_runs_status_created
                ON forward_runs (status, id DESC);
                """
            )

        forward_run_summaries_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='forward_run_summaries'"
            ).fetchall()
        }
        if 'forward_run_summaries' not in forward_run_summaries_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS forward_run_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    forward_run_id INTEGER NOT NULL UNIQUE,
                    total_trades INTEGER NOT NULL DEFAULT 0,
                    win_rate REAL NOT NULL DEFAULT 0,
                    pnl REAL NOT NULL DEFAULT 0,
                    max_drawdown REAL NOT NULL DEFAULT 0,
                    expectancy REAL NOT NULL DEFAULT 0,
                    period_start TEXT,
                    period_end TEXT,
                    last_updated_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_forward_run_summaries_run_id
                ON forward_run_summaries (forward_run_id);
                """
            )

        forward_run_gate_results_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='forward_run_gate_results'"
            ).fetchall()
        }
        if 'forward_run_gate_results' not in forward_run_gate_results_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS forward_run_gate_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    forward_run_id INTEGER NOT NULL UNIQUE,
                    gate_decision TEXT NOT NULL,
                    confidence TEXT,
                    hard_fail INTEGER NOT NULL DEFAULT 0,
                    sample_adequacy TEXT,
                    strongest_factor TEXT,
                    weakest_factor TEXT,
                    notes TEXT,
                    evaluated_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_forward_run_gate_results_run_id
                ON forward_run_gate_results (forward_run_id);
                CREATE INDEX IF NOT EXISTS idx_forward_run_gate_results_decision
                ON forward_run_gate_results (gate_decision, id DESC);
                """
            )

        account_audit_intake_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='account_audit_intake_jobs'"
            ).fetchall()
        }
        if 'account_audit_intake_jobs' not in account_audit_intake_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS account_audit_intake_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL,
                    intake_method TEXT NOT NULL,
                    source_label TEXT NOT NULL,
                    original_filename TEXT,
                    detected_rows INTEGER NOT NULL DEFAULT 0,
                    note TEXT,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_account_audit_intake_jobs_created_at
                ON account_audit_intake_jobs (id DESC);
                """
            )

        account_audit_mt5_connection_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='account_audit_mt5_connections'"
            ).fetchall()
        }
        if 'account_audit_mt5_connections' not in account_audit_mt5_connection_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS account_audit_mt5_connections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_number TEXT NOT NULL,
                    server TEXT NOT NULL,
                    connection_label TEXT NOT NULL,
                    status TEXT NOT NULL,
                    last_tested_at TEXT,
                    last_synced_at TEXT,
                    error_message TEXT,
                    account_name TEXT,
                    currency TEXT,
                    balance REAL,
                    equity REAL,
                    leverage INTEGER,
                    synced_trade_count INTEGER NOT NULL DEFAULT 0,
                    read_only INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_account_audit_mt5_connections_created_at
                ON account_audit_mt5_connections (id DESC);
                """
            )

        account_audit_mt5_trades_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='account_audit_mt5_trades'"
            ).fetchall()
        }
        if 'account_audit_mt5_trades' not in account_audit_mt5_trades_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS account_audit_mt5_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    ticket TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    order_type TEXT NOT NULL,
                    volume REAL NOT NULL,
                    open_time TEXT,
                    close_time TEXT,
                    profit REAL NOT NULL DEFAULT 0,
                    commission REAL NOT NULL DEFAULT 0,
                    swap REAL NOT NULL DEFAULT 0,
                    comment TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_account_audit_mt5_trades_connection_id
                ON account_audit_mt5_trades (connection_id, id DESC);
                """
            )

        account_audit_summaries_tables = {
            row['name']
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='account_audit_summaries'"
            ).fetchall()
        }
        if 'account_audit_summaries' not in account_audit_summaries_tables:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS account_audit_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL,
                    source_ref_id INTEGER NOT NULL,
                    account_label TEXT NOT NULL,
                    total_trades INTEGER,
                    win_rate REAL,
                    pnl REAL,
                    max_drawdown REAL,
                    profit_factor REAL,
                    expectancy REAL,
                    average_holding_time REAL,
                    period_start TEXT,
                    period_end TEXT,
                    last_computed_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_account_audit_summaries_source
                ON account_audit_summaries (source_type, source_ref_id);
                CREATE INDEX IF NOT EXISTS idx_account_audit_summaries_created_at
                ON account_audit_summaries (id DESC);
                """
            )


def import_backtests() -> int:
    if not BACKTESTS_CSV_PATH.exists():
        return 0

    result = import_backtests_csv(
        BACKTESTS_CSV_PATH,
        mode='replace',
        source_type='seed-csv',
    )
    return int(result['importedCount'])


def import_account_audit() -> int:
    if not ACCOUNT_AUDIT_CSV_PATH.exists():
        return 0

    with ACCOUNT_AUDIT_CSV_PATH.open('r', encoding='utf-8', newline='') as csv_file:
        first_row = next(csv.DictReader(csv_file), None)

    with connection_scope() as connection:
        connection.execute('DELETE FROM account_audit')

        if not first_row:
            return 0

        connection.execute(
            '''
            INSERT INTO account_audit (
                id, accountName, broker,
                balance, equity, riskScore,
                maxDrawdown, winRate, profitFactor,
                aiExplanation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                1,
                first_row.get('accountName', ''),
                first_row.get('broker', ''),
                int(float(first_row.get('balance', 0) or 0)),
                int(float(first_row.get('equity', 0) or 0)),
                int(float(first_row.get('riskScore', 0) or 0)),
                float(first_row.get('maxDrawdown', 0) or 0),
                int(float(first_row.get('winRate', 0) or 0)),
                float(first_row.get('profitFactor', 0) or 0),
                first_row.get('aiExplanation', ''),
            ),
        )

    return 1


def import_forward_gate() -> int:
    if not FORWARD_GATE_CSV_PATH.exists():
        return 0

    with FORWARD_GATE_CSV_PATH.open('r', encoding='utf-8', newline='') as csv_file:
        first_row = next(csv.DictReader(csv_file), None)

    with connection_scope() as connection:
        connection.execute('DELETE FROM forward_gate')

        if not first_row:
            return 0

        connection.execute(
            '''
            INSERT INTO forward_gate (
                id,
                strategyName, symbol,
                forwardStatus, gateDecision,
                lastUpdated,
                tradesObserved, passRate, maxDrawdown,
                summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                1,
                first_row.get('strategyName', ''),
                first_row.get('symbol', ''),
                first_row.get('forwardStatus', 'PENDING'),
                first_row.get('gateDecision', 'PENDING'),
                first_row.get('lastUpdated', ''),
                int(float(first_row.get('tradesObserved', 0) or 0)),
                int(float(first_row.get('passRate', 0) or 0)),
                float(first_row.get('maxDrawdown', 0) or 0),
                first_row.get('summary', ''),
            ),
        )

    return 1


def seed_tables(tables: list[str]) -> dict[str, int]:
    init_schema()

    imported: dict[str, int] = {}
    for table in tables:
        if table == 'backtests':
            imported[table] = import_backtests()
        elif table == 'account_audit':
            imported[table] = import_account_audit()
        elif table == 'forward_gate':
            imported[table] = import_forward_gate()
        else:
            raise ValueError(f'Unsupported table: {table}')

    return imported


def _row_count(table: str) -> int | None:
    try:
        with connection_scope() as connection:
            row = connection.execute(
                f'SELECT COUNT(*) AS total FROM {table}'
            ).fetchone()
            return int(row['total'])
    except sqlite3.Error as exc:
        logger.warning(
            'component=db_init table=%s reason=%s action=inspection_failed',
            table,
            exc,
        )
        return None


def ensure_database_ready() -> None:
    """
    Lightweight safe initializer:
    - If DB file is missing: initialize schema and seed all core tables.
    - If DB exists but any core table is missing/empty: seed only those tables.
    - Never overwrite non-empty tables during this check.
    """
    db_path = resolve_db_path()
    db_missing = not db_path.exists()

    init_schema()

    if db_missing:
        logger.info('component=db_init reason=db_missing action=seed_all')
        seed_tables(list(ALL_TABLES))
        return

    tables_to_seed: list[str] = []
    for table in ALL_TABLES:
        count = _row_count(table)
        if count is None or count == 0:
            tables_to_seed.append(table)

    if tables_to_seed:
        logger.info(
            'component=db_init reason=empty_or_missing_tables action=seed_tables tables=%s',
            ','.join(tables_to_seed),
        )
        seed_tables(tables_to_seed)


def main() -> None:
    parser = argparse.ArgumentParser(description='TradeAudit SQLite seed utility')
    parser.add_argument(
        '--table',
        choices=ALL_TABLES,
        help='Seed only one table; omit to seed all core tables',
    )
    args = parser.parse_args()

    selected_tables = [args.table] if args.table else list(ALL_TABLES)
    imported_counts = seed_tables(selected_tables)

    print(f'Initialized SQLite at: {resolve_db_path()}')
    for table in selected_tables:
        print(f'Imported {table} rows: {imported_counts[table]}')


if __name__ == '__main__':
    main()
