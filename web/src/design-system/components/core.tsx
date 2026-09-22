// Design System Core Components
// Base components with consistent styling and patterns.
// Styled via plain-CSS `ds-*` classes defined in `design-system/design-system.css`.

import { forwardRef, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// ============================================
// Button Component
// ============================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'ds-btn',
          `ds-btn--${variant}`,
          `ds-btn--${size}`,
          fullWidth && 'ds-btn--block',
          'ds-btn__loading',
          loading ? 'is-loading' : '',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="ds-btn__spinner" aria-hidden="true" />
        )}
        {!loading && leftIcon && <span className="ds-btn__icon">{leftIcon}</span>}
        <span className={cn('ds-btn__label', loading && 'is-hidden')}>{children}</span>
        {!loading && rightIcon && <span className="ds-btn__icon">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================
// IconButton Component
// ============================================

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  'aria-label': string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', 'aria-label': ariaLabel, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'ds-icon-btn',
          `ds-icon-btn--${variant}`,
          `ds-icon-btn--${size}`,
          className
        )}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// ============================================
// Input Component
// ============================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, fullWidth = false, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={cn('ds-field', fullWidth && 'ds-field--block')}>
        {label && (
          <label className="ds-field__label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <div className="ds-field__control">
          {leftIcon && (
            <span className="ds-field__addon ds-field__addon--left" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'ds-input',
              leftIcon && 'has-addon-left',
              rightIcon && 'has-addon-right',
              error && 'is-error',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(errorId, hintId)}
            {...props}
          />
          {rightIcon && (
            <span className="ds-field__addon ds-field__addon--right" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="ds-field__error" id={errorId} role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="ds-field__hint" id={hintId}>{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================
// Textarea Component
// ============================================

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  minRows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = false, minRows = 3, className, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint ? `${textareaId}-hint` : undefined;

    return (
      <div className={cn('ds-field', fullWidth && 'ds-field--block')}>
        {label && (
          <label className="ds-field__label" htmlFor={textareaId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn('ds-input', 'ds-textarea', error && 'is-error', className)}
          rows={minRows}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={cn(errorId, hintId)}
          {...props}
        />
        {error && (
          <p className="ds-field__error" id={errorId} role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="ds-field__hint" id={hintId}>{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// ============================================
// Select Component
// ============================================

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, placeholder, options, fullWidth = false, className, id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint ? `${selectId}-hint` : undefined;

    return (
      <div className={cn('ds-field', fullWidth && 'ds-field--block')}>
        {label && (
          <label className="ds-field__label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <div className="ds-field__control">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'ds-input',
              'ds-select',
              'has-addon-right',
              error && 'is-error',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(errorId, hintId)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <span
            className="ds-field__addon ds-field__addon--right ds-select__chevron"
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && <p className="ds-field__error" role="alert">{error}</p>}
        {hint && !error && <p className="ds-field__hint">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================
// Label Component
// ============================================

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, children, className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('ds-field__label', 'ds-label', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ds-label__required" aria-hidden="true">*</span>
      )}
    </label>
  )
);

Label.displayName = 'Label';

// ============================================
// FormField Wrapper
// ============================================

export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, error, hint, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('ds-field', className)}>
      {label && (
        <label className="ds-field__label">
          {label}
          {required && <span className="ds-label__required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="ds-field__hint">{hint}</p>}
    </div>
  );
}

export default { Button, IconButton, Input, Textarea, Select, Label, FormField };