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
      <Card className="mb-6">
        <CardHeader
          title="Today's round"
          description={formatDate(today)}
          action={
            <Link href="/milkman/round">
              <Button size="sm">{remaining > 0 ? 'Start round' : 'View round'}</Button>
            </Link>
          }
        />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="📍" tone="info" label="Stops" value={round.summary.total} />
          <Stat icon="✓" tone="positive" label="Delivered" value={round.summary.delivered} />
          <Stat
            icon="⏱"
            tone={remaining > 0 ? 'caution' : 'neutral'}
            label="Remaining"
            value={remaining}
          />
          <Stat icon="🥛" tone="brand" label="Milk out" value={formatMilli(Math.round(Number(round.summary.litres) * 1000))} />
        </CardBody>
      </Card>

      {/* ── Money ─────────────────────────────────────────────────────── */}
      <section className="mb-6" aria-labelledby="money-heading">
        <h2 id="money-heading" className="mb-3 text-sm font-semibold text-ink">This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="₹" tone="brand" label="Billed" value={formatPaise(earnings.billedPaise, { whole: true })} />
          <Stat icon="✓" tone="positive" label="Collected" value={formatPaise(earnings.collectedPaise, { whole: true })} />
          <Stat
            icon="⧗"
            tone="caution"
            label="Outstanding"
            value={formatPaise(earnings.billedPaise - earnings.collectedPaise, { whole: true })}
          />
          <Stat
            icon="👥"
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
