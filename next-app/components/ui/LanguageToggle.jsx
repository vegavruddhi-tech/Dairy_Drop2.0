'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from './index.jsx';
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT } from '@/i18n/config.js';
import { setLocale } from '@/actions/locale.actions.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * The language switcher, ported from the original apps.
 *
 * Two shapes:
 *   · `segmented` — three chips side by side, for a settings screen
 *   · `compact`   — a single chip that cycles, for the header
 *
 * Each language is labelled in its own script, so someone who cannot read the
 * current interface language can still find theirs. That detail is the whole
 * point of the control.
 */
export function LanguageToggle({ variant = 'segmented', className }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { locale, t } = useT();

  function choose(next) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      // The server re-renders with the new cookie; this pulls the fresh tree.
      router.refresh();
    });
  }

  if (variant === 'compact') {
    const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
    return (
      <button
        type="button"
        onClick={() => choose(nextLocale)}
        disabled={pending}
        aria-label={`${t('settings.language', {}, 'Language')}: ${LOCALE_NAMES[locale]}. Switch to ${LOCALE_NAMES[nextLocale]}`}
        className={cn(
          'tap inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2.5 text-xs font-extrabold text-ink-muted',
          'transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50',
          className,
        )}
      >
        <svg className="h-3.5 w-3.5 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{LOCALE_SHORT[locale]}</span>
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language', {}, 'Language')}
      className={cn('flex gap-1 rounded-xl bg-surface-muted p-1', className)}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => choose(code)}
            className={cn(
              'tap flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold transition-all disabled:opacity-60',
              active
                ? 'bg-surface text-brand shadow-card'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {LOCALE_NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}
