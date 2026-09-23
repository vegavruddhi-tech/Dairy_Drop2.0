import { requireCustomer } from '@/auth/session.js';
import {
  businessMonth,
  formatMonth,
  daysInMonth,
  monthStart,
  dayOfWeek,
  addMonths,
  recentMonths,
} from '@/domain/dates.js';
import { formatMilli } from '@/domain/money.js';
import { computeVariance } from '@/domain/billing.js';
import * as deliveryService from '@/services/delivery.service.js';

import { PageHeader, Card, CardBody, CardHeader, Stat, Badge } from '@/components/ui/index.jsx';
import { CalendarVacationButton } from '@/components/customer/CalendarAction.jsx';

export const metadata = { title: 'Calendar' };

const STATUS_STYLE = {
  DELIVERED: 'bg-positive-soft text-positive',
  SKIPPED: 'bg-surface-muted text-ink-subtle',
  UNDELIVERED: 'bg-critical-soft text-critical',
  PENDING: 'bg-caution-soft text-caution',
  CANCELLED: 'bg-surface-muted text-ink-subtle line-through',
};

/**
 * A month of deliveries at a glance.
 *
 * The variance figures here are **gross** — a day over and a day under show as
 * both, not as zero. The previous system showed a net figure on the invoice and
 * a gross one here, so the same customer saw two different numbers.
 */
export default async function CalendarPage({ searchParams }) {
  const actor = await requireCustomer();
  const params = await searchParams;
  const month = typeof params?.month === 'string' ? params.month : businessMonth();

  const deliveries = await deliveryService.getMonth(actor, { month });
  const variance = computeVariance(deliveries);

  const byDate = new Map();
  for (const delivery of deliveries) {
    const list = byDate.get(delivery.deliveryDate) ?? [];
    list.push(delivery);
    byDate.set(delivery.deliveryDate, list);
  }

  const total = daysInMonth(month);
  const leadingBlanks = dayOfWeek(monthStart(month));
  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];

  const delivered = deliveries.filter((d) => d.status === 'DELIVERED');
  const deliveredMilli = delivered.reduce(
    (sum, d) => sum + Math.round(Number(d.deliveredQuantity ?? 0) * 1000),
    0,
  );

  return (
    <>
      <PageHeader
        title="Calendar"
        description={formatMonth(month)}
        action={
          <div className="flex items-center gap-2">
            <CalendarVacationButton />
            <div className="flex gap-1 border-l border-border pl-2">
              <a
                href={`/calendar?month=${addMonths(month, -1)}`}
                className="tap rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                ←
              </a>
              <a
                href={`/calendar?month=${addMonths(month, 1)}`}
                className="tap rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                →
              </a>
            </div>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Delivered" value={`${delivered.length} days`} tone="positive" />
        <Stat label="Total milk" value={formatMilli(deliveredMilli)} />
        <Stat label="Extra" value={formatMilli(variance.extraMilli)} hint="Above your plan" />
        <Stat label="Less" value={formatMilli(variance.reducedMilli)} hint="Below your plan" />
      </div>

      <Card>
        <CardBody>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-subtle">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} />;

              const dayDeliveries = byDate.get(date) ?? [];
              const primary = dayDeliveries[0];
              const dayNumber = Number(date.slice(8));

              return (
                <div
                  key={date}
                  className={`aspect-square rounded-lg p-1 text-center ${
                    primary ? STATUS_STYLE[primary.status] : 'bg-surface-muted/40 text-ink-subtle'
                  }`}
                  title={
                    primary
                      ? `${primary.productName} — ${primary.status.toLowerCase()}`
                      : 'No delivery'
                  }
                >
                  <div className="text-[11px] font-medium">{dayNumber}</div>
                  {primary?.status === 'DELIVERED' ? (
                    <div className="text-[10px] tnum">
                      {Number(primary.deliveredQuantity)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-ink-muted">
            {Object.entries({
              Delivered: 'bg-positive-soft',
              Skipped: 'bg-surface-muted',
              Missed: 'bg-critical-soft',
              Scheduled: 'bg-caution-soft',
            }).map(([label, className]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${className}`} />
                {label}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
