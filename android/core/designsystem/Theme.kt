package com.ugop.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class UgopExtraColors(
    val gold: Color,
    val goldDark: Color,
    val goldTint: Color,
    val cream: Color,
    val salakotBrown: Color,
    val billOrange: Color,
    val cardBackground: Color
)

val LocalUgopExtras = staticCompositionLocalOf {
    UgopExtraColors(
        gold = UgopColors.GoldAccent,
        goldDark = UgopColors.GoldDark,
        goldTint = UgopColors.GoldTint,
        cream = UgopColors.Cream,
        salakotBrown = UgopColors.SalakotBrown,
        billOrange = UgopColors.BillOrange,
        cardBackground = UgopColors.SurfaceLight
    )
}

private val LightColorScheme = lightColorScheme(
    primary = UgopColors.ForestPrimary,
    onPrimary = Color.White,
    primaryContainer = UgopColors.ForestTint,
    secondary = UgopColors.GoldAccent,
    onSecondary = UgopColors.Ink,
    tertiary = UgopColors.Info,
    error = UgopColors.Error,
    background = UgopColors.BackgroundLight,
    surface = UgopColors.SurfaceLight,
    surfaceVariant = UgopColors.ForestTint,
    outline = UgopColors.Outline
)

private val DarkColorScheme = darkColorScheme(
    primary = UgopColors.PrimaryDark,
    onPrimary = Color.Black,
    primaryContainer = UgopColors.SurfaceDark,
    secondary = UgopColors.GoldDarkScheme,
    onSecondary = UgopColors.BackgroundDark,
    tertiary = UgopColors.Info,
    error = UgopColors.Error,
    background = UgopColors.BackgroundDark,
    surface = UgopColors.SurfaceDark,
    surfaceVariant = UgopColors.SurfaceDark,
    outline = UgopColors.OutlineDark
)

@Composable
fun UgopTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val extraColors = UgopExtraColors(
        gold = if (darkTheme) UgopColors.GoldDarkScheme else UgopColors.GoldAccent,
        goldDark = UgopColors.GoldDark,
        goldTint = UgopColors.GoldTint,
        cream = UgopColors.Cream,
        salakotBrown = UgopColors.SalakotBrown,
        billOrange = UgopColors.BillOrange,
        cardBackground = if (darkTheme) UgopColors.SurfaceDark else UgopColors.SurfaceLight
    )

    CompositionLocalProvider(LocalUgopExtras provides extraColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = UgopTypography,
            shapes = UgopShapes,
            content = content
        )
    }
}
