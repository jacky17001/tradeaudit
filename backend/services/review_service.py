"""
Review Service - Business logic for review notes and actions
"""
from data_sources.review_repository import (
    add_review_note,
    get_review_notes,
    get_latest_review_note,
    add_review_action,
    get_review_actions,
    get_latest_review_action
)
from data_sources.audit_cases_repository import get_audit_case


def add_note_to_case(case_id: int, content: str, note_type: str = 'comment') -> dict:
    """Add a note to case"""
    case = get_audit_case(case_id)
    if not case:
        raise ValueError(f"Case {case_id} not found")
    
    valid_types = {'comment', 'flag', 'question'}
    if note_type not in valid_types:
        raise ValueError(f"Invalid note_type: {note_type}")
    
    return add_review_note(case_id, content, note_type)


def list_case_notes(case_id: int, limit: int = 100) -> dict:
    """List all notes for a case"""
    case = get_audit_case(case_id)
    if not case:
        raise ValueError(f"Case {case_id} not found")
    
    notes = get_review_notes(case_id, limit)
    return {
        'case_id': case_id,
        'items': notes,
        'count': len(notes),
        'latest': notes[0] if notes else None
    }


def take_review_action(case_id: int, action: str, reason: str = None) -> dict:
    """Record a review action and optionally update case status"""
    case = get_audit_case(case_id)
    if not case:
        raise ValueError(f"Case {case_id} not found")
    
    valid_actions = {'approve', 'reject', 'watch', 'needs_data'}
    if action not in valid_actions:
        raise ValueError(f"Invalid action: {action}")
    
    # Map action to new status
    action_to_status = {
        'approve': 'closed',
        'reject': 'closed',
        'watch': 'on_watch',
        'needs_data': 'open'
    }
    
    new_status = action_to_status.get(action)
    previous_status = case['status']
    
    # Record the action
    action_record = add_review_action(
        case_id=case_id,
        action=action,
        reason=reason,
        previous_status=previous_status,
        new_status=new_status
    )
    
    # If action changes status, update the case
    if new_status != previous_status:
        from data_sources.audit_cases_repository import update_audit_case
        updated_case = update_audit_case(case_id, status=new_status)
        action_record['case_updated'] = True
        action_record['updated_case'] = updated_case
    else:
        action_record['case_updated'] = False
    
    return action_record


def get_case_review_history(case_id: int) -> dict:
    """Get complete review history for a case (notes + actions)"""
    case = get_audit_case(case_id)
    if not case:
        raise ValueError(f"Case {case_id} not found")
    
    notes = get_review_notes(case_id, limit=50)
    actions = get_review_actions(case_id, limit=50)
    
    return {
        'case_id': case_id,
        'case_status': case['status'],
        'notes': notes,
        'notes_count': len(notes),
        'actions': actions,
        'actions_count': len(actions),
        'latest_note': get_latest_review_note(case_id),
        'latest_action': get_latest_review_action(case_id)
    }


def get_case_decision(case_id: int) -> dict:
    """Get the latest decision/action for a case"""
    latest_action = get_latest_review_action(case_id)
    
    if not latest_action:
        return {
            'case_id': case_id,
            'has_decision': False,
            'action': None
        }
    
    return {
        'case_id': case_id,
        'has_decision': True,
        'action': latest_action['action'],
        'reason': latest_action['reason'],
        'decided_at': latest_action['created_at'],
        'decided_by': latest_action['created_by']
    }
