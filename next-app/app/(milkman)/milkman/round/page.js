import { requireMilkman } from '@/auth/session.js';
import { businessDate, formatDate, addDays } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import * as deliveryService from '@/services/delivery.service.js';

import { PageHeader, Card, CardBody, Stat, EmptyState } from '@/components/ui/index.jsx';
import { DeliveryIcon } from '@/components/ui/Icons.jsx';
import { RoundStop, DayOffButton } from '@/components/milkman/Round.jsx';

export const metadata = { title: 'Round' };

/**
 * The daily round.
 *
 * Optimised for one-handed use at 5am: every stop is a single card with the
 * address, a tap-to-call number, and three large status buttons. No tabs, no
 * modals in the common path.
 */
export default async function RoundPage({ searchParams }) {
  const actor = await requireMilkman();
  const params = await searchParams;
  const date = typeof params?.date === 'string' ? params.date : businessDate();

  const { stops, summary } = await deliveryService.getRound(actor, date);

  const remaining = stops.filter((stop) => stop.status === 'PENDING');
  const done = stops.filter((stop) => stop.status !== 'PENDING');

  return (
    <>
      <PageHeader
        title="Round"
        description={formatDate(date)}
        action={
          <div className="flex items-center gap-2">
            <a href={`/milkman/round?date=${addDays(date, -1)}`} className="tap rounded-lg border border-border px-3 py-2 text-sm">←</a>
            <a href={`/milkman/round?date=${businessDate()}`} className="tap rounded-lg border border-border px-3 py-2 text-sm">Today</a>
            <a href={`/milkman/round?date=${addDays(date, 1)}`} className="tap rounded-lg border border-border px-3 py-2 text-sm">→</a>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stops" value={summary.total} />
        <Stat label="Done" value={summary.delivered} tone="positive" />
        <Stat label="Left" value={remaining.length} tone={remaining.length ? 'caution' : 'neutral'} />
        <Stat
          label="Milk out"
          value={formatMilli(Math.round(Number(summary.litres) * 1000))}
          hint={summary.extrasCount > 0
            ? `+ ${summary.extrasCount} extra${summary.extrasCount === 1 ? '' : 's'}`
            : undefined}
        />
      </div>

      {stops.length === 0 ? (
        <EmptyState
          icon={<DeliveryIcon className="h-6 w-6 text-blue-600" />}
          title="Nothing scheduled"
          description="Deliveries are generated overnight from your customers' active plans."
        />
      ) : (
        <>
          {remaining.length > 0 ? (
            <section className="mb-8" aria-labelledby="remaining-heading">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="remaining-heading" className="text-sm font-semibold text-ink">
                  To deliver ({remaining.length})
                </h2>
                <DayOffButton date={date} count={remaining.length} />
              </div>
              <div className="space-y-3">
                {remaining.map((stop) => (
                  <RoundStop key={stop.id} stop={stop} />
                ))}
              </div>
            </section>
          ) : (
            <div className="mb-8 rounded-2xl bg-positive-soft px-5 py-6 text-center">
              <p className="text-2xl" aria-hidden="true">✓</p>
              <p className="mt-1 font-medium text-positive">Round complete</p>
              {/* Milk and extras, because both are billed. */}
              <p className="mt-0.5 text-sm text-ink-muted">
                {formatPaise(summary.billedPaise)} billed today
                {summary.extrasPaise > 0
                  ? ` — ${formatPaise(summary.milkPaise)} milk, ${formatPaise(summary.extrasPaise)} extras`
                  : ''}
                .
              </p>
            </div>
          )}

          {done.length > 0 ? (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading" className="mb-3 text-sm font-semibold text-ink">
                Done ({done.length})
              </h2>
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
