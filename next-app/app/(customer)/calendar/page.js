import { requireCustomer } from '@/auth/session.js';
import {
  businessMonth,
  formatMonth,
  daysInMonth,
  monthStart,
  dayOfWeek,
  addMonths,
  businessDate,
} from '@/domain/dates.js';
import { formatMilli } from '@/domain/money.js';
import { computeVariance } from '@/domain/billing.js';
import * as deliveryService from '@/services/delivery.service.js';

import { PageHeader, Stat } from '@/components/ui/index.jsx';
import { CalendarVacationButton } from '@/components/customer/CalendarAction.jsx';
import { CalendarView } from '@/components/customer/CalendarView.jsx';

export const metadata = { title: 'Calendar' };

export default async function CalendarPage({ searchParams }) {
  const actor = await requireCustomer();
  const params = await searchParams;
  const month = typeof params?.month === 'string' ? params.month : businessMonth();

  const deliveries = await deliveryService.getMonth(actor, { month });
  const variance = computeVariance(deliveries);

  const deliveriesByDate = {};
  for (const delivery of deliveries) {
    if (delivery.status === 'CANCELLED') continue;
    if (!deliveriesByDate[delivery.deliveryDate]) {
      deliveriesByDate[delivery.deliveryDate] = [];
    }
    deliveriesByDate[delivery.deliveryDate].push(delivery);
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
        <Stat label="Delivered" value={`${delivered.length}`} tone="positive" />
        <Stat label="Total milk" value={formatMilli(deliveredMilli)} />
        <Stat label="Extra" value={formatMilli(variance.extraMilli)} hint="Above your plan" />
        <Stat label="Less" value={formatMilli(variance.reducedMilli)} hint="Below your plan" />
      </div>

      <CalendarView
        cells={cells}
        deliveriesByDate={deliveriesByDate}
        month={month}
        todayDate={businessDate()}
      />
    </>
  );
}
