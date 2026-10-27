import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task.dart';
import '../models/stats.dart';

class ApiService {
  static const String defaultCloudServer = 'https://web-production-975c4.up.railway.app';
  static const String _keyServerUrl = 'fintask_server_url';
  static const String _keyLocalTasks = 'fintask_local_tasks';
  static const String _keyNtfyTopic = 'fintask_ntfy_topic';

  static String _serverUrl = defaultCloudServer;
  static SharedPreferences? _prefs;

  static String get serverUrl => _serverUrl;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final saved = _prefs?.getString(_keyServerUrl);
    if (saved != null &&
        saved.trim().isNotEmpty &&
        !saved.contains('192.168.') &&
        !saved.contains('localhost') &&
        !saved.contains('127.0.0.1')) {
      _serverUrl = saved.trim();
    } else {
      _serverUrl = defaultCloudServer;
      await _prefs?.setString(_keyServerUrl, defaultCloudServer);
    }
  }

  static Future<void> setServerUrl(String url) async {
    String clean = url.trim();
    if (clean.isEmpty) clean = defaultCloudServer;
    clean = clean.replaceAll(RegExp(r'/+$'), '');
    _serverUrl = clean;
    await _prefs?.setString(_keyServerUrl, clean);
  }

  static Uri _buildUri(String path, [Map<String, String>? queryParams]) {
    final base = _serverUrl.replaceAll(RegExp(r'/+$'), '');
    final uriStr = '$base$path';
    final parsed = Uri.parse(uriStr);
    if (queryParams != null && queryParams.isNotEmpty) {
      return parsed.replace(queryParameters: queryParams);
    }
    return parsed;
  }

  // --- Offline Fallback Cache Helpers ---

  static List<Task> getLocalTasks() {
    try {
      final jsonStr = _prefs?.getString(_keyLocalTasks);
      if (jsonStr != null && jsonStr.isNotEmpty) {
        final List<dynamic> list = jsonDecode(jsonStr);
        return list.map((item) => Task.fromJson(item as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<void> saveLocalTasks(List<Task> tasks) async {
    try {
      final list = tasks.map((t) => t.toJson()).toList();
      await _prefs?.setString(_keyLocalTasks, jsonEncode(list));
    } catch (_) {}
  }

  static List<Task> filterTasksByView(List<Task> allTasks, String view) {
    final now = DateTime.now();
    final todayStr = DateFormat('yyyy-MM-dd').format(now);

    if (view == 'done') {
      return allTasks.where((t) => t.done).toList();
    }
    if (view == 'overdue') {
      return allTasks.where((t) => !t.done && t.isOverdue).toList();
    }
    if (view == 'today') {
      return allTasks.where((t) {
        if (t.done || t.dueAt == null) return false;
        final dStr = t.dueAt!.length >= 10 ? t.dueAt!.substring(0, 10) : '';
        return dStr.compareTo(todayStr) <= 0;
      }).toList();
    }
    if (view == 'upcoming') {
      return allTasks.where((t) {
        if (t.done) return false;
        if (t.dueAt == null) return true;
        final dStr = t.dueAt!.length >= 10 ? t.dueAt!.substring(0, 10) : '';
        final dt = t.dueDateTime;
        return dStr.compareTo(todayStr) > 0 && (dt == null || !dt.isBefore(now));
      }).toList();
    }
    return allTasks;
  }

  static Stats computeLocalStats(List<Task> allTasks) {
    final now = DateTime.now();
    final todayStr = DateFormat('yyyy-MM-dd').format(now);

    final total = allTasks.length;
    final done = allTasks.where((t) => t.done).length;
    final overdue = allTasks.where((t) => !t.done && t.isOverdue).length;
    final today = allTasks.where((t) {
      if (t.done || t.dueAt == null) return false;
      final dStr = t.dueAt!.length >= 10 ? t.dueAt!.substring(0, 10) : '';
      return dStr == todayStr;
    }).length;
    final pending = allTasks.where((t) => !t.done).length;

    return Stats(
      total: total,
      done: done,
      overdue: overdue,
      today: today,
      pending: pending,
    );
  }

  // --- API Endpoints ---

  static Future<bool> checkConnection() async {
    try {
      final res = await http.get(_buildUri('/health')).timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<Stats> getStats() async {
    final now = DateTime.now();
    final nowStr = DateFormat("yyyy-MM-dd'T'HH:mm").format(now);
    final todayStr = DateFormat('yyyy-MM-dd').format(now);

    try {
      final res = await http.get(
        _buildUri('/api/stats', {
          'client_now': nowStr,
          'client_today': todayStr,
        }),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200 && res.headers['content-type']?.contains('application/json') == true) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        return Stats.fromJson(data);
      }
    } catch (_) {}

    return computeLocalStats(getLocalTasks());
  }

  static Future<List<Task>> listTasks(String view) async {
    final now = DateTime.now();
    final nowStr = DateFormat("yyyy-MM-dd'T'HH:mm").format(now);
    final todayStr = DateFormat('yyyy-MM-dd').format(now);

    try {
      final res = await http.get(
        _buildUri('/api/tasks', {
          'view': view,
          'client_now': nowStr,
          'client_today': todayStr,
        }),
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200 && res.headers['content-type']?.contains('application/json') == true) {
        final List<dynamic> data = jsonDecode(res.body);
        final serverTasks = data.map((item) => Task.fromJson(item as Map<String, dynamic>)).toList();

        // If loading all, update local cache
        if (view == 'all') {
          saveLocalTasks(serverTasks);
        }
        return serverTasks;
      }
    } catch (_) {}

    return filterTasksByView(getLocalTasks(), view);
  }

  static Future<Task> createTask({
    required String title,
    String notes = '',
    String? dueAt,
    int priority = 2,
  }) async {
    final payload = {
      'title': title.trim(),
      'notes': notes.trim(),
      'due_at': dueAt,
      'priority': priority,
    };

    final tempTask = Task(
      id: DateTime.now().millisecondsSinceEpoch,
      title: title.trim(),
      notes: notes.trim(),
      dueAt: dueAt,
      priority: priority,
      done: false,
    );

    try {
      final res = await http.post(
        _buildUri('/api/tasks'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 201 && res.headers['content-type']?.contains('application/json') == true) {
        final created = Task.fromJson(jsonDecode(res.body));
        final current = getLocalTasks().where((t) => t.id != created.id).toList();
        saveLocalTasks([created, ...current]);
        return created;
      }
    } catch (_) {}

    final current = getLocalTasks();
    saveLocalTasks([tempTask, ...current]);
    return tempTask;
  }

  static Future<void> updateTask(int id, Map<String, dynamic> changes) async {
    final current = getLocalTasks();
    final updatedList = current.map((t) {
      if (t.id == id) {
        return t.copyWith(
          title: changes['title'] as String?,
          notes: changes['notes'] as String?,
          dueAt: changes.containsKey('due_at') ? changes['due_at'] as String? : t.dueAt,
          priority: changes['priority'] as int?,
        );
      }
      return t;
    }).toList();
    saveLocalTasks(updatedList);

    try {
      await http.patch(
        _buildUri('/api/tasks/$id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(changes),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  static Future<void> toggleComplete(Task task) async {
    final newDone = !task.done;
    final current = getLocalTasks();
    final updatedList = current.map((t) => t.id == task.id ? t.copyWith(done: newDone) : t).toList();
    saveLocalTasks(updatedList);

    try {
      final action = task.done ? 'reopen' : 'complete';
      await http.post(_buildUri('/api/tasks/${task.id}/$action')).timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  static Future<void> snoozeTask(int id, int minutes) async {
    final now = DateTime.now();
    final newDue = now.add(Duration(minutes: minutes));
    final newDueIso = DateFormat("yyyy-MM-dd'T'HH:mm").format(newDue);

    final current = getLocalTasks();
    final updatedList = current.map((t) => t.id == id ? t.copyWith(dueAt: newDueIso) : t).toList();
    saveLocalTasks(updatedList);

    try {
      await http.post(
        _buildUri('/api/tasks/$id/snooze', {'minutes': minutes.toString()}),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  static Future<void> deleteTask(int id) async {
    final current = getLocalTasks();
    final remaining = current.where((t) => t.id != id).toList();
    saveLocalTasks(remaining);

    try {
      await http.delete(_buildUri('/api/tasks/$id')).timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  static Future<List<Map<String, dynamic>>> pollNotifications(int sinceId) async {
    try {
      final res = await http.get(
        _buildUri('/api/notifications/poll', {'since_id': sinceId.toString()}),
      ).timeout(const Duration(seconds: 4));

      if (res.statusCode == 200 && res.headers['content-type']?.contains('application/json') == true) {
        final List<dynamic> list = jsonDecode(res.body);
        return list.map((e) => e as Map<String, dynamic>).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<Map<String, dynamic>> getSettings() async {
    try {
      final res = await http.get(_buildUri('/api/settings')).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200 && res.headers['content-type']?.contains('application/json') == true) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['ntfy_topic'] != null) {
          await _prefs?.setString(_keyNtfyTopic, data['ntfy_topic'].toString());
        }
        return data;
      }
    } catch (_) {}

    return {
      'ntfy_topic': _prefs?.getString(_keyNtfyTopic) ?? '',
      'timezone': 'Asia/Kolkata',
    };
  }

  static Future<void> updateSettings(Map<String, dynamic> payload) async {
    if (payload.containsKey('ntfy_topic')) {
      await _prefs?.setString(_keyNtfyTopic, payload['ntfy_topic'].toString());
    }

    try {
      await http.post(
        _buildUri('/api/settings'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  static Future<bool> testNotification() async {
    try {
      final res = await http.post(_buildUri('/api/test-notification')).timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<Map<String, dynamic>?> processTask(Map<String, dynamic> payload) async {
    try {
      final res = await http.post(
        _buildUri('/api/heavy-task'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200 && res.headers['content-type']?.contains('application/json') == true) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }
}
