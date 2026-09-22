// Design System Utilities
// Formatting, validation, and common helpers

// Format a number
export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', options).format(value);
}

// Format currency
export function formatCurrency(value: number | null | undefined, currency = 'PHP'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format percentage
export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

// Format date
export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

// Format date-time
export function formatDateTime(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(d);
}

// Format relative time
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day');
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, 'month');
  return rtf.format(-diffYear, 'year');
}

// Format time
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

// Truncate a string
export function truncate(str: string, maxLength = 50): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

// Format initials
export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? '').toUpperCase())
    .join('');
}

// Pluralize a word
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`;
}

// Capitalize first letter
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Title case
export function titleCase(str: string): string {
  if (!str) return '';
  return str
    .split(/_|\s|-/)
    .filter(Boolean)
    .map((word) => capitalize(word))
    .join(' ');
}

// Snake case to title case (for status/type labels)
export function snakeToTitle(str: string): string {
  return titleCase(str);
}

// Convert to readable label
export function toLabel(value: string): string {
  return titleCase(value.replace(/[_-]/g, ' '));
}

// Clamp a number
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Sum an array of numbers
export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + (v || 0), 0);
}

// Average
export function average(values: number[]): number {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

// Check if a string is a valid email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Check if value is a valid phone number (PH)
export function isValidPhone(phone: string): boolean {
  return /^(09|\+639|639)\d{9}$/.test(phone.replace(/[\s-]/g, ''));
}

// Normalize a school ID / LRN
export function normalizeLRN(lrn: string): string {
  return lrn.replace(/[^0-9]/g, '');
}

// Group an array by key
export function groupBy<T>(arr: T[], key: string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = (item as Record<string, unknown>)[key] as string;
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

// Debounced function factory
export function debounceFn<A extends unknown[]>(fn: (...args: A) => void, delay = 150) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Throttle function factory
export function throttleFn<A extends unknown[]>(fn: (...args: A) => void, limit = 150) {
  let lastRan = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    const now = Date.now();
    if (now - lastRan >= limit) {
      fn(...args);
      lastRan = now;
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          fn(...args);
          lastRan = Date.now();
        },
        limit - (now - lastRan)
      );
    }
  };
}

// Safe JSON parse
export function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Download a file from content
export function downloadFile(filename: string, content: BlobPart, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy text to clipboard
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Utilities for accessibility
export function esc(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch] as string);
}

export default {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  truncate,
  getInitials,
  pluralize,
  capitalize,
  titleCase,
  snakeToTitle,
  toLabel,
  clamp,
  sum,
  average,
  isValidEmail,
  isValidPhone,
  normalizeLRN,
  groupBy,
  debounceFn,
  throttleFn,
  safeParse,
  downloadFile,
  copyText,
  esc,
};