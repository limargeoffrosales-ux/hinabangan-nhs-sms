// Shared utilities
import { z } from 'zod';

// SQLite (built-in) and PG INTEGER flags serialize as 0/1, not JS booleans.
export const FlagSchema = z.union([z.literal(0), z.literal(1)]);
export type Flag = z.infer<typeof FlagSchema>;

export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === '1' || v === 'true';
}

export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Mask PII - accepts any object with string values
export function maskPII(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result = { ...obj };
  for (const field of fields) {
    if (field in result && result[field] != null) {
      const val = String(result[field]);
      if (val.length <= 4) {
        result[field] = '****';
      } else {
        result[field] = val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
      }
    }
  }
  return result;
}

// Slugify
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Age calculation
export function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}