import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import '../models/task.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String channelId = 'fintask-deadlines';
  static const String channelName = 'Deadline Alerts & Escalating Prompts';
  static const String channelDescription =
      'Heads-up alarms and reminders as task deadlines approach';

  static bool _initialized = false;

  static Future<void> init() async {
    if (_initialized) return;

    try {
      tz.initializeTimeZones();
    } catch (_) {}

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const linuxSettings = LinuxInitializationSettings(
      defaultActionName: 'Open Fintask',
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
      macOS: darwinSettings,
      linux: linuxSettings,
    );

    try {
      await _notificationsPlugin.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          // Can handle navigation or action
        },
      );

      // Create Android Channel
      if (!kIsWeb && Platform.isAndroid) {
        final androidImplementation = _notificationsPlugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
        if (androidImplementation != null) {
          await androidImplementation.createNotificationChannel(
            const AndroidNotificationChannel(
              channelId,
              channelName,
              description: channelDescription,
              importance: Importance.max,
              playSound: true,
              enableVibration: true,
              showBadge: true,
            ),
          );
        }
      }

      _initialized = true;
    } catch (e) {
      debugPrint('Notification init warning: $e');
    }
  }

  static Future<bool> requestPermission() async {
    try {
      if (!kIsWeb && Platform.isAndroid) {
        final androidImpl = _notificationsPlugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
        final granted = await androidImpl?.requestNotificationsPermission();
        return granted ?? false;
      } else if (!kIsWeb && (Platform.isIOS || Platform.isMacOS)) {
        final iosImpl = _notificationsPlugin
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
        final granted = await iosImpl?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
        return granted ?? false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      channelId,
      channelName,
      channelDescription: channelDescription,
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
      macOS: darwinDetails,
    );

    try {
      await _notificationsPlugin.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: notificationDetails,
        payload: payload,
      );
    } catch (e) {
      debugPrint('Failed to display notification: $e');
    }
  }

  static Future<void> scheduleTaskNotifications(Task task) async {
    if (task.done || task.dueAt == null) return;
    final due = task.dueDateTime;
    if (due == null) return;

    final now = DateTime.now();

    // Cascading notification alert checkpoints:
    // (minutes before deadline, notification label)
    final offsets = [
      (120, 'Due in 2 hours'),
      (60, 'Due in 1 hour!'),
      (30, '🚨 30 minutes remaining'),
      (10, '🔥 Urgent: 10 minutes left!'),
      (0, '⏰ Deadline reached! Complete or snooze'),
      (-2, '⚠️ OVERDUE: Task was due 2 mins ago!'),
      (-5, '🚨 OVERDUE: Task was due 5 mins ago!'),
    ];

    for (int i = 0; i < offsets.length; i++) {
      final minsBefore = offsets[i].$1;
      final label = offsets[i].$2;
      final alertTime = due.subtract(Duration(minutes: minsBefore));

      if (alertTime.isAfter(now)) {
        // Unique deterministic notification ID for each checkpoint
        final notifId = (task.id.abs() % 100000) * 10 + i;
        try {
          final tzAlertTime = tz.TZDateTime.from(alertTime, tz.local);
          await _notificationsPlugin.zonedSchedule(
            id: notifId,
            title: 'Fintask: ${task.title}',
            body: label,
            scheduledDate: tzAlertTime,
            notificationDetails: const NotificationDetails(
              android: AndroidNotificationDetails(
                channelId,
                channelName,
                channelDescription: channelDescription,
                importance: Importance.max,
                priority: Priority.high,
                playSound: true,
              ),
              iOS: DarwinNotificationDetails(
                presentAlert: true,
                presentBadge: true,
                presentSound: true,
              ),
            ),
            androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          );
        } catch (_) {}
      }
    }
  }

  static Future<void> cancelTaskNotifications(int taskId) async {
    for (int i = 0; i < 7; i++) {
      final notifId = (taskId.abs() % 100000) * 10 + i;
      try {
        await _notificationsPlugin.cancel(id: notifId);
      } catch (_) {}
    }
  }

  static Future<void> scheduleAllActiveTasks(List<Task> tasks) async {
    for (final task in tasks) {
      if (!task.done && task.dueAt != null) {
        await scheduleTaskNotifications(task);
      }
    }
  }
}
