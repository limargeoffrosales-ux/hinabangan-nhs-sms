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

// Hooks
export * from './hooks';

// Utils
export * from './utils';
export { cn } from '../lib/cn';