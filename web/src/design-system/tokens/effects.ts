// Design System Effects Tokens
// Shadows, borders, radius, transitions, and other visual effects

export const shadows = {
  // Elevation shadows
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  smDark: '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.12)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
  mdDark: '0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  lgDark: '0 10px 15px rgba(0, 0, 0, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  xlDark: '0 20px 25px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.15)',
  '2xlDark': '0 25px 50px rgba(0, 0, 0, 0.3)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  innerDark: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',

  // Glow shadows
  glow: '0 0 20px rgba(47, 125, 244, 0.35)',
  glowSoft: '0 0 10px rgba(47, 125, 244, 0.15)',
  glowSuccess: '0 0 20px rgba(52, 211, 153, 0.35)',
  glowWarning: '0 0 20px rgba(251, 191, 36, 0.35)',
  glowDanger: '0 0 20px rgba(251, 113, 133, 0.35)',

  // Component-specific
  card: '0 18px 45px rgba(0, 0, 0, 0.42)',
  cardLight: '0 14px 40px rgba(25, 45, 90, 0.12)',
  modal: '0 25px 50px rgba(0, 0, 0, 0.5)',
  dropdown: '0 10px 40px rgba(0, 0, 0, 0.2)',
  tooltip: '0 4px 14px rgba(0, 0, 0, 0.15)',
  toast: '0 8px 32px rgba(0, 0, 0, 0.2)',
} as const;

export const borders = {
  widths: {
    none: '0',
    hairline: '0.5px',
    thin: '1px',
    medium: '2px',
    thick: '3px',
    heavy: '4px',
  },
  radius: {
    none: '0',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    full: '9999px',
  },
  styles: {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
    double: 'double',
  },
  // Semantic border colors (CSS variables used in runtime)
  semantic: {
    default: 'var(--border)',
    strong: 'var(--border-strong)',
    focus: 'var(--accent)',
    error: 'var(--danger)',
    success: 'var(--success)',
    warning: 'var(--warn)',
  },
} as const;

export const transitions = {
  // Duration
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '150ms',
    slow: '200ms',
    slower: '300ms',
    slowest: '500ms',
  },
  // Easing
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  // Presets
  presets: {
    fast: { duration: '100ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    normal: { duration: '150ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    slow: { duration: '300ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    spring: { duration: '400ms', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    bounce: { duration: '500ms', easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  },
} as const;

export const zIndices = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1700,
  loader: 1800,
  max: 9999,
} as const;

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  '3xl': '1920px',
} as const;

export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
  '3xl': `@media (min-width: ${breakpoints['3xl']})`,
  // Max-width queries
  'max-xs': `@media (max-width: ${breakpoints.xs})`,
  'max-sm': `@media (max-width: ${breakpoints.sm})`,
  'max-md': `@media (max-width: ${breakpoints.md})`,
  'max-lg': `@media (max-width: ${breakpoints.lg})`,
  'max-xl': `@media (max-width: ${breakpoints.xl})`,
  // Reduced motion
  reduceMotion: '@media (prefers-reduced-motion: reduce)',
  // Dark mode
  dark: '@media (prefers-color-scheme: dark)',
  light: '@media (prefers-color-scheme: light)',
} as const;

export type Shadows = typeof shadows;
export type Borders = typeof borders;
export type Transitions = typeof transitions;
export type ZIndices = typeof zIndices;
export type Breakpoints = typeof breakpoints;
export type MediaQueries = typeof mediaQueries;