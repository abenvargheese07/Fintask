import json
import logging
import subprocess
import urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler

try:
    from . import db
except ImportError:
    import db

logger = logging.getLogger('fintask.reminders')
scheduler = BackgroundScheduler(timezone='UTC')


def get_user_timezone():
    tz_name = db.get_setting('timezone')
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    offset_min = db.get_setting('timezone_offset')
    if offset_min is not None:
        try:
            return timezone(timedelta(minutes=-int(offset_min)))
        except Exception:
            pass
    return datetime.now().astimezone().tzinfo or timezone.utc


def send_mac_notification(title, message, sound='Glass'):
    """Native macOS desktop notification with system sound cues."""
    try:
        script = (
            f'display notification {json.dumps(message, ensure_ascii=False)} '
            f'with title {json.dumps(title, ensure_ascii=False)} sound name "{sound}"'
        )
        subprocess.run(['osascript', '-e', script], check=False, timeout=3)
    except Exception as e:
        logger.warning(f'Failed to display macOS notification: {e}')


def send_mobile_push(title, message, urgency):
    """
    Sends cross-device push notifications to mobile devices (iOS/Android/Watch)
    via ntfy.sh if the user has configured an ntfy topic in settings.
    Requires no accounts or API keys; free and open source.
    """
    topic = db.get_setting('ntfy_topic')
    if not topic:
        return

    priority_map = {
        'low': 'default',
        'medium': 'default',
        'high': 'high',
        'urgent': 'urgent',
        'critical': 'urgent',
        'emergency': 'max',
    }
    tags_map = {
        'low': 'clock',
        'medium': 'calendar',
        'high': 'warning',
        'urgent': 'warning,zap',
        'critical': 'rotating_light,alarm_clock',
        'emergency': 'fire,skull,rotating_light',
    }

    try:
        url = f'https://ntfy.sh/{topic}'
        req = urllib.request.Request(
            url,
            data=message.encode('utf-8'),
            headers={
                'Title': title.encode('utf-8'),
                'Priority': priority_map.get(urgency, 'high'),
                'Tags': tags_map.get(urgency, 'alarm_clock'),
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            pass
    except Exception as e:
        logger.warning(f'Mobile push to ntfy.sh failed: {e}')


def evaluate_task_reminder(task, now):
    """
    Calculates escalating prompt intervals as a deadline nears.
    Frequency accelerates dramatically:
      > 24h:   No prompt
      6h - 24h: Every 3 hours
      2h - 6h:  Every 1 hour
      30m - 2h: Every 20 minutes
      10m - 30m: Every 5 minutes
      0 - 10m:  Every 2 minutes
      Overdue:  Every 1 to 2 minutes based on priority
    """
    due_str = task['due_at']
    if not due_str:
        return None

    try:
        due_dt = datetime.fromisoformat(due_str)
    except ValueError:
        return None

    user_tz = get_user_timezone()
    if due_dt.tzinfo is None:
        due_dt = due_dt.replace(tzinfo=user_tz)

    now_aware = datetime.now(timezone.utc)
    delta_minutes = (due_dt - now_aware).total_seconds() / 60

    if delta_minutes > 1440:
        # More than 24 hours away
        return None

    if 360 < delta_minutes <= 1440:
        req_interval = 180  # every 3 hours
        urgency = 'low'
        sound = 'Glass'
        msg = f"Upcoming: '{task['title']}' is due today in {round(delta_minutes / 60, 1)} hours."
    elif 120 < delta_minutes <= 360:
        req_interval = 60  # every 1 hour
        urgency = 'medium'
        sound = 'Glass'
        msg = f"Approaching: '{task['title']}' is due in {round(delta_minutes / 60, 1)} hours."
    elif 30 < delta_minutes <= 120:
        req_interval = 20  # every 20 minutes
        urgency = 'high'
        sound = 'Ping'
        msg = f"Warning: '{task['title']}' is due in {int(delta_minutes)} minutes!"
    elif 10 < delta_minutes <= 30:
        req_interval = 5  # every 5 minutes
        urgency = 'urgent'
        sound = 'Ping'
        msg = f"⚡ Urgent: '{task['title']}' deadline is in {int(delta_minutes)} minutes!"
    elif 0 <= delta_minutes <= 10:
        req_interval = 2  # every 2 minutes
        urgency = 'critical'
        sound = 'Sosumi'
        msg = f"🚨 FINAL CALL: '{task['title']}' is due in {int(delta_minutes)} minutes!"
    else:
        # Overdue! Escalates by priority
        overdue_min = abs(int(delta_minutes))
        p = task.get('priority', 2)
        req_interval = 1 if p == 1 else (2 if p == 2 else 3)
        urgency = 'emergency'
        sound = 'Hero'
        msg = f"🔥 OVERDUE: '{task['title']}' was due {overdue_min}m ago! Complete or snooze now."

    # Check last reminded timestamp
    last_reminded_str = task.get('last_reminded_at')
    if not last_reminded_str:
        # Never reminded yet and inside 24h window -> fire now!
        return {'urgency': urgency, 'sound': sound, 'msg': msg}

    try:
        last_dt = datetime.fromisoformat(last_reminded_str)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        elapsed_min = (now_aware - last_dt).total_seconds() / 60
        if elapsed_min >= req_interval:
            return {'urgency': urgency, 'sound': sound, 'msg': msg}
    except ValueError:
        return {'urgency': urgency, 'sound': sound, 'msg': msg}

    return None


def check_deadlines():
    """Polls active tasks and sends escalating prompts across devices."""
    now = datetime.now()
    tasks = db.get_active_tasks_with_deadline()

    for task in tasks:
        prompt = evaluate_task_reminder(task, now)
        if prompt:
            title = 'Fintask Alert'
            msg = prompt['msg']
            urgency = prompt['urgency']
            sound = prompt['sound']

            # 1. Native Mac Notification
            send_mac_notification(title, msg, sound=sound)

            # 2. Record in database (streamed to all connected browsers/devices)
            db.record_notification_prompt(task['id'], task['title'], msg, urgency)

            # 3. Mobile Push (ntfy.sh for phone/watch if configured)
            send_mobile_push(title, msg, urgency)


def start():
    # Run every 20 seconds to guarantee escalating interval precision
    scheduler.add_job(check_deadlines, 'interval', seconds=20, id='check_deadlines', replace_existing=True)
    scheduler.start()


def stop():
    scheduler.shutdown(wait=False)