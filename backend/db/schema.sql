CREATE TABLE IF NOT EXISTS backtests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    returnPct REAL NOT NULL,
    winRate REAL NOT NULL,
    maxDrawdown REAL NOT NULL,
    profitFactor REAL NOT NULL,
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
