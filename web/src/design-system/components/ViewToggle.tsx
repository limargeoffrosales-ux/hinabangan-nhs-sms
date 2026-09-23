import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ViewToggleOption {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface ViewToggleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'children'> {
  view: string;
  onViewChange: (view: string) => void;
  options: ViewToggleOption[];
}

/**
 * Table <-> card layout switcher. ARIA: role="tablist", active option is
 * `aria-selected`. Labels are consumer-translated (i18n stays out of the
 * design system). Provide an `aria-label` for the group.
 */
export function ViewToggle({
  view,
  onViewChange,
  options,
  className,
  ...props
}: ViewToggleProps) {
  return (
    <div
      role="tablist"
      className={cn('ds-view-toggle', className)}
      {...props}
    >
      {options.map((option) => {
        const active = option.id === view;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onViewChange(option.id)}
            className={cn('ds-view-toggle__opt', active && 'is-active')}
          >
            {option.icon && <span className="ds-view-toggle__icon" aria-hidden="true">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;