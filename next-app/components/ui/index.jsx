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
    <section className="relative mb-5 overflow-hidden rounded-3xl border border-emerald-400/20 bg-hero-emerald p-4 text-white shadow-hero sm:p-5">
      {/* Ambient glow. Purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/15 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-teal-400/10 blur-2xl"
      />

      <div className="relative z-10 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {eyebrow ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {eyebrow}
            </span>
          ) : <span />}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div>
          <h1 className="font-heading text-xl font-black leading-snug tracking-tight text-white sm:text-2xl">
            {greeting ? `${greeting}, ` : ''}
            {name}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] font-semibold text-emerald-100/80">{subtitle}</p>
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
      className="tap inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-black text-white shadow-sm transition-all hover:bg-white/25 active:scale-95"
    >
      <span>{children}</span>
      <span className="text-emerald-300" aria-hidden="true">→</span>
    </a>
  );
}

// ── Status ───────────────────────────────────────────────────────────────────

const TONES = {
  neutral: { chip: 'bg-surface-muted text-ink-muted', dot: 'bg-ink-subtle' },
  brand: { chip: 'bg-brand-soft text-brand', dot: 'bg-brand' },
  positive: { chip: 'bg-positive-soft text-positive', dot: 'bg-positive' },
  caution: { chip: 'bg-caution-soft text-caution', dot: 'bg-caution' },
  critical: { chip: 'bg-critical-soft text-critical', dot: 'bg-critical' },
  info: { chip: 'bg-info-soft text-info', dot: 'bg-info' },
};

/** Pill badge with the small status dot the old apps used. */
export function Badge({ tone = 'neutral', dot = false, className, children }) {
  const style = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
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
  neutral: 'from-slate-500 to-slate-600',
  brand: 'from-emerald-500 to-emerald-600',
  positive: 'from-emerald-500 to-emerald-600',
  caution: 'from-amber-500 to-amber-600',
  critical: 'from-rose-500 to-rose-600',
  info: 'from-blue-500 to-blue-600',
};

/**
 * The horizontal stat tile from the original apps: a gradient icon square on
 * the left, label above value on the right.
 */
export function Stat({ label, value, hint, icon, tone = 'brand' }) {
  return (
    <Card className="flex items-center gap-3.5 p-3.5">
      {icon ? (
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
            STAT_ACCENT[tone] ?? STAT_ACCENT.brand,
          )}
          aria-hidden="true"
        >
          <span className="text-lg">{icon}</span>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
          {label}
        </p>
        <p className="stat-number mt-0.5 text-xl text-ink">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] font-medium text-ink-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}

/**
 * Empty state with the glowing icon treatment from the original apps: a blurred
 * gradient halo behind a soft emerald tile.
 */
export function EmptyState({ title, description, action, icon, tip }) {
  return (
    <Card className="flex flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-12">
      <div className="relative mb-4 flex items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-125 animate-pulse rounded-full bg-gradient-to-tr from-emerald-400/20 via-teal-300/20 to-blue-400/20 blur-xl"
        />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-emerald-100/80 bg-gradient-to-tr from-emerald-50 via-teal-50/80 to-white text-3xl shadow-md shadow-emerald-500/10">
          <span aria-hidden="true">{icon ?? '🥛'}</span>
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
        <div className="mt-4 flex max-w-sm items-start gap-1.5 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-left">
          <span aria-hidden="true" className="text-sm">💡</span>
          <p className="text-[11px] font-medium leading-snug text-amber-900 sm:text-xs">{tip}</p>
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
