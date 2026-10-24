import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeName, themeColors } from '../../design-system/tokens/colors';

/** Shape of a single theme's color tokens. */
type ThemeColorSet = (typeof themeColors)[ThemeName];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  resolvedTheme: ThemeName;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'meridianed_theme';
const LEGACY_THEME_MAP: Record<string, ThemeName> = {
  dark: 'midnight',
  light: 'light',
};

function resolveTheme(theme: ThemeName): ThemeName {
  if (theme === 'auto') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'midnight';
    }
    return 'midnight';
  }
  return LEGACY_THEME_MAP[theme] || theme;
}

function isThemeName(value: string | null): value is ThemeName {
  return !!value && Object.prototype.hasOwnProperty.call(themeColors, value);
}

// localStorage throws SecurityError when storage is unavailable (Safari private
// mode, hardened profiles, blocked third-party storage). That exception fired
// inside the state initializer and the effect, so the whole tree failed to mount.
// Fall back to the default theme instead of crashing.
function readStoredTheme(): ThemeName | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

export function ThemeProvider({ children, defaultTheme = 'auto' }: { children: React.ReactNode; defaultTheme?: ThemeName }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    // A value left over from the removed 7-theme picker (e.g. "forest") would
    // leave data-theme set to a name with no CSS variables, and useCSSVariables
    // would crash reading themeColors[theme].
    return readStoredTheme() || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>(() => resolveTheme(theme));

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    persistTheme(theme);
  }, [theme]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      const resolved = resolveTheme('auto');
      setResolvedTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      if (current === 'midnight') return 'light';
      if (current === 'light') return 'midnight';
      return 'midnight';
    });
  }, []);

  const isDark = resolvedTheme === 'midnight';

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, resolvedTheme, isDark }),
    [theme, resolvedTheme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to get theme-specific colors
export function useThemeColors() {
  const { resolvedTheme } = useTheme();
  return themeColors[resolvedTheme];
}

// Hook to check if current theme is dark
export function useIsDark(): boolean {
  const { isDark } = useTheme();
  return isDark;
}

// Hook to get CSS custom properties for a theme
export function useCSSVariables(themeName?: ThemeName) {
  const { resolvedTheme } = useTheme();
  const theme = themeName || resolvedTheme;
  // Fall back to the active theme rather than throwing on an unknown name
  // (e.g. a stale value in storage from the removed 7-theme picker).
  const colors: ThemeColorSet = themeColors[theme]
    ?? themeColors[resolvedTheme]
    ?? themeColors.midnight;

  return useMemo(() => {
    const cssVars: Record<string, string> = {};
    Object.entries(colors).forEach(([key, value]) => {
      cssVars[`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
    });
    return cssVars;
  }, [colors]);
}

export default ThemeProvider;