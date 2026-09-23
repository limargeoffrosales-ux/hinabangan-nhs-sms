import { useMemo, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface HeatmapDay {
  date: Date;
  value: number;
  level: number;
  present: boolean;
}

export interface CalendarHeatmapProps extends HTMLAttributes<HTMLDivElement> {
  data: { date: string | Date; value: number }[];
  /** 3 or 5 intensity levels. */
  levels?: 3 | 5;
  /** Number of calendar weeks to render, ending on the current week. */
  weeks?: number;
  onDayClick?: (day: HeatmapDay) => void;
  /** Weekday header labels (defaults to M T W T F S S). */
  weekdayLabels?: string[];
  formatTooltip?: (day: HeatmapDay) => string;
  /** Legend labels — pass translated strings, e.g. t('attendance.less'). */
  legendLow?: string;
  legendHigh?: string;
}

const DATE_KEY = (d: Date) => d.toISOString().slice(0, 10);

function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toMonday(value: Date): Date {
  const d = startOfDay(value);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Attendance-style calendar heatmap. Weeks are rows ending on the current one;
 * each day cell is tinted `heat.0..N`. Dates absent from `data` render as a
 * dimmed `is-empty` cell and stay clickable.
 */
export function CalendarHeatmap({
  data,
  levels = 5,
  weeks = 8,
  onDayClick,
  weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  formatTooltip,
  legendLow = 'Less',
  legendHigh = 'More',
  className,
  ...props
}: CalendarHeatmapProps) {
  const { days } = useMemo(() => {
    const byKey: Map<string, number> = new Map();
    let max = 0;
    for (const item of data) {
      const d = item.date instanceof Date ? item.date : new Date(item.date);
      if (Number.isNaN(d.getTime())) continue;
      byKey.set(DATE_KEY(d), item.value);
      if (item.value > max) max = item.value;
    }
    const today = startOfDay(new Date());
    const thisMonday = toMonday(today);
    const grid: HeatmapDay[] = [];
    for (let w = weeks - 1; w >= 0; w -= 1) {
      const weekStart = new Date(thisMonday.getTime() - w * 7 * 86400000);
      for (let dow = 0; dow < 7; dow += 1) {
        const date = new Date(weekStart.getTime() + dow * 86400000);
        const value = byKey.get(DATE_KEY(date));
        const present = value !== undefined;
        const level = present && value !== undefined
          ? (max > 0 ? Math.round((value / max) * (levels - 1)) : 0)
          : -1;
        grid.push({ date, value: value ?? 0, level, present });
      }
    }
    return { days: grid, maxValue: max };
  }, [data, levels, weeks]);

  const header = days.slice(0, 7).map(() => weekdayLabels[0]);

  const rows: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  return (
    <div
      className={cn('ds-heatmap', className)}
      role="grid"
      aria-label="Calendar heatmap"
      {...props}
    >
      <div className="ds-heatmap__head" role="row">
        {weekdayLabels.map((label, i) => (
          <span key={`${label}-${i}`} className="ds-heatmap__dow" role="columnheader">
            {label}
          </span>
        ))}
      </div>
      {rows.map((week, wi) => (
        <div className="ds-heatmap__row" role="row" key={wi}>
          {week.map((day) => {
            const key = day.date.toDateString();
            const levelClass = day.present ? `is-lvl-${day.level}` : 'is-empty';
            const tooltip = formatTooltip ? formatTooltip(day) : undefined;
            return (
              <span
                key={key}
                role="gridcell"
                aria-label={tooltip || day.date.toDateString()}
                className={cn('ds-heatmap__cell', levelClass, onDayClick && 'is-clickable')}
                onClick={onDayClick ? () => onDayClick(day) : undefined}
                onKeyDown={onDayClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(day); } } : undefined}
                tabIndex={onDayClick ? 0 : -1}
                title={tooltip ?? day.date.toDateString()}
              />
            );
          })}
        </div>
      ))}
      <div className="ds-heatmap__legend" aria-hidden="true">
        <span>{legendLow}</span>
        {Array.from({ length: levels }, (_, i) => (
          <span key={i} className={cn('ds-heatmap__swatch', `is-lvl-${i}`)} />
        ))}
        <span>{legendHigh}</span>
      </div>
    </div>
  );
}

export default CalendarHeatmap;