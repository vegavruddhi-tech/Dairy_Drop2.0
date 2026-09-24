import { requireMilkman } from '@/auth/session.js';
import { formatDate, businessDate } from '@/domain/dates.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as saasService from '@/services/saas.service.js';

import { Card, CardBody, CardHeader, Stat, StatusBadge, Notice, Table, Th, Td, STATUS_TONE, cn } from '@/components/ui/index.jsx';
import { MembershipIcon, ClockIcon, UsersIcon, CheckIcon, PhoneIcon } from '@/components/ui/Icons.jsx';
import { SubmitSaasPayment } from '@/components/milkman/Activate.jsx';

export const metadata = { title: 'Membership' };

const STATUS_LABEL = {
  ACTIVE: 'Active',
  TRIAL: 'Free trial',
  PENDING_VERIFICATION: 'Awaiting verification',
  EXPIRED: 'Expired',
};

const dayOf = (instant) => formatDate(businessDate(instant));

/**
 * The milkman's own subscription to DairyDrop.
 *
 * The banner answers the two questions this page exists for — how long is
 * left, and how many customers the plan allows — before anything else.
 */
export default async function MembershipPage() {
  const actor = await requireMilkman();
  const membership = await saasService.getMembership(actor);

  const current = membership.current;
  const status = current?.status ?? 'EXPIRED';
  const days = membership.daysRemaining;

  // Term progress: how much of the paid period has been used.
  const termDays = current
    ? Math.max(1, Math.round((new Date(current.endsAt) - new Date(current.startsAt)) / 86_400_000))
    : 0;
  const termUsed = current ? Math.min(100, Math.max(0, Math.round(((termDays - days) / termDays) * 100))) : 0;

  const limit = membership.customerLimit;
  const slotsLeft = limit ? Math.max(0, limit - membership.customerCount) : null;

  const daysTone = days <= 3 ? 'critical' : days <= 7 ? 'caution' : 'positive';
  const statusTone = STATUS_TONE[status] ?? 'neutral';

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
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    status === 'ACTIVE' || status === 'TRIAL' ? 'animate-pulse bg-sky-200' : 'bg-white/60',
                  )}
                />
                {STATUS_LABEL[status] ?? status}
              </span>
              <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {current?.planName ?? (status === 'TRIAL' ? 'Free trial' : 'No active plan')}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/85">
                {current
                  ? `${dayOf(current.startsAt)} → ${dayOf(current.endsAt)} · ${limit ? `up to ${limit} customers` : 'unlimited customers'}`
                  : 'Pick a plan below to open your panel.'}
              </p>
            </div>

            {membership.settings?.supportPhone ? (
              <a
                href={`tel:${membership.settings.supportPhone}`}
                className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <PhoneIcon className="h-4 w-4" />
                Support
              </a>
            ) : null}
          </div>

          {current ? (
            <div className="mt-5">
              <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/85">
                <span>
                  {days > 0
                    ? `${days} ${days === 1 ? 'day' : 'days'} left · ends ${dayOf(current.endsAt)}`
                    : `Ended ${dayOf(current.endsAt)}`}
                </span>
                <span className="tnum shrink-0 font-heading text-lg font-black text-white">{termUsed}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={termUsed}
                aria-label="Membership term used"
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500 ease-out-expo',
                    days <= 3 ? 'bg-critical shadow-[0_0_12px_rgba(225,29,72,0.6)]' : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]',
                  )}
                  style={{ width: `${termUsed}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Plan" value={current?.planName ?? 'None'} icon={<MembershipIcon className="h-5 w-5" />} tone="brand" />
        <Stat
          label="Days left"
          value={days}
          icon={<ClockIcon className="h-5 w-5" />}
          tone={current ? daysTone : 'neutral'}
          hint={current ? `ends ${dayOf(current.endsAt)}` : undefined}
        />
        <Stat
          label="Customers"
          value={limit ? `${membership.customerCount} / ${limit}` : membership.customerCount}
          icon={<UsersIcon className="h-5 w-5" />}
          tone={membership.nearLimit ? 'caution' : 'info'}
          hint={limit ? `${slotsLeft} ${slotsLeft === 1 ? 'slot' : 'slots'} left` : 'No limit'}
        />
        <Stat
          label="Status"
          value={<StatusBadge status={status} />}
          icon={<CheckIcon className="h-5 w-5" />}
          tone={statusTone === 'neutral' ? 'neutral' : statusTone}
        />
      </div>

      {membership.nearLimit ? (
        <div className="mb-6">
          <Notice tone="caution" title="Close to your customer limit">
            You can serve {limit} customers on this plan. Pick a bigger one below to take on more.
          </Notice>
        </div>
      ) : null}

      {status === 'PENDING_VERIFICATION' ? (
        <div className="mb-6">
          <Notice tone="info" title="We are checking your payment">
            Your reference has been received. The panel opens as soon as an administrator matches it against the bank statement.
          </Notice>
        </div>
      ) : null}

      {membership.pendingChange ? (
        <div className="mb-6">
          <Notice tone="info" title={`Switching to ${membership.pendingChange.planName}`}>
            Your payment is being checked. {current?.planName ?? 'Your current plan'} stays open until it is
            confirmed; the new plan starts that day with a fresh {membership.pendingChange.planName} term.
          </Notice>
        </div>
      ) : null}

      <div className="mb-6">
        <SubmitSaasPayment
          plans={membership.plans}
          settings={membership.settings}
          current={
            current
              ? {
                  planId: current.planId,
                  planName: current.planName,
                  status: current.status,
                  customerLimit: current.customerLimit,
                }
              : null
          }
          customerCount={membership.customerCount}
          pendingChange={
            membership.pendingChange
              ? {
                  planName: membership.pendingChange.planName,
                  paymentReference: membership.pendingChange.paymentReference,
                  createdAt: membership.pendingChange.createdAt,
                }
              : null
          }
        />
      </div>

      {/* ── History ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="History" description="Every term on this account, newest first" />
        <CardBody className="p-0 pt-3">
          {membership.history.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-medium text-ink-muted">Nothing yet.</p>
          ) : (
            <>
              <ul className="divide-y divide-border md:hidden">
                {membership.history.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <MembershipIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-extrabold text-ink">{row.planName ?? 'Free trial'}</p>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-ink-muted">
                        {dayOf(row.startsAt)} → {dayOf(row.endsAt)}
                        {row.cancellationReason ? ` · ${row.cancellationReason}` : ''}
                      </p>
                    </div>
                    <p className="tnum shrink-0 text-sm font-extrabold text-ink">{formatPaise(toPaise(row.pricePaid), { whole: true })}</p>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th>Period</Th>
                      <Th numeric>Paid</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {membership.history.map((row) => (
                      <tr key={row.id}>
                        <Td>{row.planName ?? 'Free trial'}</Td>
                        <Td><StatusBadge status={row.status} /></Td>
                        <Td className="text-ink-muted">
                          {dayOf(row.startsAt)} → {dayOf(row.endsAt)}
                          {row.cancellationReason ? (
                            <span className="block text-xs font-medium text-ink-subtle">{row.cancellationReason}</span>
                          ) : null}
                        </Td>
                        <Td numeric>{formatPaise(toPaise(row.pricePaid))}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
