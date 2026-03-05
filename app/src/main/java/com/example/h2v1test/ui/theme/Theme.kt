package com.example.h2v1test.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// MARK: - Design Tokens (from iOS Components.swift)

object H2VColors {
    // Backgrounds
    val AppBgDark = Color(0xFF0D0D0D)
    val AppBgLight = Color(0xFFF2F2F7)

    // Glass surfaces
    val GlassSurfaceDark = Color(0xFF262628)
    val GlassSurfaceLight = Color(0xEBFFFFFF)

    // Glass border
    val GlassBorderDark = Color(0x21FFFFFF)   // white 13%
    val GlassBorderLight = Color(0x12000000)  // black 7%

    // Message bubbles
    val BubbleMeDark = Color(0x21FFFFFF)      // white 13%
    val BubbleMeLight = Color(0xFFD0E8FF)
    val BubbleThemDark = Color(0x12FFFFFF)    // white 7%
    val BubbleThemLight = Color(0xFFFFFFFF)

    // Text
    val TextPrimaryDark = Color(0xEBFFFFFF)   // white 92%
    val TextPrimaryLight = Color(0xE1000000)  // black 88%
    val TextSecondaryDark = Color(0x54FFFFFF) // white 33%
    val TextSecondaryLight = Color(0x61000000)
    val TextTertiaryDark = Color(0x33FFFFFF)  // white 20%
    val TextTertiaryLight = Color(0x33000000)

    // Accent
    val OnlineGreen = Color(0xFF30D158)
    val DangerRed = Color(0xFFFF3B30)
    val AccentBlue = Color(0xFF5E8CFF)
    val GradientStart = Color(0xFF4A7CFF)
    val GradientEnd = Color(0xFF7A4AFF)

    // Bubble styles
    val BubbleSolidMe = Color(0xFF1E3A5F)
    val BubbleSolidThem = Color(0xFF2A2A2E)

    // Avatar pastel palette
    val AvatarPalette = listOf(
        Color(0xFFE8D5B7), Color(0xFFB7D4E8), Color(0xFFE8B7B7),
        Color(0xFFC5B7E8), Color(0xFFB7E8C5), Color(0xFFE8C5B7),
        Color(0xFFD4E8B7), Color(0xFFB7E8D4), Color(0xFFE8D4C5),
        Color(0xFFC5D4E8)
    )
}

fun avatarColor(id: String): Color {
    val hash = id.fold(0) { acc, c -> acc + c.code }
    return H2VColors.AvatarPalette[Math.abs(hash) % H2VColors.AvatarPalette.size]
}

private val DarkColorScheme = darkColorScheme(
    primary = H2VColors.AccentBlue,
    onPrimary = Color.White,
    background = H2VColors.AppBgDark,
    onBackground = H2VColors.TextPrimaryDark,
    surface = H2VColors.GlassSurfaceDark,
    onSurface = H2VColors.TextPrimaryDark,
    error = H2VColors.DangerRed,
)

private val LightColorScheme = lightColorScheme(
    primary = H2VColors.AccentBlue,
    onPrimary = Color.White,
    background = H2VColors.AppBgLight,
    onBackground = H2VColors.TextPrimaryLight,
    surface = H2VColors.GlassSurfaceLight,
    onSurface = H2VColors.TextPrimaryLight,
    error = H2VColors.DangerRed,
)

@Composable
fun H2VTheme(
    darkTheme: Boolean = true, // always dark like iOS
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

// MARK: - Convenience getters based on dark/light

@Composable
fun appBg(dark: Boolean = true) = if (dark) H2VColors.AppBgDark else H2VColors.AppBgLight

@Composable
fun glassSurface(dark: Boolean = true) =
    if (dark) H2VColors.GlassSurfaceDark else H2VColors.GlassSurfaceLight

@Composable
fun glassBorder(dark: Boolean = true) =
    if (dark) H2VColors.GlassBorderDark else H2VColors.GlassBorderLight

@Composable
fun textPrimary(dark: Boolean = true) =
    if (dark) H2VColors.TextPrimaryDark else H2VColors.TextPrimaryLight

@Composable
fun textSecondary(dark: Boolean = true) =
    if (dark) H2VColors.TextSecondaryDark else H2VColors.TextSecondaryLight

@Composable
fun textTertiary(dark: Boolean = true) =
    if (dark) H2VColors.TextTertiaryDark else H2VColors.TextTertiaryLight

@Composable
fun bubbleMe(dark: Boolean = true) =
    if (dark) H2VColors.BubbleMeDark else H2VColors.BubbleMeLight

@Composable
fun bubbleThem(dark: Boolean = true) =
    if (dark) H2VColors.BubbleThemDark else H2VColors.BubbleThemLight
