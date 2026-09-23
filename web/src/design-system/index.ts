// Design System - Main Entry Point
// Unified import surface for the entire design system

// Tokens
export * from './tokens';
export { tokens } from './tokens';

// Theme
export { default as ThemeProvider, useTheme, useThemeColors, useIsDark, useCSSVariables } from './theme/ThemeProvider';

// Core components
export {
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Label,
  FormField,
} from './components/core';
export type { ButtonProps, IconButtonProps, InputProps, TextareaProps, SelectProps } from './components/core';

// Feedback components
export {
  Badge,
  StatusBadge,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  Alert,
  Skeleton,
  EmptyState,
  Divider,
  Progress,
  StatCard,
  SectionTitle,
} from './components/feedback';
export type { BadgeProps, BadgeVariant, CardProps, AlertProps, AlertVariant } from './components/feedback';

// Layout components
export {
  Container,
  Stack,
  Grid,
  Flex,
  PageHeader,
  Tabs,
  Breadcrumbs,
  Spacer,
} from './components/layout';
export type { ContainerProps, StackProps, GridProps, PageHeaderProps, TabsProps, BreadcrumbsProps } from './components/layout';

// App-shell components
export { ViewToggle, DataTable, ProfileDrawer, RankCard, CalendarHeatmap, LiveStatusPill, RoleScopedEmptyState, LiveActivityFeed, LanguageSwitch, GroupedNav } from './components';
export type { ViewToggleProps, ViewToggleOption } from './components/ViewToggle';
export type { DataTableProps, DataTableColumn } from './components/DataTable';
export type { ProfileDrawerProps } from './components/ProfileDrawer';
export type { RankCardProps } from './components/RankCard';
export type { CalendarHeatmapProps, HeatmapDay } from './components/CalendarHeatmap';
export type { LiveStatusPillProps, LiveStatusTone } from './components/LiveStatusPill';
export type { RoleScopedEmptyStateProps } from './components/RoleScopedEmptyState';
export type { LiveActivityFeedProps } from './components/LiveActivityFeed';
export type { LanguageSwitchProps, LanguageOption } from './components/LanguageSwitch';
export type { GroupedNavProps, GroupedNavItem, GroupedNavGroup } from './components/GroupedNav';

// Chart components + SVG primitives
export { ChartCard, ChartTooltip, Sparkline, ProgressRing, DonutChart, ModernBarChart, ModernLineChart } from './components/charts';
export type {
  ChartCardProps,
  ChartTooltipProps,
  SparklineProps,
  ProgressRingProps,
  RingTone,
  DonutChartProps,
  DonutSegment,
  ModernBarChartProps,
  ModernBarSeries,
  ModernLineChartProps,
  ModernLineSeries,
  RechartsShim,
} from './components/charts';

// Hooks
export * from './hooks';

// Utils
export * from './utils';
export { cn } from '../lib/cn';