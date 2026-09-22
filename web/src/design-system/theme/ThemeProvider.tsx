import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeName, themeColors } from '../../design-system/tokens/colors';

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

export function ThemeProvider({ children, defaultTheme = 'auto' }: { children: React.ReactNode; defaultTheme?: ThemeName }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    return stored || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>(() => resolveTheme(theme));

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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
  const colors = themeColors[theme];

  return useMemo(() => {
    const cssVars: Record<string, string> = {};
    Object.entries(colors).forEach(([key, value]) => {
      cssVars[`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
    });
    return cssVars;
  }, [theme]);
}

export default ThemeProvider;