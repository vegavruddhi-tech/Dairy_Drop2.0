import { requireMilkman } from '@/auth/session.js';
import { businessMonth, formatMonth, addMonths } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import * as billingService from '@/services/billing.service.js';

import { Card, CardBody, CardHeader, Stat, cn } from '@/components/ui/index.jsx';
import {
  EarningsIcon,
  CheckIcon,
  RequestsIcon,
  DeliveryIcon,
  MilkDropIcon,
  CartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/ui/Icons.jsx';
import { CustomerEarnings, PaymentHistory } from '@/components/milkman/Earnings.jsx';
import { CustomerFilter } from '@/components/milkman/EarningsFilter.jsx';

export const metadata = { title: 'Earnings' };

/**
 * Earnings.
 *
 * Computed by the same engine as the customer invoice, so these figures equal
 * the sum of this milkman's customers' bills exactly. The previous system used
 * different constants on each side and the two never agreed.
 *
 * `?customer=<id>` — the picker under the banner — narrows the whole page to
 * one customer: the tiles, the milk/extras split, top extras, the by-customer
 * block and the payment history all show that customer's figures alone.
 */
export default async function EarningsPage({ searchParams }) {
  const actor = await requireMilkman();
  const params = await searchParams;
  const thisMonth = businessMonth();
  const month = typeof params?.month === 'string' ? params.month : thisMonth;
  const focused = typeof params?.customer === 'string' ? params.customer : null;

  const earnings = await billingService.getEarnings(actor, { month });

  // An id that is not in this month's figures is ignored rather than trusted.
  const focusedRow = focused
    ? earnings.byCustomer.find((row) => row.customerId === focused) ?? null
    : null;

  /*
   * Everything below reads from `view`. A customer row carries the same
   * fields as the month (milkPaise, billedPaise, topProducts, ...), so the
   * page renders one shape and never branches on which it was given.
   */
  const view = focusedRow ?? earnings;
  const payments = focusedRow
    ? earnings.payments.filter((payment) => payment.customerId === focusedRow.customerId)
    : earnings.payments;
  // Everyone with a line this month, A–Z, for the picker.
  const customers = earnings.byCustomer
    .map((row) => ({ id: row.customerId, name: row.customerName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Litres actually delivered — per customer on the row, summed for the month.
  const milkMilli = focusedRow
    ? focusedRow.milkMilli
    : earnings.byCustomer.reduce((total, row) => total + row.milkMilli, 0);

  const collectedRate = view.billedPaise > 0 ? Math.min(100, Math.round((view.collectedPaise / view.billedPaise) * 100)) : 0;
  const milkShare = view.billedPaise > 0 ? Math.round((view.milkPaise / view.billedPaise) * 100) : 0;
  const topPaise = view.topProducts[0]?.paise ?? 0;

  const withCustomer = (href) => (focused ? `${href}&customer=${focused}` : href);

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
                {month === thisMonth ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200" />
                ) : null}
                {formatMonth(month)}
              </span>
              <h1 className="mt-3 truncate font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {focusedRow ? focusedRow.customerName : 'Earnings'}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/85">
                {formatPaise(view.billedPaise, { whole: true })} billed ·{' '}
                {formatPaise(view.collectedPaise, { whole: true })} collected ·{' '}
                {formatPaise(view.outstandingPaise, { whole: true })} outstanding
              </p>
            </div>

            <nav aria-label="Change month" className="flex shrink-0 items-center gap-1.5">
              <a
                href={withCustomer(`/milkman/earnings?month=${addMonths(month, -1)}`)}
                aria-label="Previous month"
                className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </a>
              {month !== thisMonth ? (
                <a
                  href={withCustomer(`/milkman/earnings?month=${thisMonth}`)}
                  className="tap flex h-10 items-center rounded-xl border border-white/25 bg-white/15 px-3 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
                >
                  Now
                </a>
              ) : null}
              <a
                href={withCustomer(`/milkman/earnings?month=${addMonths(month, 1)}`)}
                aria-label="Next month"
                className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </a>
            </nav>
          </div>

          {/* How much of the month's billing has actually arrived. */}
          <div className="mt-5">
            <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/85">
              <span>
                {view.billedPaise > 0
                  ? collectedRate >= 100
                    ? 'Everything billed has been collected'
                    : `${formatPaise(view.outstandingPaise, { whole: true })} still to come in`
                  : 'Nothing billed yet this month'}
              </span>
              <span className="shrink-0">
                <span className="tnum font-heading text-lg font-black text-white">{collectedRate}%</span>
                <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-white/80">collected</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={collectedRate}
              aria-label="Share of billing collected"
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-[width] duration-500 ease-out-expo"
                style={{ width: `${collectedRate}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── The filter: narrows everything below it ───────────────────── */}
      <div className="card-surface mb-5 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CustomerFilter month={month} customers={customers} value={focusedRow?.customerId ?? null} />
        <p className="text-xs font-medium text-ink-muted">
          {focusedRow ? (
            <>
              Every figure on this page is {focusedRow.customerName}'s alone.{' '}
              <a href={`/milkman/earnings?month=${month}`} className="font-bold text-brand hover:underline">
                Show everyone
              </a>
            </>
          ) : (
            `${earnings.byCustomer.length} ${earnings.byCustomer.length === 1 ? 'customer' : 'customers'} with a line this month`
          )}
        </p>
      </div>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Billed" value={formatPaise(view.billedPaise, { whole: true })} icon={<EarningsIcon className="h-5 w-5" />} tone="brand" />
        <Stat label="Collected" value={formatPaise(view.collectedPaise, { whole: true })} icon={<CheckIcon className="h-5 w-5" />} tone="positive" />
        <Stat
          label="Outstanding"
          value={formatPaise(view.outstandingPaise, { whole: true })}
          icon={<RequestsIcon className="h-5 w-5" />}
          tone={view.outstandingPaise > 0 ? 'caution' : 'neutral'}
        />
        <Stat
          label="Deliveries"
          value={view.deliveredCount}
          icon={<DeliveryIcon className="h-5 w-5" />}
          tone="info"
          hint={milkMilli > 0 ? `${formatMilli(milkMilli)} of milk` : undefined}
        />
      </div>

      {/* ── Who the money is with ─────────────────────────────────────── */}
      <section className="mb-5">
        <CustomerEarnings month={month} rows={earnings.byCustomer} focused={focusedRow?.customerId ?? null} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Milk vs extras ────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Where it came from" description="Milk against extras, this month" />
          <CardBody>
            {view.billedPaise > 0 ? (
              <div className="mb-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`${milkShare}% milk, ${100 - milkShare}% extras`}>
                  <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${milkShare}%` }} />
                  <div className="h-full bg-caution transition-[width] duration-500" style={{ width: `${100 - milkShare}%` }} />
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Milk {milkShare}%</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-caution" />Extras {100 - milkShare}%</span>
                </div>
              </div>
            ) : null}

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><MilkDropIcon className="h-4 w-4" /></span>
                <dt className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">Milk</span>
                  <span className="block text-xs font-medium text-ink-muted">
                    {view.deliveredCount} {view.deliveredCount === 1 ? 'delivery' : 'deliveries'}{milkMilli > 0 ? ` · ${formatMilli(milkMilli)}` : ''}
                  </span>
                </dt>
                <dd className="tnum font-extrabold text-ink">{formatPaise(view.milkPaise)}</dd>
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-caution-soft text-caution"><CartIcon className="h-4 w-4" /></span>
                <dt className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">Extras</span>
                  <span className="block text-xs font-medium text-ink-muted">{view.purchaseCount} {view.purchaseCount === 1 ? 'order' : 'orders'}</span>
                </dt>
                <dd className="tnum font-extrabold text-ink">{formatPaise(view.productsPaise)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <dt className="font-bold text-ink">Total billed</dt>
                <dd className="stat-number text-lg text-ink">{formatPaise(view.billedPaise)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* ── Top extras, ranked ────────────────────────────────────── */}
        <Card>
          <CardHeader title="Top extras" description="By revenue this month" />
          <CardBody className={view.topProducts.length === 0 ? 'p-0' : undefined}>
            {view.topProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm font-medium text-ink-muted">No extras sold yet.</p>
            ) : (
              <ol className="space-y-3">
                {view.topProducts.map((product, index) => {
                  const share = topPaise > 0 ? Math.max(4, Math.round((product.paise / topPaise) * 100)) : 0;
                  return (
                    <li key={product.name} className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'stat-number flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm',
                          index === 0 ? 'bg-hero-gradient text-brand-ink shadow-sm shadow-brand/25' : 'bg-surface-muted text-ink-muted',
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-bold text-ink">{product.name}</p>
                          <p className="tnum shrink-0 text-sm font-extrabold text-ink">{formatPaise(product.paise, { whole: true })}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                            <div className={cn('h-full rounded-full', index === 0 ? 'bg-brand' : 'bg-brand/50')} style={{ width: `${share}%` }} />
                          </div>
                          <span className="tnum shrink-0 text-[11px] font-semibold text-ink-subtle">
                            {product.count} {product.count === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Collections history ───────────────────────────────────────── */}
      <section className="mt-5">
        <PaymentHistory month={month} payments={payments} focusedRow={focusedRow} />
      </section>
    </>
  );
}
