from __future__ import annotations

from typing import Any

from db.sqlite import connection_scope


def _event(
    event_type: str,
    object_type: str,
    object_ref_id: str | int,
    title: str,
    created_at: str,
    source_section: str,
    description: str = "",
    actor: str = "system",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "event_type": event_type,
        "object_type": object_type,
        "object_ref_id": object_ref_id,
        "title": title,
        "description": description,
        "actor": actor,
        "created_at": created_at,
        "metadata": metadata or {},
        "source_section": source_section,
    }


def _sort_and_limit(events: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    filtered = [item for item in events if item.get("created_at")]
    filtered.sort(key=lambda item: item["created_at"], reverse=True)
    return filtered[:limit]


def get_strategy_timeline(strategy_id: str, limit: int = 100) -> dict[str, Any]:
    clean_strategy_id = str(strategy_id or "").strip()
    if not clean_strategy_id:
        raise ValueError("strategyId is required")

    events: list[dict[str, Any]] = []

    with connection_scope() as db:
        imported_rows = db.execute(
            """
            SELECT c.import_job_id, c.change_type, c.before_score, c.after_score, c.created_at,
                   j.sourcePath AS source_path, j.mode
            FROM backtest_change_items c
            LEFT JOIN import_jobs j ON j.id = c.import_job_id
            WHERE c.strategy_id = ?
            ORDER BY c.id DESC
            LIMIT 200
            """,
            (clean_strategy_id,),
        ).fetchall()

        for row in imported_rows:
            events.append(
                _event(
                    event_type="imported",
                    object_type="strategy",
                    object_ref_id=clean_strategy_id,
                    title="imported",
                    description=f"job #{row['import_job_id']} ({(row['change_type'] or '').lower()})",
                    created_at=row["created_at"],
                    source_section="backtests",
                    metadata={
                        "import_job_id": row["import_job_id"],
                        "change_type": row["change_type"],
                        "source_path": row["source_path"],
                        "mode": row["mode"],
                        "before_score": row["before_score"],
                        "after_score": row["after_score"],
                    },
                )
            )

        candidate_row = db.execute(
            "SELECT strategy_id, marked_at FROM backtest_candidates WHERE strategy_id = ?",
            (clean_strategy_id,),
        ).fetchone()
        if candidate_row:
            events.append(
                _event(
                    event_type="candidate_marked",
                    object_type="strategy",
                    object_ref_id=clean_strategy_id,
                    title="candidate marked",
                    description="candidate set in active dataset",
                    created_at=candidate_row["marked_at"],
                    source_section="backtests",
                    metadata={"strategy_id": clean_strategy_id},
                )
            )

        run_rows = db.execute(
            """
            SELECT id, status, note, source_job_id, symbol, timeframe, created_at, updated_at, started_at, ended_at
            FROM forward_runs
            WHERE strategy_id = ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (clean_strategy_id,),
        ).fetchall()

        run_ids: list[int] = []
        for row in run_rows:
            run_id = int(row["id"])
            run_ids.append(run_id)

            events.append(
                _event(
                    event_type="forward_run_created",
                    object_type="strategy",
                    object_ref_id=clean_strategy_id,
                    title="forward run created",
                    description=f"run #{run_id} {row['symbol']} {row['timeframe']}",
                    created_at=row["created_at"],
                    source_section="forward",
                    metadata={
                        "run_id": run_id,
                        "status": row["status"],
                        "source_job_id": row["source_job_id"],
                        "note": row["note"],
                        "started_at": row["started_at"],
                        "ended_at": row["ended_at"],
                    },
                )
            )

            if row["updated_at"] and row["updated_at"] != row["created_at"]:
                events.append(
                    _event(
                        event_type="forward_status_updated",
                        object_type="strategy",
                        object_ref_id=clean_strategy_id,
                        title="forward status updated",
                        description=f"run #{run_id} -> {row['status']}",
                        created_at=row["updated_at"],
                        source_section="forward",
                        metadata={"run_id": run_id, "status": row["status"]},
                    )
                )

        if run_ids:
            placeholders = ",".join(["?" for _ in run_ids])

            summary_rows = db.execute(
                f"""
                SELECT s.forward_run_id, s.created_at, s.last_updated_at, s.total_trades, s.win_rate, s.pnl, s.max_drawdown
                FROM forward_run_summaries s
                WHERE s.forward_run_id IN ({placeholders})
                ORDER BY s.id DESC
                """,
                tuple(run_ids),
            ).fetchall()

            for row in summary_rows:
                events.append(
                    _event(
                        event_type="summary_updated",
                        object_type="strategy",
                        object_ref_id=clean_strategy_id,
                        title="summary updated",
                        description=f"run #{row['forward_run_id']}",
                        created_at=row["last_updated_at"] or row["created_at"],
                        source_section="forward",
                        metadata={
                            "run_id": row["forward_run_id"],
                            "total_trades": row["total_trades"],
                            "win_rate": row["win_rate"],
                            "pnl": row["pnl"],
                            "max_drawdown": row["max_drawdown"],
                        },
                    )
                )

            gate_rows = db.execute(
                f"""
                SELECT g.forward_run_id, g.gate_decision, g.hard_fail, g.evaluated_at, g.updated_at
                FROM forward_run_gate_results g
                WHERE g.forward_run_id IN ({placeholders})
                ORDER BY g.id DESC
                """,
                tuple(run_ids),
            ).fetchall()

            for row in gate_rows:
                events.append(
                    _event(
                        event_type="gate_result_saved",
                        object_type="strategy",
                        object_ref_id=clean_strategy_id,
                        title="gate result saved",
                        description=f"run #{row['forward_run_id']} -> {row['gate_decision']}",
                        created_at=row["updated_at"] or row["evaluated_at"],
                        source_section="gate",
                        metadata={
                            "run_id": row["forward_run_id"],
                            "gate_decision": row["gate_decision"],
                            "hard_fail": bool(row["hard_fail"]),
                        },
                    )
                )

    return {
        "object_type": "strategy",
        "object_ref_id": clean_strategy_id,
        "items": _sort_and_limit(events, limit),
        "count": len(events),
    }


def get_account_audit_timeline(source_type: str, source_ref_id: int, limit: int = 100) -> dict[str, Any]:
    clean_source_type = str(source_type or "").strip()
    if not clean_source_type:
        raise ValueError("sourceType is required")

    events: list[dict[str, Any]] = []
    case_ids: list[int] = []

    with connection_scope() as db:
        if clean_source_type == "mt5_investor":
            conn_row = db.execute(
                """
                SELECT id, account_number, server, status, created_at, last_tested_at, last_synced_at
                FROM account_audit_mt5_connections
                WHERE id = ?
                """,
                (source_ref_id,),
            ).fetchone()
            if conn_row:
                events.append(
                    _event(
                        event_type="mt5_connected",
                        object_type="account_audit",
                        object_ref_id=source_ref_id,
                        title="intake created",
                        description=f"MT5 {conn_row['account_number']}@{conn_row['server']}",
                        created_at=conn_row["created_at"],
                        source_section="account_audit",
                        metadata={"status": conn_row["status"]},
                    )
                )
                if conn_row["last_tested_at"]:
                    events.append(
                        _event(
                            event_type="mt5_tested",
                            object_type="account_audit",
                            object_ref_id=source_ref_id,
                            title="intake created",
                            description="mt5 connection tested",
                            created_at=conn_row["last_tested_at"],
                            source_section="account_audit",
                        )
                    )
                if conn_row["last_synced_at"]:
                    events.append(
                        _event(
                            event_type="mt5_synced",
                            object_type="account_audit",
                            object_ref_id=source_ref_id,
                            title="mt5 synced",
                            description=f"connection status: {conn_row['status']}",
                            created_at=conn_row["last_synced_at"],
                            source_section="account_audit",
                        )
                    )

        intake_row = db.execute(
            """
            SELECT id, source_type, intake_method, source_label, original_filename, status, created_at
            FROM account_audit_intake_jobs
            WHERE id = ?
            """,
            (source_ref_id,),
        ).fetchone()
        if intake_row:
            events.append(
                _event(
                    event_type="intake_created",
                    object_type="account_audit",
                    object_ref_id=source_ref_id,
                    title="intake created",
                    description=f"{intake_row['source_type']} / {intake_row['intake_method']}",
                    created_at=intake_row["created_at"],
                    source_section="account_audit",
                    metadata={
                        "source_label": intake_row["source_label"],
                        "original_filename": intake_row["original_filename"],
                        "status": intake_row["status"],
                    },
                )
            )

        summary_rows = db.execute(
            """
            SELECT id, source_type, source_ref_id, last_computed_at, updated_at
            FROM account_audit_summaries
            WHERE source_type = ? AND source_ref_id = ?
            ORDER BY id DESC
            LIMIT 50
            """,
            (clean_source_type, source_ref_id),
        ).fetchall()
        for row in summary_rows:
            events.append(
                _event(
                    event_type="summary_updated",
                    object_type="account_audit",
                    object_ref_id=source_ref_id,
                    title="summary updated",
                    description=f"summary #{row['id']}",
                    created_at=row["last_computed_at"] or row["updated_at"],
                    source_section="account_audit",
                    metadata={"summary_id": row["id"]},
                )
            )

        case_type = "mt5_connection" if clean_source_type == "mt5_investor" else "account_audit"
        case_rows = db.execute(
            """
            SELECT id, created_at, updated_at, status
            FROM audit_cases
            WHERE case_type = ? AND ref_id = ?
            ORDER BY id DESC
            LIMIT 50
            """,
            (case_type, source_ref_id),
        ).fetchall()

        for row in case_rows:
            case_id = int(row["id"])
            case_ids.append(case_id)
            events.append(
                _event(
                    event_type="case_created",
                    object_type="case",
                    object_ref_id=case_id,
                    title="intake created",
                    description=f"case #{case_id}",
                    created_at=row["created_at"],
                    source_section="review",
                    metadata={"status": row["status"]},
                )
            )
            if row["updated_at"] and row["updated_at"] != row["created_at"]:
                events.append(
                    _event(
                        event_type="case_updated",
                        object_type="case",
                        object_ref_id=case_id,
                        title="summary updated",
                        description=f"case #{case_id}",
                        created_at=row["updated_at"],
                        source_section="review",
                        metadata={"status": row["status"]},
                    )
                )

        for case_id in case_ids:
            note_rows = db.execute(
                """
                SELECT id, content, note_type, created_at, created_by
                FROM review_notes
                WHERE case_id = ?
                ORDER BY id DESC
                LIMIT 100
                """,
                (case_id,),
            ).fetchall()
            for row in note_rows:
                events.append(
                    _event(
                        event_type="review_note_added",
                        object_type="case",
                        object_ref_id=case_id,
                        title="review note added",
                        description=f"{row['note_type']}: {row['content'][:80]}",
                        actor=row["created_by"] or "system",
                        created_at=row["created_at"],
                        source_section="review",
                        metadata={"note_id": row["id"], "note_type": row["note_type"]},
                    )
                )

            action_rows = db.execute(
                """
                SELECT id, action, reason, previous_status, new_status, created_at, created_by
                FROM review_actions
                WHERE case_id = ?
                ORDER BY id DESC
                LIMIT 100
                """,
                (case_id,),
            ).fetchall()
            for row in action_rows:
                events.append(
                    _event(
                        event_type="review_action_recorded",
                        object_type="case",
                        object_ref_id=case_id,
                        title="review action recorded",
                        description=f"{row['action']} ({row['previous_status']} -> {row['new_status']})",
                        actor=row["created_by"] or "system",
                        created_at=row["created_at"],
                        source_section="review",
                        metadata={"action_id": row["id"], "action": row["action"], "reason": row["reason"]},
                    )
                )

    return {
        "object_type": "account_audit",
        "object_ref_id": source_ref_id,
        "source_type": clean_source_type,
        "items": _sort_and_limit(events, limit),
        "count": len(events),
    }


def get_case_timeline(case_id: int, limit: int = 100) -> dict[str, Any]:
    events: list[dict[str, Any]] = []

    with connection_scope() as db:
        case_row = db.execute(
            """
            SELECT id, case_type, ref_id, status, created_at, updated_at
            FROM audit_cases
            WHERE id = ?
            """,
            (case_id,),
        ).fetchone()

        if case_row is None:
            raise ValueError(f"Case {case_id} not found")

        events.append(
            _event(
                event_type="case_created",
                object_type="case",
                object_ref_id=case_id,
                title="intake created",
                description=f"{case_row['case_type']} #{case_row['ref_id']}",
                created_at=case_row["created_at"],
                source_section="review",
                metadata={"status": case_row["status"]},
            )
        )

        if case_row["updated_at"] and case_row["updated_at"] != case_row["created_at"]:
            events.append(
                _event(
                    event_type="case_updated",
                    object_type="case",
                    object_ref_id=case_id,
                    title="summary updated",
                    description=f"status: {case_row['status']}",
                    created_at=case_row["updated_at"],
                    source_section="review",
                    metadata={"status": case_row["status"]},
                )
            )

        note_rows = db.execute(
            """
            SELECT id, content, note_type, created_at, created_by
            FROM review_notes
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (case_id,),
        ).fetchall()
        for row in note_rows:
            events.append(
                _event(
                    event_type="review_note_added",
                    object_type="case",
                    object_ref_id=case_id,
                    title="review note added",
                    description=f"{row['note_type']}: {row['content'][:80]}",
                    actor=row["created_by"] or "system",
                    created_at=row["created_at"],
                    source_section="review",
                    metadata={"note_id": row["id"], "note_type": row["note_type"]},
                )
            )

        action_rows = db.execute(
            """
            SELECT id, action, reason, previous_status, new_status, created_at, created_by
            FROM review_actions
            WHERE case_id = ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (case_id,),
        ).fetchall()
        for row in action_rows:
            events.append(
                _event(
                    event_type="review_action_recorded",
                    object_type="case",
                    object_ref_id=case_id,
                    title="review action recorded",
                    description=f"{row['action']} ({row['previous_status']} -> {row['new_status']})",
                    actor=row["created_by"] or "system",
                    created_at=row["created_at"],
                    source_section="review",
                    metadata={"action_id": row["id"], "action": row["action"], "reason": row["reason"]},
                )
            )

    case_type = str(case_row["case_type"])
    ref_id = case_row["ref_id"]

    if case_type in {"strategy", "backtest"}:
        strategy_timeline = get_strategy_timeline(str(ref_id), limit=limit * 2)
        events.extend(strategy_timeline["items"])
    elif case_type in {"account_audit", "mt5_connection"}:
        source_type = "mt5_investor" if case_type == "mt5_connection" else "manual_trade_import"
        audit_timeline = get_account_audit_timeline(source_type, int(ref_id), limit=limit * 2)
        events.extend(audit_timeline["items"])

    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for item in events:
        key = (
            item.get("event_type"),
            item.get("object_type"),
            item.get("object_ref_id"),
            item.get("created_at"),
            item.get("description"),
        )
        deduped[key] = item

    items = _sort_and_limit(list(deduped.values()), limit)
    return {
        "object_type": "case",
        "object_ref_id": case_id,
        "case_type": case_type,
        "items": items,
        "count": len(items),
    }


def get_audit_timeline(
    object_type: str,
    object_ref_id: str,
    limit: int = 100,
    source_type: str | None = None,
) -> dict[str, Any]:
    clean_type = str(object_type or "").strip().lower()

    if clean_type == "case":
        return get_case_timeline(int(object_ref_id), limit)

    if clean_type == "strategy":
        return get_strategy_timeline(str(object_ref_id), limit)

    if clean_type == "account_audit":
        if not source_type:
            raise ValueError("sourceType is required for account_audit timeline")
        return get_account_audit_timeline(source_type, int(object_ref_id), limit)

    raise ValueError(f"Unsupported object_type: {object_type}")
