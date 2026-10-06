import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / 'fintask.db'
FMT = '%Y-%m-%dT%H:%M'

SCHEMA = '''
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    due_at TEXT,
    priority INTEGER NOT NULL DEFAULT 2,
    done INTEGER NOT NULL DEFAULT 0,
    reminded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
)
'''


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute(SCHEMA)


def get_task(task_id):
    with get_conn() as conn:
        row = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    return dict(row) if row else None


def add_task(title, notes='', due_at=None, priority=2):
    created = datetime.now().isoformat(timespec='seconds')
    with get_conn() as conn:
        cur = conn.execute(
            'INSERT INTO tasks (title, notes, due_at, priority, created_at) '
            'VALUES (?, ?, ?, ?, ?)',
            (title, notes, due_at, priority, created),
        )
        task_id = cur.lastrowid
    return get_task(task_id)


def list_tasks(view='today'):
    today = datetime.now().strftime('%Y-%m-%d')
    queries = {
        'today': ('done = 0 AND due_at IS NOT NULL AND substr(due_at, 1, 10) <= ?', (today,)),
        'upcoming': ('done = 0 AND (due_at IS NULL OR substr(due_at, 1, 10) > ?)', (today,)),
        'done': ('done = 1', ()),
        'all': ('1 = 1', ()),
    }
    where, params = queries[view]
    sql = f'SELECT * FROM tasks WHERE {where} ORDER BY priority, due_at IS NULL, due_at'
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def update_task(task_id, fields):
    allowed = {'title', 'notes', 'due_at', 'priority'}
    fields = {k: v for k, v in fields.items() if k in allowed}
    if not fields:
        return get_task(task_id)
    if 'due_at' in fields:
        fields['reminded'] = 0  # new due time means a new reminder
    sets = ', '.join(f'{k} = ?' for k in fields)
    with get_conn() as conn:
        conn.execute(f'UPDATE tasks SET {sets} WHERE id = ?', (*fields.values(), task_id))
    return get_task(task_id)


def set_done(task_id, done):
    with get_conn() as conn:
        conn.execute('UPDATE tasks SET done = ? WHERE id = ?', (int(done), task_id))
    return get_task(task_id)


def snooze_task(task_id, minutes):
    due = (datetime.now() + timedelta(minutes=minutes)).strftime(FMT)
    with get_conn() as conn:
        conn.execute('UPDATE tasks SET due_at = ?, reminded = 0 WHERE id = ?', (due, task_id))
    return get_task(task_id)


def delete_task(task_id):
    with get_conn() as conn:
        conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))


def due_unreminded():
    now = datetime.now().strftime(FMT)
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT * FROM tasks WHERE done = 0 AND reminded = 0 '
            'AND due_at IS NOT NULL AND due_at <= ?',
            (now,),
        ).fetchall()
    return [dict(r) for r in rows]


def mark_reminded(task_id):
    with get_conn() as conn:
        conn.execute('UPDATE tasks SET reminded = 1 WHERE id = ?', (task_id,))