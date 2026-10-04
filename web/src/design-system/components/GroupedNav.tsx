import { HTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export interface GroupedNavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface GroupedNavGroup {
  id: string;
  label: ReactNode;
  items: GroupedNavItem[];
}

export interface GroupedNavProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  groups: GroupedNavGroup[];
  activeId?: string;
  onNavigate?: (itemId: string) => void;
  collapsible?: boolean;
  /** Opens groups where `groups.itemCount > threshold` automatically. */
  openGroupCount?: number;
}

const chevronIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

function initialOpenGroups(groups: GroupedNavGroup[], openGroupCount: number): string[] {
  return groups
    .filter((g) => g.items.length >= openGroupCount)
    .map((g) => g.id);
}

/**
 * Collapsible grouped sidebar nav. Group labels are consumer-translated.
 * Non-collapsible mode renders all groups expanded (for portal-style sidebars).
 */
export function GroupedNav({
  groups,
  activeId,
  onNavigate,
  collapsible = true,
  openGroupCount = 0,
  className,
  ...props
}: GroupedNavProps) {
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    collapsible ? initialOpenGroups(groups, openGroupCount) : groups.map((g) => g.id)
  );

  // Groups the user explicitly collapsed/expanded. The auto-sync effect below
  // must not fight user intent: with openGroupCount = 0 every group satisfies
  // `items.length >= openGroupCount`, so the "open groups by default" branch
  // re-added every manually collapsed group on each re-render, and the groups
  // array is a fresh literal on every Layout render, so that was constantly.
  const userToggled = useRef<Set<string>>(new Set());

  // Signature of the group shape, so this only re-runs when the groups actually
  // change rather than on every new array identity.
  const signature = collapsible
    ? `${openGroupCount}|${groups.map((g) => `${g.id}:${g.items.length}`).join(',')}`
    : `all|${groups.map((g) => g.id).join(',')}`;

  // Re-spread when the group set changes while a group is collapsed:
  // keep open ids that still exist, otherwise default.
  useEffect(() => {
    if (!collapsible) {
      setOpenGroups(groups.map((g) => g.id));
      return;
    }
    setOpenGroups((current) => {
      const live = new Set(current);
      for (const g of groups) {
        if (userToggled.current.has(g.id)) continue;
        if (g.items.length < openGroupCount) live.delete(g.id);
        else if (!live.has(g.id)) live.add(g.id);
      }
      for (const id of current) {
        if (!groups.some((g) => g.id === id)) live.delete(id);
      }
      return live.size === current.length && current.every((id, i) => id === Array.from(live)[i])
        ? current
        : Array.from(live);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, collapsible]);

  function toggleGroup(id: string) {
    userToggled.current.add(id);
    setOpenGroups((open) =>
      open.includes(id) ? open.filter((g) => g !== id) : [...open, id]
    );
  }

  return (
    <nav className={cn('ds-navgroup', className)} {...props}>
      {groups.map((group) => {
        const open = openGroups.includes(group.id);
        return (
          <div key={group.id} className="ds-navgroup__group">
            <button
              type="button"
              className={cn('ds-navgroup__head', collapsible && 'is-toggle', open && 'is-open')}
              onClick={() => collapsible && toggleGroup(group.id)}
              aria-expanded={collapsible ? open : true}
            >
              <span aria-hidden="true" className="ds-navgroup__chev">{chevronIcon}</span>
              <span className="ds-navgroup__head-label">{group.label}</span>
            </button>
            <ul className={cn('ds-navgroup__list', !open && 'is-hidden')}>
              {group.items.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => !item.disabled && onNavigate?.(item.id)}
                      className={cn('ds-navgroup__item', active && 'is-active', item.disabled && 'is-disabled')}
                      disabled={item.disabled}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.icon && (
                        <span aria-hidden="true" className="ds-navgroup__ico">{item.icon}</span>
                      )}
                      <span className="ds-navgroup__label">{item.label}</span>
                      {typeof item.count === 'number' && (
                        <span className="ds-navgroup__badge">{item.count}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export default GroupedNav;