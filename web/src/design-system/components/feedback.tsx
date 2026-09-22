// Design System Feedback Components
// Badge, Card, Alert, Skeleton, Empty state, etc.
// Styled via plain-CSS `ds-*` classes defined in `design-system/design-system.css`.

import React, { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// ============================================
// Badge Component
// ============================================

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  children?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  pulse = false,
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'ds-badge',
        `ds-badge--${variant}`,
        `ds-badge--${size}`,
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('ds-badge__dot', pulse && 'is-pulsing')} aria-hidden="true">
          <span className={cn('ds-badge__dot-core', `is-${variant}`)} />
          {pulse && <span className={cn('ds-badge__dot-halo', `is-${variant}`)} />}
        </span>
      )}
      {children}
    </span>
  );
}

// Status badge helper — maps API status strings to semantic variants
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: 'success',
  approved: 'success',
  published: 'success',
  completed: 'success',
  enrolled: 'success',
  present: 'success',
  passed: 'success',
  good: 'success',
  low: 'success',
  on_time: 'success',
  closed: 'success',
  paid: 'success',
  pending: 'warning',
  submitted: 'warning',
  reviewing: 'warning',
  in_progress: 'warning',
  partial: 'warning',
  late: 'warning',
  void: 'warning',
  draft: 'neutral',
  archived: 'neutral',
  expired: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  suspended: 'danger',
  rejected: 'danger',
  failed: 'danger',
  absent: 'danger',
  deficient: 'danger',
  overdue: 'danger',
  cancelled: 'danger',
  critical: 'danger',
  missing: 'danger',
  error: 'danger',
  info: 'info',
  queued: 'info',
  processing: 'info',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = String(status || '').toLowerCase();
  const variant: BadgeVariant = STATUS_VARIANTS[key] || 'neutral';

  return (
    <Badge variant={variant} dot className={className}>
      {status}
    </Badge>
  );
}

// ============================================
// Card Component
// ============================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hoverable?: boolean;
  interactive?: boolean;
  flat?: boolean;
  border?: boolean;
}

export function Card({
  children,
  padding = 'md',
  hoverable = false,
  interactive = false,
  flat = false,
  border = true,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'ds-card',
        `ds-card--pad-${padding}`,
        hoverable && 'is-hoverable',
        interactive && 'is-interactive',
        flat && 'is-flat',
        !border && 'no-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ds-card__header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ds-card__body', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ds-card__footer', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('ds-card__title', className)} {...props}>
      {children}
    </h3>
  );
}

// ============================================
// Alert Component
// ============================================

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
}

const alertIcons: Record<AlertVariant, ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  neutral: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

export function Alert({ variant = 'info', title, icon, dismissible, onDismiss, children, className, ...props }: AlertProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div
      role="alert"
      className={cn('ds-alert', `ds-alert--${variant}`, className)}
      {...props}
    >
      <span className="ds-alert__icon">{icon || alertIcons[variant]}</span>
      <div className="ds-alert__content">
        {title && <p className="ds-alert__title">{title}</p>}
        <div className="ds-alert__body">{children}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="ds-alert__dismiss"
          aria-label="Dismiss alert"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================
// Skeleton Component
// ============================================

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  lines?: number;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  circle = false,
  lines,
  className,
  ...props
}: SkeletonProps) {
  if (lines) {
    return (
      <div className={cn('ds-skeleton-group', className)} aria-hidden="true" {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className={cn('ds-skeleton', i === lines - 1 && 'is-short')}
            style={{ width }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className={cn('ds-skeleton', circle && 'is-circle', className)}
      style={{ width, height }}
      aria-hidden="true"
      {...props}
    />
  );
}

// ============================================
// Empty State
// ============================================

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('ds-empty', className)} {...props}>
      {icon && <div className="ds-empty__icon">{icon}</div>}
      <h3 className="ds-empty__title">{title}</h3>
      {description && <p className="ds-empty__desc">{description}</p>}
      {action && <div className="ds-empty__action">{action}</div>}
    </div>
  );
}

// ============================================
// Divider
// ============================================

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <div className={cn('ds-divider', 'has-label', className)}>
        <span className="ds-divider__line" />
        <span className="ds-divider__label">{label}</span>
        <span className="ds-divider__line" />
      </div>
    );
  }
  return <div className={cn('ds-divider', className)} role="separator" />;
}

// ============================================
// Progress Bar
// ============================================

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
}

export function Progress({ value, max = 100, variant = 'primary', showLabel = false, className, ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('ds-progress', className)} {...props}>
      <div
        className="ds-progress__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn('ds-progress__bar', `is-${variant}`)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <span className="ds-progress__label">{Math.round(percentage)}%</span>}
    </div>
  );
}

// ============================================
// KPI Stat Card
// ============================================

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: number;
  trendLabel?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon, trend, trendLabel, loading = false, className, ...props }: StatCardProps) {
  const trendPositive = trend !== undefined && trend >= 0;

  return (
    <Card className={cn('ds-stat', className)} {...props}>
      <div className="ds-stat__row">
        <div className="ds-stat__text">
          <p className="ds-stat__label">{label}</p>
          {loading ? (
            <Skeleton width="80px" height="2rem" className="ds-stat__value" />
          ) : (
            <p className="ds-stat__value">{value}</p>
          )}
          {trend !== undefined && (
            <div className="ds-stat__trend">
              <span
                className={cn('ds-stat__trend-value', trendPositive ? 'is-up' : 'is-down')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {trendPositive ? (
                    <polyline points="18 15 12 9 6 15" />
                  ) : (
                    <polyline points="6 9 12 15 18 9" />
                  )}
                </svg>
                {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="ds-stat__trend-note">{trendLabel}</span>}
            </div>
          )}
        </div>
        {icon && <div className="ds-stat__icon">{icon}</div>}
      </div>
    </Card>
  );
}

// ============================================
// Section Title
// ============================================

export function SectionTitle({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('ds-section-title', className)} {...props}>
      {children}
    </h2>
  );
}

export default { Badge, StatusBadge, Card, Alert, Skeleton, EmptyState, Divider, Progress, StatCard, SectionTitle };