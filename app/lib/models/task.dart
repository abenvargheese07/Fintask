import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme/app_theme.dart';

enum DeadlineStatus {
  overdue,
  critical, // <= 10 mins
  urgent,   // <= 30 mins
  soon,     // <= 120 mins
  today,
  upcoming,
  none,
  done,
}

class DeadlineBadgeInfo {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final Color borderColor;
  final DeadlineStatus status;

  DeadlineBadgeInfo({
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    required this.borderColor,
    required this.status,
  });
}

class CadenceTierInfo {
  final String label;
  final Color color;

  CadenceTierInfo({required this.label, required this.color});
}

class Task {
  final int id;
  final String title;
  final String notes;
  final String? dueAt; // ISO: YYYY-MM-DDTHH:MM
  final int priority;  // 1: High, 2: Med, 3: Low
  final bool done;
  final String? createdAt;
  final String? updatedAt;

  Task({
    required this.id,
    required this.title,
    this.notes = '',
    this.dueAt,
    this.priority = 2,
    this.done = false,
    this.createdAt,
    this.updatedAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    // Some endpoints may return done as integer 0/1 or boolean true/false
    bool isDone = false;
    if (json['done'] is bool) {
      isDone = json['done'] as bool;
    } else if (json['done'] is int) {
      isDone = (json['done'] as int) == 1;
    }

    return Task(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] as String? ?? '',
      notes: json['notes'] as String? ?? '',
      dueAt: json['due_at'] as String?,
      priority: json['priority'] is int ? json['priority'] as int : int.tryParse(json['priority'].toString()) ?? 2,
      done: isDone,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'notes': notes,
      'due_at': dueAt,
      'priority': priority,
      'done': done ? 1 : 0,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
    };
  }

