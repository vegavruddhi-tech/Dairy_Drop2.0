import Image from 'next/image';
import { cn } from './index.jsx';

const SIZES = {
  sm: {
    card: 'p-5 max-w-xs',
    logoContainer: 'h-14 w-14',
    logoSize: 36,
    ring: 'h-16 w-16',
    title: 'text-xs font-bold',
    msg: 'text-xs',
    bar: 'w-28 h-1',
  },
  md: {
    card: 'p-6 sm:p-7 max-w-sm',
    logoContainer: 'h-16 w-16',
    logoSize: 42,
    ring: 'h-20 w-20',
    title: 'text-xs font-extrabold tracking-wider',
    msg: 'text-sm font-bold',
    bar: 'w-36 h-1.5',
  },
  lg: {
    card: 'p-7 sm:p-9 max-w-md',
    logoContainer: 'h-20 w-20',
    logoSize: 52,
    ring: 'h-24 w-24',
    title: 'text-[11px] font-black tracking-widest',
    msg: 'text-sm sm:text-base font-extrabold',
    bar: 'w-48 sm:w-56 h-2',
  },
};

export function CowLoader({
  size = 'lg',
  message = 'Loading…',
  submessage = 'Getting everything fresh and ready for you',
  label = 'DairyDrop',
}) {
  const s = SIZES[size] ?? SIZES.lg;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        'relative mx-auto flex select-none flex-col items-center justify-center rounded-3xl',
        'border border-slate-200/80 bg-white/95 text-center shadow-xl shadow-slate-900/5 backdrop-blur-xl',
        s.card,
      )}
    >
      {/* Dynamic Ambient Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 -top-8 h-36 w-36 animate-pulse rounded-full bg-blue-400/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 animate-pulse rounded-full bg-emerald-400/20 blur-2xl"
      />

      {/* Orbit Spinner with Branded Logo Center */}
      <div className={cn('relative mb-5 flex items-center justify-center', s.ring)}>
        {/* Outer Ring Animation */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-blue-600 border-r-emerald-500"
          style={{ animationDuration: '1.2s' }}
        />
        
        {/* Pulsing Backing Glow */}
        <span
          aria-hidden="true"
          className="absolute inset-1.5 animate-ping rounded-2xl bg-blue-100/60 opacity-30"
          style={{ animationDuration: '2.5s' }}
        />

        {/* Center App Icon Badge */}
        <span
          aria-hidden="true"
          className={cn(
            'relative flex items-center justify-center rounded-2xl overflow-hidden',
            'bg-white border border-slate-100 shadow-md shadow-slate-200',
            s.logoContainer,
          )}
        >
          <Image
            src="/icon-512.png"
            alt="DairyDrop Logo"
            width={s.logoSize}
            height={s.logoSize}
            priority
            className="object-contain drop-shadow-xs transition-transform hover:scale-105"
          />
        </span>
      </div>

      {/* Label and Message */}
      <p className={cn('uppercase text-blue-600 font-heading', s.title)}>
        {label}
      </p>
      <p className={cn('mt-1 text-slate-900 font-heading tracking-tight', s.msg)}>
        {message}
      </p>
      {submessage ? (
        <p className="mt-1 text-xs font-semibold text-slate-500 max-w-xs leading-relaxed">
          {submessage}
        </p>
      ) : null}

      {/* Modern Shimmering Progress Indicator */}
      <div className={cn('mt-5 overflow-hidden rounded-full bg-slate-100 relative', s.bar)}>
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 animate-pulse"
        />
      </div>
    </div>
  );
}

/** Centered full-panel variant for route loading boundaries */
export function CowLoaderPanel(props) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-8">
      <CowLoader {...props} />
    </div>
  );
}
