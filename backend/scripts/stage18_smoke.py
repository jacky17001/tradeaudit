"""Stage 18 smoke test – in-process, no server needed."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from services.backtests_import_service import _build_change_items, _compute_changes_summary

before_map = {
    'A': {'name': 'Alpha', 'score': 80, 'decision': 'PASS'},
    'B': {'name': 'Beta', 'score': 60, 'decision': 'NEEDS_IMPROVEMENT'},
    'C': {'name': 'Gamma', 'score': 50, 'decision': 'FAIL'},
}
after_map = {
    'A': {'name': 'Alpha', 'score': 85, 'decision': 'PASS'},
    'B': {'name': 'Beta', 'score': 60, 'decision': 'FAIL'},
    'D': {'name': 'Delta', 'score': 70, 'decision': 'PASS'},
}

items = _build_change_items(before_map, after_map)
print('changeItems count:', len(items))
for item in items:
    print(' ', item['strategy_id'], '-', item['change_type'],
          'score_delta=', item['score_delta'],
          'before_dec=', item['before_decision'],
          'after_dec=', item['after_decision'])

summary = _compute_changes_summary(before_map, after_map)
print('summary newCount:', summary['newStrategiesCount'],
      'removedCount:', summary['removedStrategiesCount'],
      'changedCount:', summary['changedStrategiesCount'])

assert len(items) == 4, 'Expected 4 items, got ' + str(len(items))
types = {i['strategy_id']: i['change_type'] for i in items}
assert types['C'] == 'REMOVED', types
assert types['D'] == 'NEW', types
assert types['A'] == 'UPDATED', types
assert types['B'] == 'UPDATED', types

a_item = next(i for i in items if i['strategy_id'] == 'A')
assert a_item['score_delta'] == 5, a_item
assert a_item['before_score'] == 80
assert a_item['after_score'] == 85

b_item = next(i for i in items if i['strategy_id'] == 'B')
assert b_item['score_delta'] == 0, b_item
assert b_item['before_decision'] == 'NEEDS_IMPROVEMENT'
assert b_item['after_decision'] == 'FAIL'

d_item = next(i for i in items if i['strategy_id'] == 'D')
assert d_item['before_score'] is None
assert d_item['after_score'] == 70
assert d_item['score_delta'] is None

c_item = next(i for i in items if i['strategy_id'] == 'C')
assert c_item['after_score'] is None
assert c_item['before_score'] == 50
assert c_item['score_delta'] is None

# Verify summary is still consistent
assert summary['newStrategiesCount'] == 1
assert summary['removedStrategiesCount'] == 1
assert summary['changedStrategiesCount'] == 2
assert summary['decisionChangedCount'] == 1

print('ALL ASSERTIONS PASSED - Stage 18 smoke OK')
