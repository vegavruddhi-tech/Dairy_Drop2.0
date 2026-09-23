import Link from 'next/link';

import { requireMilkman } from '@/auth/session.js';
import { businessDate, businessMonth, greeting, formatDate } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import { daysRemaining } from '@/auth/policy.js';
import * as deliveryService from '@/services/delivery.service.js';
import * as billingService from '@/services/billing.service.js';
import * as requestsRepo from '@/repositories/requests.repo.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import { db } from '@/db/index.js';

import {
  Stat, Card, CardBody, CardHeader, Notice, Badge, HeroBanner, HeroAction,
} from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { DayOffButton } from '@/components/milkman/Round.jsx';
import {
  RoutesIcon,
  DeliveryIcon,
  UsersIcon,
  PaymentsIcon,
  MilkDropIcon,
} from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Milkman' };

export default async function MilkmanDashboard() {
  const actor = await requireMilkman();
  const today = businessDate();

  const [round, earnings, requests, pendingCustomers, customerCount] = await Promise.all([
    deliveryService.getRound(actor, today),
    billingService.getEarnings(actor, { month: businessMonth() }),
    requestsRepo.countPendingRequests(actor),
    usersRepo.countPendingCustomers(actor),
    subscriptionsRepo.countActiveCustomers(db, actor.userId),
  ]);

  const remaining = round.summary.total - round.summary.delivered - round.summary.skipped - round.summary.undelivered;
  const left = daysRemaining(actor.saas);
  const limit = actor.saas?.customerLimit;
  const nearLimit = limit ? customerCount >= limit * 0.8 : false;

  return (
    <>
      <HeroBanner
        eyebrow={formatDate(today)}
        greeting={greeting()}
        name={actor.name?.split(' ')[0] ?? 'there'}
        subtitle={`${round.summary.total} stops on today's round`}
        action={<HeroAction href="/milkman/round">Start round</HeroAction>}
      />

      {left <= 3 ? (
        <div className="mb-5">
          <Notice
            tone={left <= 1 ? 'critical' : 'caution'}
            title={`${left} day${left === 1 ? '' : 's'} left on your ${actor.saas?.status === 'TRIAL' ? 'trial' : 'plan'}`}
            action={
              <Link href="/milkman/membership">
                <Button size="sm">Renew</Button>
              </Link>
            }
          >
            Your panel closes when it ends. Your customers and history are kept.
          </Notice>
        </div>
      ) : null}

      {nearLimit ? (
        <div className="mb-5">
          <Notice
            tone="caution"
            title={`${customerCount} of ${limit} customers`}
            action={
              <Link href="/milkman/membership">
                <Button size="sm" variant="outline">Upgrade</Button>
              </Link>
            }
          >
            You are close to your plan limit. Upgrade to take on more customers.
          </Notice>
        </div>
      ) : null}

      {/* ── Today's round ─────────────────────────────────────────────── */}
      <div className="mb-6 rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-heading text-base font-extrabold tracking-tight text-slate-900">Today's Round</h2>
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(today)}</p>
            </div>
            <div className="flex items-center gap-2">
              <DayOffButton date={today} count={remaining} />
              <Link href="/milkman/round">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">{remaining > 0 ? 'Start Round' : 'View Round'}</Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<RoutesIcon className="h-5 w-5" />} tone="info" label="Stops" value={round.summary.total} />
            <Stat
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              }
              tone="positive"
              label="Delivered"
              value={round.summary.delivered}
            />
            <Stat
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              tone={remaining > 0 ? 'caution' : 'neutral'}
              label="Remaining"
              value={remaining}
            />
            <Stat icon={<MilkDropIcon className="h-5 w-5" />} tone="brand" label="Milk Out" value={formatMilli(Math.round(Number(round.summary.litres) * 1000))} />
          </div>
        </div>

        {/* ── Money ─────────────────────────────────────────────────────── */}
        <section className="mb-6" aria-labelledby="money-heading">
          <h2 id="money-heading" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">This Month Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<PaymentsIcon className="h-5 w-5" />} tone="brand" label="Billed" value={formatPaise(earnings.billedPaise, { whole: true })} />
            <Stat
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              }
              tone="positive"
              label="Collected"
              value={formatPaise(earnings.collectedPaise, { whole: true })}
            />
            <Stat
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              tone="caution"
              label="Outstanding"
              value={formatPaise(earnings.billedPaise - earnings.collectedPaise, { whole: true })}
            />
            <Stat
              icon={<UsersIcon className="h-5 w-5" />}
              tone={nearLimit ? 'caution' : 'info'}
              label="Customers"
              value={limit ? `${customerCount} / ${limit}` : customerCount}
            />
          </div>
        </section>

      {/* ── Needs attention ───────────────────────────────────────────── */}
      {requests.total > 0 || pendingCustomers > 0 ? (
        <Card>
          <CardHeader title="Needs you" />
          <CardBody className="space-y-2">
            {pendingCustomers > 0 ? (
              <ActionRow
                href="/milkman/customers?status=PENDING"
                label={`${pendingCustomers} customer${pendingCustomers === 1 ? '' : 's'} waiting for approval`}
              />
            ) : null}
            {requests.quantity > 0 ? (
              <ActionRow
                href="/milkman/requests"
                label={`${requests.quantity} quantity change${requests.quantity === 1 ? '' : 's'} to answer`}
              />
            ) : null}
            {requests.plan > 0 ? (
              <ActionRow
                href="/milkman/requests"
                label={`${requests.plan} plan change${requests.plan === 1 ? '' : 's'} to answer`}
              />
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function ActionRow({ href, label }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-surface-muted"
    >
      <span className="text-ink">{label}</span>
      <span aria-hidden="true" className="text-ink-subtle">→</span>
    </Link>
  );
}
