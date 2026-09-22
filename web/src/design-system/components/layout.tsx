// Design System Layout Components
// Container, Stack, Grid, PageHeader, etc.
// Styled via plain-CSS `ds-*` classes defined in `design-system/design-system.css`.

import React, { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

// ============================================
// Container
// ============================================

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
}

export function Container({ size = 'xl', children, className, ...props }: ContainerProps) {
  return (
    <div className={cn('ds-container', `ds-container--${size}`, className)} {...props}>
      {children}
    </div>
  );
}

// ============================================
// Stack
// ============================================

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  children: ReactNode;
}

export function Stack({
  direction = 'column',
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  children,
  className,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(
        'ds-stack',
        direction === 'column' ? 'is-col' : 'is-row',
        `gap-${spacing}`,
        `align-${align}`,
        `justify-${justify}`,
        wrap && 'is-wrap',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Grid
// ============================================

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  colsSm?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  colsMd?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  colsLg?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  colsXl?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  children: ReactNode;
}

export function Grid({
  cols = 1,
  colsSm,
  colsMd,
  colsLg,
  colsXl,
  gap = 'md',
  children,
  className,
  ...props
}: GridProps) {
  return (
    <div
      className={cn(
        'ds-grid',
        `gap-${gap}`,
        `cols-${cols}`,
        colsSm && `cols-sm-${colsSm}`,
        colsMd && `cols-md-${colsMd}`,
        colsLg && `cols-lg-${colsLg}`,
        colsXl && `cols-xl-${colsXl}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Flex (arrangement shortcut)
// ============================================

export function Flex({ className, ...props }: StackProps) {
  return <Stack direction="row" {...props} className={className} />;
}

// ============================================
// Page Header
// ============================================

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, breadcrumbs, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn('ds-page-header', className)} {...props}>
      {breadcrumbs && <div className="ds-page-header__crumbs">{breadcrumbs}</div>}
      <div className="ds-page-header__row">
        <div className="ds-page-header__lead">
          {icon && <div className="ds-page-header__icon">{icon}</div>}
          <div className="ds-page-header__text">
            <h1 className="ds-page-header__title">{title}</h1>
            {subtitle && <p className="ds-page-header__subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="ds-page-header__actions">{actions}</div>}
      </div>
    </div>
  );
}

// ============================================
// Tabs
// ============================================

export interface TabsProps {
  tabs: { id: string; label: ReactNode; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills' | 'boxed';
  className?: string;
}

export function Tabs({ tabs, active, onChange, variant = 'underline', className, ...props }: TabsProps) {
  return (
    <div
      className={cn('ds-tabs', `ds-tabs--${variant}`, className)}
      role="tablist"
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn('ds-tabs__tab', active === tab.id && 'is-active')}
        >
          {tab.icon && <span className="ds-tabs__icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// Breadcrumbs
// ============================================

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items: { label: ReactNode; to?: string; onClick?: () => void }[];
}

export function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  return (
    <nav className={cn('ds-breadcrumbs', className)} aria-label="Breadcrumb" {...props}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <span className="ds-breadcrumbs__sep" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            )}
            {item.to || item.onClick ? (
              <a
                href={item.to}
                onClick={item.onClick}
                className={cn('ds-breadcrumbs__item', isLast && 'is-current')}
              >
                {item.label}
              </a>
            ) : (
              <span className={cn('ds-breadcrumbs__item', isLast && 'is-current')}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================
// Spacer
// ============================================

export function Spacer({ size = 'md', className }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'; className?: string }) {
  return <div className={cn('ds-spacer', `ds-spacer--${size}`, className)} aria-hidden="true" />;
}

export default { Container, Stack, Grid, Flex, PageHeader, Tabs, Breadcrumbs, Spacer };