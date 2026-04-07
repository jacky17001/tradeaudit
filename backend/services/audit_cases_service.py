"""
Audit Cases Service - Business logic for audit cases
"""
from data_sources.audit_cases_repository import (
    insert_audit_case,
    get_audit_cases,
    get_audit_case,
    update_audit_case,
    get_review_queue,
    count_audit_cases,
    delete_audit_case
)


def create_audit_case(case_type: str, ref_id: int, priority: str = 'normal',
                     status: str = 'open', note: str = None) -> dict:
    """
    Create a new audit case
    
    case_type: 'strategy', 'backtest', 'account_audit', 'mt5_connection', 'forward_run'
    """
    valid_types = {'strategy', 'backtest', 'account_audit', 'mt5_connection', 'forward_run'}
    if case_type not in valid_types:
        raise ValueError(f"Invalid case_type: {case_type}")
    
    valid_priorities = {'high', 'normal', 'low'}
    if priority not in valid_priorities:
        raise ValueError(f"Invalid priority: {priority}")
    
    valid_statuses = {'open', 'in_progress', 'closed', 'on_watch'}
    if status not in valid_statuses:
        raise ValueError(f"Invalid status: {status}")
    
    return insert_audit_case(case_type, ref_id, priority, status, note)


def list_audit_cases(limit: int = 50, status: str = None, priority: str = None) -> dict:
    """List audit cases with optional filters"""
    cases = get_audit_cases(limit, status, priority)
    total = count_audit_cases(status)
    
    return {
        'items': cases,
        'total': total,
        'count': len(cases)
    }


def get_case_detail(case_id: int) -> dict:
    """Get detailed information about a case"""
    case = get_audit_case(case_id)
    if not case:
        raise ValueError(f"Case {case_id} not found")
    
    # Enrich with object details based on case_type
    case['object_label'] = f"{case['case_type']}#{case['ref_id']}"
    
    return case


def update_case(case_id: int, priority: str = None, status: str = None, 
               note: str = None) -> dict:
    """Update a case"""
    updates = {}
    
    if priority:
        valid_priorities = {'high', 'normal', 'low'}
        if priority not in valid_priorities:
            raise ValueError(f"Invalid priority: {priority}")
        updates['priority'] = priority
    
    if status:
        valid_statuses = {'open', 'in_progress', 'closed', 'on_watch'}
        if status not in valid_statuses:
            raise ValueError(f"Invalid status: {status}")
        updates['status'] = status
    
    if note is not None:
        updates['note'] = note
    
    return update_audit_case(case_id, **updates)


def get_queue_for_review(limit: int = 50) -> dict:
    """Get review queue - list of high-priority cases needing review"""
    cases = get_review_queue(limit)
    
    return {
        'items': cases,
        'count': len(cases),
        'has_high_priority': any(c['priority'] == 'high' for c in cases)
    }


def case_summary() -> dict:
    """Get summary statistics of audit cases"""
    return {
        'total': count_audit_cases(),
        'open': count_audit_cases('open'),
        'in_progress': count_audit_cases('in_progress'),
        'closed': count_audit_cases('closed'),
        'on_watch': count_audit_cases('on_watch')
    }
