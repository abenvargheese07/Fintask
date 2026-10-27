import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/audio_service.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';

class SettingsDialog extends StatefulWidget {
  final VoidCallback onRefresh;

  const SettingsDialog({super.key, required this.onRefresh});

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late final TextEditingController _serverController;
  late final TextEditingController _topicController;

  String _status = 'checking'; // 'connected' | 'offline' | 'checking'
  String _timezone = 'Asia/Kolkata';
  bool _testingAlert = false;

  @override
  void initState() {
    super.initState();
    _serverController = TextEditingController(text: ApiService.serverUrl);
    _topicController = TextEditingController();
    _loadSettings();
    _checkServer();
  }

  @override
  void dispose() {
    _serverController.dispose();
    _topicController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final settings = await ApiService.getSettings();
    if (mounted) {
      setState(() {
        _topicController.text = settings['ntfy_topic']?.toString() ?? '';
        _timezone = settings['timezone']?.toString() ?? 'Asia/Kolkata';
      });
    }
  }

  Future<void> _checkServer() async {
    setState(() => _status = 'checking');
    final ok = await ApiService.checkConnection();
    if (mounted) {
      setState(() => _status = ok ? 'connected' : 'offline');
    }
  }

  Future<void> _saveServer() async {
    AudioService.triggerHaptic('medium');
    await ApiService.setServerUrl(_serverController.text);
    await _checkServer();
    widget.onRefresh();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server URL updated! 🚀')),
      );
    }
  }

  Future<void> _saveNtfy() async {
    AudioService.triggerHaptic('medium');
    await ApiService.updateSettings({'ntfy_topic': _topicController.text.trim()});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ntfy topic saved! 📱')),
      );
    }
  }

  Future<void> _triggerTestAlert() async {
    setState(() => _testingAlert = true);
    AudioService.playChime('urgent');

    // Trigger local native notification
    await NotificationService.showNotification(
      id: 99999,
      title: '⚡ Fintask Alert Triggered',
      body: 'Push notifications are active on this device! Cascading deadline alarms configured.',
    );

    // Broadcast across cloud server
    final sent = await ApiService.testNotification();
    if (mounted) {
      setState(() => _testingAlert = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            sent
                ? '⚡ Alert fired on device & broadcasted to cloud!'
                : '⚡ Local test notification fired!',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppTheme.bgElevated,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: AppTheme.glassBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Multi-Device Sync',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textWhite),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Server URL Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'BACKEND API SERVER',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.6),
                  ),
                  _statusBadge(),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _serverController,
                      style: const TextStyle(fontSize: 13, color: AppTheme.textWhite),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0x33000000),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _saveServer,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0x2EFFFFFF),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Save', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // ntfy Topic Section
              const Text(
                'PUSH TOPIC (ntfy.sh)',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.6),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _topicController,
                      style: const TextStyle(fontSize: 13, color: AppTheme.textWhite),
                      decoration: InputDecoration(
                        hintText: 'e.g. fintask-xxxx',
                        hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                        filled: true,
                        fillColor: const Color(0x33000000),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _saveNtfy,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0x2EFFFFFF),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Save', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Timezone info
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Active Timezone', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                  Text(
                    _timezone,
                    style: AppTheme.monoTextStyle.copyWith(fontSize: 12, color: AppTheme.accentCyan),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Test Alert Button
              OutlinedButton.icon(
                onPressed: _testingAlert ? null : _triggerTestAlert,
                icon: const Icon(Icons.flash_on, size: 18, color: AppTheme.p2Med),
                label: Text(
                  _testingAlert ? 'Firing Test...' : '⚡ Trigger Test Alert & Chime',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0x44F59E0B)),
                  backgroundColor: const Color(0x1AF59E0B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusBadge() {
    Color color;
    String text;
    if (_status == 'connected') {
      color = AppTheme.p3Low;
      text = 'Connected';
    } else if (_status == 'offline') {
      color = AppTheme.overdueRed;
      text = 'Offline';
    } else {
      color = AppTheme.p2Med;
      text = 'Checking...';
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}
