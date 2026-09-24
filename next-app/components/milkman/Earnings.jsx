import Link from 'next/link';

import { formatMonth, formatInstant } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import { cn, Card, CardBody, CardHeader, Badge, Table, Th, Td, StatusBadge } from '@/components/ui/index.jsx';
import { PhoneIcon, CheckIcon, ClockIcon, CloseIcon } from '@/components/ui/Icons.jsx';

/**
 * The per-customer half of the earnings page.
 *
 * Both blocks render twice: a table from `md` up, and a stack of cards below
 * it. A six-column money table scrolled sideways on a phone is how the old
 * app did it, and the milkman ended up reading the customer name and the
 * outstanding figure on different screens.
 *
 * `?customer=<id>` (the picker at the top of the page) narrows both to that
 * one customer; tapping a name here is a shortcut to the same thing.
 */

const monthHref = (month, customerId) =>
  customerId ? `/milkman/earnings?month=${month}&customer=${customerId}` : `/milkman/earnings?month=${month}`;

function Owed({ paise }) {
  return paise > 0 ? (
    <Badge tone="caution" dot>
      {formatPaise(paise, { whole: true })} due
    </Badge>
  ) : (
    <Badge tone="positive" dot>
      Settled
    </Badge>
  );
}

function Phone({ number, className }) {
  if (!number) return null;
  return (
    <a href={`tel:${number}`} className={cn('text-xs font-semibold text-brand', className)}>
      {number}
    </a>
  );
}

/** A round call button, for the card layouts. */
function PhoneButton({ number, name }) {
  if (!number) return null;
  return (
    <a
      href={`tel:${number}`}
      aria-label={`Call ${name}`}
      title={`Call ${name}`}
      className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
    >
      <PhoneIcon className="h-4 w-4" />
    </a>
  );
}

