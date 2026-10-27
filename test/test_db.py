import sys
import unittest
from pathlib import Path

# Add backend and root to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / 'backend'
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import db


class TestDB(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_task_lifecycle(self):
        task = db.add_task('Test task', due_at='2026-10-07T09:00')
        self.assertIsNotNone(task)
        self.assertEqual(task['title'], 'Test task')

        updated = db.set_done(task['id'], True)
        self.assertEqual(updated['done'], 1)

        db.delete_task(task['id'])
        deleted = db.get_task(task['id'])
        self.assertIsNone(deleted)


if __name__ == '__main__':
    unittest.main()
