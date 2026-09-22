// Application-wide constants

// SHS Tracks/Strands
export const SHS_TRACKS = [
  'Academic',
  'Technical-Vocational-Livelihood',
  'Sports',
  'Arts and Design',
] as const;

export type SHSTrack = (typeof SHS_TRACKS)[number];

export const ACADEMIC_STRANDS = [
  'STEM',
  'ABM',
  'HUMSS',
  'GAS',
] as const;

export const TVL_STRANDS = [
  'Home Economics',
  'Industrial Arts',
  'Information and Communications Technology',
  'Agri-Fishery Arts',
] as const;

// School years - typically generated dynamically but here for reference
export const SCHOOL_YEAR_PATTERN = /^\d{4}-\d{4}$/;

// Terms/Quarters
export const TERMS = [1, 2, 3, 4] as const;
export type Term = (typeof TERMS)[number];

// Pagination defaults
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 500;

// LRN format
export const LRN_REGEX = /^\d{12}$/;

// Password policy defaults (can be overridden in app_settings)
export const DEFAULT_PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
} as const;

// Grade weight defaults (can be overridden in app_settings)
export const DEFAULT_GRADE_WEIGHTS = {
  written_work: 25,
  performance_task: 45,
  quarterly_exam: 30,
} as const;

// File upload limits
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;

// JWT settings
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const CSRF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limits
export const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 15 };
export const REGISTER_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 12 };
export const RESET_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 6 };

// Real-time
export const MAX_SSE_CLIENTS = 200;
export const SSE_HEARTBEAT_INTERVAL_MS = 25000;

// Export formats
export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Date formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Portal visibility
export const PORTAL_ROLES = ['student', 'parent'] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

// Staff roles (have broader access)
export const STAFF_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'assistant_principal',
  'registrar',
  'teacher',
  'guidance',
  'security',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

// Write roles for resources
export const WRITE_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'assistant_principal',
  'registrar',
] as const;

export type WriteRole = (typeof WRITE_ROLES)[number];

// Grade level display names (uses GradeLevel from enums)
import type { GradeLevel } from '../enums';
export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  '7': 'Grade 7',
  '8': 'Grade 8',
  '9': 'Grade 9',
  '10': 'Grade 10',
  '11': 'Grade 11',
  '12': 'Grade 12',
};

// Term display names
export const TERM_LABELS: Record<number, string> = {
  1: '1st Quarter',
  2: '2nd Quarter',
  3: '3rd Quarter',
  4: '4th Quarter',
};