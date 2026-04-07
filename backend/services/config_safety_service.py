"""Runtime config safety checks for deployment hardening."""

from __future__ import annotations

import os
from typing import Any

UNSAFE_PASSWORD_VALUES = {
    "",
    "admin",
    "123456",
    "password",
    "qwerty",
    "letmein",
}


def _normalized(value: str | None) -> str:
    return (value or "").strip().lower()


def _is_production_mode() -> bool:
    env = _normalized(os.environ.get("TRADEAUDIT_ENV") or os.environ.get("FLASK_ENV") or "")
    return env in {"prod", "production"}


def get_admin_password_status() -> dict[str, Any]:
    raw_password = os.environ.get("TRADEAUDIT_ADMIN_PASSWORD")
    configured = raw_password is not None and str(raw_password).strip() != ""
    normalized = _normalized(raw_password)
    unsafe = (not configured) or (normalized in UNSAFE_PASSWORD_VALUES)

    warnings: list[str] = []
    if not configured:
        warnings.append("Admin password is not configured")
    elif normalized in UNSAFE_PASSWORD_VALUES:
        warnings.append("Unsafe admin password")

    return {
        "configured": configured,
        "unsafe": unsafe,
        "warningMessages": warnings,
        "isProductionMode": _is_production_mode(),
    }


def validate_runtime_config() -> dict[str, Any]:
    status = get_admin_password_status()

    # In production mode, reject unsafe password configuration.
    if status["isProductionMode"] and status["unsafe"]:
        raise RuntimeError(
            "Unsafe configuration: TRADEAUDIT_ADMIN_PASSWORD must be configured "
            "and must not use common default values in production mode."
        )

    return status


def get_safe_config_status() -> dict[str, Any]:
    status = get_admin_password_status()
    return {
        "configurationWarning": status["unsafe"],
        "adminPasswordConfigured": status["configured"],
        "unsafeAdminPassword": status["unsafe"],
        "warningMessages": status["warningMessages"],
    }
