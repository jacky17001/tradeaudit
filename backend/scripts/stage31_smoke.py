"""
Stage 31 Account Audit Review View Smoke Test.

Validates basic review aggregation for MT5 sources and intake jobs.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from services.account_audit_review_service import get_account_audit_review


def test_account_audit_review_mt5_source():
    """Test review aggregation for MT5 investor connection."""
    # Assume connection #1 exists from Stage 29 MT5 tests
    try:
        review = get_account_audit_review('mt5_investor', 1)
        
        # Validate structure
        assert isinstance(review, dict), "Review should be a dict"
        assert 'sourceInfo' in review, "Review should have sourceInfo"
        assert 'accountInfo' in review, "Review should have accountInfo"
        assert 'metricsSummary' in review, "Review should have metricsSummary"
        assert 'recentTrades' in review, "Review should have recentTrades"
        assert 'dataCoverage' in review, "Review should have dataCoverage"
        
        # Validate sourceInfo
        source_info = review['sourceInfo']
        assert source_info['sourceType'] == 'mt5_investor', "Source type should be mt5_investor"
        assert source_info['sourceRefId'] == 1, "Source ref ID should be 1"
        assert 'sourceLabel' in source_info, "Source info should have label"
        assert 'accountNumber' in source_info, "MT5 source should have account number"
        
        # Validate accountInfo (MT5 has this)
        if review['accountInfo']:
            account_info = review['accountInfo']
            assert 'accountNumber' in account_info, "Account info should have account number"
            assert 'balance' in account_info, "Account info should have balance"
            assert 'equity' in account_info, "Account info should have equity"
        
        # Validate metricsSummary (may be None initially)
        # If present, validate structure
        if review['metricsSummary']:
            summary = review['metricsSummary']
            assert 'totalTrades' in summary, "Summary should have totalTrades"
            assert 'winRate' in summary or summary['winRate'] is None, "Summary should have winRate"
        
        # Validate recentTrades (list)
        assert isinstance(review['recentTrades'], list), "Recent trades should be a list"
        # Each trade should have basic structure if present
        for trade in review['recentTrades']:
            assert 'ticket' in trade, "Trade should have ticket"
            assert 'symbol' in trade, "Trade should have symbol"
        
        # Validate dataCoverage
        coverage = review['dataCoverage']
        assert 'hasSummary' in coverage, "Coverage should have hasSummary"
        assert 'tradeCount' in coverage, "Coverage should have tradeCount"
        assert 'completenessNote' in coverage, "Coverage should have completenessNote"
        
        print("✓ MT5 review aggregation test passed")
        return True
        
    except Exception as exc:
        print(f"✗ MT5 review aggregation test failed: {exc}")
        return False


def test_account_audit_review_intake_source():
    """Test review aggregation for intake job source."""
    # Assume intake job #1 exists
    try:
        review = get_account_audit_review('statement_upload', 1)
        
        # Validate structure
        assert isinstance(review, dict), "Review should be a dict"
        assert 'sourceInfo' in review, "Review should have sourceInfo"
        assert 'dataCoverage' in review, "Review should have dataCoverage"
        
        # Validate sourceInfo
        source_info = review['sourceInfo']
        assert source_info['sourceType'] == 'statement_upload', "Source type should be statement_upload"
        assert source_info['sourceRefId'] == 1, "Source ref ID should be 1"
        
        # Intake sources should NOT have accountInfo
        assert review['accountInfo'] is None, "Intake sources should not have account info"
        
        # Intake sources should have limited trades (empty list)
        assert isinstance(review['recentTrades'], list), "Recent trades should be a list"
        assert len(review['recentTrades']) == 0, "Intake sources should have no trades from aggregation"
        
        # Validate dataCoverage
        coverage = review['dataCoverage']
        assert 'completenessNote' in coverage, "Coverage should have completeness note"
        
        print("✓ Intake source review aggregation test passed")
        return True
        
    except Exception as exc:
        print(f"✗ Intake source review aggregation test failed: {exc}")
        return False


def test_invalid_source_type():
    """Test that invalid source type raises ValueError."""
    try:
        get_account_audit_review('invalid_source_type', 1)
        print("✗ Should have raised ValueError for invalid source type")
        return False
    except ValueError as exc:
        print(f"✓ Correctly rejected invalid source type: {exc}")
        return True
    except Exception as exc:
        print(f"✗ Unexpected error: {exc}")
        return False


if __name__ == '__main__':
    results = [
        test_account_audit_review_mt5_source(),
        test_account_audit_review_intake_source(),
        test_invalid_source_type(),
    ]
    
    passed = sum(results)
    total = len(results)
    
    print()
    if passed == total:
        print(f"ALL ASSERTIONS PASSED - Stage 31 smoke OK ({passed}/{total})")
        sys.exit(0)
    else:
        print(f"SOME TESTS FAILED - {passed}/{total} passed")
        sys.exit(1)
