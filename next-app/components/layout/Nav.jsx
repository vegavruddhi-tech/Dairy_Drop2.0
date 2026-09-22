'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/components/ui/index.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { useT } from '@/i18n/provider.jsx';

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
        aria-current={active ? 'page' : undefined}
        className="no-select group relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1"
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-12 items-center justify-center rounded-full text-base transition-colors duration-150',
              active
                ? 'bg-brand text-brand-ink shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                : 'text-ink-subtle group-hover:bg-brand-soft group-hover:text-brand',
            )}
          >
            {icon}
          </span>

          {count ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-critical px-1 text-[10px] font-extrabold text-white ring-2 ring-surface">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </div>

        <span
          className={cn(
            'mt-0.5 text-[10.5px] tracking-tight transition-colors',
            active ? 'font-extrabold text-ink' : 'font-bold text-ink-subtle',
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
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors',
        active ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
      )}
    >
      <span aria-hidden="true" className="w-5 text-center text-base">{icon}</span>
      <span className="flex-1">{label}</span>
      {count ? (
        <span className="rounded-full bg-critical px-1.5 text-xs font-extrabold text-white">
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
export function MoreMenu({ items, user }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap rounded-xl px-2 text-lg text-ink-muted"
        aria-label="More"
        aria-expanded={open}
      >
        ☰
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full animate-fade-in rounded-t-3xl border-t border-border bg-surface p-4 pb-8 shadow-dropdown">
            {/* Grab handle, matching the old sheet. */}
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

            {user ? (
              <div className="mb-3 flex items-center gap-3 border-b border-border pb-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white"
                >
                  {(user.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{user.name}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">{user.email}</p>
                </div>
              </div>
            ) : null}

            {/* Full language names here — there is room, unlike the header. */}
            <div className="mb-3">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                {t('settings.language', {}, 'Language')}
              </p>
              <LanguageToggle />
            </div>

            <nav className="space-y-0.5" aria-label="More">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
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
        </div>
      ) : null}
    </>
  );
}
