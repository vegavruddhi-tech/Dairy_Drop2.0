/**
 * UI primitives, ported from the original DairyDrop apps.
 *
 * Same visual language — emerald-tinted cards with a soft low shadow, heavy
 * Outfit numerals, pill badges with a status dot, empty states with a glowing
 * icon. The difference is that there is now one copy instead of three that had
 * drifted apart.
 *
 * Server components: none of these need interactivity, so none ship JavaScript.
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, later ones winning conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ className, interactive, children, ...props }) {
  return (
    <div
      className={cn(interactive ? 'card-interactive' : 'card-surface', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-[15px] font-extrabold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>;
}

// ── Page headers ─────────────────────────────────────────────────────────────

export function PageHeader({ title, description, action }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm font-medium text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * The dashboard banner from the original apps: a deep emerald→teal→slate
 * gradient with two blurred glow orbs behind it, a live date pill, the
 * time-of-day greeting, and an optional shortcut on the right.
 */
export function HeroBanner({ eyebrow, greeting, name, subtitle, action, children }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-5 sm:p-6 text-white shadow-xl shadow-blue-600/10">
      {/* Ambient glow. Purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-400/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-400/15 blur-2xl"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {eyebrow ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-blue-100 backdrop-blur-md border border-white/10">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
              {eyebrow}
            </span>
          ) : <span />}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-black leading-snug tracking-tight text-white sm:text-3xl">
            {greeting ? `${greeting}, ` : ''}
            {name}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm font-medium text-blue-100/80">{subtitle}</p>
          ) : null}
        </div>

        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </section>
  );
}

/** A compact shortcut chip for the hero's right-hand side. */
export function HeroAction({ href, children }) {
  return (
    <a
      href={href}
      className="tap inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
    >
      <span>{children}</span>
      <span className="text-blue-200" aria-hidden="true">→</span>
    </a>
  );
}

// ── Status ───────────────────────────────────────────────────────────────────

const TONES = {
  neutral: { chip: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
  brand: { chip: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-600' },
  positive: { chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-600' },
  caution: { chip: 'bg-amber-50 text-amber-800 border border-amber-200', dot: 'bg-amber-600' },
  critical: { chip: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-600' },
  info: { chip: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-600' },
};

/** Pill badge with the small status dot. */
export function Badge({ tone = 'neutral', dot = false, className, children }) {
  const style = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold',
        style.chip,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} /> : null}
      {children}
    </span>
  );
}

/** Domain status → tone, so colour means the same thing on every screen. */
export const STATUS_TONE = {
  PENDING: 'caution', DELIVERED: 'positive', UNDELIVERED: 'critical',
  SKIPPED: 'neutral', CANCELLED: 'neutral',
  ACTIVE: 'positive', PAUSED: 'caution', SUPERSEDED: 'neutral',
  TRIAL: 'info', PENDING_VERIFICATION: 'caution', EXPIRED: 'critical',
  APPROVED: 'positive', REJECTED: 'critical',
  VERIFIED: 'positive', SUBMITTED: 'caution',
  PAID: 'positive', PARTIALLY_PAID: 'caution', UNPAID: 'critical',
  OVERDUE: 'critical', OPEN: 'info', ACCEPTED: 'info',
};

export function StatusBadge({ status, children }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {children ?? String(status ?? '').replace(/_/g, ' ').toLowerCase()}
    </Badge>
  );
}

// ── Data display ─────────────────────────────────────────────────────────────

const STAT_ACCENT = {
  neutral: 'from-slate-600 to-slate-700',
  brand: 'from-blue-600 to-indigo-700',
  positive: 'from-emerald-600 to-teal-700',
  caution: 'from-amber-500 to-amber-600',
  critical: 'from-rose-600 to-red-700',
  info: 'from-blue-600 to-indigo-600',
};

/**
 * The horizontal stat tile: a crisp rounded gradient icon square on
 * the left, label above value on the right.
 */
export function Stat({ label, value, hint, icon, tone = 'brand' }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-slate-300 transition-all">
      {icon ? (
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
            STAT_ACCENT[tone] ?? STAT_ACCENT.brand,
          )}
          aria-hidden="true"
        >
          <span className="text-base flex items-center justify-center">{icon}</span>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="stat-number mt-0.5 text-xl font-extrabold text-slate-900">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Empty state with the glowing icon treatment from the original apps: a blurred
 * gradient halo behind a soft emerald tile.
 */
export function EmptyState({ title, description, action, icon, tip }) {
  return (
    <Card className="flex flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-12 bg-white border border-slate-200 shadow-sm rounded-3xl">
      <div className="relative mb-4 flex items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-125 animate-pulse rounded-full bg-gradient-to-tr from-blue-400/20 via-indigo-300/20 to-sky-400/20 blur-xl"
        />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-tr from-blue-50 via-slate-50 to-white text-3xl shadow-md shadow-blue-500/10">
          <span aria-hidden="true" className="flex items-center justify-center text-blue-600">
            {icon ?? (
              <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            )}
          </span>
        </div>
      </div>

      <h3 className="font-heading text-base font-extrabold tracking-tight text-ink sm:text-lg">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-ink-muted sm:text-sm">
          {description}
        </p>
      ) : null}

      {tip ? (
        <div className="mt-4 flex max-w-sm items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-left">
          <svg className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-[11px] font-medium leading-snug text-blue-900 sm:text-xs">{tip}</p>
        </div>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function Field({ label, value, className }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink tnum">{value ?? '—'}</dd>
    </div>
  );
}

export function Divider({ className }) {
  return <hr className={cn('border-border', className)} />;
}

// ── Notices ──────────────────────────────────────────────────────────────────

export function Notice({ tone = 'info', title, children, action }) {
  const tones = {
    info: 'border-info/25 bg-info-soft/60',
    caution: 'border-caution/25 bg-caution-soft/60',
    critical: 'border-critical/25 bg-critical-soft/60',
    positive: 'border-positive/25 bg-positive-soft/60',
  };
  return (
    <div className={cn('rounded-2xl border px-4 py-3', tones[tone])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="text-sm font-extrabold text-ink">{title}</p> : null}
          {children ? <div className="mt-0.5 text-sm font-medium text-ink-muted">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className, numeric }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border bg-surface-muted/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-subtle',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, numeric }) {
  return (
    <td
      className={cn(
        'border-b border-border px-4 py-3 font-semibold text-ink',
        numeric ? 'text-right tnum' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}
