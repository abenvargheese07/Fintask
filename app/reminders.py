import json
import subprocess

from apscheduler.schedulers.background import BackgroundScheduler

from . import db

scheduler = BackgroundScheduler()


def notify(title, message):
    # json.dumps returns a quoted, escaped string that AppleScript also accepts
    script = (
        f'display notification {json.dumps(message, ensure_ascii=False)} '
        f'with title {json.dumps(title, ensure_ascii=False)} sound name "Glass"'
    )
    subprocess.run(['osascript', '-e', script], check=False)


def check_due():
    for task in db.due_unreminded():
        notify('Fintask', task['title'])
        db.mark_reminded(task['id'])


def start():
    scheduler.add_job(check_due, 'interval', seconds=30, id='check_due', replace_existing=True)
    scheduler.start()


def stop():
    scheduler.shutdown(wait=False)