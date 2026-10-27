import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatTile extends StatelessWidget {
  final String label;
  final int count;
  final Color? countColor;
  final IconData? icon;

  const StatTile({
    super.key,
    required this.label,
    required this.count,
    this.countColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0x380E1219),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.glassBorderSubtle),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 10, color: AppTheme.textMuted),
                const SizedBox(width: 3),
              ],
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textMuted,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            count.toString(),
            style: AppTheme.monoTextStyle.copyWith(
              fontSize: 20,
              color: countColor ?? AppTheme.textWhite,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }
}
