import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from pathlib import Path

from db.init_db import ensure_database_ready
from routes.api import api_bp
from services.config_safety_service import validate_runtime_config

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")

config_status = validate_runtime_config()
for warning in config_status.get("warningMessages", []):
    print(f"[CONFIG WARNING] {warning}")

# Auto-seed only when DB is missing or core tables are empty.
ensure_database_ready()

# CORS defaults to local frontend dev URL; production should set CORS_ORIGINS explicitly.
raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
if raw_origins.strip() == "*":
    cors_origins = "*"
else:
    cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not cors_origins:
        cors_origins = ["http://localhost:5173"]

CORS(app, origins=cors_origins)

app.register_blueprint(api_bp)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/dashboard.html")
def dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/account-audit.html")
def account_audit_page():
    return send_from_directory(FRONTEND_DIR, "account-audit.html")


@app.route("/backtests.html")
def backtests_page():
    return send_from_directory(FRONTEND_DIR, "backtests.html")


@app.route("/style.css")
def style_file():
    return send_from_directory(FRONTEND_DIR, "style.css")


@app.route("/app.js")
def app_script():
    return send_from_directory(FRONTEND_DIR, "app.js")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)