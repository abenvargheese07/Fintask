import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Create a high-importance notification channel for Android 8.0+
export async function setupNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'fintask-deadlines',
      name: 'Deadline Alerts & Escalating Prompts',
      description: 'Heads-up alarms and reminders as task deadlines approach',
      importance: 5, // MAX importance: displays heads-up banner and makes sound
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#e0a96d',
    });
  } catch (err) {
    console.warn('Notification channel setup failed:', err);
  }
}

// Request permission from the user
export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (err) {
      console.warn('Error requesting local notification permission:', err);
      return false;
    }
  } else if (typeof Notification !== 'undefined') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

// Trigger an immediate test notification on this device
export async function triggerNativeTestAlert() {
  if (Capacitor.isNativePlatform()) {
    try {
      await setupNotificationChannel();
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        throw new Error('Notification permission not granted by user');
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: '⚡ Fintask Alert Triggered',
            body: 'Push notifications are active on this phone! You will receive escalating prompts as deadlines approach.',
            id: 99999,
            channelId: 'fintask-deadlines',
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
            sound: 'default',
            smallIcon: 'ic_launcher_round',
            actionTypeId: '',
            extra: { type: 'test' }
          }
        ]
      });
      return { ok: true, native: true };
    } catch (err) {
      console.warn('Native test alert failed, falling back:', err);
      return { ok: false, error: err.message };
    }
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('⚡ Fintask Alert Triggered', {
      body: 'Desktop notifications are active!',
      icon: '/logo.png'
    });
    return { ok: true, native: false };
  }
  return { ok: false, error: 'Notifications not supported or blocked' };
}

// Schedule escalating local notifications for a task (approaching + overdue)
export async function scheduleTaskNotifications(task) {
  if (!Capacitor.isNativePlatform() || !task.due_at || task.done) return;

  try {
    await setupNotificationChannel();
    const dueTime = new Date(task.due_at).getTime();
    const now = Date.now();
    if (isNaN(dueTime)) return;

    // Escalating offsets in minutes relative to deadline:
    // positive = minutes before deadline; 0 = at deadline; negative = minutes after deadline (overdue)
    const offsets = [
      { mins: 120, label: 'Due in 2 hours' },
      { mins: 60, label: 'Due in 1 hour!' },
      { mins: 30, label: '🚨 30 minutes remaining' },
      { mins: 10, label: '🔥 Urgent: 10 minutes left!' },
      { mins: 0, label: '⏰ Deadline reached!' },
      { mins: -2, label: '⚠️ Overdue by 2 mins!' },
      { mins: -5, label: '🚨 Overdue by 5 mins!' },
      { mins: -15, label: '🔥 OVERDUE by 15 mins! Complete or snooze.' },
      { mins: -30, label: '💀 OVERDUE by 30 mins!' },
      { mins: -60, label: '🚨 1 Hour Overdue! Action required.' }
    ];

    const notifications = [];
    const baseId = (task.id % 10000) * 10;

    offsets.forEach((offset, idx) => {
      const triggerTime = dueTime - offset.mins * 60 * 1000;
      if (triggerTime > now) {
        notifications.push({
          title: offset.mins <= 0 ? `🚨 Overdue: ${task.title}` : `Fintask: ${task.title}`,
          body: `${offset.label} Tap to complete or snooze.`,
          id: baseId + idx,
          channelId: 'fintask-deadlines',
          schedule: { at: new Date(triggerTime) },
          sound: 'default',
          smallIcon: 'ic_launcher_round',
          extra: { taskId: task.id, mins: offset.mins }
        });
      }
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.warn('Error scheduling task notifications:', err);
  }
}

// Reschedule all active tasks with deadlines on phone
export async function scheduleAllActiveTasks(tasks) {
  if (!Capacitor.isNativePlatform() || !Array.isArray(tasks)) return;
  for (const t of tasks) {
    if (!t.done && t.due_at) {
      await scheduleTaskNotifications(t);
    }
  }
}

// Cancel notifications for a task when marked done or deleted
export async function cancelTaskNotifications(taskId) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const baseId = (taskId % 10000) * 10;
    const idsToCancel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => ({ id: baseId + idx }));
    await LocalNotifications.cancel({ notifications: idsToCancel });
  } catch (err) {
    console.warn('Error cancelling task notifications:', err);
  }
}

// Initialize native mobile push channel & check permission on startup
export async function initMobileNotifications() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await setupNotificationChannel();
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    }
    return true;
  } catch (e) {
    console.warn('Init mobile notifications failed:', e);
    return false;
  }
}

// Display immediate native status bar & lock-screen notification on phone / browser
export async function showNativeNotification(title, body, id = Math.floor(Date.now() % 100000)) {
  if (Capacitor.isNativePlatform()) {
    try {
      await setupNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Number(id) || Math.floor(Date.now() % 100000),
            channelId: 'fintask-deadlines',
            schedule: { at: new Date(Date.now() + 200) },
            sound: 'default',
            smallIcon: 'ic_launcher_round',
            extra: { type: 'alert' }
          }
        ]
      });
      return true;
    } catch (e) {
      console.warn('Native LocalNotifications.schedule failed:', e);
      return false;
    }
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/logo.png',
        tag: `fintask-${id}`,
      });
      return true;
    } catch (e) {}
  }
  return false;
}
