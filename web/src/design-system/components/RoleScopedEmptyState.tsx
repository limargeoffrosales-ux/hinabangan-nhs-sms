import { ReactNode } from 'react';
import { EmptyState } from './feedback';
import { cn } from '../../lib/cn';

export interface RoleScopedEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Write-tier roles receive the primary `action`; read-only roles receive `flagAction`. */
  canEdit?: boolean;
  action?: ReactNode;
  flagAction?: ReactNode;
  /** Optional single-line helper, e.g. "Staff can be notified via Guidance." */
  readOnlyNote?: ReactNode;
  className?: string;
}

/**
 * Empty state that respects the five-role write tier: editors see the primary
 * action, everyone else sees a request/flag affordance instead. Keep the
 * `description` to one line — this is an empty state, not a feature page.
 */
export function RoleScopedEmptyState({
  icon,
  title,
  description,
  canEdit = true,
  action,
  flagAction,
  readOnlyNote,
  className,
}: RoleScopedEmptyStateProps) {
  const showAction = canEdit ? action : (flagAction ?? readOnlyNote);
  return (
    <div className={cn('ds-empty-role', className)}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={showAction}
      />
      {!canEdit && readOnlyNote && action && !flagAction && (
        <p className="ds-empty-role__note">{readOnlyNote}</p>
      )}
    </div>
  );
}

export default RoleScopedEmptyState;