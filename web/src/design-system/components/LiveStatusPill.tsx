import { useEffect, useState, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type LiveStatusTone = 'live' | 'stale' | 'offline';

export interface LiveStatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Base label: "Live" / "Nag-u-update" etc. — consumer-translated. */
  label: ReactNode;
  tone?: LiveStatusTone;
  /** Last data timestamp; drives the "updated X ago" age label and auto-stale. */
  lastUpdated?: number | string | Date | null;
  /** Renders the age text, e.g. (ms) => t('common.updatedXsAgo', {ms}). */
  ageFormatter?: (ageMs: number) => string;
  /** Treat a live pill as stale when nothing arrived in this long (ms). */
  staleAfterMs?: number;
}

function toDate(value: number | string | Date | null): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Persistent "live/connected" affordance for SSE-backed surfaces. Pulses while
 * live, flips to stale after `staleAfterMs` of silence, and can render a
 * rolling "updated Xs ago" label via `ageFormatter` (keeps i18n with the caller).
 */
export function LiveStatusPill({
  label,
  tone = 'live',
  lastUpdated,
  ageFormatter,
  staleAfterMs = 60000,
  className,
  ...props
}: LiveStatusPillProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const last = lastUpdated === undefined ? null : toDate(lastUpdated);
  const ageMs = last && now >= last.getTime() ? now - last.getTime() : null;
  const effectiveTone: LiveStatusTone =
    tone === 'live' && ageMs !== null && ageMs > staleAfterMs ? 'stale' : tone;

  return (
    <span
      className={cn('ds-live-pill', `is-${effectiveTone}`)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span className="ds-live-pill__dot" aria-hidden="true">
        <span className="ds-live-pill__dot-core" />
        <span className="ds-live-pill__dot-halo" />
      </span>
      <span className="ds-live-pill__label">{label}</span>
      {effectiveTone !== 'offline' && ageFormatter && ageMs !== null && (
        <span className="ds-live-pill__age">{ageFormatter(ageMs)}</span>
      )}
    </span>
  );
}

export default LiveStatusPill;