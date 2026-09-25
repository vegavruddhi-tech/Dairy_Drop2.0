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
      className={cn(
        'overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition-all',
        interactive && 'hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs font-medium text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}

// ── Page headers ─────────────────────────────────────────────────────────────

export function PageHeader({ title, description, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * Eyebrow heading with a count chip, for the sections of a list page.
 */
export function SectionHeading({ id, count, tone = 'brand', action, children }) {
  const chip =
    tone === 'positive'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : tone === 'caution'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : tone === 'neutral'
          ? 'bg-slate-100 text-slate-600 border border-slate-200'
          : 'bg-blue-50 text-blue-700 border border-blue-200';
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <h2 id={id} className="font-heading text-xs font-bold uppercase tracking-wider text-slate-500">
        {children}
      </h2>
      {count != null ? (
        <span className={cn('tnum inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 text-[11px] font-extrabold', chip)}>
          {count}
        </span>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

/**
 * World-class gradient HeroBanner matching the SaaS homepage design system.
 */
export function HeroBanner({ eyebrow, greeting, name, subtitle, action, children }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-5 sm:p-7 text-white shadow-xl shadow-blue-600/15">
      {/* Ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl"
      />

      {/* Floating Animated DairyDrop Brand Watermark Emblem */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 -bottom-6 opacity-15 sm:opacity-20 transition-transform duration-700"
      >
        <img
          src="/icon.svg"
          alt=""
          className="h-32 w-32 sm:h-44 sm:w-44 object-contain filter drop-shadow-2xl animate-in fade-in zoom-in-75 duration-700"
        />
      </div>

      <div className="relative z-10 space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {eyebrow ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
              {eyebrow}
            </span>
          ) : <span />}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            {greeting ? `${greeting}, ` : ''}
            {name}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-xs sm:text-sm font-medium text-blue-100 leading-relaxed max-w-2xl">{subtitle}</p>
          ) : null}
        </div>

        {children ? <div className="pt-2">{children}</div> : null}
      </div>
    </section>
  );
}

/** A compact shortcut chip for the hero's right-hand side. */
export function HeroAction({ href, children }) {
  return (
    <a
      href={href}
      className="tap inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 px-3.5 py-2 text-xs font-bold text-white shadow-sm backdrop-blur-md transition-all hover:bg-white/30 active:scale-95"
    >
      <span>{children}</span>
      <span className="text-white/80" aria-hidden="true">→</span>
    </a>
  );
}

/**
 * Next Recommended Action guide for cognitive clarity & low-literacy guidance.
 */
export function NextActionCard({ stepNumber, title, description, actionText, actionHref, onAction, tone = 'blue', icon }) {
  const toneBg = {
    blue: 'border-blue-200 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 text-blue-950',
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 text-emerald-950',
    amber: 'border-amber-200 bg-gradient-to-br from-amber-50/90 to-orange-50/50 text-amber-950',
  }[tone] ?? 'border-slate-200 bg-slate-50 text-slate-900';

  const btnBg = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20',
  }[tone] ?? 'bg-slate-900 text-white';

  return (
    <div className={cn('relative overflow-hidden rounded-3xl border-2 p-5 shadow-sm transition-all', toneBg)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {stepNumber ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white font-heading text-sm font-black shadow-sm text-slate-900 border border-slate-200/80">
              {stepNumber}
            </span>
          ) : icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm border border-slate-200/80">
              {icon}
            </span>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Next Step</span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
            </div>
            <h3 className="font-heading text-base font-extrabold tracking-tight text-slate-950 mt-0.5">
              {title}
            </h3>
            <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed max-w-xl">
              {description}
            </p>
          </div>
        </div>

        {actionHref ? (
          <a
            href={actionHref}
            className={cn('tap inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-heading text-xs font-bold transition-all active:scale-[0.98]', btnBg)}
          >
            <span>{actionText}</span>
            <span>→</span>
          </a>
        ) : onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={cn('tap inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-heading text-xs font-bold transition-all active:scale-[0.98]', btnBg)}
          >
            <span>{actionText}</span>
            <span>→</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Status ───────────────────────────────────────────────────────────────────

const TONES = {
  neutral: { chip: 'border border-slate-200 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  brand: { chip: 'border border-blue-200 bg-blue-50 text-blue-700 font-bold', dot: 'bg-blue-600' },
  positive: { chip: 'border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold', dot: 'bg-emerald-500' },
  caution: { chip: 'border border-amber-200 bg-amber-50 text-amber-800 font-bold', dot: 'bg-amber-500' },
  critical: { chip: 'border border-rose-200 bg-rose-50 text-rose-700 font-bold', dot: 'bg-rose-500' },
  info: { chip: 'border border-sky-200 bg-sky-50 text-sky-700 font-bold', dot: 'bg-sky-500' },
};

/** Pill badge with the small status dot. */
export function Badge({ tone = 'neutral', dot = false, className, children }) {
  const style = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-2xs',
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

export const STATUS_LABELS_HI = {
  PENDING: 'लंबित',
  DELIVERED: 'डिलीवर हुआ',
  UNDELIVERED: 'डिलीवर नहीं हुआ',
  SKIPPED: 'छोड़ा गया',
  CANCELLED: 'रद्द',
  ACTIVE: 'सक्रिय',
  PAUSED: 'रोका गया',
  SUPERSEDED: 'प्रतिस्थापित',
  TRIAL: 'ट्रायल',
  PENDING_VERIFICATION: 'सत्यापन लंबित',
  EXPIRED: 'समाप्त',
  APPROVED: 'स्वीकृत',
  REJECTED: 'अस्वीकृत',
  VERIFIED: 'सत्यापित',
  SUBMITTED: 'जमा किया गया',
  PAID: 'भुगतान हुआ',
  PARTIALLY_PAID: 'आंशिक भुगतान',
  UNPAID: 'बकाया',
  OVERDUE: 'अतिदेय',
  OPEN: 'खुला',
  ACCEPTED: 'स्वीकृत',
};

export function StatusBadge({ status, children, locale }) {
  const isHi = locale === 'hi';
  const label = children ?? (isHi && STATUS_LABELS_HI[status] ? STATUS_LABELS_HI[status] : String(status ?? '').replace(/_/g, ' ').toLowerCase());
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {label}
    </Badge>
  );
}

// ── Data display ─────────────────────────────────────────────────────────────

const STAT_ACCENT = {
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  brand: 'bg-blue-600 text-white shadow-md shadow-blue-500/25',
  positive: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25',
  caution: 'bg-amber-500 text-white shadow-md shadow-amber-500/25',
  critical: 'bg-rose-500 text-white shadow-md shadow-rose-500/25',
  info: 'bg-blue-500 text-white shadow-md shadow-blue-500/25',
};

/**
 * The horizontal stat tile: a crisp rounded icon square on
 * the left, label above value on the right.
 */
export function Stat({ label, value, hint, icon, tone = 'brand' }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
      {icon ? (
        <div
          className={cn(
            'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl font-bold',
            STAT_ACCENT[tone] ?? STAT_ACCENT.brand,
          )}
          aria-hidden="true"
        >
          <span className="text-sm sm:text-base flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">{icon}</span>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-slate-500">
          {label}
        </p>
        <p className="font-heading mt-0.5 text-base sm:text-lg font-bold text-slate-900 tnum">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[10px] sm:text-[11px] font-medium text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Empty state with the glowing icon treatment from the SaaS design system.
 */
export function EmptyState({ title, description, action, icon, tip }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-slate-200/90 bg-white px-5 py-10 text-center shadow-sm sm:px-6 sm:py-12">
      <div className="relative mb-4 flex items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-125 animate-pulse rounded-full bg-blue-500/10 blur-xl"
        />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-blue-200 bg-blue-50 text-3xl text-blue-600 shadow-md shadow-blue-500/10">
          <span aria-hidden="true" className="flex items-center justify-center text-blue-600">
            {icon ?? (
              <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            )}
          </span>
        </div>
      </div>

      <h3 className="font-heading text-lg font-black tracking-tight text-slate-950 sm:text-xl">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs font-normal leading-relaxed text-slate-600 sm:text-sm">
          {description}
        </p>
      ) : null}

      {tip ? (
        <div className="mt-4 flex max-w-sm items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 text-left">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-[11px] font-medium leading-snug text-slate-700 sm:text-xs">{tip}</p>
        </div>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
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
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-full border-collapse text-left text-xs sm:text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, numeric }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-slate-200/90 bg-slate-50/90 px-3.5 sm:px-5 py-3 font-heading text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500',
        numeric ? 'text-right whitespace-nowrap' : 'text-left',
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
        'border-b border-slate-100 px-3.5 sm:px-5 py-3 sm:py-3.5 font-medium text-slate-800 transition-colors',
        numeric ? 'text-right tnum whitespace-nowrap' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}
