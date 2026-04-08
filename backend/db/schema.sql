CREATE TABLE IF NOT EXISTS backtests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    returnPct REAL NOT NULL,
    winRate REAL NOT NULL,
    maxDrawdown REAL NOT NULL,
    profitFactor REAL NOT NULL,
    tradeCount INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL,
    decision TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_audit (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    accountName TEXT NOT NULL,
    broker TEXT NOT NULL,
    balance INTEGER NOT NULL,
    equity INTEGER NOT NULL,
    riskScore INTEGER NOT NULL,
    maxDrawdown REAL NOT NULL,
    winRate INTEGER NOT NULL,
    profitFactor REAL NOT NULL,
    aiExplanation TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS forward_gate (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    strategyName TEXT NOT NULL,
    symbol TEXT NOT NULL,
    forwardStatus TEXT NOT NULL,
    gateDecision TEXT NOT NULL,
    lastUpdated TEXT NOT NULL,
    tradesObserved INTEGER NOT NULL,
    passRate INTEGER NOT NULL,
    maxDrawdown REAL NOT NULL,
    summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    finalScore INTEGER NOT NULL,
    decision TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evaluatedAt TEXT NOT NULL,
    rulesVersion TEXT NOT NULL,
    datasetVersion TEXT NOT NULL,
    confidenceLevel TEXT NOT NULL,
    sampleAdequacy TEXT NOT NULL,
    dataSourceType TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_snapshots_entity
ON evaluation_snapshots (entityType, entityId, id DESC);

CREATE TABLE IF NOT EXISTS import_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobType TEXT NOT NULL,
    triggeredAt TEXT NOT NULL,
    sourcePath TEXT NOT NULL,
    mode TEXT NOT NULL,
    importedCount INTEGER NOT NULL DEFAULT 0,
    skippedCount INTEGER NOT NULL DEFAULT 0,
    failedCount INTEGER NOT NULL DEFAULT 0,
    invalidRowCount INTEGER NOT NULL DEFAULT 0,
    reEvaluatedCount INTEGER NOT NULL DEFAULT 0,
    snapshotWrittenCount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    errorMessage TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_triggered_at
ON import_jobs (id DESC);

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

CREATE TABLE IF NOT EXISTS backtest_dataset_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_import_job_id INTEGER NOT NULL,
    activated_at TEXT NOT NULL,
    activated_by TEXT,
    note TEXT,
    activation_diff_summary TEXT,
    strategies_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS backtest_candidates (
    strategy_id TEXT PRIMARY KEY,
    marked_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS audit_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open',
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_cases_status_priority
ON audit_cases (status, priority, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_cases_case_type
ON audit_cases (case_type, ref_id);

CREATE TABLE IF NOT EXISTS review_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'comment',
    created_at TEXT NOT NULL,
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_review_notes_case_id
ON review_notes (case_id, id DESC);

CREATE TABLE IF NOT EXISTS review_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    previous_status TEXT,
    new_status TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_review_actions_case_id
ON review_actions (case_id, id DESC);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type TEXT NOT NULL,
    object_ref_id INTEGER NOT NULL,
    action_key TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    due_label TEXT NOT NULL DEFAULT 'later',
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_object
ON follow_up_tasks (object_type, object_ref_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_status_priority
ON follow_up_tasks (status, priority, id DESC);

CREATE TABLE IF NOT EXISTS report_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_ref_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_type_object
ON report_snapshots (snapshot_type, object_type, object_ref_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_created
ON report_snapshots (id DESC);
