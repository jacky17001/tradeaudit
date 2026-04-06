import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from db import init_db
from db.sqlite import connection_scope
from app import app


class DbInitTests(unittest.TestCase):
    def test_seed_single_table_imports_forward_gate_data(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / 'tradeaudit.db'
            with patch.dict(os.environ, {'TRADEAUDIT_DB_PATH': str(db_path)}):
                imported = init_db.seed_tables(['forward_gate'])

                self.assertEqual(imported['forward_gate'], 1)
                with connection_scope() as connection:
                    row = connection.execute(
                        'SELECT COUNT(*) AS total FROM forward_gate'
                    ).fetchone()
                    self.assertEqual(row['total'], 1)

    def test_auto_init_on_empty_db_makes_api_usable(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / 'tradeaudit.db'
            with patch.dict(os.environ, {'TRADEAUDIT_DB_PATH': str(db_path)}):
                init_db.ensure_database_ready()

                with connection_scope() as connection:
                    counts = {
                        'backtests': connection.execute(
                            'SELECT COUNT(*) AS total FROM backtests'
                        ).fetchone()['total'],
                        'account_audit': connection.execute(
                            'SELECT COUNT(*) AS total FROM account_audit'
                        ).fetchone()['total'],
                        'forward_gate': connection.execute(
                            'SELECT COUNT(*) AS total FROM forward_gate'
                        ).fetchone()['total'],
                    }

                self.assertGreater(counts['backtests'], 0)
                self.assertGreater(counts['account_audit'], 0)
                self.assertGreater(counts['forward_gate'], 0)

                client = app.test_client()
                response = client.get('/api/backtests/list?page=1&pageSize=2')
                self.assertEqual(response.status_code, 200)
                payload = response.get_json()
                self.assertIn('items', payload)
