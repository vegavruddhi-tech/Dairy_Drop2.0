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
import * as productsRepo from '@/repositories/products.repo.js';
import { db } from '@/db/index.js';

import {
  Stat, Notice, HeroBanner, HeroAction, NextActionCard,
} from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { DayOffButton } from '@/components/milkman/Round.jsx';
import { PushNotificationPrompt } from '@/components/ui/PushNotificationPrompt.jsx';
import {
  RoutesIcon,
  UsersIcon,
  PaymentsIcon,
  MilkDropIcon,
  PackageIcon,
  SunIcon,
  TruckIcon,
} from '@/components/ui/Icons.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Milkman Dashboard' };

export default async function MilkmanDashboard() {
  const actor = await requireMilkman();
  const today = businessDate();

  const [round, earnings, requests, pendingCustomers, customerCount, todayExtras, pendingOrdersCount] = await Promise.all([
    deliveryService.getRound(actor, today),
    billingService.getEarnings(actor, { month: businessMonth() }),
    requestsRepo.countPendingRequests(actor),
    usersRepo.countPendingCustomers(actor),
    subscriptionsRepo.countActiveCustomers(db, actor.userId),
    productsRepo.listRoundExtras(actor, today),
    productsRepo.countPendingOrders(actor),
  ]);

  const summary = round?.summary ?? { total: 0, delivered: 0, skipped: 0, undelivered: 0, litres: 0 };
  const remaining = Math.max(
    0,
    (summary.total ?? 0) - (summary.delivered ?? 0) - (summary.skipped ?? 0) - (summary.undelivered ?? 0),
  );
  const progressPercent = summary.total > 0
    ? Math.round(((summary.total - remaining) / summary.total) * 100)
    : 0;

  const left = daysRemaining(actor.saas);
  const limit = actor.saas?.customerLimit;
  const nearLimit = limit ? (customerCount ?? 0) >= limit * 0.8 : false;

  const billedPaise = earnings?.billedPaise ?? 0;
  const collectedPaise = earnings?.collectedPaise ?? 0;
  const pendingDuePaise = Math.max(0, billedPaise - collectedPaise);
  const reqs = requests ?? { total: 0, quantity: 0, plan: 0 };
  const extras = Array.isArray(todayExtras) ? todayExtras : [];

  // Aggregate extras by product for quick vehicle load checklist
  const extraTotalsMap = {};
  for (const item of extras) {
    const key = `${item.productName}_${item.unit}`;
    if (!extraTotalsMap[key]) {
      extraTotalsMap[key] = {
        productName: item.productName,
        unit: item.unit,
        totalQty: 0,
        orderCount: 0,
      };
    }
    extraTotalsMap[key].totalQty += Number(item.quantity);
    extraTotalsMap[key].orderCount += 1;
  }
  const aggregatedExtras = Object.values(extraTotalsMap);

  return (
    <div className="space-y-7">
      <HeroBanner
        eyebrow={`Today · ${formatDate(today)}`}
        greeting={greeting()}
        name={actor.name?.split(' ')[0] ?? 'there'}
        subtitle={
          remaining > 0
            ? `${remaining} stops pending delivery on today's round${extras.length > 0 ? ` · ${extras.length} extra product order${extras.length === 1 ? '' : 's'} (Paneer, Ghee, etc.)` : ''}`
            : `All ${summary.total} stops completed for today.`
        }
        action={<HeroAction href="/milkman/round">{remaining > 0 ? 'Start Round' : 'View Round'}</HeroAction>}
      />

      <PushNotificationPrompt role="milkman" />

      {/* ── PSYCHOLOGY-DRIVEN GUIDED NEXT ACTION BANNER ─────────────────── */}
      {pendingCustomers > 0 ? (
        <NextActionCard
          stepNumber="!"
          tone="amber"
          title={`${pendingCustomers} New Customer Approval${pendingCustomers === 1 ? '' : 's'} Waiting`}
          description="New households have requested to subscribe to your dairy. Review and accept them to start delivery tomorrow."
          actionText="Review Customers"
          actionHref="/milkman/customers?status=PENDING"
        />
      ) : pendingOrdersCount > 0 ? (
        <NextActionCard
          icon={<PackageIcon className="h-5 w-5 text-blue-600" />}
          tone="blue"
          title={`${pendingOrdersCount} New Extra Item Order${pendingOrdersCount === 1 ? '' : 's'} to Review`}
          description="Customers ordered paneer, curd, or ghee for delivery. Accept them so they ride along on the round."
          actionText="View Orders"
          actionHref="/milkman/orders"
        />
      ) : reqs.total > 0 ? (
        <NextActionCard
          stepNumber="!"
          tone="blue"
          title={`${reqs.total} Customer Request${reqs.total === 1 ? '' : 's'} to Resolve`}
          description="Customers have submitted quantity or plan change requests for upcoming deliveries."
          actionText="View Requests"
          actionHref="/milkman/requests"
        />
      ) : remaining > 0 ? (
        <NextActionCard
          icon={<SunIcon className="h-5 w-5 text-emerald-600" />}
          tone="emerald"
          title="Morning Delivery Round in Progress"
          description={`${summary.delivered} delivered out of ${summary.total} stops (${progressPercent}% completed).`}
          actionText="Open Delivery Sheet"
          actionHref="/milkman/round"
        />
      ) : null}

      {/* ── TODAY'S EXTRAS PACKING SUMMARY (PANEER / GHEE / CURD / ETC.) ─────── */}
      {extras.length > 0 ? (
        <div className="rounded-3xl border-2 border-amber-300 bg-linear-to-r from-amber-50/95 via-orange-50/60 to-amber-50/95 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <PackageIcon className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-base sm:text-lg font-black text-amber-950">
                    Vehicle Packing & Products Load List
                  </h3>
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-900">
                    {extras.length} order{extras.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-amber-900/80 mt-0.5">
                  Pack these items in your carry bag before heading out for the round:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/milkman/orders"
                className="tap font-heading text-xs font-bold text-amber-900 bg-white border border-amber-300 px-3.5 py-2 rounded-xl hover:bg-amber-100 transition-all shadow-2xs"
              >
                All Orders →
              </Link>
            </div>
          </div>

          {/* Aggregated totals chips */}
          {aggregatedExtras.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-amber-100/70 p-3 border border-amber-200">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 self-center mr-1">
                Total to pack:
              </span>
              {aggregatedExtras.map((agg) => (
                <span
                  key={`${agg.productName}_${agg.unit}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1 font-heading text-xs font-black text-amber-950 shadow-2xs border border-amber-200"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{agg.totalQty} {agg.unit}</span>
                  <span className="text-slate-700">{agg.productName}</span>
                  <span className="text-[10px] font-bold text-amber-700">({agg.orderCount} stops)</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Customer delivery list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {extras.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-white border border-amber-200/90 p-3.5 shadow-2xs hover:border-amber-400 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-heading text-xs font-bold text-slate-950 truncate">
                      {item.customerName}
                    </p>
                    {item.customerPhone ? (
                      <a
                        href={`tel:${item.customerPhone}`}
                        aria-label={`Call ${item.customerName}`}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        Call
                      </a>
                    ) : null}
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                    {item.deliveryAddress || 'Doorstep drop'}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-900 border border-amber-200/60">
                    <span>{Number(item.quantity)} {item.unit}</span>
                    <span>{item.productName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {left <= 3 ? (
        <Notice
          tone={left <= 1 ? 'critical' : 'caution'}
          title={`${left} day${left === 1 ? '' : 's'} left on your ${actor.saas?.status === 'TRIAL' ? 'trial' : 'plan'}`}
          action={
            <Link href="/milkman/membership">
              <Button size="sm">Renew Membership</Button>
            </Link>
          }
        >
          Your panel closes when it ends. Your customers and history are kept safely.
        </Notice>
      ) : null}

      {nearLimit ? (
        <Notice
          tone="caution"
          title={`${customerCount} of ${limit} customer capacity used`}
          action={
            <Link href="/milkman/membership">
              <Button size="sm" variant="outline">Upgrade Plan</Button>
            </Link>
          }
        >
          You are close to your subscription capacity. Upgrade to add more households.
        </Notice>
      ) : null}

      {/* ── Today's Round Status & Progress Bar ─────────────────────────── */}
      <div className="rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <TruckIcon className="h-4 w-4" />
              </span>
              <h2 className="font-heading text-lg font-black tracking-tight text-slate-900">
                Today's Delivery Round
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 border border-blue-200">
                {formatDate(today)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {remaining > 0 ? `${remaining} stops left to deliver` : 'Morning round 100% completed'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <DayOffButton date={today} count={remaining} />
            <Link href="/milkman/round">
              <button
                type="button"
                className="tap inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                <span>{remaining > 0 ? 'Open Round' : 'View Sheet'}</span>
                <span>→</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Live Delivery Progress Bar */}
        {summary.total > 0 ? (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Delivery Progress</span>
              <span className="text-blue-600">{progressPercent}% Completed</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<RoutesIcon className="h-5 w-5" />} tone="info" label="Total Stops" value={summary.total} />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            tone="positive"
            label="Delivered"
            value={summary.delivered}
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
          <Stat
            icon={<MilkDropIcon className="h-5 w-5" />}
            tone="brand"
            label="Milk Out"
            value={formatMilli(Math.round(Number(summary.litres) * 1000))}
            hint={extras.length > 0 ? `+ ${extras.length} extra product${extras.length === 1 ? '' : 's'} (Paneer, etc.)` : undefined}
          />
        </div>
      </div>

      {/* ── Monthly Financial Overview ──────────────────────────────────── */}
      <section aria-labelledby="money-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="money-heading" className="font-heading text-sm font-extrabold uppercase tracking-wider text-slate-500">
            This Month's Financials
          </h2>
          <Link href="/milkman/earnings" className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700">
            View Ledger →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<PaymentsIcon className="h-5 w-5" />} tone="brand" label="Total Billed" value={formatPaise(billedPaise, { whole: true })} />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            tone="positive"
            label="Collected"
            value={formatPaise(collectedPaise, { whole: true })}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            tone="caution"
            label="Pending Due"
            value={formatPaise(pendingDuePaise, { whole: true })}
          />
          <Stat
            icon={<UsersIcon className="h-5 w-5" />}
            tone={nearLimit ? 'caution' : 'info'}
            label="Active Customers"
            value={limit ? `${customerCount} / ${limit}` : customerCount}
          />
        </div>
      </section>

      {/* ── Pending Tasks & Attention ───────────────────────────────────── */}
      {reqs.total > 0 || pendingCustomers > 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-3">
          <h3 className="font-heading text-base font-black text-slate-900">
            Requires Your Attention
          </h3>
          <div className="space-y-2">
            {pendingCustomers > 0 ? (
              <ActionRow
                href="/milkman/customers?status=PENDING"
                badge={`${pendingCustomers} new`}
                label={`${pendingCustomers} customer${pendingCustomers === 1 ? '' : 's'} waiting for approval`}
              />
            ) : null}
            {reqs.quantity > 0 ? (
              <ActionRow
                href="/milkman/requests"
                badge={`${reqs.quantity} requests`}
                label={`${reqs.quantity} quantity change${reqs.quantity === 1 ? '' : 's'} to answer`}
              />
            ) : null}
            {reqs.plan > 0 ? (
              <ActionRow
                href="/milkman/requests"
                badge={`${reqs.plan} requests`}
                label={`${reqs.plan} plan change${reqs.plan === 1 ? '' : 's'} to answer`}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionRow({ href, label, badge }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-slate-200/80 p-3.5 sm:px-4 text-sm font-semibold transition-all hover:border-blue-300 hover:bg-blue-50/50"
    >
      <span className="text-slate-900 font-heading text-xs sm:text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {badge ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
            {badge}
          </span>
        ) : null}
        <span aria-hidden="true" className="text-slate-400">→</span>
      </div>
    </Link>
  );
}
