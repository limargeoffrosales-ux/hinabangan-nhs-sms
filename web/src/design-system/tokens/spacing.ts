// Design System Spacing Tokens
// Consistent spacing scale based on 4px base unit

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
} as const;

// Semantic spacing aliases
export const spacingSemantic = {
  xs: spacing[1],    // 4px
  sm: spacing[2],    // 8px
  md: spacing[4],    // 16px
  lg: spacing[6],    // 24px
  xl: spacing[8],    // 32px
  xxl: spacing[12],  // 48px
  xxxl: spacing[16], // 64px
} as const;

// Layout spacing
export const layoutSpacing = {
  pagePadding: spacing[6],     // 24px
  sectionGap: spacing[8],      // 32px
  componentGap: spacing[4],    // 16px
  elementGap: spacing[2],      // 8px
  inlineGap: spacing[1],       // 4px
} as const;

export type Spacing = typeof spacing;
export type SpacingSemantic = typeof spacingSemantic;
export type LayoutSpacing = typeof layoutSpacing;