  Task copyWith({
    int? id,
    String? title,
    String? notes,
    String? dueAt,
    int? priority,
    bool? done,
    String? createdAt,
    String? updatedAt,
  }) {
    return Task(
      id: id ?? this.id,
      title: title ?? this.title,
      notes: notes ?? this.notes,
      dueAt: dueAt ?? this.dueAt,
      priority: priority ?? this.priority,
      done: done ?? this.done,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  DateTime? get dueDateTime {
    if (dueAt == null || dueAt!.trim().isEmpty) return null;
    try {
      return DateTime.parse(dueAt!);
    } catch (_) {
      return null;
    }
  }

  bool get isOverdue {
    if (done) return false;
    final dt = dueDateTime;
    if (dt == null) return false;
    return dt.isBefore(DateTime.now());
  }

  Color get priorityColor {
    switch (priority) {
      case 1:
        return AppTheme.p1High;
      case 2:
        return AppTheme.p2Med;
      case 3:
      default:
        return AppTheme.p3Low;
    }
  }

  String get priorityLabel {
    switch (priority) {
      case 1:
        return 'P1 High';
      case 2:
        return 'P2 Med';
      case 3:
      default:
        return 'P3 Low';
    }
  }

  DeadlineBadgeInfo get deadlineBadge {
    if (done) {
      final formatted = dueDateTime != null
          ? DateFormat('MMM d, h:mm a').format(dueDateTime!)
          : 'Done';
      return DeadlineBadgeInfo(
        label: 'Completed • $formatted',
        backgroundColor: const Color(0x2210B981),
        textColor: AppTheme.p3Low,
        borderColor: const Color(0x4410B981),
        status: DeadlineStatus.done,
      );
    }

    final dt = dueDateTime;
    if (dt == null) {
      return DeadlineBadgeInfo(
        label: 'No deadline',
        backgroundColor: const Color(0x1A94A3B8),
        textColor: AppTheme.textMuted,
        borderColor: const Color(0x2A94A3B8),
        status: DeadlineStatus.none,
      );
    }

    final now = DateTime.now();
    final diff = dt.difference(now);
    final diffMin = diff.inMinutes;

    if (diffMin < 0) {
      final overdueMins = diffMin.abs();
      String overdueStr;
      if (overdueMins < 60) {
        overdueStr = '⚠️ Overdue by ${overdueMins}m';
      } else {
        final hours = overdueMins ~/ 60;
        if (hours < 24) {
          overdueStr = '⚠️ Overdue by ${hours}h';
        } else {
          final days = hours ~/ 24;
          overdueStr = '⚠️ Overdue by ${days}d';
        }
      }
      return DeadlineBadgeInfo(
        label: overdueStr,
        backgroundColor: const Color(0x33EF4444),
        textColor: AppTheme.overdueRed,
        borderColor: const Color(0x66EF4444),
        status: DeadlineStatus.overdue,
      );
    }

    if (diffMin <= 10) {
      return DeadlineBadgeInfo(
        label: '🚨 Due in ${diffMin}m',
        backgroundColor: const Color(0x33F43F5E),
        textColor: AppTheme.p1High,
        borderColor: const Color(0x66F43F5E),
        status: DeadlineStatus.critical,
      );
    }

    if (diffMin <= 120) {
      return DeadlineBadgeInfo(
        label: '⚡ Due in ${diffMin}m',
        backgroundColor: const Color(0x33F59E0B),
        textColor: AppTheme.p2Med,
        borderColor: const Color(0x66F59E0B),
        status: DeadlineStatus.soon,
      );
    }

    final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
    if (isToday) {
      final timeStr = DateFormat('h:mm a').format(dt);
      return DeadlineBadgeInfo(
        label: '⏰ Today at $timeStr',
        backgroundColor: const Color(0x266366F1),
        textColor: const Color(0xFF818CF8),
        borderColor: const Color(0x446366F1),
        status: DeadlineStatus.today,
      );
    }

    final tomorrow = now.add(const Duration(days: 1));
    final isTomorrow = dt.year == tomorrow.year && dt.month == tomorrow.month && dt.day == tomorrow.day;
    if (isTomorrow) {
      final timeStr = DateFormat('h:mm a').format(dt);
      return DeadlineBadgeInfo(
        label: 'Tomorrow at $timeStr',
        backgroundColor: const Color(0x1FFFFFFF),
        textColor: AppTheme.textPrimary,
        borderColor: AppTheme.glassBorder,
        status: DeadlineStatus.upcoming,
      );
    }

    final dateStr = DateFormat('MMM d, h:mm a').format(dt);
    return DeadlineBadgeInfo(
      label: dateStr,
      backgroundColor: const Color(0x14FFFFFF),
      textColor: AppTheme.textSecondary,
      borderColor: AppTheme.glassBorderSubtle,
      status: DeadlineStatus.upcoming,
    );
  }

  CadenceTierInfo? get escalatingCadenceTier {
    if (done || dueDateTime == null) return null;
    final dt = dueDateTime!;
    final now = DateTime.now();
    final diffMin = dt.difference(now).inMinutes;

    if (diffMin < 0) {
      final freq = priority == 1 ? 'Every 1 min' : (priority == 2 ? 'Every 2 mins' : 'Every 3 mins');
      return CadenceTierInfo(
        label: '🚨 Overdue Cadence: $freq',
        color: AppTheme.overdueRed,
      );
    }
    if (diffMin <= 10) {
      return CadenceTierInfo(
        label: '🚨 Final 10m: Prompting Every 2 mins',
        color: AppTheme.p1High,
      );
    }
    if (diffMin <= 30) {
      return CadenceTierInfo(
        label: '⚡ Imminent: Prompting Every 5 mins',
        color: AppTheme.p2Med,
      );
    }
    if (diffMin <= 120) {
      return CadenceTierInfo(
        label: '⏰ Approaching: Prompting Every 20 mins',
        color: const Color(0xFFFBBF24),
      );
    }
    if (diffMin <= 360) {
      return CadenceTierInfo(
        label: '⏰ Prompts: Every 1 hour',
        color: AppTheme.textSecondary,
      );
    }
    if (diffMin <= 1440) {
      return CadenceTierInfo(
        label: '📅 Due Today: Prompts every 3 hours',
        color: AppTheme.textMuted,
      );
    }
    return null;
  }
}
