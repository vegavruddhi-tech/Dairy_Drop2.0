'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/components/ui/index.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton.jsx';
import { useT } from '@/i18n/provider.jsx';
import { MenuIcon, CloseIcon } from '@/components/ui/Icons.jsx';

/**
 * Navigation, ported from the original apps.
 *
 * The mobile bar is the distinctive part: the active destination's icon sits in
 * a filled emerald pill rather than merely changing colour, and the label
 * underneath goes heavier. It reads clearly at arm's length in daylight, which
 * is the actual use case — a milkman glancing at a phone mid-round.
 */
export function NavLink({ href, label, icon, count, exact, compact }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (compact) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-current={active ? 'page' : undefined}
        className="no-select group relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 transition-all"
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-12 items-center justify-center rounded-2xl text-base transition-all duration-200',
              active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-900',
            )}
          >
            {icon}
          </span>

          {count ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white shadow-sm">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </div>

        <span
          className={cn(
            'mt-1 font-heading text-[11px] tracking-tight transition-colors',
            active ? 'font-black text-blue-600' : 'font-semibold text-slate-500',
          )}
        >
          {label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3.5 py-3 font-heading text-xs sm:text-sm transition-all',
        active
          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/70 shadow-xs'
          : 'font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-950',
      )}
    >
      <span aria-hidden="true" className={cn('w-5 text-center flex items-center justify-center', active ? 'text-blue-600' : 'text-slate-500')}>{icon}</span>
      <span className="flex-1">{label}</span>
      {count ? (
        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The overflow sheet on mobile, holding everything past the first four items.
 *
 * `user` is a plain `{name, email, role}` — never an `ActorContext`. This is a
 * client component, and React cannot serialize the actor's `can()`/`scope()`
 * methods across the boundary.
 */
export function MoreMenu({ items, user, variant = 'header', label = 'More' }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();

  // Prevent background body scrolling when mobile menu sheet is open
  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }
  }, [open]);

  /*
   * The sheet is portalled to <body>.
   *
   * It used to render inside the sticky <header>, which has `backdrop-blur`.
   * A backdrop-filter establishes a containing block for fixed descendants, so
   * the overlay's `inset-0` filled the 56px header rather than the viewport,
   * and `items-end` hung the sheet *upward* off the header's bottom edge —
   * mostly off-screen, with its last item peeking out at the top of the page
   * and the backdrop covering nothing. Portalling puts it back on the viewport.
   *
   * `open` is false on the server and on first client render, so there is no
   * hydration mismatch and `document` exists by the time it is used.
   */
  const sheet = open
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm lg:hidden touch-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="w-full max-h-[85dvh] overflow-y-auto overscroll-contain animate-fade-in rounded-t-3xl border-t border-border bg-surface p-4 pb-8 shadow-dropdown"
            style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle, matching the old sheet. */}
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tap flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted"
                aria-label="Close menu"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {user ? (
              <div className="mb-3 flex items-center gap-3 border-b border-border pb-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-hero-gradient text-sm font-black text-brand-ink"
                >
                  {(user.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{user.name}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">{user.email}</p>
                </div>
              </div>
            ) : null}

            {/* PWA Install Button for mobile */}
            <div className="mb-3">
              <PwaInstallButton variant="sidebar" />
            </div>

            {/* Full language names here — there is room, unlike the header. */}
            <div className="mb-3">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                {t('settings.language', {}, 'Language')}
              </p>
              <LanguageToggle />
            </div>

            <nav className="space-y-0.5" aria-label={label}>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="tap flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-ink hover:bg-surface-muted"
                >
                  <span aria-hidden="true" className="w-5 text-center text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.count ? (
                    <span className="rounded-full bg-critical px-1.5 text-xs font-extrabold text-white">
                      {item.count}
                    </span>
                  ) : null}
                  <span aria-hidden="true" className="text-ink-subtle">→</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>,
        document.body,
      )
    : null;

  /*
   * Two triggers for one sheet. The header gets a plain icon button on the
   * left; the bottom bar gets a tile drawn like its neighbours, so the items
   * past the first four are reachable from where the thumb already is rather
   * than only from the top of the screen.
   */
  if (variant === 'bar') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="no-select group relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-12 items-center justify-center rounded-full text-base transition-colors duration-150',
              open
                ? 'bg-brand text-brand-ink shadow-md shadow-brand/25'
                : 'text-ink-subtle group-hover:bg-brand-soft group-hover:text-brand',
            )}
          >
            <MenuIcon className="h-5 w-5" />
          </span>
          <span
            className={cn(
              'mt-0.5 text-[10.5px] tracking-tight transition-colors',
              open ? 'font-extrabold text-brand' : 'font-semibold text-ink-subtle',
            )}
          >
            {label}
          </span>
        </button>
        {sheet}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-muted active:bg-surface-muted"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      {sheet}
    </>
  );
}
