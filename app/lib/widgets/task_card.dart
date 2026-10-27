import 'package:flutter/material.dart';
import '../models/task.dart';
import '../theme/app_theme.dart';
import 'glass_card.dart';

class TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onToggleComplete;
  final Function(int minutes) onSnooze;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const TaskCard({
    super.key,
    required this.task,
    required this.onToggleComplete,
    required this.onSnooze,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final badge = task.deadlineBadge;
    final cadence = task.escalatingCadenceTier;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      borderRadius: 18,
      borderColor: task.isOverdue
          ? const Color(0x55EF4444)
          : (task.done ? const Color(0x14FFFFFF) : AppTheme.glassBorder),
      backgroundColor: task.isOverdue
          ? const Color(0x66181014)
          : (task.done ? const Color(0x4D0E1218) : AppTheme.bgCardGlass),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Checkbox + Title + More menu
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Custom Circular Checkbox
              GestureDetector(
                onTap: onToggleComplete,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 26,
                  height: 26,
                  margin: const EdgeInsets.only(top: 2, right: 12),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: task.done ? AppTheme.p3Low : Colors.transparent,
                    border: Border.all(
                      color: task.done
                          ? AppTheme.p3Low
                          : (task.isOverdue
                              ? AppTheme.overdueRed
                              : const Color(0x4DFFFFFF)),
                      width: 2,
                    ),
                    boxShadow: task.done
                        ? [
                            BoxShadow(
                              color: AppTheme.p3Low.withValues(alpha: 0.4),
                              blurRadius: 8,
                            ),
                          ]
                        : null,
                  ),
                  child: task.done
                      ? const Icon(Icons.check, size: 16, color: Colors.white)
                      : null,
                ),
              ),

              // Title and Notes
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: task.done ? AppTheme.textMuted : AppTheme.textWhite,
                        decoration: task.done ? TextDecoration.lineThrough : null,
                        decorationColor: AppTheme.textMuted,
                        height: 1.25,
                      ),
                    ),
                    if (task.notes.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        task.notes,
                        style: TextStyle(
                          fontSize: 13,
                          color: task.done ? const Color(0xFF475569) : AppTheme.textSecondary,
                          height: 1.35,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),

              // Action Popup Menu
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 18, color: AppTheme.textMuted),
                color: AppTheme.bgElevated,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(color: AppTheme.glassBorder),
                ),
                onSelected: (value) {
                  if (value == 'edit') onEdit();
                  if (value == 'delete') onDelete();
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'edit',
                    child: Row(
                      children: [
                        Icon(Icons.edit_outlined, size: 16, color: AppTheme.textSecondary),
                        SizedBox(width: 8),
                        Text('Edit Task', style: TextStyle(color: AppTheme.textPrimary)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, size: 16, color: AppTheme.overdueRed),
                        SizedBox(width: 8),
                        Text('Delete', style: TextStyle(color: AppTheme.overdueRed)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Row 2: Badges (Deadline, Priority, Cadence)
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              // Deadline Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badge.backgroundColor,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: badge.borderColor),
                ),
                child: Text(
                  badge.label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: badge.textColor,
                  ),
                ),
              ),

              // Priority Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: task.priorityColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: task.priorityColor.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: task.priorityColor,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      task.priorityLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: task.priorityColor,
                      ),
                    ),
                  ],
                ),
              ),

              // Escalating Cadence badge (if applicable)
              if (cadence != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: cadence.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: cadence.color.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    cadence.label,
                    style: AppTheme.monoTextStyle.copyWith(
                      fontSize: 11,
                      color: cadence.color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),

          // Row 3: Quick Snooze Buttons (Only if not completed)
          if (!task.done && task.dueAt != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0x240A0D14),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.glassBorderSubtle),
              ),
              child: Row(
                children: [
                  const Icon(Icons.access_time, size: 14, color: AppTheme.textMuted),
                  const SizedBox(width: 6),
                  const Text(
                    'Snooze:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _snoozeButton('+10m', () => onSnooze(10)),
                  const SizedBox(width: 6),
                  _snoozeButton('+1h', () => onSnooze(60)),
                  const SizedBox(width: 6),
                  _snoozeButton('+1d', () => onSnooze(1440)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _snoozeButton(String text, VoidCallback onPressed) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0x1AFFFFFF),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0x24FFFFFF)),
        ),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }
}
