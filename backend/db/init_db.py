import argparse
import csv
import logging
import sqlite3
from pathlib import Path

from db.sqlite import connection_scope, resolve_db_path

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


def import_backtests() -> int:
    if not BACKTESTS_CSV_PATH.exists():
        return 0

    with BACKTESTS_CSV_PATH.open('r', encoding='utf-8', newline='') as csv_file:
        rows = list(csv.DictReader(csv_file))

    with connection_scope() as connection:
        connection.execute('DELETE FROM backtests')
        for item in rows:
            connection.execute(
                '''
                INSERT INTO backtests (
                    id, name, symbol, timeframe,
                    returnPct, winRate, maxDrawdown, profitFactor,
                    score, decision
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    item.get('id', ''),
                    item.get('name', ''),
                    item.get('symbol', ''),
                    item.get('timeframe', ''),
                    float(item.get('returnPct', 0) or 0),
                    float(item.get('winRate', 0) or 0),
                    float(item.get('maxDrawdown', 0) or 0),
                    float(item.get('profitFactor', 0) or 0),
                    int(float(item.get('score', 0) or 0)),
                    item.get('decision', 'NEEDS_IMPROVEMENT'),
                ),
            )

    return len(rows)


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
