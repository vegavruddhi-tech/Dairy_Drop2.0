import { requireMilkman } from '@/auth/session.js';
import { formatMonth, formatDate } from '@/domain/dates.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as paymentService from '@/services/payment.service.js';
import * as usersRepo from '@/repositories/users.repo.js';
import { getLocale } from '@/i18n/server.js';

import { Card, CardBody, CardHeader, EmptyState, Table, Th, Td, StatusBadge, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { PaymentsIcon, RequestsIcon, UsersIcon, EarningsIcon, PhoneIcon } from '@/components/ui/Icons.jsx';
import { VerifyPayment } from '@/components/milkman/Payments.jsx';
import { PaymentSettings } from '@/components/milkman/PaymentSettings.jsx';

export const metadata = { title: 'Payments' };

/**
 * Collections.
 *
 * Two lists: payments customers say they made, waiting for the milkman to
 * find them in the bank app; and bills that still owe. Confirming here is
 * what moves money from "claimed" to "collected" on the earnings page.
 */
export default async function PaymentsPage() {
  const actor = await requireMilkman();
  const locale = await getLocale();
  const isHi = locale === 'hi';

  const [pending, outstanding, profile] = await Promise.all([
    paymentService.listPending(actor, { limit: 50 }),
    paymentService.listOutstanding(actor, { limit: 50 }),
    usersRepo.findMilkmanProfile(actor.userId),
  ]);

  const awaitingPaise = pending.reduce((total, payment) => total + toPaise(payment.amount), 0);
  const duePaise = outstanding.reduce((total, row) => total + toPaise(row.balance), 0);
  const owing = new Set(outstanding.map((row) => row.customerId)).size;
  const overdue = outstanding.filter((row) => row.status === 'OVERDUE').length;

  const subtitle = isHi
    ? [
        pending.length
          ? `${pending.length} पुष्टि हेतु बाकी · ${formatPaise(awaitingPaise, { whole: true })} दावा किया गया`
          : 'पुष्टि के लिए कुछ नहीं',
        outstanding.length
          ? `${formatPaise(duePaise, { whole: true })} बकाया (${owing} ग्राहक)`
          : 'सभी का भुगतान पूरा हो चुका है',
      ].join(' · ')
    : [
        pending.length
          ? `${pending.length} to confirm · ${formatPaise(awaitingPaise, { whole: true })} claimed`
          : 'Nothing to confirm',
        outstanding.length
          ? `${formatPaise(duePaise, { whole: true })} due from ${owing} ${owing === 1 ? 'customer' : 'customers'}`
          : 'everyone is paid up',
      ].join(' · ');

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              {pending.length > 0 ? (
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200" />
              ) : null}
              {isHi ? 'वसूली / संग्रह (Collections)' : 'Collections'}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {isHi ? 'भुगतान (Payments)' : 'Payments'}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>

          <a
            href="/milkman/earnings"
            className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
          >
            <EarningsIcon className="h-4 w-4" />
            {isHi ? 'कमाई (Earnings)' : 'Earnings'}
          </a>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={isHi ? 'सत्यापन बाकी (To confirm)' : 'To confirm'}
          value={pending.length}
          icon={<PaymentsIcon className="h-5 w-5" />}
          tone={pending.length ? 'caution' : 'neutral'}
          hint={
            pending.length
              ? isHi
                ? `${formatPaise(awaitingPaise, { whole: true })} दावा किया गया`
                : `${formatPaise(awaitingPaise, { whole: true })} claimed`
              : isHi
              ? 'कोई भुगतान प्रतीक्षारत नहीं'
              : 'Nothing waiting'
          }
        />
        <Stat
          label={isHi ? 'बकाया राशि (Outstanding)' : 'Outstanding'}
          value={formatPaise(duePaise, { whole: true })}
          icon={<UsersIcon className="h-5 w-5" />}
          tone={duePaise > 0 ? 'critical' : 'positive'}
          hint={
            owing
              ? isHi
                ? `${owing} ग्राहकों का बकाया है`
                : `${owing} ${owing === 1 ? 'customer owes' : 'customers owe'}`
              : isHi
              ? 'सभी का हिसाब चुकता है'
              : 'Everyone is up to date'
          }
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={isHi ? 'अतिदेय बिल (Overdue)' : 'Overdue bills'}
            value={overdue}
            icon={<RequestsIcon className="h-5 w-5" />}
            tone={overdue ? 'critical' : 'neutral'}
            hint={
              overdue
                ? isHi
                  ? 'समय-सीमा समाप्त'
                  : 'Past their due date'
                : isHi
                ? 'कोई बकाया अतिदेय नहीं'
                : 'None past due'
            }
          />
        </div>
      </div>

      {/* ── To confirm ────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="verify-heading">
        <SectionHeading id="verify-heading" count={pending.length} tone="caution">
          {isHi ? 'सत्यापन हेतु भुगतान (To confirm)' : 'To confirm'}
        </SectionHeading>

        {pending.length === 0 ? (
          <EmptyState
            icon={<PaymentsIcon className="h-8 w-8 text-brand" />}
            title={isHi ? 'सत्यापित करने के लिए कुछ नहीं' : 'Nothing to confirm'}
            description={
              isHi
                ? 'जब कोई ग्राहक अपने ऐप में भुगतान दर्ज करता है, तो वह संदर्भ/रेफरेंस के साथ यहाँ दिखता है ताकि आप अपने बैंक या UPI खाते में जांच सकें।'
                : 'When a customer records a payment in their app, it appears here with the reference for you to check against your bank or UPI history.'
            }
            tip={
              isHi
                ? 'केवल वही भुगतान आपकी कमाई (Earnings) पेज पर एकत्रित माना जाता है, जिसे आप यहाँ कन्फर्म करते हैं।'
                : 'Only what you confirm here counts as collected on the Earnings page.'
            }
          />
        ) : (
          <div className="space-y-3">
            {pending.map((payment) => (
              <VerifyPayment key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </section>

      {/* ── Outstanding ───────────────────────────────────────────────── */}
      <section aria-labelledby="outstanding-heading">
        <Card>
          <CardHeader
            title={isHi ? 'बकाया ग्राहक (Outstanding)' : 'Outstanding'}
            description={
              outstanding.length
                ? isHi
                  ? `${formatPaise(duePaise, { whole: true })} आना बाकी है`
                  : `${formatPaise(duePaise, { whole: true })} still to come in, largest first`
                : isHi
                ? 'वे ग्राहक जिनका भुगतान अभी बाकी है'
                : 'Customers who still owe money'
            }
          />
          <CardBody className="p-0 pt-3">
            {outstanding.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm font-medium text-ink-muted">
                {isHi ? 'सभी ग्राहकों का हिसाब चुकता है।' : 'Everyone is up to date.'}
              </p>
            ) : (
              <>
                {/* Phone: one row per bill. */}
                <ul className="divide-y divide-border md:hidden">
                  {outstanding.map((row) => (
                    <li key={row.billId} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-sm font-extrabold text-ink">{row.customerName}</p>
                          <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-ink-muted">
                          {formatMonth(row.month)} · {isHi ? 'भुगतान किया' : 'paid'} {formatPaise(toPaise(row.paidAmount), { whole: true })} /{' '}
                          {formatPaise(toPaise(row.totalAmount), { whole: true })}
                          {row.dueDate ? ` · ${isHi ? 'अंतिम तिथि' : 'due'} ${formatDate(row.dueDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="tnum text-base font-extrabold text-critical">{formatPaise(toPaise(row.balance), { whole: true })}</p>
                        {row.customerPhone ? (
                          <a
                            href={`tel:${row.customerPhone}`}
                            aria-label={`Call ${row.customerName}`}
                            className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
                          >
                            <PhoneIcon className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden md:block">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{isHi ? 'ग्राहक' : 'Customer'}</Th>
                        <Th>{isHi ? 'महीना' : 'Month'}</Th>
                        <Th numeric>{isHi ? 'कुल बिल' : 'Billed'}</Th>
                        <Th numeric>{isHi ? 'भुगतान किया' : 'Paid'}</Th>
                        <Th numeric>{isHi ? 'बकाया' : 'Due'}</Th>
                        <Th>{isHi ? 'स्थिति' : 'Status'}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.map((row) => (
                        <tr key={row.billId}>
                          <Td>
                            <span className="font-extrabold">{row.customerName}</span>
                            {row.customerPhone ? (
                              <a href={`tel:${row.customerPhone}`} className="block text-xs font-semibold text-brand">
                                {row.customerPhone}
                              </a>
                            ) : null}
                          </Td>
                          <Td>
                            {formatMonth(row.month)}
                            {row.dueDate ? (
                              <span className="block text-xs font-medium text-ink-muted">
                                {isHi ? 'अंतिम तिथि' : 'Due'} {formatDate(row.dueDate)}
                              </span>
                            ) : null}
                          </Td>
                          <Td numeric>{formatPaise(toPaise(row.totalAmount))}</Td>
                          <Td numeric className="text-positive">{formatPaise(toPaise(row.paidAmount))}</Td>
                          <Td numeric className="font-extrabold text-critical">{formatPaise(toPaise(row.balance))}</Td>
                          <Td><StatusBadge status={row.status} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </section>

      {/* ── UPI & QR Code Settings ────────────────────────────────────── */}
      <section className="mt-8 border-t border-border/80 pt-8" aria-labelledby="settings-heading">
        <PaymentSettings initialUpiId={profile?.upiId ?? ''} initialQrCodeUrl={profile?.qrCodeUrl ?? ''} />
      </section>
    </>
  );
}

