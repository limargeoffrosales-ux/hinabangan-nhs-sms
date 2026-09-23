// Design System Chart Components
// ChartCard + ChartTooltip (recharts-friendly shell + theming) and lightweight
// pure-SVG primitives (Sparkline, ProgressRing, DonutChart) with zero recharts
// dependency. Styled via `ds-*` classes in `design-system/design-system.css`.

import React, { ReactNode, useId, useMemo } from 'react';
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

// ============================================
// Modern recharts wrappers — "bold gradient + glass" look.
// Vertical gradient fills, floating rounded bars, minimal
// dashed gridlines, clean dim typography. The `R` prop is the
// lazily-loaded recharts module (pages already hold it).
// ============================================

type RechartsComp = React.ComponentType<any>;

export interface RechartsShim {
  BarChart: RechartsComp;
  Bar: RechartsComp;
  XAxis: RechartsComp;
  YAxis: RechartsComp;
  CartesianGrid: RechartsComp;
  Tooltip: RechartsComp;
  ResponsiveContainer: RechartsComp;
  Cell: RechartsComp;
  LineChart: RechartsComp;
  AreaChart: RechartsComp;
  Area: RechartsComp;
  Line: RechartsComp;
  ReferenceDot: RechartsComp;
  Label: RechartsComp;
}

export interface ModernBarSeries {
  key: string;
  name?: string;
  color: string;
}

export interface ModernBarChartProps {
  R: RechartsShim;
  data: Array<Record<string, unknown>>;
  series: ModernBarSeries[];
  categoryKey?: string;
  layout?: 'horizontal' | 'vertical';
  stacked?: boolean;
  perBarColors?: string[];
  showLabels?: boolean;
  labelSuffix?: string;
  height?: number;
  barSize?: number;
  barGap?: number;
  barCategoryGap?: number | string;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
  yDomain?: [number | 'auto', number | 'auto'];
  yTickFormatter?: (value: number) => string;
  grid?: boolean;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
  animationDuration?: number;
  radius?: number;
  xAngle?: number;
  xHeight?: number;
  children?: ReactNode;
}

