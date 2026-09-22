/**
 * The branded loader from the original DairyDrop apps.
 *
 * A milk-drop emblem inside a spinning emerald ring, sat on a frosted card with
 * two ambient glow orbs and a shimmering progress bar. It is the one piece of
 * pure personality in the product, and worth keeping.
 *
 * Server component — the animation is entirely CSS, so it ships no JavaScript.
 */

import { cn } from './index.jsx';

const SIZES = {
  sm: { card: 'p-4 max-w-xs', ring: 'h-12 w-12', badge: 'h-9 w-9', icon: 'h-5 w-5', msg: 'text-xs', bar: 'w-28 h-1' },
  md: { card: 'p-5 max-w-sm', ring: 'h-16 w-16', badge: 'h-12 w-12', icon: 'h-6 w-6', msg: 'text-sm', bar: 'w-36 h-1.5' },
  lg: { card: 'p-6 sm:p-7 max-w-md', ring: 'h-20 w-20 sm:h-24 sm:w-24', badge: 'h-14 w-14 sm:h-16 sm:w-16', icon: 'h-8 w-8 sm:h-9 sm:w-9', msg: 'text-sm sm:text-base', bar: 'w-48 sm:w-56 h-2' },
};

export function CowLoader({ size = 'lg', message = 'Loading…', submessage, label = 'DairyDrop' }) {
  const s = SIZES[size] ?? SIZES.lg;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        'relative mx-auto flex select-none flex-col items-center justify-center rounded-3xl',
        'border border-emerald-100/90 bg-surface/95 text-center shadow-lifted backdrop-blur-xl',
        s.card,
      )}
    >
      {/* Ambient glow. Decorative. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-6 -top-6 h-32 w-32 animate-pulse rounded-full bg-emerald-400/20 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 animate-pulse rounded-full bg-teal-400/20 blur-2xl" />

      {/* Spinning ring with the emblem at rest in the middle. */}
      <div className={cn('relative mb-4 flex items-center justify-center', s.ring)}>
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-500"
          style={{ animationDuration: '1.1s' }}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative flex items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30',
            s.badge,
          )}
        >
          {/* A milk drop. */}
          <svg className={cn('-rotate-12 text-white drop-shadow', s.icon)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" className="opacity-95" />
            <path d="M12 7c-2 2-3 3.5-3 5.5a3 3 0 0 0 6 0c0-2-1-3.5-3-5.5z" fill="#fff" opacity="0.85" />
            <circle cx="14" cy="11" r="1" fill="#fff" />
          </svg>
        </span>
      </div>

      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">{label}</p>
      <p className={cn('mt-1 font-extrabold text-ink', s.msg)}>{message}</p>
      {submessage ? <p className="mt-0.5 text-xs font-medium text-ink-muted">{submessage}</p> : null}

      <div className={cn('skeleton mt-4 rounded-full bg-emerald-100', s.bar)} />
    </div>
  );
}

/** Centred full-panel variant, for a route's loading boundary. */
export function CowLoaderPanel(props) {
  return (
    <div className="flex min-h-[55dvh] items-center justify-center px-4">
      <CowLoader {...props} />
    </div>
  );
}
