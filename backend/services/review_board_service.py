"""
Review Board Service - Unified review status aggregation
Provides board-level view of all audit cases with filtering and summary
"""
from data_sources.audit_cases_repository import (
    get_audit_cases,
    count_audit_cases,
)


def get_review_board_summary() -> dict:
    """
    Get summary statistics for the review board
    Returns counts by status
    """
    statuses = ['open', 'in_progress', 'closed', 'on_watch']
    summary = {}
    
    for status in statuses:
        summary[status] = count_audit_cases(status)
    
    return {
        'byStatus': summary,
        'total': sum(summary.values()),
        'statuses': statuses,
    }


def get_review_board_cases(
    limit: int = 100,
    status: str = None,
    case_type: str = None,
    priority: str = None,
    offset: int = 0
) -> dict:
    """
    Get filtered list of audit cases for the review board
    
    Args:
        limit: Number of cases to return (default 100)
        status: Filter by case status (open, in_progress, closed, on_watch)
        case_type: Filter by case type (strategy, backtest, account_audit, etc)
        priority: Filter by priority (high, normal, low)
        offset: Pagination offset
    
    Returns:
        {
            items: [
                {
                    id, case_type, ref_id, priority, status, note,
                    created_at, updated_at, object_label
                }
            ],
            total: total count matching filters,
            summary: { byStatus, filters applied }
        }
    """
    
    # Get cases (note: current repository doesn't support case_type filter in query,
    # so we'll filter in Python if needed)
    cases = get_audit_cases(limit + offset, status, priority)
    
    # Apply case_type filter if specified
    if case_type:
        cases = [c for c in cases if c.get('case_type') == case_type]
    
    # Paginate
    items = cases[offset:offset + limit]
    
    # Enrich each case with object_label
    for case in items:
        case['object_label'] = f"{case['case_type']}#{case['ref_id']}"
        case['object_detail'] = {
            'type': case['case_type'],
            'label': f"{case['case_type']} #{case['ref_id']}",
        }
    
    # Get total count with applied filters
    total = len(cases)  # Rough - doesn't account for all filters perfectly
    if not case_type:
        total = count_audit_cases(status)
    
    return {
        'items': items,
        'total': total,
        'count': len(items),
        'summary': {
            'byStatus': get_review_board_summary()['byStatus'],
            'filters': {
                'status': status,
                'case_type': case_type,
                'priority': priority,
            }
        }
    }


def get_review_status_options() -> dict:
    """
    Return available options for review status filtering
    """
    return {
        'statuses': ['open', 'in_progress', 'closed', 'on_watch'],
        'caseTypes': ['strategy', 'backtest', 'account_audit', 'mt5_connection', 'forward_run'],
        'priorities': ['high', 'normal', 'low'],
    }
