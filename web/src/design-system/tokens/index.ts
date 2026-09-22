// Design System Tokens - Main Export
// Re-exports all token modules for convenient importing

export * from './colors';
export * from './spacing';
export * from './typography';
export * from './effects';

// Composite tokens object for easy access
import * as colors from './colors';
import * as spacing from './spacing';
import * as typography from './typography';
import * as effects from './effects';

export const tokens = {
  colors,
  spacing,
  typography,
  effects,
} as const;

export type Tokens = typeof tokens;