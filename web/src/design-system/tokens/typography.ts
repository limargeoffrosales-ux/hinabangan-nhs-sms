// Design System Typography Tokens
// Consistent type scale with fluid scaling

export const fontFamilies = {
  ui: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  display: "'Outfit', 'Space Grotesk', 'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
} as const;

export const fontWeights = {
  thin: 100,
  extraLight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
  black: 900,
} as const;

export const fontSizes = {
  // Fluid type scale using clamp()
  // clamp(min, preferred, max)
  xs: 'clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem)',      // ~11-12px
  sm: 'clamp(0.8125rem, 0.75rem + 0.3125vw, 0.875rem)', // ~13-14px
  base: 'clamp(0.9375rem, 0.875rem + 0.3125vw, 1rem)',  // ~15-16px
  lg: 'clamp(1.0625rem, 1rem + 0.3125vw, 1.125rem)',    // ~17-18px
  xl: 'clamp(1.25rem, 1.125rem + 0.625vw, 1.5rem)',     // ~20-24px
  '2xl': 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',       // ~24-32px
  '3xl': 'clamp(1.875rem, 1.5rem + 1.875vw, 3rem)',     // ~30-48px
  '4xl': 'clamp(2.25rem, 1.75rem + 2.5vw, 4rem)',       // ~36-64px
  '5xl': 'clamp(3rem, 2rem + 5vw, 6rem)',               // ~48-96px
} as const;

export const lineHeights = {
  tight: 1.1,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const letterSpacings = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// Semantic typography styles
export const typographyStyles = {
  // Display styles
  display: {
    h1: { fontSize: '4xl', fontWeight: 'bold', lineHeight: 'tight', letterSpacing: 'tighter', fontFamily: 'display' },
    h2: { fontSize: '3xl', fontWeight: 'bold', lineHeight: 'tight', letterSpacing: 'tighter', fontFamily: 'display' },
    h3: { fontSize: '2xl', fontWeight: 'bold', lineHeight: 'snug', letterSpacing: 'tight', fontFamily: 'display' },
    h4: { fontSize: 'xl', fontWeight: 'bold', lineHeight: 'snug', letterSpacing: 'tight', fontFamily: 'display' },
    h5: { fontSize: 'lg', fontWeight: 'semiBold', lineHeight: 'snug', letterSpacing: 'normal', fontFamily: 'display' },
    h6: { fontSize: 'lg', fontWeight: 'medium', lineHeight: 'snug', letterSpacing: 'normal', fontFamily: 'display' },
  },
  // Text styles
  text: {
    large: { fontSize: 'lg', fontWeight: 'normal', lineHeight: 'relaxed', letterSpacing: 'normal' },
    base: { fontSize: 'base', fontWeight: 'normal', lineHeight: 'normal', letterSpacing: 'normal' },
    small: { fontSize: 'sm', fontWeight: 'normal', lineHeight: 'normal', letterSpacing: 'normal' },
    caption: { fontSize: 'xs', fontWeight: 'medium', lineHeight: 'normal', letterSpacing: 'wide' },
    overline: { fontSize: 'xs', fontWeight: 'semiBold', lineHeight: 'normal', letterSpacing: 'widest', textTransform: 'uppercase' },
    statValue: { fontSize: '2xl', fontWeight: 'bold', lineHeight: 'snug', letterSpacing: 'tight', fontFamily: 'display', fontVariantNumeric: 'tabular-nums' },
    navLabel: { fontSize: 'xs', fontWeight: 'semiBold', lineHeight: 'normal', letterSpacing: 'wide' },
    heatCell: { fontSize: 'xs', fontWeight: 'medium', lineHeight: 'normal', fontVariantNumeric: 'tabular-nums' },
  },
  // Code styles
  code: {
    inline: { fontSize: 'sm', fontFamily: 'mono', fontWeight: 'normal', lineHeight: 'normal' },
    block: { fontSize: 'sm', fontFamily: 'mono', fontWeight: 'normal', lineHeight: 'loose' },
  },
  // Button styles
  button: {
    large: { fontSize: 'base', fontWeight: 'semiBold', lineHeight: 'normal', letterSpacing: 'normal' },
    medium: { fontSize: 'sm', fontWeight: 'semiBold', lineHeight: 'normal', letterSpacing: 'normal' },
    small: { fontSize: 'xs', fontWeight: 'semiBold', lineHeight: 'normal', letterSpacing: 'wide' },
  },
} as const;

export type FontFamilies = typeof fontFamilies;
export type FontWeights = typeof fontWeights;
export type FontSizes = typeof fontSizes;
export type LineHeights = typeof lineHeights;
export type LetterSpacings = typeof letterSpacings;