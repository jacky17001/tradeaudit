# TradeAudit V1

TradeAudit is an AI trading system and investor account audit platform.

## Core Modules
- Dashboard
- Strategy Lab
- Backtest Center
- Forward / Gate Report
- Investor Account Audit
- Calendar

## Goal
Help traders audit strategies and real trading accounts before moving to the next stage.

## Backend SQLite (Maintenance)
- Database file: `backend/db/tradeaudit.db`
- Full seed/init: `python -m db.init_db`
- Seed one table only:
	- `python -m db.init_db --table backtests`
	- `python -m db.init_db --table account_audit`
	- `python -m db.init_db --table forward_gate`
- Optional custom DB path (for tests or local variants): set `TRADEAUDIT_DB_PATH`

### Auto Init Behavior
- Flask startup performs a lightweight readiness check.
- If DB file is missing: schema + all core tables are seeded.
- If DB exists but core tables are empty/missing: only those tables are seeded.
- Existing non-empty tables are not overwritten by auto-init.

## Deployment (Vercel + Render)

### Recommended Boundary
- Frontend deploy target: `frontend-react/` on Vercel
- Backend deploy target: `backend/` on Render

### Frontend (Vercel)
- Root Directory: `frontend-react`
- Build Command: `npm run build`
- Output Directory: `dist`
- SPA rewrites: already configured in `frontend-react/vercel.json`

Set Vercel environment variables:
- `VITE_USE_MOCK_API=false`
- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`

Local frontend env (already in use):
- `frontend-react/.env.local`
	- `VITE_USE_MOCK_API=false`
	- `VITE_API_BASE_URL=http://127.0.0.1:5000`

### Backend (Render)
- Blueprint file: `render.yaml`
- Service root: `backend`
- Start command: `gunicorn app:app`
- Runtime deps: `backend/requirements.txt`

Set Render environment variables:
- `CORS_ORIGINS=https://<your-vercel-domain>.vercel.app`
	- Multiple origins: comma-separated values
- `TRADEAUDIT_DB_PATH=/var/data/tradeaudit.db`
	- For persistent disk usage on Render

### SQLite Handling in Current Stage
- DB file default: `backend/db/tradeaudit.db`
- In production, prefer persistent path via `TRADEAUDIT_DB_PATH`
- App startup runs a safe readiness check to seed missing/empty core tables only

### Post-Deploy API Checklist
Verify these endpoints from browser/curl/Postman:
- `/api/health`
- `/api/dashboard/summary`
- `/api/account-audit/summary`
- `/api/backtests/list?page=1&pageSize=10`
- `/api/forward-gate/summary`