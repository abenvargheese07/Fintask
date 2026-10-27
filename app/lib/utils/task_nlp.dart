import 'package:intl/intl.dart';

class TaskNlpResult {
  final bool hasSuggestion;
  final String cleanTitle;
  final String? detectedDueAt;
  final int? detectedPriority;
  final String label;
  final String rawSnippet;

  const TaskNlpResult({
    required this.hasSuggestion,
    required this.cleanTitle,
    this.detectedDueAt,
    this.detectedPriority,
    this.label = '',
    this.rawSnippet = '',
  });

  static const TaskNlpResult empty = TaskNlpResult(
    hasSuggestion: false,
    cleanTitle: '',
  );
}

class TaskNlpParser {
  static String formatIso(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    final h = d.hour.toString().padLeft(2, '0');
    final min = d.minute.toString().padLeft(2, '0');
    return '$y-$m-${day}T$h:$min';
  }

  static TaskNlpResult parse(String rawInput) {
    if (rawInput.trim().isEmpty) {
      return TaskNlpResult(hasSuggestion: false, cleanTitle: rawInput);
    }

    String text = rawInput;
    int? detectedPriority;
    String? detectedDueAt;
    final List<String> matchedSnippets = [];

    // 1. Detect Priority: !p1, !high, !urgent, #p1, #high, !p2, !med, #p2, !p3, !low, #p3
    final p1Regex = RegExp(r'(?:^|\s)(!p1|!high|!urgent|#p1|#high)(?=\s|$)', caseSensitive: false);
    final p1Match = p1Regex.firstMatch(text);
    if (p1Match != null) {
      detectedPriority = 1;
      final snippet = p1Match.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    final p2Regex = RegExp(r'(?:^|\s)(!p2|!med|!medium|#p2|#med)(?=\s|$)', caseSensitive: false);
    final p2Match = p2Regex.firstMatch(text);
    if (detectedPriority == null && p2Match != null) {
      detectedPriority = 2;
      final snippet = p2Match.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    final p3Regex = RegExp(r'(?:^|\s)(!p3|!low|#p3|#low)(?=\s|$)', caseSensitive: false);
    final p3Match = p3Regex.firstMatch(text);
    if (detectedPriority == null && p3Match != null) {
      detectedPriority = 3;
      final snippet = p3Match.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    final now = DateTime.now();

    // 2. Relative Hours / Minutes: "in 2 hours", "in 30 mins", "in 1h", "in 45m"
    final relHoursRegex = RegExp(r'(?:^|\s)(in\s+(\d+)\s*(?:hours?|hrs?|h))(?=\s|$)', caseSensitive: false);
    final relHoursMatch = relHoursRegex.firstMatch(text);
    if (relHoursMatch != null) {
      final h = int.tryParse(relHoursMatch.group(2) ?? '0') ?? 0;
      final target = now.add(Duration(hours: h));
      detectedDueAt = formatIso(target);
      final snippet = relHoursMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    final relMinsRegex = RegExp(r'(?:^|\s)(in\s+(\d+)\s*(?:mins?|minutes?|m))(?=\s|$)', caseSensitive: false);
    final relMinsMatch = relMinsRegex.firstMatch(text);
    if (detectedDueAt == null && relMinsMatch != null) {
      final m = int.tryParse(relMinsMatch.group(2) ?? '0') ?? 0;
      final target = now.add(Duration(minutes: m));
      detectedDueAt = formatIso(target);
      final snippet = relMinsMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    // 3. Named Expressions: "tonight"
    final tonightRegex = RegExp(
      r'(?:^|\s)(tonight(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?)(?=\s|$)',
      caseSensitive: false,
    );
    final tonightMatch = tonightRegex.firstMatch(text);
    if (detectedDueAt == null && tonightMatch != null) {
      int hour = 21;
      int min = 0;
      final hourStr = tonightMatch.group(2);
      if (hourStr != null) {
        int h = int.tryParse(hourStr) ?? 21;
        final ampm = (tonightMatch.group(4) ?? '').toLowerCase();
        if (ampm == 'pm' && h < 12) h += 12;
        if (ampm == 'am' && h == 12) h = 0;
        hour = h;
        min = int.tryParse(tonightMatch.group(3) ?? '0') ?? 0;
      }
      var target = DateTime(now.year, now.month, now.day, hour, min);
      if (target.isBefore(now)) {
        target = target.add(const Duration(days: 1));
      }
      detectedDueAt = formatIso(target);
      final snippet = tonightMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    // 4. "tomorrow morning" / "tomorrow evening" / "tomorrow 5pm" / "tomorrow at 3pm" / "tomorrow"
    final tomorrowRegex = RegExp(
      r'(?:^|\s)(tomorrow(?:\s+(morning|evening|afternoon|(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?))?)(?=\s|$)',
      caseSensitive: false,
    );
    final tomorrowMatch = tomorrowRegex.firstMatch(text);
    if (detectedDueAt == null && tomorrowMatch != null) {
      int hour = 9;
      int min = 0;
      final sub = (tomorrowMatch.group(2) ?? '').toLowerCase();
      if (sub.contains('morning')) {
        hour = 9;
      } else if (sub.contains('evening') || sub.contains('afternoon')) {
        hour = 17;
      } else if (tomorrowMatch.group(3) != null) {
        int h = int.tryParse(tomorrowMatch.group(3)!) ?? 9;
        final ampm = (tomorrowMatch.group(5) ?? '').toLowerCase();
        if (ampm == 'pm' && h < 12) h += 12;
        if (ampm == 'am' && h == 12) h = 0;
        hour = h;
        min = int.tryParse(tomorrowMatch.group(4) ?? '0') ?? 0;
      }
      final tomorrow = now.add(const Duration(days: 1));
      final target = DateTime(tomorrow.year, tomorrow.month, tomorrow.day, hour, min);
      detectedDueAt = formatIso(target);
      final snippet = tomorrowMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    // 5. Day of Week: "this friday", "friday", "next monday", "monday at 3pm"
    final dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    final dayPattern = '(?:^|\\s)((?:this\\s+|next\\s+)?(${dayNames.join('|')})(?:\\s+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)?)(?=\\s|\$)';
    final dayRegex = RegExp(dayPattern, caseSensitive: false);
    final dayMatch = dayRegex.firstMatch(text);
    if (detectedDueAt == null && dayMatch != null) {
      final dayName = (dayMatch.group(2) ?? '').toLowerCase();
      final dayIndex = dayNames.indexOf(dayName);
      final isNext = (dayMatch.group(1) ?? '').toLowerCase().startsWith('next');
      
      // DateTime.weekday: Monday is 1, Sunday is 7. Convert to 0-6 Sunday=0
      final currentDay = now.weekday % 7;
      int diff = (dayIndex - currentDay + 7) % 7;
      if (diff == 0 || isNext) diff += 7;

      int hour = dayIndex == 5 ? 17 : 9; // Friday defaults to 5pm, others to 9am
      int min = 0;
      if (dayMatch.group(3) != null) {
        int h = int.tryParse(dayMatch.group(3)!) ?? hour;
        final ampm = (dayMatch.group(5) ?? '').toLowerCase();
        if (ampm == 'pm' && h < 12) h += 12;
        if (ampm == 'am' && h == 12) h = 0;
        hour = h;
        min = int.tryParse(dayMatch.group(4) ?? '0') ?? 0;
      }

      final targetDate = now.add(Duration(days: diff));
      final target = DateTime(targetDate.year, targetDate.month, targetDate.day, hour, min);
      detectedDueAt = formatIso(target);
      final snippet = dayMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    // 6. Generic "at 4pm", "at 10:30am" today
    final timeOnlyRegex = RegExp(r'(?:^|\s)(at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm))(?=\s|$)', caseSensitive: false);
    final timeOnlyMatch = timeOnlyRegex.firstMatch(text);
    if (detectedDueAt == null && timeOnlyMatch != null) {
      int h = int.tryParse(timeOnlyMatch.group(2) ?? '0') ?? 0;
      final ampm = (timeOnlyMatch.group(4) ?? '').toLowerCase();
      if (ampm == 'pm' && h < 12) h += 12;
      if (ampm == 'am' && h == 12) h = 0;
      final min = int.tryParse(timeOnlyMatch.group(3) ?? '0') ?? 0;

      var target = DateTime(now.year, now.month, now.day, h, min);
      if (target.isBefore(now)) {
        target = target.add(const Duration(days: 1)); // If passed today, assume tomorrow
      }
      detectedDueAt = formatIso(target);
      final snippet = timeOnlyMatch.group(1)!;
      matchedSnippets.add(snippet);
      text = text.replaceFirst(snippet, ' ');
    }

    final cleanTitle = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    final hasSuggestion = detectedDueAt != null || detectedPriority != null;

    final List<String> labelParts = [];
    if (detectedDueAt != null) {
      try {
        final d = DateTime.parse(detectedDueAt);
        final formattedDate = DateFormat('EEE, MMM d, h:mm a').format(d);
        labelParts.add('📅 $formattedDate');
      } catch (_) {}
    }
    if (detectedPriority != null) {
      final pLabel = detectedPriority == 1
          ? '🔥 High (P1)'
          : (detectedPriority == 2 ? '⚡ Med (P2)' : '🌱 Low (P3)');
      labelParts.add(pLabel);
    }

    return TaskNlpResult(
      hasSuggestion: hasSuggestion,
      cleanTitle: cleanTitle.isNotEmpty ? cleanTitle : rawInput.trim(),
      detectedDueAt: detectedDueAt,
      detectedPriority: detectedPriority,
      label: labelParts.join(' • '),
      rawSnippet: matchedSnippets.join(', '),
    );
  }
}
