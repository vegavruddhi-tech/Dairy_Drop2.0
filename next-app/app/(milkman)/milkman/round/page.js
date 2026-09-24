import { requireMilkman } from '@/auth/session.js';
import { businessDate, formatDate, addDays } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import * as deliveryService from '@/services/delivery.service.js';

import { Stat, EmptyState, SectionHeading } from '@/components/ui/index.jsx';
import {
  DeliveryIcon,
  RoutesIcon,
  CheckIcon,
  ClockIcon,
  MilkDropIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/ui/Icons.jsx';
import { RoundStop, DayOffButton } from '@/components/milkman/Round.jsx';

export const metadata = { title: 'Round' };

/**
 * The daily round.
 *
 * Optimised for one-handed use at 5am: every stop is a single card with the
 * address, a tap-to-call number, and three large status buttons. No tabs, no
 * modals in the common path.
 *
 * The header is the same deep-blue banner as the dashboard, carrying the day,
 * a progress bar and the date controls, so the milkman sees how far through
 * the round they are before reading a single stop.
 */
export default async function RoundPage({ searchParams }) {
  const actor = await requireMilkman();
  const params = await searchParams;
  const today = businessDate();
  const date = typeof params?.date === 'string' ? params.date : today;
  const isToday = date === today;

  const { stops, summary } = await deliveryService.getRound(actor, date);

  const remaining = stops.filter((stop) => stop.status === 'PENDING');
  const done = stops.filter((stop) => stop.status !== 'PENDING');
  const progress = summary.total ? Math.round((done.length / summary.total) * 100) : 0;
  const litres = formatMilli(Math.round(Number(summary.litres) * 1000));

  const subtitle =
    summary.total === 0
      ? 'No stops scheduled for this day.'
      : remaining.length === 0
        ? `All ${summary.total} ${summary.total === 1 ? 'stop' : 'stops'} done · ${litres} of milk out`
        : `${done.length} of ${summary.total} stops done · ${remaining.length} to go · ${litres} of milk`;

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
                {isToday ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200" />
                ) : null}
                {isToday ? 'Today' : 'Round'}
              </span>
              <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {isToday ? "Today's round" : formatDate(date)}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/85">
                {isToday ? formatDate(date) : subtitle}
              </p>
            </div>

            {/* Date controls, as glass chips. */}
            <nav aria-label="Change day" className="flex shrink-0 items-center gap-1.5">
              <a
                href={`/milkman/round?date=${addDays(date, -1)}`}
                aria-label="Previous day"
                className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </a>
              {!isToday ? (
                <a
                  href={`/milkman/round?date=${today}`}
                  className="tap flex h-10 items-center rounded-xl border border-white/25 bg-white/15 px-3 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
                >
                  Today
                </a>
              ) : null}
              <a
                href={`/milkman/round?date=${addDays(date, 1)}`}
                aria-label="Next day"
                className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </a>
            </nav>
          </div>

          {/* Progress. */}
          <div className="mt-5">
            <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/85">
              <span>{isToday ? subtitle : `${progress}% complete`}</span>
              <span className="tnum shrink-0 font-heading text-lg font-black text-white">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Round progress"
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-[width] duration-500 ease-out-expo"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stops" value={summary.total} icon={<RoutesIcon className="h-5 w-5" />} tone="brand" />
        <Stat label="Done" value={done.length} icon={<CheckIcon className="h-5 w-5" />} tone="positive" />
        <Stat
          label="Left"
          value={remaining.length}
          icon={<ClockIcon className="h-5 w-5" />}
          tone={remaining.length ? 'caution' : 'neutral'}
        />
        <Stat
          label="Milk out"
          value={litres}
          icon={<MilkDropIcon className="h-5 w-5" />}
          tone="info"
          hint={
            summary.extrasCount > 0
              ? `+ ${summary.extrasCount} extra${summary.extrasCount === 1 ? '' : 's'} to carry`
              : undefined
          }
        />
      </div>

      {stops.length === 0 ? (
        <EmptyState
          icon={<DeliveryIcon className="h-6 w-6 text-brand" />}
          title="Nothing scheduled"
          description="Deliveries are generated overnight from your customers' active plans."
        />
      ) : (
        <>
          {remaining.length > 0 ? (
            <section className="mb-8" aria-labelledby="remaining-heading">
              <SectionHeading
                id="remaining-heading"
                count={remaining.length}
                tone="caution"
                action={<DayOffButton date={date} count={remaining.length} />}
              >
                To deliver
              </SectionHeading>
              <div className="space-y-3">
                {remaining.map((stop) => (
                  <RoundStop key={stop.id} stop={stop} />
                ))}
              </div>
            </section>
          ) : (
            <RoundComplete summary={summary} />
          )}

          {done.length > 0 ? (
            <section aria-labelledby="done-heading">
              <SectionHeading id="done-heading" count={done.length} tone="positive">
                Done
              </SectionHeading>
              <div className="space-y-3">
                {done.map((stop) => (
                  <RoundStop key={stop.id} stop={stop} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * Shown once nothing is left to deliver. Milk and extras are both listed
 * because both are billed.
 */
function RoundComplete({ summary }) {
  return (
    <section className="card-surface relative mb-8 overflow-hidden p-5 text-center sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-hero-gradient" />
      <span
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive-soft text-positive ring-8 ring-positive-soft/50"
      >
        <CheckIcon className="h-7 w-7" />
      </span>
      <h2 className="mt-3 font-heading text-xl font-extrabold text-ink">Round complete</h2>
      <p className="mt-0.5 text-sm font-medium text-ink-muted">Nice work — everything for today is marked.</p>

      <p className="stat-number mt-4 text-3xl text-ink">{formatPaise(summary.billedPaise, { whole: true })}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">billed today</p>

      <dl className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-muted px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Milk</dt>
          <dd className="tnum text-sm font-extrabold text-ink">{formatPaise(summary.milkPaise, { whole: true })}</dd>
        </div>
        <div className="rounded-xl bg-surface-muted px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Extras</dt>
          <dd className="tnum text-sm font-extrabold text-ink">{formatPaise(summary.extrasPaise, { whole: true })}</dd>
        </div>
      </dl>
    </section>
  );
}