/** Initial in a gradient tile, matching the customer book. */
function Avatar({ name }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hero-gradient font-heading text-sm font-black text-brand-ink shadow-sm shadow-brand/25"
    >
      {(name ?? '?').trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** A thin collected-of-billed bar. */
function CollectedBar({ collectedPaise, billedPaise }) {
  const rate = billedPaise > 0 ? Math.min(100, Math.round((collectedPaise / billedPaise) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate} aria-label="Collected of billed">
        <div className={cn('h-full rounded-full', rate >= 100 ? 'bg-positive' : 'bg-brand')} style={{ width: `${rate}%` }} />
      </div>
      <span className="tnum shrink-0 text-[11px] font-bold text-ink-subtle">{rate}%</span>
    </div>
  );
}

const PAYMENT_TILE = {
  VERIFIED: { Icon: CheckIcon, tile: 'bg-positive-soft text-positive' },
  REJECTED: { Icon: CloseIcon, tile: 'bg-critical-soft text-critical' },
  SUBMITTED: { Icon: ClockIcon, tile: 'bg-caution-soft text-caution' },
};

/** Green check, red cross or amber clock, by payment state. */
function PaymentTile({ status }) {
  const { Icon, tile } = PAYMENT_TILE[status] ?? PAYMENT_TILE.SUBMITTED;
  return (
    <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tile)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/**
 * @param {object} props
 * @param {string} props.month
 * @param {Array}  props.rows        `earnings.byCustomer`
 * @param {string|null} props.focused customer id, when one is selected
 */
export function CustomerEarnings({ month, rows, focused }) {
  const focusedRow = focused ? rows.find((row) => row.customerId === focused) : null;
  const shown = focusedRow ? [focusedRow] : rows;

  return (
    <Card>
      <CardHeader
        title="By customer"
        description={
          focusedRow
            ? `Showing ${focusedRow.customerName} for ${formatMonth(month)}`
            : `Where ${formatMonth(month)}'s money sits, largest bill first`
        }
        action={
          focusedRow ? (
            <Link
              href={monthHref(month)}
              className="tap shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-ink-muted hover:bg-surface-muted"
            >
              Show all
            </Link>
          ) : null
        }
      />
      <CardBody className="p-0 pt-3">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">
            Nothing delivered, ordered or paid this month yet.
          </p>
        ) : (
          <>
            {/* ── Phone: one card per customer ─────────────────────────── */}
            <ul className="divide-y divide-border md:hidden">
              {shown.map((row) => {
                const active = row.customerId === focused;
                // The name is the link, not the whole card: the phone number
                // beside it is a `tel:` link of its own, and one anchor cannot
                // contain another.
                return (
                  <li
                    key={row.customerId}
                    className={cn('px-4 py-4 transition-colors', active ? 'bg-brand-soft/50' : '')}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={row.customerName} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={monthHref(month, active ? null : row.customerId)}
                          aria-current={active ? 'true' : undefined}
                          className="tap -mx-1 block rounded-lg px-1 active:bg-surface-muted"
                        >
                          <span className="block truncate font-heading text-[15px] font-extrabold tracking-tight text-ink">{row.customerName}</span>
                          <span className="block text-xs font-semibold text-brand">{active ? 'Show everyone' : 'Only this customer →'}</span>
                        </Link>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Billed</p>
                        <p className="stat-number text-xl leading-none text-ink">{formatPaise(row.billedPaise, { whole: true })}</p>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-muted/70 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Milk</dt>
                        <dd className="tnum font-extrabold text-ink">{formatPaise(row.milkPaise, { whole: true })}</dd>
                        <dd className="text-[11px] font-medium text-ink-muted">{formatMilli(row.milkMilli)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Extras</dt>
                        <dd className="tnum font-extrabold text-ink">{formatPaise(row.productsPaise, { whole: true })}</dd>
                        <dd className="text-[11px] font-medium text-ink-muted">
                          {row.purchaseCount} {row.purchaseCount === 1 ? 'order' : 'orders'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Collected</dt>
                        <dd className="tnum font-extrabold text-positive">{formatPaise(row.collectedPaise, { whole: true })}</dd>
                      </div>
                    </dl>

                    <div className="mt-2.5">
                      <CollectedBar collectedPaise={row.collectedPaise} billedPaise={row.billedPaise} />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <Owed paise={row.outstandingPaise} />
                      <PhoneButton number={row.customerPhone} name={row.customerName} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* ── Wider screens: the table ─────────────────────────────── */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th numeric>Milk</Th>
                    <Th numeric>Extras</Th>
                    <Th numeric>Billed</Th>
                    <Th numeric>Collected</Th>
                    <Th className="text-right">Outstanding</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const active = row.customerId === focused;
                    return (
                      <tr
                        key={row.customerId}
                        className={cn('transition-colors', active ? 'bg-brand-soft/60' : 'hover:bg-surface-muted/60')}
                      >
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={row.customerName} />
                            <div className="min-w-0">
                              <Link
                                href={monthHref(month, active ? null : row.customerId)}
                                aria-current={active ? 'true' : undefined}
                                className="block hover:text-brand"
                              >
                                <span className="font-extrabold">{row.customerName}</span>
                                <span className="block text-xs font-medium text-ink-muted">
                                  {row.deliveredCount} {row.deliveredCount === 1 ? 'delivery' : 'deliveries'}
                                  {row.purchaseCount ? ` · ${row.purchaseCount} ${row.purchaseCount === 1 ? 'order' : 'orders'}` : ''}
                                </span>
                              </Link>
                              <Phone number={row.customerPhone} className="block" />
                            </div>
                          </div>
                        </Td>
                        <Td numeric>
                          {formatPaise(row.milkPaise)}
                          <span className="block text-xs font-medium text-ink-muted">{formatMilli(row.milkMilli)}</span>
                        </Td>
                        <Td numeric>{formatPaise(row.productsPaise)}</Td>
                        <Td numeric className="font-extrabold">{formatPaise(row.billedPaise)}</Td>
                        <Td numeric className="text-positive">{formatPaise(row.collectedPaise)}</Td>
                        <Td className="text-right">
                          <Owed paise={row.outstandingPaise} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The month's collections ledger, newest first.
 *
 * @param {object} props
 * @param {string} props.month
 * @param {Array}  props.payments
 * @param {{customerId: string, customerName: string}|null} [props.focusedRow]
 *   narrows the list to one customer
 */
export function PaymentHistory({ month, payments, focusedRow }) {
  return (
    <Card>
      <CardHeader
        title="Payment history"
        description={
          focusedRow
            ? `${focusedRow.customerName}'s payments against ${formatMonth(month)}`
            : `Everything recorded against ${formatMonth(month)}`
        }
      />
      <CardBody className="p-0 pt-3">
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">
            {focusedRow
              ? `No payments from ${focusedRow.customerName} for this month yet.`
              : 'No payments recorded for this month yet.'}
          </p>
        ) : (
          <>
            {/* ── Phone ────────────────────────────────────────────────── */}
            <ul className="divide-y divide-border md:hidden">
              {payments.map((payment) => {
                const verified = payment.status === 'VERIFIED';
                return (
                  <li key={payment.id} className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <PaymentTile status={payment.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-ink">{payment.customerName}</p>
                        <Phone number={payment.customerPhone} className="block" />
                      </div>
                      <p className={cn('tnum shrink-0 text-base font-extrabold', verified ? 'text-ink' : 'text-ink-muted')}>
                        {formatPaise(payment.amountPaise)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <StatusBadge status={payment.status} />
                      <span className="font-semibold">{payment.method}</span>
                      {payment.reference ? <span className="tnum">Ref {payment.reference}</span> : null}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {formatInstant(payment.createdAt)}
                      {payment.verifiedAt ? ` · confirmed ${formatInstant(payment.verifiedAt)}` : ''}
                    </p>
                    {payment.rejectionReason ? (
                      <p className="mt-1 text-xs text-critical">{payment.rejectionReason}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* ── Wider screens ────────────────────────────────────────── */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Recorded</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th>State</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td>
                        <span className="font-medium">{payment.customerName}</span>
                        <Phone number={payment.customerPhone} className="block" />
                      </Td>
                      <Td>
                        <span className="text-sm">{formatInstant(payment.createdAt)}</span>
                        {payment.verifiedAt ? (
                          <span className="block text-xs text-ink-muted">
                            Confirmed {formatInstant(payment.verifiedAt)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>{payment.method}</Td>
                      <Td>
                        <span className="tnum text-sm">{payment.reference ?? '—'}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={payment.status} />
                        {payment.rejectionReason ? (
                          <span className="block text-xs text-ink-muted">{payment.rejectionReason}</span>
                        ) : null}
                      </Td>
                      <Td numeric className={payment.status === 'VERIFIED' ? 'font-medium' : 'text-ink-muted'}>
                        {formatPaise(payment.amountPaise)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
