import { requireCustomer } from '@/auth/session.js';
import { businessMonth, formatMonth, formatDate, recentMonths } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import { getLocale } from '@/i18n/server.js';
import * as billingService from '@/services/billing.service.js';
import * as paymentService from '@/services/payment.service.js';

import { PageHeader, Card, CardBody, CardHeader, Table, Th, Td, StatusBadge, Notice, Field } from '@/components/ui/index.jsx';
import { PayForm } from '@/components/customer/PayForm.jsx';

export const metadata = { title: 'Billing' };

/**
 * The invoice.
 * Dual Language Support (English / Hindi).
 * Product names and numbers remain in English.
 */
export default async function BillingPage({ searchParams }) {
  const actor = await requireCustomer();
  const params = await searchParams;
  const month = typeof params?.month === 'string' ? params.month : businessMonth();
  const locale = await getLocale();
  const isHi = locale === 'hi';

  const [bill, paymentInfo, history] = await Promise.all([
    billingService.getBill(actor, { month }),
    paymentService.getPaymentInfo(actor),
    billingService.listInvoices(actor, { limit: 12 }),
  ]);

  const months = recentMonths(businessMonth(), 12);

  return (
    <>
      <PageHeader
        title={isHi ? 'बिलिंग' : 'Billing'}
        description={`${formatMonth(month)}${bill.frozen ? (isHi ? ' · बंद' : ' · closed') : (isHi ? ' · अभी जारी' : ' · still open')}`}
        action={
          <form>
            <select
              name="month"
              defaultValue={month}
              className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" className="ml-2 text-sm text-brand">{isHi ? 'देखें' : 'Go'}</button>
            </noscript>
          </form>
        }
      />

      {bill.balancePaise > 0 ? (
        <div className="mb-5">
          <Notice
            tone={bill.paidPaise > 0 ? 'info' : 'caution'}
            title={
              bill.paidPaise > 0
                ? isHi
                  ? `आंशिक भुगतान · ${formatPaise(bill.balancePaise)} बकाया शेष`
                  : `Partially Paid · ${formatPaise(bill.balancePaise)} remaining due`
                : `${formatPaise(bill.balancePaise)} ${isHi ? 'देय राशि' : 'due'}`
            }
          >
            {bill.paidPaise > 0
              ? isHi
                ? `आपने अब तक ${formatPaise(bill.paidPaise)} का भुगतान किया है। ${
                    bill.frozen ? `अंतिम तिथि ${formatDate(bill.dueDate)} है।` : 'यह महीना अभी जारी है।'
                  }`
                : `You have paid ${formatPaise(bill.paidPaise)} so far. ${
                    bill.frozen ? `Remaining balance due by ${formatDate(bill.dueDate)}.` : 'This month is still running.'
                  }`
              : bill.frozen
              ? isHi
                ? `अंतिम तिथि ${formatDate(bill.dueDate)} है।`
                : `Due by ${formatDate(bill.dueDate)}.`
              : isHi
              ? 'यह महीना अभी जारी है — जैसे-जैसे दूध डिलीवर होगा कुल राशि अपडेट होती रहेगी।'
              : 'This month is still running — the total will change as milk is delivered.'}
          </Notice>
        </div>
      ) : bill.creditPaise > 0 ? (
        <div className="mb-5">
          <Notice tone="positive" title={`${formatPaise(bill.creditPaise)} ${isHi ? 'क्रेडिट में' : 'in credit'}`}>
            {isHi
              ? 'आपने इस महीने के बिल से अधिक भुगतान किया है। यह अगले महीने में जुड़ जाएगा।'
              : "You have paid more than this month's bill. It will be applied to next month."}
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ── The invoice ──────────────────────────────────────────── */}
        <Card>
          <CardHeader title={isHi ? 'आपकी देय राशि' : 'What you owe'} description={formatMonth(month)} />
          <CardBody className="space-y-6">
            {/* Milk, one line per plan */}
            {bill.milkLines?.length ? (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {isHi ? 'दूध' : 'Milk'}
                </h3>
                <Table>
                  <thead>
                    <tr>
                      <Th>{isHi ? 'प्लान' : 'Plan'}</Th>
                      <Th numeric>{isHi ? 'दिन' : 'Days'}</Th>
                      <Th numeric>{isHi ? 'डिलीवर' : 'Delivered'}</Th>
                      <Th numeric>{isHi ? 'दर' : 'Rate'}</Th>
                      <Th numeric>{isHi ? 'राशि' : 'Amount'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.milkLines.map((line) => (
                      <tr key={line.subscriptionRootId}>
                        <Td className="min-w-[100px] sm:min-w-0">
                          <span className="font-bold text-slate-900">{line.productName}</span>
                          {line.skippedDays > 0 ? (
                            <span className="block text-[11px] text-ink-muted">
                              {isHi
                                ? `${line.skippedDays} दिन छुट्टी — कोई शुल्क नहीं`
                                : `${line.skippedDays} day${line.skippedDays === 1 ? '' : 's'} skipped — not charged`}
                            </span>
                          ) : null}
                        </Td>
                        <Td numeric>{line.deliveredDays}</Td>
                        <Td numeric>{formatMilli(line.deliveredMilli, line.unit)}</Td>
                        <Td numeric>₹{Number(line.unitPrice).toFixed(2)}</Td>
                        <Td numeric className="font-bold text-slate-900">{formatPaise(line.amountPaise)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {isHi ? 'इस महीने कोई दूध डिलीवर नहीं हुआ।' : 'No milk delivered this month.'}
              </p>
            )}

            {/* Extras */}
            {bill.productLines?.length ? (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {isHi ? 'अतिरिक्त उत्पाद' : 'Extras'}
                </h3>
                <Table>
                  <thead>
                    <tr>
                      <Th>{isHi ? 'सामान' : 'Item'}</Th>
                      <Th numeric>{isHi ? 'मात्रा' : 'Qty'}</Th>
                      <Th numeric>{isHi ? 'राशि' : 'Amount'}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.productLines.map((line) => (
                      <tr key={line.id}>
                        <Td>
                          <span className="font-bold text-slate-900">{line.productName}</span>
                          <span className="block text-xs text-ink-muted">
                            {formatDate(line.orderDate)}
                          </span>
                        </Td>
                        <Td numeric>{formatMilli(line.quantityMilli, line.unit)}</Td>
                        <Td numeric>{formatPaise(line.amountPaise)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : null}

            {/* Totals */}
            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <Row label={isHi ? 'दूध' : 'Milk'} value={formatPaise(bill.milkAmountPaise)} />
              <Row label={isHi ? 'अतिरिक्त उत्पाद' : 'Extras'} value={formatPaise(bill.productsAmountPaise)} />
              {bill.adjustmentPaise > 0 ? (
                <Row label={bill.adjustmentReason ?? (isHi ? 'क्रेडिट' : 'Credit')} value={`− ${formatPaise(bill.adjustmentPaise)}`} />
              ) : null}
              <Row label={isHi ? 'कुल योग' : 'Total'} value={formatPaise(bill.totalPaise)} strong />
              <Row label={isHi ? 'भुगतान किया' : 'Paid'} value={formatPaise(bill.paidPaise)} />
              {bill.awaitingPaise > 0 ? (
                <Row label={isHi ? 'स्वीकृति लंबित' : 'Awaiting confirmation'} value={formatPaise(bill.awaitingPaise)} />
              ) : null}
              <Row
                label={isHi ? 'बकाया राशि' : 'Balance'}
                value={formatPaise(bill.balancePaise)}
                strong
                tone={bill.balancePaise > 0 ? 'critical' : 'positive'}
              />
            </dl>
          </CardBody>
        </Card>

        {/* ── Pay ───────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <PayForm
            month={month}
            balancePaise={bill.balancePaise}
            awaitingPaise={bill.awaitingPaise ?? 0}
            milkman={paymentInfo}
          />

          <Card>
            <CardHeader title={isHi ? 'पुराने बिल' : 'Past invoices'} />
            <CardBody className="space-y-1">
              {history.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {isHi ? 'अभी कोई पुराना बिल नहीं है।' : 'No earlier invoices yet.'}
                </p>
              ) : (
                history.map((invoice) => (
                  <a
                    key={invoice.month}
                    href={`/billing?month=${invoice.month}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-surface-muted"
                  >
                    <span className="text-ink">{formatMonth(invoice.month)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tnum text-ink-muted">{formatPaise(invoice.totalPaise)}</span>
                      <StatusBadge status={invoice.status} />
                    </span>
                  </a>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, tone }) {
  const toneClass = { critical: 'text-critical', positive: 'text-positive' }[tone] ?? 'text-ink';
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'font-medium text-ink' : 'text-ink-muted'}>{label}</dt>
      <dd className={`tnum ${strong ? `font-semibold ${toneClass}` : 'text-ink-muted'}`}>{value}</dd>
    </div>
  );
}
