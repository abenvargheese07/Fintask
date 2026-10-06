from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import AfterValidator, BaseModel, Field

from . import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title='Fintask', lifespan=lifespan)


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


@app.get('/api/tasks')
def list_tasks(view: Literal['today', 'upcoming', 'done', 'all'] = 'today'):
    return db.list_tasks(view)


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
def snooze_task(task_id: int, minutes: int = Query(10, ge=1, le=1440)):
    get_or_404(task_id)
    return db.snooze_task(task_id, minutes)


@app.delete('/api/tasks/{task_id}')
def delete_task(task_id: int):
    get_or_404(task_id)
    db.delete_task(task_id)
    return {'ok': True}