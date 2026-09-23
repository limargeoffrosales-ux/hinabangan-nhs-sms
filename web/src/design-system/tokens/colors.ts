// Design System Color Tokens
// These tokens define the complete color palette for the application
// They are theme-aware and support both light/dark modes

export const colorTokens = {
  // Brand colors
  brand: {
    primary: {
      50: '#E8F1FF',
      100: '#D0E2FF',
      200: '#A8C8FF',
      300: '#7AA6FF',
      400: '#4D96FF',
      500: '#2F7DF4', // main
      600: '#1A63D8',
      700: '#144BB8',
      800: '#0E3590',
      900: '#0A2468',
    },
    secondary: {
      50: '#ECFFF5',
      100: '#D4FFE6',
      200: '#A8FFCC',
      300: '#6EFFAD',
      400: '#2FD6A0',
      500: '#12A97C', // main
      600: '#0E8763',
      700: '#0A654A',
      800: '#074331',
      900: '#042818',
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
      main: '#0FA968',
      dark: '#0A7A4D',
      bg: 'rgba(52, 211, 153, 0.14)',
      border: 'rgba(52, 211, 153, 0.4)',
    },
    warning: {
      light: '#FBBF24',
      main: '#D97706',
      dark: '#A65204',
      bg: 'rgba(251, 191, 36, 0.14)',
      border: 'rgba(251, 191, 36, 0.4)',
    },
    danger: {
      light: '#FB7185',
      main: '#DC2626',
      dark: '#A61A1A',
      bg: 'rgba(251, 113, 133, 0.14)',
      border: 'rgba(251, 113, 133, 0.4)',
    },
    info: {
      light: '#2DD4BF',
      main: '#0E9AB3',
      dark: '#0A6D80',
      bg: 'rgba(45, 212, 191, 0.14)',
      border: 'rgba(45, 212, 191, 0.4)',
    },
    live: {
      light: '#34D399',
      main: '#0FA968',
      dark: '#0A7A4D',
      ring: 'rgba(15, 169, 104, 0.35)',
      bg: 'rgba(15, 169, 104, 0.14)',
      border: 'rgba(15, 169, 104, 0.4)',
    },
  },

  // Neutral colors
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // RGB values for gradients and rgba()
  rgb: {
    primary: { r: 47, g: 125, b: 244 },
    secondary: { r: 22, g: 173, b: 128 },
    teal: { r: 14, g: 154, b: 179 },
  },
} as const;

export type ColorTokens = typeof colorTokens;

// Theme-specific color overrides
export const themeColors = {
  midnight: {
    bg: '#04070F',
    bgSoft: '#0A1122',
    card: 'rgba(15, 23, 44, 0.72)',
    cardSolid: '#0E172E',
    cardHover: 'rgba(28, 44, 82, 0.55)',
    border: 'rgba(125, 148, 205, 0.16)',
    borderStrong: 'rgba(125, 148, 205, 0.32)',
    text: '#EAF0FF',
    textDim: '#8FA3C8',
    accent: '#4D96FF',
    accent2: '#2FD6A0',
    accent3: '#2DD4BF',
    glow: 'rgba(77, 150, 255, 0.38)',
    glowSoft: 'rgba(77, 150, 255, 0.14)',
    grad: 'linear-gradient(135deg, #4D96FF, #2FD6A0)',
    grad3: 'linear-gradient(135deg, #4D96FF, #2DD4BF 55%, #2FD6A0)',
    shadow: '0 18px 45px rgba(0, 0, 0, 0.42)',
    gridLine: 'rgba(255, 255, 255, 0.02)',
    rank: { gold: '#FACC15', silver: '#CBD5E1', bronze: '#D97706' },
    heat: ['#121A2B', '#1E2A44', '#2B3E66', '#3E5C9E', '#4D96FF'],
    surface: { muted: 'rgba(125, 148, 205, 0.08)' },
  },
  light: {
    bg: '#F2F6FC',
    bgSoft: '#E4ECF9',
    card: 'rgba(255, 255, 255, 0.82)',
    cardSolid: '#FFFFFF',
    cardHover: '#FFFFFF',
    border: 'rgba(30, 58, 110, 0.13)',
    borderStrong: 'rgba(30, 58, 110, 0.26)',
    text: '#101E3C',
    textDim: '#4A5D82',
    accent: '#2F7DF4',
    accent2: '#12A97C',
    accent3: '#0E9AB3',
    glow: 'rgba(47, 125, 244, 0.26)',
    glowSoft: 'rgba(47, 125, 244, 0.12)',
    grad: 'linear-gradient(135deg, #2F7DF4, #12A97C)',
    grad3: 'linear-gradient(135deg, #2F7DF4, #0E9AB3 55%, #12A97C)',
    shadow: '0 14px 40px rgba(25, 45, 90, 0.12)',
    gridLine: 'rgba(30, 58, 110, 0.045)',
    rank: { gold: '#EAB308', silver: '#94A3B8', bronze: '#B45309' },
    heat: ['#F2F6FC', '#E3ECFA', '#C5D7F3', '#7FA6E8', '#2F7DF4'],
    surface: { muted: '#F8FAFC' },
  },
  // Auto theme (follows system preference)
  auto: {},
} as const;

export type ThemeColors = typeof themeColors;
export type ThemeName = keyof typeof themeColors;