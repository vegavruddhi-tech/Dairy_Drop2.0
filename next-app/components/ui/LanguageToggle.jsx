'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from './index.jsx';
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT } from '@/i18n/config.js';
import { setLocale } from '@/actions/locale.actions.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * Pure English & Hindi Language Switcher.
 *
 * Designed specifically for DairyDrop:
 *   · `compact`   — sleek header/mobile pill showing current language with 1-tap switch
 *   · `segmented` — 2-option interactive toggle [ English | हिन्दी ]
 */
export function LanguageToggle({ variant = 'segmented', className }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { locale, t } = useT();

  function choose(next) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  if (variant === 'compact') {
    const nextLocale = locale === 'en' ? 'hi' : 'en';
    return (
      <button
        type="button"
        onClick={() => choose(nextLocale)}
        disabled={pending}
        title={`Current: ${LOCALE_NAMES[locale]}. Click to switch to ${LOCALE_NAMES[nextLocale]}`}
        aria-label={`${t('settings.language', {}, 'Language')}: ${LOCALE_NAMES[locale]}. Switch to ${LOCALE_NAMES[nextLocale]}`}
        className={cn(
          'tap inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-heading font-extrabold text-slate-800 shadow-2xs',
          'hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 transition-all active:scale-[0.98] disabled:opacity-50',
          className,
        )}
      >
        <svg
          className="h-3.5 w-3.5 text-blue-600 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="tracking-wide">
          {locale === 'en' ? 'EN / हिन्दी' : 'हिन्दी / EN'}
        </span>
        {pending ? (
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
        ) : null}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language', {}, 'Language')}
      className={cn(
        'flex items-center gap-1 rounded-2xl bg-slate-100/90 p-1 border border-slate-200/80',
        className,
      )}
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
              'tap flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-heading font-bold transition-all disabled:opacity-60',
              active
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50',
            )}
          >
            {LOCALE_NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}
