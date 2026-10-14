import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / 'fintask.db'
DB_PATH = Path(os.environ.get('DATABASE_PATH', str(DEFAULT_DB_PATH)))
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
    last_reminded_at TEXT,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS notification_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    urgency TEXT NOT NULL,
    created_at TEXT NOT NULL
);
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
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.executescript(SCHEMA)
        # Migrate existing tasks table if missing new columns
        cur = conn.execute('PRAGMA table_info(tasks)')
        cols = {row['name'] for row in cur.fetchall()}
        if 'last_reminded_at' not in cols:
            conn.execute('ALTER TABLE tasks ADD COLUMN last_reminded_at TEXT')
        if 'reminder_count' not in cols:
            conn.execute('ALTER TABLE tasks ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0')


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
    now = datetime.now().strftime(FMT)
    queries = {
        'today': ('done = 0 AND due_at IS NOT NULL AND substr(due_at, 1, 10) <= ?', (today,)),
        'upcoming': ('done = 0 AND (due_at IS NULL OR substr(due_at, 1, 10) > ?)', (today,)),
        'overdue': ('done = 0 AND due_at IS NOT NULL AND due_at < ?', (now,)),
        'done': ('done = 1', ()),
        'all': ('1 = 1', ()),
    }
    where, params = queries[view]
    sql = f'SELECT * FROM tasks WHERE {where} ORDER BY priority, due_at IS NULL, due_at'
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def get_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    now = datetime.now().strftime(FMT)
    with get_conn() as conn:
        total = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
        done = conn.execute('SELECT COUNT(*) FROM tasks WHERE done = 1').fetchone()[0]
        overdue = conn.execute('SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at < ?', (now,)).fetchone()[0]
        due_today = conn.execute('SELECT COUNT(*) FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND substr(due_at, 1, 10) = ?', (today,)).fetchone()[0]
        pending = conn.execute('SELECT COUNT(*) FROM tasks WHERE done = 0').fetchone()[0]
    return {
        'total': total,
        'done': done,
        'overdue': overdue,
        'today': due_today,
        'pending': pending,
    }


def update_task(task_id, fields):
    allowed = {'title', 'notes', 'due_at', 'priority'}
    fields = {k: v for k, v in fields.items() if k in allowed}
    if not fields:
        return get_task(task_id)
    if 'due_at' in fields:
        fields['reminded'] = 0
        fields['last_reminded_at'] = None
        fields['reminder_count'] = 0
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
        conn.execute(
            'UPDATE tasks SET due_at = ?, reminded = 0, last_reminded_at = NULL, reminder_count = 0 WHERE id = ?',
            (due, task_id)
        )
    return get_task(task_id)


def delete_task(task_id):
    with get_conn() as conn:
        conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))


def get_active_tasks_with_deadline():
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT * FROM tasks WHERE done = 0 AND due_at IS NOT NULL ORDER BY due_at'
        ).fetchall()
    return [dict(r) for r in rows]


def record_notification_prompt(task_id, title, message, urgency):
    now = datetime.now().isoformat(timespec='seconds')
    with get_conn() as conn:
        conn.execute(
            'UPDATE tasks SET last_reminded_at = ?, reminder_count = reminder_count + 1, reminded = 1 WHERE id = ?',
            (now, task_id)
        )
        conn.execute(
            'INSERT INTO notification_events (task_id, title, message, urgency, created_at) VALUES (?, ?, ?, ?, ?)',
            (task_id, title, message, urgency, now)
        )


def get_recent_notifications(since_id=0, limit=20):
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT * FROM notification_events WHERE id > ? ORDER BY id DESC LIMIT ?',
            (since_id, limit)
        ).fetchall()
    return [dict(r) for r in rows]


def get_setting(key, default=None):
    with get_conn() as conn:
        row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    return row['value'] if row else default


def set_setting(key, value):
    with get_conn() as conn:
        conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))


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