// Design System Chart Components
// ChartCard + ChartTooltip (recharts-friendly shell + theming) and lightweight
// pure-SVG primitives (Sparkline, ProgressRing, DonutChart) with zero recharts
// dependency. Styled via `ds-*` classes in `design-system/design-system.css`.

import React, { ReactNode, useMemo } from 'react';
import { cn } from '../../lib/cn';
import { Card, Skeleton } from './feedback';

// ============================================
// ChartCard — shared chart shell
// ============================================

export interface ChartCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  height?: number | string;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  icon,
  actions,
  height = 260,
  loading = false,
  empty,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card padding="none" className={cn('ds-chart', className)}>
      {(title != null || subtitle != null || actions != null) && (
        <div className="ds-chart__head">
          <div className="ds-chart__heading">
            {icon != null && <span className="ds-chart__icon">{icon}</span>}
            <div style={{ minWidth: 0 }}>
              {title != null && <h3 className="ds-chart__title">{title}</h3>}
              {subtitle != null && <p className="ds-chart__sub">{subtitle}</p>}
            </div>
          </div>
          {actions != null && <div className="ds-chart__actions">{actions}</div>}
        </div>
      )}
      <div className="ds-chart__body" style={{ height }}>
        {loading ? (
          <Skeleton height="100%" className="ds-chart__skeleton" />
        ) : empty != null ? (
          <div className="ds-chart__empty">{empty}</div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

// ============================================
// ChartTooltip — themed content for recharts <Tooltip content={...} />
// ============================================

export interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  stroke?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number, payload?: ChartTooltipEntry[]) => string;
  valueFormatter?: (value: number | string, entry: ChartTooltipEntry) => string;
  unit?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  unit,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const title = labelFormatter
    ? labelFormatter(label != null ? label : '', payload)
    : label != null
      ? String(label)
      : '';

  return (
    <div className="ds-chart-tip" role="status">
      {title && <div className="ds-chart-tip__title">{title}</div>}
      <div className="ds-chart-tip__rows">
        {payload.map((entry, i) => {
          const raw = Array.isArray(entry.value) ? entry.value[0] : entry.value;
          const value =
            raw == null
              ? '—'
              : valueFormatter
                ? valueFormatter(raw, entry)
                : String(raw);
          const dotColor = entry.color || entry.stroke || entry.fill || 'var(--accent)';
          return (
            <div key={i} className="ds-chart-tip__row">
              <span className="ds-chart-tip__swatch" style={{ background: dotColor }} />
              <span className="ds-chart-tip__name">{entry.name != null ? entry.name : ''}</span>
              <strong className="ds-chart-tip__value">
                {value}
                {unit != null ? ` ${unit}` : ''}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Sparkline — tiny trend line, pure SVG
// ============================================

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = 'var(--accent)',
  strokeWidth = 2,
  fill = true,
  className,
  ariaLabel,
}: SparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = strokeWidth;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    return data.map((v, i) => {
      const x = pad + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = pad + innerH - ((v - min) / span) * innerH;
      return [x, y] as const;
    });
  }, [data, width, height, strokeWidth]);

  if (points.length === 0) return null;

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const areaPath = `M ${first[0].toFixed(2)},${(height - strokeWidth).toFixed(2)} L ${line.replace(/\s/g, ' L ')} L ${last[0].toFixed(2)},${(height - strokeWidth).toFixed(2)} Z`;

  return (
    <svg
      className={cn('ds-sparkline', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <defs>
        {fill && (
          <linearGradient id="ds-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        )}
      </defs>
      {fill && <path d={areaPath} fill="url(#ds-spark-fill)" stroke="none" />}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1} fill={stroke} />
    </svg>
  );
}

// ============================================
// ProgressRing — circular percentage gauge
// ============================================

export type RingTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  label?: ReactNode;
  showLabel?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  tone = 'primary',
  label,
  showLabel = true,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn('ds-ring', `is-${tone}`, className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label != null ? String(label) : `${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="ds-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ds-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <div className="ds-ring__label">{label != null ? label : `${Math.round(clamped)}%`}</div>
      )}
    </div>
  );
}

// ============================================
// DonutChart — ring chart with optional center total + legend
// ============================================

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  gap?: number;
  centerValue?: ReactNode;
  centerLabel?: string;
  legend?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function DonutChart({
  data,
  size = 160,
  thickness = 24,
  gap = 2,
  centerValue,
  centerLabel,
  legend = true,
  valueFormatter,
  className,
}: DonutChartProps) {
  const total = Math.max(
    0,
    data.reduce((a, s) => a + (Number.isFinite(s.value) ? s.value : 0), 0)
  );

  const { radius, circumference, segments } = useMemo(() => {
    const r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;
    const gapLen = gap > 0 ? (gap / 360) * circ : 0;
    let accum = 0;
    const segs = data.map((s) => {
      const len = total > 0 ? (s.value / total) * circ : 0;
      const item = {
        ...s,
        dash: `${Math.max(0, len - gapLen).toFixed(2)} ${Math.max(0, circ - len + gapLen).toFixed(2)}`,
        offset: -accum,
      };
      accum += len;
      return item;
    });
    return { radius: r, circumference: circ, segments: segs };
  }, [data, size, thickness, gap, total]);

  if (total <= 0 || data.length === 0) {
    return (
      <div className={cn('ds-donut', className)}>
        <div className="ds-donut__empty" style={{ width: size, height: size }}>
          —
        </div>
      </div>
    );
  }

  const c = size / 2;

  return (
    <div className={cn('ds-donut', className)}>
      <div className="ds-donut__chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            className="ds-donut__track"
            cx={c}
            cy={c}
            r={radius}
            fill="none"
            strokeWidth={thickness}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              className="ds-donut__seg"
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={seg.dash}
              strokeDashoffset={seg.offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          ))}
        </svg>
        {(centerValue != null || centerLabel != null) && (
          <div className="ds-donut__center">
            {centerValue != null && <div className="ds-donut__center-value">{centerValue}</div>}
            {centerLabel != null && <div className="ds-donut__center-label">{centerLabel}</div>}
          </div>
        )}
      </div>
      {legend && (
        <ul className="ds-donut__legend">
          {data.map((seg, i) => (
            <li key={i} className="ds-donut__item">
              <span className="ds-donut__swatch" style={{ background: seg.color }} />
              <span className="ds-donut__name">{seg.name}</span>
              <strong className="ds-donut__val">
                {valueFormatter ? valueFormatter(seg.value) : seg.value}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default { ChartCard, ChartTooltip, Sparkline, ProgressRing, DonutChart };