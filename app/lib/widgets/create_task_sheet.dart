import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/audio_service.dart';
import '../theme/app_theme.dart';
import '../utils/task_nlp.dart';

class CreateTaskSheet extends StatefulWidget {
  final Function({
    required String title,
    String notes,
    String? dueAt,
    int priority,
  }) onCreate;

  const CreateTaskSheet({super.key, required this.onCreate});

  @override
  State<CreateTaskSheet> createState() => _CreateTaskSheetState();
}

class _CreateTaskSheetState extends State<CreateTaskSheet> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();
  final FocusNode _titleFocus = FocusNode();

  String? _dueAt;
  int _priority = 2;
  bool _showNotes = false;
  bool _nlpDismissed = false;

  TaskNlpResult _nlpResult = TaskNlpResult.empty;

  @override
  void initState() {
    super.initState();
    _titleController.addListener(_onTitleChanged);
  }

  @override
  void dispose() {
    _titleController.removeListener(_onTitleChanged);
    _titleController.dispose();
    _notesController.dispose();
    _titleFocus.dispose();
    super.dispose();
  }

  void _onTitleChanged() {
    final text = _titleController.text;
    if (_nlpDismissed || text.trim().isEmpty) {
      if (_nlpResult.hasSuggestion) {
        setState(() => _nlpResult = TaskNlpResult.empty);
      }
      return;
    }

    final parsed = TaskNlpParser.parse(text);
    setState(() {
      _nlpResult = parsed;
    });
  }

  void _applyNlp() {
    if (!_nlpResult.hasSuggestion) return;
    AudioService.triggerHaptic('medium');

    setState(() {
      if (_nlpResult.detectedDueAt != null) {
        _dueAt = _nlpResult.detectedDueAt;
      }
      if (_nlpResult.detectedPriority != null) {
        _priority = _nlpResult.detectedPriority!;
      }
      _titleController.text = _nlpResult.cleanTitle;
      _titleController.selection = TextSelection.fromPosition(
        TextPosition(offset: _titleController.text.length),
      );
      _nlpDismissed = true;
      _nlpResult = TaskNlpResult.empty;
    });
  }

  void _applyPreset(String type, [int? hours]) {
    AudioService.triggerHaptic('light');
    final now = DateTime.now();
    DateTime target;

    if (hours != null) {
      target = now.add(Duration(hours: hours));
    } else if (type == 'tonight') {
      target = DateTime(now.year, now.month, now.day, 21, 0);
      if (target.isBefore(now)) target = target.add(const Duration(days: 1));
    } else if (type == 'tomorrow_morning') {
      final tom = now.add(const Duration(days: 1));
      target = DateTime(tom.year, tom.month, tom.day, 9, 0);
    } else if (type == 'friday') {
      final currentDay = now.weekday % 7; // Sunday=0, Friday=5
      int diff = (5 - currentDay + 7) % 7;
      if (diff == 0) diff = 7;
      final fri = now.add(Duration(days: diff));
      target = DateTime(fri.year, fri.month, fri.day, 17, 0);
    } else {
      return;
    }

    setState(() {
      _dueAt = TaskNlpParser.formatIso(target);
    });
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final initialDate = _dueAt != null ? (DateTime.tryParse(_dueAt!) ?? now) : now;

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 3650)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppTheme.accentIndigo,
              surface: AppTheme.bgElevated,
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedDate == null || !mounted) return;

    final initialTime = TimeOfDay.fromDateTime(initialDate);
    final pickedTime = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppTheme.accentIndigo,
              surface: AppTheme.bgElevated,
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedTime == null) return;

    final combined = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );

    setState(() {
      _dueAt = TaskNlpParser.formatIso(combined);
    });
  }

  void _submit() {
    final title = _titleController.text.trim();
    if (title.isEmpty) return;

    AudioService.triggerHaptic('success');
    widget.onCreate(
      title: title,
      notes: _notesController.text.trim(),
      dueAt: _dueAt,
      priority: _priority,
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.bgElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: AppTheme.glassBorder, width: 1.5),
        ),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0x4DFFFFFF),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Schedule New Task',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textWhite,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Title Input
            TextField(
              controller: _titleController,
              focusNode: _titleFocus,
              autofocus: true,
              style: const TextStyle(fontSize: 16, color: AppTheme.textWhite, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'What needs to get done? (e.g. Call client tomorrow at 5pm !p1)',
                hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 14),
                filled: true,
                fillColor: const Color(0x33000000),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.glassBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.glassBorderSubtle),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.accentIndigo, width: 1.5),
                ),
              ),
              onSubmitted: (_) => _submit(),
            ),

            // Smart NLP Suggestion Pill
            if (_nlpResult.hasSuggestion) ...[
              const SizedBox(height: 10),
              InkWell(
                onTap: _applyNlp,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0x266366F1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0x666366F1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.auto_awesome, size: 16, color: Color(0xFFA5B4FC)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Detected: ${_nlpResult.label}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFC7D2FE),
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.accentIndigo,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Apply',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 14),

            // Quick Deadline Presets
            const Text(
              'QUICK DEADLINE PRESETS',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppTheme.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _presetChip('In 2h', () => _applyPreset('', 2)),
                  const SizedBox(width: 6),
                  _presetChip('Tonight 9pm', () => _applyPreset('tonight')),
                  const SizedBox(width: 6),
                  _presetChip('Tomorrow 9am', () => _applyPreset('tomorrow_morning')),
                  const SizedBox(width: 6),
                  _presetChip('Friday 5pm', () => _applyPreset('friday')),
                  const SizedBox(width: 6),
                  _presetChip('Custom Date 🗓️', _pickDateTime),
                ],
              ),
            ),

            if (_dueAt != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.event_available, size: 14, color: AppTheme.accentCyan),
                  const SizedBox(width: 6),
                  Text(
                    'Deadline: ${DateFormat('EEE, MMM d • h:mm a').format(DateTime.parse(_dueAt!))}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.accentCyan,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => setState(() => _dueAt = null),
                    child: const Text(
                      'Clear',
                      style: TextStyle(fontSize: 11, color: AppTheme.overdueRed, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 16),

            // Priority Selector
            const Text(
              'PRIORITY',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppTheme.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _priorityChip(1, '🔥 High (P1)', AppTheme.p1High)),
                const SizedBox(width: 8),
                Expanded(child: _priorityChip(2, '⚡ Med (P2)', AppTheme.p2Med)),
                const SizedBox(width: 8),
                Expanded(child: _priorityChip(3, '🌱 Low (P3)', AppTheme.p3Low)),
              ],
            ),

            const SizedBox(height: 14),

            // Notes Toggle
            if (!_showNotes)
              GestureDetector(
                onTap: () => setState(() => _showNotes = true),
                child: const Row(
                  children: [
                    Icon(Icons.notes, size: 16, color: AppTheme.textMuted),
                    SizedBox(width: 6),
                    Text(
                      '+ Add Notes / Details',
                      style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              )
            else
              TextField(
                controller: _notesController,
                maxLines: 3,
                style: const TextStyle(fontSize: 14, color: AppTheme.textWhite),
                decoration: InputDecoration(
                  hintText: 'Additional context, checklist, or links...',
                  hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  filled: true,
                  fillColor: const Color(0x33000000),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppTheme.glassBorderSubtle),
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // Submit Button
            ElevatedButton(
              onPressed: _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentIndigo,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 4,
                shadowColor: AppTheme.accentIndigo.withValues(alpha: 0.5),
              ),
              child: const Text(
                'Schedule Task 🎯',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _presetChip(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0x1AFFFFFF),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0x22FFFFFF)),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
        ),
      ),
    );
  }

  Widget _priorityChip(int p, String label, Color color) {
    final selected = _priority == p;
    return InkWell(
      onTap: () {
        AudioService.triggerHaptic('light');
        setState(() => _priority = p);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.25) : const Color(0x14FFFFFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? color : const Color(0x22FFFFFF),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? Colors.white : AppTheme.textMuted,
          ),
        ),
      ),
    );
  }
}
