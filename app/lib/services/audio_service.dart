import 'package:flutter/services.dart';

class AudioService {
  static void triggerHaptic([String type = 'light']) {
    try {
      switch (type) {
        case 'success':
          HapticFeedback.mediumImpact();
          break;
        case 'heavy':
        case 'critical':
          HapticFeedback.heavyImpact();
          break;
        case 'medium':
          HapticFeedback.mediumImpact();
          break;
        case 'light':
        default:
          HapticFeedback.lightImpact();
          break;
      }
    } catch (_) {}
  }

  static void playChime([String urgency = 'normal']) {
    try {
      SystemSound.play(SystemSoundType.click);
    } catch (_) {}
    triggerHaptic(urgency == 'critical' ? 'heavy' : 'light');
  }
}
