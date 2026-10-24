import { HTMLAttributes, ReactNode, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

export interface DataTableColumn<T> {
  key: string;
  header?: ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  loadingRows?: number;
  emptySlot?: ReactNode;
  density?: 'comfort' | 'compact';
  emptyColSpan?: number;
}

const chevronUp = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points="6 14 12 8 18 14" />
  </svg>
);

const chevronDown = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Generic sortable data table with built-in skeleton loading and an empty slot
 * for consumers to pass `EmptyState`/`RoleScopedEmptyState`. Rows are
 * keyboard-activatable when `onRowClick` is provided.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  loadingRows = 3,
  emptySlot,
  density = 'comfort',
  emptyColSpan,
  className,
  ...props
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    const get = col?.sortValue;
    if (!get) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sortKey, sortDir]);

  function onHeaderClick(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  const colSpan = emptyColSpan ?? columns.length;

  return (
    <div className={cn('ds-table', `is-${density}`, className)} {...props}>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(col.className, col.align && `is-${col.align}`)}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="ds-table__sort"
                    onClick={() => onHeaderClick(col)}
                    aria-sort={
                      sortKey === col.key
                        ? (sortDir === 'asc' ? 'ascending' : 'descending')
                        : undefined
                    }
                  >
                    <span>{col.header}</span>
                    <span className="ds-table__ind" aria-hidden="true">
                      {sortKey === col.key
                        ? (sortDir === 'asc' ? chevronUp : chevronDown)
                        : chevronDown}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }, (_, i) => (
              <tr key={`skeleton-${i}`} className="ds-table__skel">
                <td colSpan={colSpan}>
                  <span className="ds-skeleton" />
                </td>
              </tr>
            ))
          ) : sorted.length > 0 ? (
            sorted.map((row) => {
              const key = rowKey(row);
              const clickable = Boolean(onRowClick);
              return (
                <tr
                  key={key}
                  className={cn(clickable && 'is-clickable')}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick?.(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : -1}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn(col.align && `is-${col.align}`)}>
                      {col.render ? col.render(row) : null}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            emptySlot && (
              <tr className="ds-table__empty">
                <td colSpan={colSpan}>{emptySlot}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;