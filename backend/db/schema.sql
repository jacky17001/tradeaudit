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
