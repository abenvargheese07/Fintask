import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final Color? borderColor;
  final double blur;
  final VoidCallback? onTap;
  final Border? customBorder;

  const GlassCard({
    super.key,
    required this.child,
    this.borderRadius = 20,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.backgroundColor,
    this.borderColor,
    this.blur = 20.0,
    this.onTap,
    this.customBorder,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppTheme.bgCardGlass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: customBorder ??
            Border.all(
              color: borderColor ?? AppTheme.glassBorder,
              width: 1,
            ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 25,
            offset: Offset(0, 10),
          ),
          BoxShadow(
            color: AppTheme.glassInnerGlow,
            blurRadius: 1,
            spreadRadius: 0,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius),
          splashColor: const Color(0x1AFFFFFF),
          highlightColor: const Color(0x0FFFFFFF),
          child: content,
        ),
      );
    }

    Widget glassWrapper = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: content,
      ),
    );

    if (margin != null) {
      return Padding(padding: margin!, child: glassWrapper);
    }
    return glassWrapper;
  }
}
