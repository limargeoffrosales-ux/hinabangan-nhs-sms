// Design System Color Tokens
// These tokens define the complete color palette for the application
// They are theme-aware and support both light/dark modes

export const colorTokens = {
  // Brand colors
  brand: {
    primary: {
      50: '#E3F1E8',
      100: '#C5D7F3',
      200: '#A8C2B4',
      300: '#7AA6FF',
      400: '#2E9E5B',
      500: '#0F5A36', // main
      600: '#0A4128',
      700: '#062E1C',
      800: '#042818',
      900: '#020617',
    },
    secondary: {
      50: '#E3F2FA',
      100: '#D4FFE6',
      200: '#A8FFCC',
      300: '#6EFFAD',
      400: '#1E88B5',
      500: '#1E88B5', // main
      600: '#0B7A8F',
      700: '#085A6B',
      800: '#063A47',
      900: '#031A23',
    },
    accent: {
      teal: {
        50: '#ECFEFC',
        100: '#D4FCF8',
        200: '#A8F8F0',
        300: '#6EF1E4',
        400: '#2DD4BF',
        500: '#0E9AB3', // main
        600: '#0B7A8F',
        700: '#085A6B',
        800: '#063A47',
        900: '#031A23',
      },
    },
  },

  // Semantic colors
  semantic: {
    success: {
      light: '#34D399',
      main: '#2E9E5B',
      dark: '#0A7A4D',
      bg: 'rgba(46, 158, 91, 0.14)',
      border: 'rgba(46, 158, 91, 0.4)',
    },
    warning: {
      light: '#FBBF24',
      main: '#E8A317',
      dark: '#A65204',
      bg: 'rgba(232, 163, 23, 0.14)',
      border: 'rgba(232, 163, 23, 0.4)',
    },
    danger: {
      light: '#F87171',
      main: '#D64545',
      dark: '#A61A1A',
      bg: 'rgba(214, 69, 69, 0.14)',
      border: 'rgba(214, 69, 69, 0.4)',
    },
    info: {
      light: '#38BDF8',
      main: '#1E88B5',
      dark: '#075985',
      bg: 'rgba(30, 136, 181, 0.14)',
      border: 'rgba(30, 136, 181, 0.4)',
    },
    live: {
      light: '#34D399',
      main: '#2E9E5B',
      dark: '#0A7A4D',
      ring: 'rgba(46, 158, 91, 0.35)',
      bg: 'rgba(46, 158, 91, 0.14)',
      border: 'rgba(46, 158, 91, 0.4)',
    },
  },

  // Neutral colors
  neutral: {
    0: '#FFFFFF',
    50: '#F5F8F4',
    100: '#E3F1E8',
    200: '#DCE7E0',
    300: '#A8C2B4',
    400: '#5B6F63',
    500: '#12261C',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // RGB values for gradients and rgba()
  rgb: {
    primary: { r: 15, g: 90, b: 54 },
    secondary: { r: 30, g: 136, b: 181 },
    teal: { r: 14, g: 154, b: 179 },
  },
} as const;

export type ColorTokens = typeof colorTokens;

// Theme-specific color overrides
export const themeColors = {
  midnight: {
    bg: '#F5F8F4',
    bgSoft: '#E3F1E8',
    card: '#FFFFFF',
    cardSolid: '#FFFFFF',
    cardHover: '#F0F7F2',
    bgCard: '#FFFFFF',
    bgPage: '#F5F8F4',
    border: '#DCE7E0',
    borderStrong: '#A8C2B4',
    text: '#12261C',
    textDim: '#5B6F63',
    accent: '#D9A834',
    accent2: '#2E9E5B',
    accent3: '#1E88B5',
    success: '#2E9E5B',
    warn: '#E8A317',
    danger: '#D64545',
    purple: '#A78BFA',
    info: '#1E88B5',
    glow: 'rgba(15, 90, 54, 0.25)',
    glowSoft: 'rgba(15, 90, 54, 0.12)',
    grad: 'linear-gradient(135deg, #0F5A36, #2E9E5B)',
    grad3: 'linear-gradient(135deg, #0F5A36, #1E88B5 55%, #2E9E5B)',
    gradDanger: 'linear-gradient(135deg, #D64545, #B91C1C)',
    shadow: '0 1px 2px rgba(18, 38, 28, 0.06), 0 4px 12px rgba(18, 38, 28, 0.05)',
    shadowSm: '0 2px 8px rgba(18, 38, 28, 0.04)',
    shadowLg: '0 20px 48px rgba(18, 38, 28, 0.18)',
    mapTileBg: '#DDE8F2',
    gridLine: 'rgba(30, 58, 110, 0.045)',
    rank: { gold: '#EAB308', silver: '#94A3B8', bronze: '#B45309' },
    heat: ['#F5F8F4', '#E3F1E8', '#C5D7F3', '#7FA6E8', '#0F5A36'],
    surface: { muted: '#F8FAFC' },
  },
  light: {
    bg: '#F5F8F4',
    bgSoft: '#E3F1E8',
    card: '#FFFFFF',
    cardSolid: '#FFFFFF',
    cardHover: '#F0F7F2',
    bgCard: '#FFFFFF',
    bgPage: '#F5F8F4',
    border: '#DCE7E0',
    borderStrong: '#A8C2B4',
    text: '#12261C',
    textDim: '#5B6F63',
    accent: '#D9A834',
    accent2: '#2E9E5B',
    accent3: '#1E88B5',
    success: '#2E9E5B',
    warn: '#E8A317',
    danger: '#D64545',
    purple: '#A78BFA',
    info: '#1E88B5',
    glow: 'rgba(15, 90, 54, 0.25)',
    glowSoft: 'rgba(15, 90, 54, 0.12)',
    grad: 'linear-gradient(135deg, #0F5A36, #2E9E5B)',
    grad3: 'linear-gradient(135deg, #0F5A36, #1E88B5 55%, #2E9E5B)',
    gradDanger: 'linear-gradient(135deg, #D64545, #B91C1C)',
    shadow: '0 1px 2px rgba(18, 38, 28, 0.06), 0 4px 12px rgba(18, 38, 28, 0.05)',
    shadowSm: '0 2px 8px rgba(18, 38, 28, 0.04)',
    shadowLg: '0 20px 48px rgba(18, 38, 28, 0.18)',
    mapTileBg: '#DDE8F2',
    gridLine: 'rgba(30, 58, 110, 0.045)',
    rank: { gold: '#EAB308', silver: '#94A3B8', bronze: '#B45309' },
    heat: ['#F5F8F4', '#E3F1E8', '#C5D7F3', '#7FA6E8', '#0F5A36'],
    surface: { muted: '#F8FAFC' },
  },
  auto: {},
} as const;

export type ColorTokens = typeof colorTokens;
export type ThemeColors = typeof themeColors;
export type ThemeName = keyof typeof themeColors;
