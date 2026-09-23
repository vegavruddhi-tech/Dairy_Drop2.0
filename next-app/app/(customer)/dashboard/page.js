import Link from 'next/link';

import { requireCustomer } from '@/auth/session.js';
import { businessDate, greeting, formatDate, businessMonth } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import * as deliveryService from '@/services/delivery.service.js';
import * as billingService from '@/services/billing.service.js';
import * as productService from '@/services/product.service.js';
import * as subscriptionService from '@/services/subscription.service.js';
import * as usersRepo from '@/repositories/users.repo.js';

import {
  Card, CardBody, CardHeader, Stat, EmptyState, StatusBadge, Notice,
  HeroBanner, HeroAction,
} from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { TodayCard } from '@/components/customer/TodayCard.jsx';

export const metadata = { title: 'Today' };

export default async function CustomerDashboard() {
  const actor = await requireCustomer();
  const today = businessDate();

  const [{ deliveries }, bill, products, milkman, subscriptions] = await Promise.all([
    deliveryService.getCustomerDay(actor, today),
    billingService.getBill(actor, { month: businessMonth() }),
    productService.listForCustomer(actor),
    usersRepo.findMilkmanPaymentInfo(actor.tenantId),
    subscriptionService.listMine(actor),
  ]);

  /*
   * "No delivery today" and "no plan" are different states, and conflating them
   * told a subscribed customer to go and subscribe.
   *
   * A delivery row only exists once `generate-deliveries` has run for the day,
   * so between subscribing and the next run there is an active plan and no row.
   * A paused plan produces no rows either. Branch on the plan, not on the row.
   */
  const active = subscriptions.filter((s) => s.status === 'ACTIVE');
  const paused = subscriptions.filter((s) => s.status === 'PAUSED');

  return (
    <>
      <HeroBanner
        eyebrow={formatDate(today)}
        greeting={greeting()}
        name={actor.name?.split(' ')[0] ?? 'there'}
        subtitle="Pure, direct from the farm"
        action={<HeroAction href="/subscriptions">My plan</HeroAction>}
      />

      {/* ── Today ─────────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-3 text-sm font-semibold text-ink">
          {formatDate(today)}
        </h2>

        {deliveries.length === 0 ? (
          active.length > 0 ? (
            <EmptyState
              icon="🌙"
              title="Nothing scheduled for today"
              description={
                `Your plan is active. Today's round has not been drawn up yet — ` +
                `it is prepared shortly after midnight, or today may not be a ` +
                `delivery day for your plan.`
              }
              action={
                <Link href="/subscriptions">
                  <Button variant="secondary">See my plan</Button>
                </Link>
              }
            />
          ) : paused.length > 0 ? (
            <EmptyState
              icon="⏸"
              title="Your plan is paused"
              description="Resume it and your milk starts arriving again from the next round."
              action={
                <Link href="/subscriptions">
                  <Button>Resume my plan</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="🥛"
              title="No delivery scheduled today"
              description="Subscribe to a plan and your milk will arrive every morning."
              action={
                <Link href="/subscriptions">
                  <Button>Browse plans</Button>
                </Link>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {deliveries.map((delivery) => (
              <TodayCard key={delivery.id} delivery={delivery} />
            ))}
          </div>
        )}
      </section>

      {/* ── This month ────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="month-heading">
        <h2 id="month-heading" className="mb-3 text-sm font-semibold text-ink">
          This month so far
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="✓" tone="positive" label="Delivered" value={`${bill.deliveredDays} days`} />
          <Stat icon="🥛" tone="info" label="Milk" value={formatMilli(bill.deliveredMilli)} />
          <Stat icon="⤳" tone="neutral" label="Skipped" value={`${bill.skippedDays} days`} hint="Not charged" />
          <Stat
            icon="₹"
            tone="brand"
            label="Bill so far"
            value={formatPaise(bill.totalPaise, { whole: true })}
          />
        </div>

        {bill.balancePaise > 0 ? (
          <div className="mt-3">
            <Notice
              tone="caution"
              title={`${formatPaise(bill.balancePaise)} outstanding`}
              action={
                <Link href="/billing">
                  <Button size="sm">Pay now</Button>
                </Link>
              }
            >
              Pay {milkman?.businessName ?? 'your milkman'} by UPI and record it here.
            </Notice>
          </div>
        ) : null}
      </section>

      {/* ── Catalog ───────────────────────────────────────────────────── */}
      {products.length > 0 ? (
        <section aria-labelledby="shop-heading">
          <Card>
            <CardHeader
              title="Fresh today"
              description="Extras your milkman can bring with tomorrow's milk"
              action={
                <Link href="/shop" className="text-sm font-medium text-brand">
                  See all
                </Link>
              }
            />
            <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {products.slice(0, 4).map((product) => (
                <Link
                  key={product.id}
                  href="/shop"
                  className="rounded-xl border border-border p-3 transition-colors hover:bg-surface-muted"
                >
                  <p className="text-sm font-medium text-ink">{product.name}</p>
                  <p className="mt-1 text-sm tnum text-ink-muted">
                    ₹{Number(product.pricePerUnit)} / {product.unit}
                  </p>
                </Link>
              ))}
            </CardBody>
          </Card>
        </section>
      ) : null}
    </>
  );
}
