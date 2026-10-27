import 'dart:math';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class DonutGauge extends StatelessWidget {
  final int percentage;
  final double size;
  final double strokeWidth;

  const DonutGauge({
    super.key,
    required this.percentage,
    this.size = 76,
    this.strokeWidth = 7,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _DonutPainter(
              percentage: percentage.clamp(0, 100),
              strokeWidth: strokeWidth,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$percentage%',
                style: AppTheme.monoTextStyle.copyWith(
                  fontSize: 16,
                  color: AppTheme.textWhite,
                  letterSpacing: -0.5,
                ),
              ),
              const Text(
                'DONE',
                style: TextStyle(
                  fontSize: 7,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textMuted,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final int percentage;
  final double strokeWidth;

  _DonutPainter({required this.percentage, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Track background
    final bgPaint = Paint()
      ..color = const Color(0x22FFFFFF)
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);

    if (percentage > 0) {
      // Progress Arc
      final sweepAngle = 2 * pi * (percentage / 100);

      final progressPaint = Paint()
        ..shader = const SweepGradient(
          startAngle: -pi / 2,
          endAngle: 3 * pi / 2,
          colors: [
            AppTheme.accentIndigo,
            AppTheme.accentCyan,
            AppTheme.p3Low,
          ],
        ).createShader(Rect.fromCircle(center: center, radius: radius))
        ..strokeWidth = strokeWidth
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

      // Glow blur
      final glowPaint = Paint()
        ..color = AppTheme.accentIndigo.withValues(alpha: 0.35)
        ..strokeWidth = strokeWidth + 4
        ..style = PaintingStyle.stroke
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(-pi / 2);
      canvas.translate(-center.dx, -center.dy);

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        0,
        sweepAngle,
        false,
        glowPaint,
      );

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        0,
        sweepAngle,
        false,
        progressPaint,
      );

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) {
    return oldDelegate.percentage != percentage || oldDelegate.strokeWidth != strokeWidth;
  }
}
