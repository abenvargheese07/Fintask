from pathlib import Path
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import AfterValidator, BaseModel, Field

from . import db, reminders


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    reminders.start()
    yield
    reminders.stop()


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title='Fintask', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def clean_due(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).strftime('%Y-%m-%dT%H:%M')
    except ValueError:
        raise ValueError('due_at must look like 2026-10-07T09:00')


DueAt = Annotated[Optional[str], AfterValidator(clean_due)]


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = ''
    due_at: DueAt = None
    priority: int = Field(default=2, ge=1, le=3)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    notes: Optional[str] = None
    due_at: DueAt = None
    priority: Optional[int] = Field(default=None, ge=1, le=3)


def get_or_404(task_id: int):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(404, 'Task not found')
    return task


@app.get('/health')
def health():
    return {'status': 'ok', 'app': 'fintask'}


@app.get('/api/stats')
def get_stats(client_now: Optional[str] = None, client_today: Optional[str] = None):
    return db.get_stats(client_now=client_now, client_today=client_today)


@app.get('/api/tasks')
def list_tasks(
    view: Literal['today', 'upcoming', 'overdue', 'done', 'all'] = 'today',
    client_now: Optional[str] = None,
    client_today: Optional[str] = None
):
    return db.list_tasks(view, client_now=client_now, client_today=client_today)


@app.post('/api/tasks', status_code=201)
def create_task(task: TaskIn):
    return db.add_task(task.title, task.notes, task.due_at, task.priority)


@app.patch('/api/tasks/{task_id}')
def edit_task(task_id: int, changes: TaskUpdate):
    get_or_404(task_id)
    data = changes.model_dump(exclude_unset=True)
    for key in ('title', 'notes', 'priority'):
        if key in data and data[key] is None:
            del data[key]  # these columns cannot be empty
    return db.update_task(task_id, data)


@app.post('/api/tasks/{task_id}/complete')
def complete_task(task_id: int):
    get_or_404(task_id)
    return db.set_done(task_id, True)


@app.post('/api/tasks/{task_id}/reopen')
def reopen_task(task_id: int):
    get_or_404(task_id)
    return db.set_done(task_id, False)


@app.post('/api/tasks/{task_id}/snooze')
def snooze_task(task_id: int, minutes: int = Query(10, ge=1, le=10080)):
    get_or_404(task_id)
    return db.snooze_task(task_id, minutes)


@app.delete('/api/tasks/{task_id}')
def delete_task(task_id: int):
    get_or_404(task_id)
    db.delete_task(task_id)
    return {'ok': True}


@app.get('/api/notifications/poll')
def poll_notifications(since_id: int = Query(0, ge=0)):
    return db.get_recent_notifications(since_id=since_id, limit=30)


@app.get('/api/settings')
def get_settings():
    topic = db.get_setting('ntfy_topic')
    if not topic:
        import secrets
        topic = f'fintask-{secrets.token_hex(4)}'
        db.set_setting('ntfy_topic', topic)
    return {
        'ntfy_topic': topic,
        'timezone': db.get_setting('timezone', 'Asia/Kolkata'),
        'timezone_offset': db.get_setting('timezone_offset', None),
    }


class SettingsUpdate(BaseModel):
    ntfy_topic: Optional[str] = None
    timezone: Optional[str] = None
    timezone_offset: Optional[int] = None


@app.post('/api/settings')
def update_settings(payload: SettingsUpdate):
    if payload.ntfy_topic is not None and payload.ntfy_topic.strip():
        db.set_setting('ntfy_topic', payload.ntfy_topic.strip())
    if payload.timezone is not None and payload.timezone.strip():
        db.set_setting('timezone', payload.timezone.strip())
    if payload.timezone_offset is not None:
        db.set_setting('timezone_offset', str(payload.timezone_offset))
    return get_settings()


@app.post('/api/test-notification')
def test_notification():
    title = 'Fintask Escalating Alert'
    msg = '⚡ Test: Approaching deadline alert triggered across your devices!'
    urgency = 'urgent'
    reminders.send_mac_notification(title, msg, sound='Ping')
    db.record_notification_prompt(0, 'Test Alert', msg, urgency)
    reminders.send_mobile_push(title, msg, urgency)
    return {'ok': True, 'message': 'Test alert broadcasted'}


from fastapi.responses import FileResponse


@app.api_route('/download-apk', methods=['GET', 'HEAD'])
def download_apk():
    apk_candidates = [
        Path(__file__).resolve().parent / 'downloads/fintask.apk',
        Path(__file__).resolve().parent.parent / 'frontend/android/app/build/outputs/apk/debug/app-debug.apk',
    ]
    apk_path = next((p for p in apk_candidates if p.exists()), None)
    if not apk_path:
        raise HTTPException(404, 'APK not found. Please build it first.')
    return FileResponse(
        path=apk_path,
        filename='fintask.apk',
        media_type='application/vnd.android.package-archive'
    )


app.mount('/', StaticFiles(directory=Path(__file__).parent / 'static', html=True), name='static')


if __name__ == '__main__':
    import os
    import uvicorn
    port_str = os.environ.get('PORT', '8080')
    try:
        port = int(port_str)
    except ValueError:
        port = 8080
    uvicorn.run(app, host='0.0.0.0', port=port)