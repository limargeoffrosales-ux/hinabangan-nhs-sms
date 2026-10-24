import { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import { useEscapeKey, useFocusTrap } from '../hooks';

export interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  /** Desktop panel width in px; full-screen sheet on mobile. */
  width?: number;
  /** Close-button accessible name — pass t('common.close'). Defaults to "Close". */
  closeLabel?: string;
  hiddenFromScreenReader?: boolean;
}

const closeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Right-hand profile/edit drawer. Overlay + Escape + focus trap keep it modal;
 * on small screens the panel becomes a full-height sheet with the header
 * pinned and the body scrollable.
 */
export function ProfileDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  aside,
  width = 420,
  closeLabel = 'Close',
  hiddenFromScreenReader = false,
}: ProfileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const titleString = typeof title === 'string' ? title : undefined;

  return (
    <div className="ds-drawer" role="presentation">
      <div className="ds-drawer__overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titleString}
        aria-hidden={hiddenFromScreenReader ? true : undefined}
        className="ds-drawer__panel"
        style={{ '--ds-drawer-width': `${width}px` } as CSSProperties}
      >
        <header className="ds-drawer__head">
          <div className="ds-drawer__titles">
            <h3>{title}</h3>
            {subtitle && <p className="ds-drawer__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="ds-drawer__close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            {closeIcon}
          </button>
        </header>
        <div className="ds-drawer__layout">
          <div className="ds-drawer__body">{children}</div>
          {aside && <div className="ds-drawer__aside">{aside}</div>}
        </div>
        {footer && <footer className="ds-drawer__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export default ProfileDrawer;