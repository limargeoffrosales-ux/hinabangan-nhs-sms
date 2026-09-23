import { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface LiveActivityFeedProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T, index: number) => string;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Screens-reader-friendly drop-in for recent activity: `aria-live="polite"`
 * announces newly appended items. Loading renders skeleton rows; empty renders
 * `emptyState` (pass `RoleScopedEmptyState`-style content as needed).
 */
export function LiveActivityFeed<T>({
  items,
  renderItem,
  itemKey,
  emptyState,
  loading = false,
  loadingRows = 3,
  className,
  'aria-label': ariaLabel,
}: LiveActivityFeedProps<T>) {
  return (
    <div className={cn('ds-feed', className)} role="region" aria-label={ariaLabel}>
      {loading ? (
        <ul className="ds-feed__list">
          {Array.from({ length: loadingRows }, (_, i) => (
            <li key={`skeleton-${i}`} className="ds-feed__skel">
              <span className="ds-skeleton is-avatar" />
              <span className="ds-feed__skel-lines">
                <span className="ds-skeleton" />
                <span className="ds-skeleton is-short" />
              </span>
            </li>
          ))}
        </ul>
      ) : items.length > 0 ? (
        <ul className="ds-feed__list" aria-live="polite">
          {items.map((item, index) => (
            <li key={itemKey(item, index)} className="ds-feed__item">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      ) : (
        emptyState ?? null
      )}
    </div>
  );
}

export default LiveActivityFeed;