export function ModernBarChart({
  R,
  data,
  series,
  categoryKey = 'name',
  layout = 'horizontal',
  stacked = false,
  perBarColors,
  showLabels = true,
  labelSuffix = '',
  height = 270,
  barSize,
  barGap,
  barCategoryGap = '28%',
  hideXAxis = false,
  hideYAxis = false,
  yDomain,
  yTickFormatter,
  grid = true,
  margin,
  animationDuration = 800,
  radius = 8,
  xAngle,
  xHeight,
  children,
}: ModernBarChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const perBar = perBarColors && perBarColors.length > 0 ? perBarColors : null;

  if (!data || data.length === 0 || !series || series.length === 0) return null;

  const topRadius: [number, number, number, number] = layout === 'vertical' ? [0, radius, radius, 0] : [radius, radius, 0, 0];
  const zeroRadius: [number, number, number, number] = [0, 0, 0, 0];

  const barRadius = (i: number): [number, number, number, number] => {
    if (stacked) return i === series.length - 1 ? topRadius : zeroRadius;
    return topRadius;
  };

  const m = {
    top: layout === 'horizontal' ? 20 : 6,
    right: layout === 'vertical' ? 34 : 8,
    left: 0,
    bottom: 0,
    ...margin,
  };

  const labelProps = layout === 'vertical' ? { position: 'right' } : { position: 'top' };

  const defs = (
    <defs key="grads">
      {perBar
        ? data.map((_, i) => {
            const c = perBar[i % perBar.length] ?? 'var(--accent)';
            return (
              <linearGradient key={i} id={`${uid}-pg${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                <stop offset="100%" stopColor={c} stopOpacity={1} />
              </linearGradient>
            );
          })
        : series.map((s, i) => (
            <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={s.color} stopOpacity={1} />
            </linearGradient>
          ))}
    </defs>
  );

  const labelId = layout === 'vertical' ? 'right' : 'top';

  const renderBars = () => {
    if (perBar) {
      const s = series[0];
      if (!s) return null;
      return (
        <R.Bar
          key={`${uid}-pb`}
          dataKey={s.key}
          name={s.name ?? s.key}
          radius={topRadius}
          barSize={barSize}
          animationDuration={animationDuration}
          animationEasing="ease-out"
          label={showLabels ? { position: labelId as 'top' | 'right', offset: 8 } : undefined}
        >
          {data.map((_, i) => (
            <R.Cell key={i} fill={`url(#${uid}-pg${i})`} />
          ))}
        </R.Bar>
      );
    }
    return series.map((s, i) => (
      <R.Bar
        key={s.key}
        dataKey={s.key}
        name={s.name ?? s.key}
        fill={`url(#${uid}-g${i})`}
        radius={barRadius(i)}
        barSize={barSize}
        animationDuration={animationDuration}
        animationEasing="ease-out"
        label={showLabels && !stacked ? { position: labelId as 'top' | 'right', offset: 8 } : undefined}
      />
    ));
  };

  return (
    <R.ResponsiveContainer width="100%" height={height}>
      <R.BarChart data={data} margin={m} barCategoryGap={barCategoryGap} barGap={barGap}>
        {defs}
        {grid && (
          <R.CartesianGrid
            strokeDasharray="4 8"
            stroke="var(--grid-line)"
            horizontal={layout === 'horizontal'}
            vertical={layout === 'vertical'}
          />
        )}
        {!hideXAxis && (
          <R.XAxis
            dataKey={categoryKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-dim)', fontSize: 11, ...(xAngle != null ? { angle: xAngle, textAnchor: 'end' } : null) }}
            height={xHeight}
            interval="preserveStartEnd"
          />
        )}
        {!hideYAxis && (
          <R.YAxis
            axisLine={false}
            tickLine={false}
            width={38}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            tickFormatter={yTickFormatter}
            allowDecimals={false}
            {...(yDomain != null ? { domain: yDomain } : null)}
          />
        )}
        {renderBars()}
        {children}
      </R.BarChart>
    </R.ResponsiveContainer>
  );
}

export interface ModernLineSeries {
  key: string;
  name?: string;
  color: string;
}

export interface ModernLineChartProps {
  R: RechartsShim;
  data: Array<Record<string, unknown>>;
  series: ModernLineSeries[];
  categoryKey?: string;
  area?: boolean;
  strokeWidth?: number;
  dots?: boolean;
  highlightLast?: boolean;
  height?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  yTickFormatter?: (value: number) => string;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
  grid?: boolean;
  animationDuration?: number;
  children?: ReactNode;
}

export function ModernLineChart({
  R,
  data,
  series,
  categoryKey = 'name',
  area = true,
  strokeWidth = 3,
  dots = false,
  highlightLast = true,
  height = 260,
  yDomain,
  yTickFormatter,
  hideXAxis = false,
  hideYAxis = false,
  grid = true,
  animationDuration = 800,
  children,
}: ModernLineChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (!data || data.length === 0 || !series || series.length === 0) return null;

  const lastPoint = data[data.length - 1];
  const lastSeries = series[0];
  const lastValue = lastSeries && lastPoint ? Number(lastPoint[lastSeries.key] ?? 0) : null;
  const lastLabel =
    lastSeries && lastPoint ? String(lastPoint[categoryKey] ?? '') : '';

  const Chart = area ? R.AreaChart : R.LineChart;
  const Path = area ? R.Area : R.Line;

  const defs = (
    <defs key="line-grads">
      {series.map((s, i) => (
        <linearGradient key={i} id={`${uid}-la${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={s.color} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  );

  return (
    <R.ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
        {defs}
        {grid && (
          <R.CartesianGrid strokeDasharray="4 8" stroke="var(--grid-line)" vertical={false} />
        )}
        {!hideXAxis && (
          <R.XAxis
            dataKey={categoryKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            interval="preserveStartEnd"
          />
        )}
        {!hideYAxis && (
          <R.YAxis
            axisLine={false}
            tickLine={false}
            width={38}
            domain={yDomain}
            tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
            tickFormatter={yTickFormatter}
          />
        )}
        {series.map((s, i) =>
          area ? (
            <R.Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={s.color}
              strokeWidth={strokeWidth}
              fill={`url(#${uid}-la${i})`}
              dot={dots}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={animationDuration}
              animationEasing="ease-out"
            />
          ) : (
            <R.Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              dot={dots}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={animationDuration}
              animationEasing="ease-out"
            />
          )
        )}
        {highlightLast && lastSeries && lastPoint && lastValue != null && (
          <R.ReferenceDot
            x={lastPoint[categoryKey] as string | number}
            y={lastValue}
            r={4.5}
            fill={lastSeries.color}
            stroke="var(--card)"
            strokeWidth={2}
          >
            <R.Label
              value={lastValue}
              position="top"
              offset={8}
              fill={lastSeries.color}
              fontSize={12}
              fontWeight={700}
            />
          </R.ReferenceDot>
        )}
        {children}
      </Chart>
    </R.ResponsiveContainer>
  );
}

export default { ChartCard, ChartTooltip, Sparkline, ProgressRing, DonutChart, ModernBarChart, ModernLineChart };