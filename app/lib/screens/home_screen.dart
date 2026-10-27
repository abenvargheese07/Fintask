import 'dart:async';
import 'package:flutter/material.dart';
import '../models/task.dart';
import '../models/stats.dart';
import '../services/api_service.dart';
import '../services/audio_service.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';
import '../utils/task_nlp.dart';
import '../widgets/donut_gauge.dart';
import '../widgets/glass_card.dart';
import '../widgets/stat_tile.dart';
import '../widgets/task_card.dart';
import '../widgets/create_task_sheet.dart';
import '../widgets/edit_task_dialog.dart';
import '../widgets/settings_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Task> _tasks = [];
  Stats _stats = const Stats();
  String _activeTab = 'today';
  int? _priorityFilter; // null = all, 1 = P1, 2 = P2, 3 = P3
  String _searchQuery = '';
  String _syncStatus = 'checking'; // 'connected' | 'offline' | 'checking'

  bool _showSearchBar = false;
  final TextEditingController _searchController = TextEditingController();

  // Desktop inline add state
  final TextEditingController _desktopAddController = TextEditingController();
  TaskNlpResult _desktopNlpResult = TaskNlpResult.empty;

  Timer? _refreshTimer;
  Timer? _pollTimer;
  Timer? _deadlineTimer;

  int _lastNotificationId = 0;
  final Set<String> _alertedDeadlines = {};

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    await ApiService.init();
    await NotificationService.init();
    await NotificationService.requestPermission();

    await _refreshAll();
    await _checkServerStatus();

    // Setup periodic polling & deadlines
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _refreshAll());
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollNotifications());
    _deadlineTimer = Timer.periodic(const Duration(seconds: 10), (_) => _checkDeadlines());

    _desktopAddController.addListener(_onDesktopAddChanged);
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _pollTimer?.cancel();
    _deadlineTimer?.cancel();
    _searchController.dispose();
    _desktopAddController.dispose();
    super.dispose();
  }

  void _onDesktopAddChanged() {
    final text = _desktopAddController.text;
    if (text.trim().isEmpty) {
      if (_desktopNlpResult.hasSuggestion) {
        setState(() => _desktopNlpResult = TaskNlpResult.empty);
      }
      return;
    }
    final parsed = TaskNlpParser.parse(text);
    setState(() => _desktopNlpResult = parsed);
  }

  Future<void> _checkServerStatus() async {
    final ok = await ApiService.checkConnection();
    if (mounted) {
      setState(() => _syncStatus = ok ? 'connected' : 'offline');
    }
  }

  Future<void> _refreshAll() async {
    try {
      final stats = await ApiService.getStats();
      final tasks = await ApiService.listTasks(_activeTab);
      if (mounted) {
        setState(() {
          _stats = stats;
          _tasks = tasks;
        });
      }
      NotificationService.scheduleAllActiveTasks(tasks);
    } catch (_) {}
  }

  Future<void> _pollNotifications() async {
    try {
      final events = await ApiService.pollNotifications(_lastNotificationId);
      if (events.isNotEmpty) {
        for (final ev in events) {
          final id = ev['id'] is int ? ev['id'] as int : int.tryParse(ev['id'].toString()) ?? 0;
          if (id > _lastNotificationId) {
            _lastNotificationId = id;
          }
        }
        final latest = events.first;
        final title = latest['title']?.toString() ?? 'Fintask Alert';
        final msg = latest['message']?.toString() ?? 'Approaching deadline!';
        final urgency = latest['urgency']?.toString() ?? 'normal';

        AudioService.playChime(urgency);
        await NotificationService.showNotification(
          id: _lastNotificationId,
          title: title,
          body: msg,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg)),
          );
        }
        _refreshAll();
      }
    } catch (_) {}
  }

  void _checkDeadlines() {
    final now = DateTime.now();
    for (final task in _tasks) {
      if (task.done || task.dueAt == null) continue;
      final due = task.dueDateTime;
      if (due == null) continue;

      final diffMin = due.difference(now).inMinutes;
      String? alertKey;
      String? alertMsg;
      String? urgency;

      if (diffMin <= 0 && diffMin > -2) {
        alertKey = '${task.id}-deadline';
        alertMsg = '⏰ Deadline reached for "${task.title}"!';
        urgency = 'critical';
      } else if (diffMin <= -2 && diffMin > -5) {
        alertKey = '${task.id}-overdue-2m';
        alertMsg = '⚠️ OVERDUE: "${task.title}" was due 2m ago!';
        urgency = 'emergency';
      } else if (diffMin <= -15 && diffMin > -20) {
        alertKey = '${task.id}-overdue-15m';
        alertMsg = '🔥 OVERDUE: "${task.title}" was due 15m ago! Complete or snooze.';
        urgency = 'emergency';
      } else if (diffMin > 0 && diffMin <= 10) {
        alertKey = '${task.id}-approaching-10m';
        alertMsg = '⚡ 10 mins remaining for "${task.title}"!';
        urgency = 'urgent';
      }

      if (alertKey != null && alertMsg != null && !_alertedDeadlines.contains(alertKey)) {
        _alertedDeadlines.add(alertKey);
        AudioService.playChime(urgency ?? 'normal');
        NotificationService.showNotification(
          id: task.id.abs() % 100000,
          title: alertMsg,
          body: 'Tap to complete or snooze task in Fintask',
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(alertMsg)),
          );
        }
      }
    }
  }

  // Task Actions
  Future<void> _handleCreateTask({
    required String title,
    String notes = '',
    String? dueAt,
    int priority = 2,
  }) async {
    final task = await ApiService.createTask(
      title: title,
      notes: notes,
      dueAt: dueAt,
      priority: priority,
    );
    NotificationService.scheduleTaskNotifications(task);
    _refreshAll();
  }

  Future<void> _handleToggleComplete(Task task) async {
    AudioService.triggerHaptic(task.done ? 'light' : 'success');
    await ApiService.toggleComplete(task);
    if (!task.done) {
      NotificationService.cancelTaskNotifications(task.id);
    } else {
      NotificationService.scheduleTaskNotifications(task);
    }
    _refreshAll();
  }

  Future<void> _handleSnooze(int taskId, int minutes) async {
    AudioService.triggerHaptic('medium');
    await ApiService.snoozeTask(taskId, minutes);
    final text = minutes >= 1440 ? 'tomorrow' : (minutes >= 60 ? '${minutes ~/ 60}h' : '${minutes}m');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Deadline postponed by $text ⏰')),
      );
    }
    _refreshAll();
  }

  Future<void> _handleDeleteTask(Task task) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.bgElevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppTheme.glassBorder),
        ),
        title: const Text('Delete Task?', style: TextStyle(color: AppTheme.textWhite)),
        content: Text('Are you sure you want to delete "${task.title}"?', style: const TextStyle(color: AppTheme.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.overdueRed),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      AudioService.triggerHaptic('medium');
      await ApiService.deleteTask(task.id);
      NotificationService.cancelTaskNotifications(task.id);
      _refreshAll();
    }
  }

  void _openCreateSheet() {
    AudioService.triggerHaptic('light');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CreateTaskSheet(onCreate: _handleCreateTask),
    );
  }

  void _openEditDialog(Task task) {
    AudioService.triggerHaptic('light');
    showDialog(
      context: context,
      builder: (context) => EditTaskDialog(
        task: task,
        onSave: (changes) async {
          await ApiService.updateTask(task.id, changes);
          _refreshAll();
        },
      ),
    );
  }

  void _openSettingsDialog() {
    AudioService.triggerHaptic('light');
    showDialog(
      context: context,
      builder: (context) => SettingsDialog(onRefresh: _refreshAll),
    );
  }

  // Filtered task list
  List<Task> get _filteredTasks {
    return _tasks.where((t) {
      if (_priorityFilter != null && t.priority != _priorityFilter) {
        return false;
      }
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final inTitle = t.title.toLowerCase().contains(q);
        final inNotes = t.notes.toLowerCase().contains(q);
        return inTitle || inNotes;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 840;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: Stack(
        children: [
          // Ambient Room Wallpaper & Subtle Spatial Veil
          Positioned.fill(
            child: Image.asset(
              'assets/images/bg.jpg',
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(color: AppTheme.bgDark),
            ),
          ),
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0, -0.4),
                  radius: 1.2,
                  colors: [
                    Color(0xA60F121A),
                    Color(0xF0090B10),
                  ],
                ),
              ),
            ),
          ),

          // Main View Content (Desktop vs Mobile)
          SafeArea(
            child: isDesktop ? _buildDesktopLayout() : _buildMobileLayout(),
          ),
        ],
      ),
      floatingActionButton: isDesktop
          ? null
          : FloatingActionButton.extended(
              onPressed: _openCreateSheet,
              backgroundColor: AppTheme.accentIndigo,
              foregroundColor: Colors.white,
              elevation: 6,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Add Task', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
    );
  }

  // ==========================================
  // MOBILE TOUCH-FIRST LAYOUT
  // ==========================================
  Widget _buildMobileLayout() {
    return Column(
      children: [
        // Top Blurred App Bar
        _buildMobileHeader(),

        // Search Bar (if expanded)
        if (_showSearchBar)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchController,
              autofocus: true,
              style: const TextStyle(fontSize: 14, color: AppTheme.textWhite),
              decoration: InputDecoration(
                hintText: 'Search tasks or notes...',
                hintStyle: const TextStyle(color: AppTheme.textMuted),
                filled: true,
                fillColor: const Color(0x33000000),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textMuted),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.close, size: 16, color: AppTheme.textMuted),
                  onPressed: () {
                    _searchController.clear();
                    setState(() {
                      _searchQuery = '';
                      _showSearchBar = false;
                    });
                  },
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onChanged: (val) => setState(() => _searchQuery = val),
            ),
          ),

        // Scrollable Body
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refreshAll,
            color: AppTheme.accentIndigo,
            backgroundColor: AppTheme.bgElevated,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                // Hero Dashboard Card with Radial Gauge
                _buildHeroCard(),

                const SizedBox(height: 16),

                // Nav Tabs Capsule Scroll
                _buildNavTabs(),

                const SizedBox(height: 12),

                // Priority Filter Row
                _buildPriorityFilterRow(),

                const SizedBox(height: 14),

                // Tasks Feed List
                ..._buildTasksList(),

                const SizedBox(height: 80), // Fab spacing
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Color(0x9E0E1219),
        border: Border(bottom: BorderSide(color: AppTheme.glassBorderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0x2EFFFFFF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.glassHighlight),
                  boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 8)],
                ),
                alignment: Alignment.center,
                child: const Text(
                  'F',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Fintask',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textWhite,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _syncStatus == 'connected' ? AppTheme.p3Low : AppTheme.overdueRed,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _syncStatus == 'connected' ? 'Cloud Synced' : 'Offline / Standalone',
                        style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              IconButton(
                icon: Icon(
                  _showSearchBar ? Icons.search_off : Icons.search,
                  size: 20,
                  color: AppTheme.textSecondary,
                ),
                onPressed: () => setState(() => _showSearchBar = !_showSearchBar),
              ),
              IconButton(
                icon: const Icon(Icons.flash_on, size: 20, color: AppTheme.p2Med),
                tooltip: 'Test Alert',
                onPressed: () async {
                  AudioService.playChime('urgent');
                  await ApiService.testNotification();
                  await NotificationService.showNotification(
                    id: 88888,
                    title: '⚡ Test Alert',
                    body: 'Escalating deadline alerts active!',
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.settings_outlined, size: 20, color: AppTheme.textSecondary),
                onPressed: _openSettingsDialog,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeroCard() {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      borderRadius: 22,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Task Engine',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${_stats.pending} pending tasks remaining',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                ],
              ),
              DonutGauge(percentage: _stats.completionPercent, size: 68, strokeWidth: 6),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: StatTile(label: 'Total', count: _stats.total)),
              const SizedBox(width: 8),
              Expanded(child: StatTile(label: 'Done', count: _stats.done, countColor: AppTheme.p3Low)),
              const SizedBox(width: 8),
              Expanded(child: StatTile(label: 'Overdue', count: _stats.overdue, countColor: _stats.overdue > 0 ? AppTheme.overdueRed : null)),
              const SizedBox(width: 8),
              Expanded(child: StatTile(label: 'Today', count: _stats.today, countColor: const Color(0xFF818CF8))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNavTabs() {
    final tabs = [
      ('today', 'Today', _stats.today),
      ('upcoming', 'Upcoming', 0),
      ('overdue', 'Overdue', _stats.overdue),
      ('all', 'All Tasks', _stats.total),
      ('done', 'Completed', _stats.done),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((tab) {
          final isSelected = _activeTab == tab.$1;
          final count = tab.$3;

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () {
                AudioService.triggerHaptic('light');
                setState(() => _activeTab = tab.$1);
                _refreshAll();
              },
              borderRadius: BorderRadius.circular(999),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : const Color(0x1AFFFFFF),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: isSelected ? Colors.white : AppTheme.glassBorderSubtle,
                  ),
                  boxShadow: isSelected
                      ? const [BoxShadow(color: Color(0x33FFFFFF), blurRadius: 10)]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      tab.$2,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: isSelected ? const Color(0xFF10141D) : AppTheme.textSecondary,
                      ),
                    ),
                    if (count > 0 && tab.$1 != 'upcoming') ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF10141D) : const Color(0x33FFFFFF),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          count.toString(),
                          style: AppTheme.monoTextStyle.copyWith(
                            fontSize: 10,
                            color: isSelected ? Colors.white : AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPriorityFilterRow() {
    return Row(
      children: [
        _priorityChip(null, 'All Priorities'),
        const SizedBox(width: 6),
        _priorityChip(1, '🔥 High', AppTheme.p1High),
        const SizedBox(width: 6),
        _priorityChip(2, '⚡ Med', AppTheme.p2Med),
        const SizedBox(width: 6),
        _priorityChip(3, '🌱 Low', AppTheme.p3Low),
      ],
    );
  }

  Widget _priorityChip(int? p, String label, [Color? color]) {
    final isSelected = _priorityFilter == p;
    return InkWell(
      onTap: () {
        AudioService.triggerHaptic('light');
        setState(() => _priorityFilter = p);
      },
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? (color?.withValues(alpha: 0.3) ?? const Color(0x38FFFFFF)) : const Color(0x0FFFFFFF),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected ? (color ?? Colors.white) : const Color(0x1AFFFFFF),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : AppTheme.textMuted,
          ),
        ),
      ),
    );
  }

  List<Widget> _buildTasksList() {
    final tasks = _filteredTasks;
    if (tasks.isEmpty) {
      return [
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Column(
              children: [
                const Icon(Icons.task_alt, size: 48, color: Color(0x38FFFFFF)),
                const SizedBox(height: 12),
                Text(
                  _searchQuery.isNotEmpty ? 'No tasks match search' : 'No tasks in this view',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                ),
              ],
            ),
          ),
        ),
      ];
    }

    return tasks.map((task) {
      return TaskCard(
        task: task,
        onToggleComplete: () => _handleToggleComplete(task),
        onSnooze: (mins) => _handleSnooze(task.id, mins),
        onEdit: () => _openEditDialog(task),
        onDelete: () => _handleDeleteTask(task),
      );
    }).toList();
  }

  // ==========================================
  // DESKTOP SPATIAL VISIONOS LAYOUT
  // ==========================================
  Widget _buildDesktopLayout() {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 1200),
        padding: const EdgeInsets.all(24),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Spatial Sidebar (300px)
            SizedBox(
              width: 290,
              child: Column(
                children: [
                  _buildDesktopSidebar(),
                ],
              ),
            ),

            const SizedBox(width: 24),

            // Main Stage
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildDesktopTopBar(),
                  const SizedBox(height: 16),
                  _buildDesktopInlineAdd(),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildPriorityFilterRow(),
                      SizedBox(
                        width: 240,
                        child: TextField(
                          controller: _searchController,
                          style: const TextStyle(fontSize: 13, color: AppTheme.textWhite),
                          decoration: InputDecoration(
                            hintText: 'Search tasks...',
                            hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                            filled: true,
                            fillColor: const Color(0x33000000),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            prefixIcon: const Icon(Icons.search, size: 16, color: AppTheme.textMuted),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onChanged: (val) => setState(() => _searchQuery = val),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView(
                      children: _buildTasksList(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDesktopSidebar() {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      borderRadius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Logo & Title
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0x2EFFFFFF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.glassHighlight),
                ),
                alignment: Alignment.center,
                child: const Text('F', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
              ),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Fintask', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                  Text('VisionOS Task Engine', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                ],
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Donut Gauge Summary
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Completion', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
                  Text('${_stats.done}/${_stats.total} tasks completed', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                ],
              ),
              DonutGauge(percentage: _stats.completionPercent, size: 60, strokeWidth: 5.5),
            ],
          ),

          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 14),

          // Sidebar Navigation Tabs
          _sidebarTab('today', 'Today', Icons.wb_sunny_outlined, _stats.today),
          _sidebarTab('upcoming', 'Upcoming', Icons.calendar_today_outlined, 0),
          _sidebarTab('overdue', 'Overdue', Icons.error_outline, _stats.overdue, AppTheme.overdueRed),
          _sidebarTab('all', 'All Tasks', Icons.inbox_outlined, _stats.total),
          _sidebarTab('done', 'Completed', Icons.check_circle_outline, _stats.done, AppTheme.p3Low),

          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 14),

          // Settings Button
          ListTile(
            dense: true,
            leading: const Icon(Icons.settings_outlined, size: 18, color: AppTheme.textSecondary),
            title: const Text('Multi-Device Sync', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
            trailing: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _syncStatus == 'connected' ? AppTheme.p3Low : AppTheme.overdueRed,
              ),
            ),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            onTap: _openSettingsDialog,
          ),
        ],
      ),
    );
  }

  Widget _sidebarTab(String id, String label, IconData icon, int count, [Color? badgeColor]) {
    final isSelected = _activeTab == id;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        selected: isSelected,
        selectedTileColor: const Color(0x38FFFFFF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        leading: Icon(icon, size: 18, color: isSelected ? Colors.white : AppTheme.textMuted),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : AppTheme.textSecondary,
          ),
        ),
        trailing: count > 0 && id != 'upcoming'
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : (badgeColor?.withValues(alpha: 0.2) ?? const Color(0x1FFFFFFF)),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  count.toString(),
                  style: AppTheme.monoTextStyle.copyWith(
                    fontSize: 11,
                    color: isSelected ? const Color(0xFF10141D) : (badgeColor ?? AppTheme.textSecondary),
                  ),
                ),
              )
            : null,
        onTap: () {
          AudioService.triggerHaptic('light');
          setState(() => _activeTab = id);
          _refreshAll();
        },
      ),
    );
  }

  Widget _buildDesktopTopBar() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          _activeTab.toUpperCase(),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5),
        ),
        Row(
          children: [
            OutlinedButton.icon(
              icon: const Icon(Icons.flash_on, size: 16, color: AppTheme.p2Med),
              label: const Text('Test Alert', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0x33F59E0B)),
                backgroundColor: const Color(0x14F59E0B),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                AudioService.playChime('urgent');
                await ApiService.testNotification();
                await NotificationService.showNotification(
                  id: 77777,
                  title: '⚡ Test Alert',
                  body: 'Escalating deadline alerts active!',
                );
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDesktopInlineAdd() {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      borderRadius: 16,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.add_task, size: 20, color: AppTheme.accentIndigo),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _desktopAddController,
                  style: const TextStyle(fontSize: 14, color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Add a new deadline task... (e.g. "Submit report tomorrow at 5pm !p1")',
                    hintStyle: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                    border: InputBorder.none,
                  ),
                  onSubmitted: (val) {
                    if (val.trim().isEmpty) return;
                    String clean = val.trim();
                    String? due;
                    int p = 2;
                    if (_desktopNlpResult.hasSuggestion) {
                      clean = _desktopNlpResult.cleanTitle;
                      due = _desktopNlpResult.detectedDueAt;
                      p = _desktopNlpResult.detectedPriority ?? 2;
                    }
                    _handleCreateTask(title: clean, dueAt: due, priority: p);
                    _desktopAddController.clear();
                  },
                ),
              ),
              IconButton(
                icon: const Icon(Icons.tune, size: 18, color: AppTheme.textMuted),
                tooltip: 'More Details & Presets',
                onPressed: _openCreateSheet,
              ),
            ],
          ),
          if (_desktopNlpResult.hasSuggestion) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0x266366F1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, size: 14, color: Color(0xFFA5B4FC)),
                  const SizedBox(width: 6),
                  Text(
                    'NLP: ${_desktopNlpResult.label}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFC7D2FE)),
                  ),
                  const Spacer(),
                  const Text('Press Enter to Schedule', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
