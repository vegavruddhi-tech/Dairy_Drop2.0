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
  Stat, EmptyState, NextActionCard,
  HeroBanner, HeroAction,
} from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { TodayCard } from '@/components/customer/TodayCard.jsx';
import { CalendarVacationButton } from '@/components/customer/CalendarAction.jsx';
import { OrderCard } from '@/components/customer/OrderCard.jsx';

import {
  DeliveryIcon,
  MilkDropIcon,
  PaymentsIcon,
  SubscriptionsIcon,
  CalendarIcon,
} from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Customer Dashboard' };

export default async function CustomerDashboard() {
  const actor = await requireCustomer();
  const today = businessDate();

  const [dayResult, billResult, productsResult, milkman, subscriptionsResult] = await Promise.all([
    deliveryService.getCustomerDay(actor, today).catch(() => ({ deliveries: [] })),
    billingService.getBill(actor, { month: businessMonth() }).catch(() => ({
      deliveredDays: 0,
      deliveredMilli: 0,
      skippedDays: 0,
      totalPaise: 0,
      balancePaise: 0,
    })),
    productService.listForCustomer(actor).catch(() => []),
    usersRepo.findMilkmanPaymentInfo(actor.tenantId).catch(() => null),
    subscriptionService.listMine(actor).catch(() => []),
  ]);

  const deliveries = dayResult?.deliveries ?? [];
  const bill = billResult ?? { deliveredDays: 0, deliveredMilli: 0, skippedDays: 0, totalPaise: 0, balancePaise: 0 };
  const products = productsResult ?? [];
  const subscriptions = subscriptionsResult ?? [];

  const active = subscriptions.filter((s) => s.status === 'ACTIVE');
  const paused = subscriptions.filter((s) => s.status === 'PAUSED');

  return (
    <div className="space-y-7">
      <HeroBanner
        eyebrow={`Today · ${formatDate(today)}`}
        greeting={greeting()}
        name={actor.name?.split(' ')[0] ?? 'there'}
        subtitle="Pure Farm Fresh Milk Delivered to Your Doorstep Every Morning"
        action={<HeroAction href="/subscriptions">My Subscriptions</HeroAction>}
      />

      {/* ── PSYCHOLOGY-DRIVEN GUIDED NEXT ACTION BANNER ─────────────────── */}
      {subscriptions.length === 0 ? (
        <NextActionCard
          stepNumber="01"
          tone="blue"
          title="Choose your Daily Milk Plan"
          description="You don't have an active subscription yet. Select pure cow or buffalo milk and daily quantity to start morning doorstep deliveries."
          actionText="Select Milk Plan"
          actionHref="/subscriptions"
        />
      ) : bill.balancePaise > 0 ? (
        <NextActionCard
          icon={<PaymentsIcon className="h-5 w-5 text-amber-700" />}
          tone="amber"
          title={`Monthly Bill Due: ${formatPaise(bill.balancePaise)}`}
          description={`Pay ${milkman?.businessName ?? 'your milkman'} directly via UPI QR code and record payment in 1-tap.`}
          actionText="Pay Now with UPI"
          actionHref="/billing"
        />
      ) : paused.length > 0 && active.length === 0 ? (
        <NextActionCard
          icon={<CalendarIcon className="h-5 w-5 text-amber-700" />}
          tone="amber"
          title="Your Milk Deliveries are Currently Paused"
          description="Vacation mode is active. Resume your subscription whenever you are back to restart morning deliveries."
          actionText="Manage Subscriptions"
          actionHref="/subscriptions"
        />
      ) : null}

      {/* ── Today's Scheduled Delivery ──────────────────────────────────── */}
      <section aria-labelledby="today-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 id="today-heading" className="font-heading text-sm font-extrabold uppercase tracking-wider text-slate-500">
              Today's Delivery · {formatDate(today)}
            </h2>
            <p className="text-xs text-slate-500 font-medium">Daily doorstep arrival window: 6:00 AM – 7:30 AM</p>
          </div>
          {active.length > 0 && <CalendarVacationButton />}
        </div>

        {deliveries.length === 0 ? (
          active.length > 0 ? (
            <EmptyState
              icon={<DeliveryIcon className="h-8 w-8 text-blue-600" />}
              title="Nothing scheduled for today"
              description={
                `Your plan is active. Today's round is drawn up shortly before delivery, or today is not a scheduled delivery day.`
              }
              action={
                <Link href="/subscriptions">
                  <Button variant="secondary">View My Plan</Button>
                </Link>
              }
            />
          ) : paused.length > 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-8 w-8 text-amber-500" />}
              title="Your plan is currently paused"
              description="Resume it and your fresh milk starts arriving from tomorrow morning."
              action={
                <Link href="/subscriptions">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Resume Plan</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<MilkDropIcon className="h-8 w-8 text-blue-600" />}
              title="No active milk delivery today"
              description="Subscribe to a local dairy plan to enjoy fresh milk every morning."
              action={
                <Link href="/subscriptions">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Browse Milk Plans</Button>
                </Link>
              }
            />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {deliveries.map((delivery) => (
              <TodayCard key={delivery.id} delivery={delivery} />
            ))}
          </div>
        )}
      </section>

      {/* ── This Month's Itemized Summary ───────────────────────────────── */}
      <section aria-labelledby="month-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="month-heading" className="font-heading text-sm font-extrabold uppercase tracking-wider text-slate-500">
            This Month Summary
          </h2>
          <Link href="/billing" className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700">
            View Full Bill →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            tone="positive"
            label="Delivered"
            value={`${bill.deliveredDays} days`}
          />
          <Stat icon={<MilkDropIcon className="h-5 w-5" />} tone="info" label="Total Milk" value={formatMilli(bill.deliveredMilli)} />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            tone="neutral"
            label="Skipped (₹0)"
            value={`${bill.skippedDays} days`}
            hint="Not charged"
          />
          <Stat
            icon={<PaymentsIcon className="h-5 w-5" />}
            tone="brand"
            label="Bill So Far"
            value={formatPaise(bill.totalPaise, { whole: true })}
          />
        </div>
      </section>

      {/* ── Fresh Extras Today / Doorstep Add-ons ───────────────────────── */}
      {products.length > 0 ? (
        <section aria-labelledby="shop-heading" className="pb-4">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="shop-heading" className="font-heading text-base font-extrabold text-slate-900">
                  Fresh Dairy Extras
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  Doorstep Delivery
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Order extras your milkman brings alongside tomorrow's milk
              </p>
            </div>
            <Link
              href="/shop"
              className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>See all ({products.length})</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <OrderCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
