import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../hooks';
import { cn } from '../../lib/cn';

export interface LanguageOption {
  code: string;
  label: string;
}

export interface LanguageSwitchProps {
  languages?: LanguageOption[];
  /** localStorage key for the pick. Defaults to `meridianed_lang`. */
  storageKey?: string;
  onLanguageChange?: (code: string) => void;
  popupAlign?: 'left' | 'right';
  className?: string;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
];

const globeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const checkIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Bilingual EN/FIL switcher extracted from the duplicated topbar popovers in
 * `Layout.jsx` / `PortalLayout.jsx`. Persists via localStorage, syncs through
 * i18next, and is fully ARIA-accessible.
 */
export function LanguageSwitch({
  languages = DEFAULT_LANGUAGES,
  storageKey = 'meridianed_lang',
  onLanguageChange,
  popupAlign = 'right',
  className,
}: LanguageSwitchProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false));

  const current = i18n.language?.toLowerCase() || 'en';
  const active = languages.find((l) => current.startsWith(l.code));

  function pick(code: string) {
    try { localStorage.setItem(storageKey, code); } catch { /* storage unavailable */ }
    i18n.changeLanguage(code).catch(() => {});
    onLanguageChange?.(code);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn('ds-lang', className)}>
      <button
        type="button"
        className="ds-lang__trigger"
        onClick={() => setOpen((o) => !o)}
        title={active ? active.label : undefined}
        aria-label={active ? active.label : 'Language'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {globeIcon}
      </button>
      {open && (
        <div role="menu" className={cn('ds-lang__pop', `is-${popupAlign}`)}>
          <p className="ds-lang__title">Language</p>
          {languages.map((option) => {
            const isActive = current.startsWith(option.code);
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={cn('ds-lang__opt', isActive && 'is-on')}
                onClick={() => pick(option.code)}
              >
                <span>{option.label}</span>
                {isActive && checkIcon}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitch;