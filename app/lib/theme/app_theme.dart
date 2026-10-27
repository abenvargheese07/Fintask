import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // VisionOS Spatial Dark Palette
  static const Color bgDark = Color(0xFF090C12);
  static const Color bgSurface = Color(0xFF0F121A);
  static const Color bgCard = Color(0xFF141820);
  static const Color bgCardGlass = Color(0x9E161B24);
  static const Color bgElevated = Color(0xFF1C222D);

  // Glass borders and highlights
  static const Color glassBorder = Color(0x24FFFFFF);
  static const Color glassBorderSubtle = Color(0x14FFFFFF);
  static const Color glassHighlight = Color(0x38FFFFFF);
  static const Color glassInnerGlow = Color(0x1FFFFFFF);

  // Typography Colors
  static const Color textWhite = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFFF1F5F9);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Status & Priority Colors
  static const Color p1High = Color(0xFFF43F5E);      // Crimson Rose
  static const Color p2Med = Color(0xFFF59E0B);       // Warm Amber
  static const Color p3Low = Color(0xFF10B981);       // Mint Emerald
  static const Color overdueRed = Color(0xFFEF4444);  // Overdue Urgent Red
  static const Color accentIndigo = Color(0xFF6366F1);// Violet Indigo
  static const Color accentCyan = Color(0xFF06B6D4);  // Spatial Cyan

  static ThemeData get darkTheme {
    final baseTextTheme = GoogleFonts.plusJakartaSansTextTheme(
      ThemeData.dark().textTheme,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      colorScheme: const ColorScheme.dark(
        primary: accentIndigo,
        secondary: accentCyan,
        surface: bgSurface,
        error: overdueRed,
        onPrimary: textWhite,
        onSurface: textPrimary,
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: baseTextTheme.displayLarge?.copyWith(
          color: textWhite,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.03,
        ),
        displayMedium: baseTextTheme.displayMedium?.copyWith(
          color: textWhite,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.02,
        ),
        titleLarge: baseTextTheme.titleLarge?.copyWith(
          color: textWhite,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.02,
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          color: textWhite,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.01,
        ),
        bodyLarge: baseTextTheme.bodyLarge?.copyWith(
          color: textPrimary,
          fontSize: 15,
          fontWeight: FontWeight.w400,
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(
          color: textSecondary,
          fontSize: 13,
        ),
        labelLarge: baseTextTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
      iconTheme: const IconThemeData(color: textSecondary),
      dividerTheme: const DividerThemeData(
        color: glassBorderSubtle,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: bgElevated,
        contentTextStyle: GoogleFonts.plusJakartaSans(
          color: textWhite,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: glassBorder),
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // Mono TextStyle for Numbers / Counts / Urgency Cadence
  static TextStyle get monoTextStyle => GoogleFonts.jetBrainsMono(
    fontWeight: FontWeight.w700,
  );
}
