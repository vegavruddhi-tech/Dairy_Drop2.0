import Link from 'next/link';

import { requireCustomer } from '@/auth/session.js';
import { businessDate, greeting, formatDate, businessMonth } from '@/domain/dates.js';
import { formatPaise, formatMilli } from '@/domain/money.js';
import { getLocale, getGreeting } from '@/i18n/server.js';
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
import { PushNotificationPrompt } from '@/components/ui/PushNotificationPrompt.jsx';

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
  const locale = await getLocale();
  const isHi = locale === 'hi';

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

  const greetingText = await getGreeting(new Date().getHours());

  return (
    <div className="space-y-7">
      <HeroBanner
        eyebrow={`${isHi ? 'आज' : 'Today'} · ${formatDate(today)}`}
        greeting={greetingText || (isHi ? 'नमस्ते' : greeting())}
        name={actor.name?.split(' ')[0] ?? (isHi ? 'ग्राहक' : 'there')}
        subtitle={isHi ? 'हर सुबह आपके दरवाजे पर शुद्ध फार्म फ्रेश दूध' : 'Pure Farm Fresh Milk Delivered to Your Doorstep Every Morning'}
        action={
          <HeroAction href="/subscriptions">
            {isHi ? 'मेरी सदस्यता' : 'My Subscriptions'}
          </HeroAction>
        }
      />

      <PushNotificationPrompt role="customer" />

      {/* ── PSYCHOLOGY-DRIVEN GUIDED NEXT ACTION BANNER ─────────────────── */}
      {subscriptions.length === 0 ? (
        <NextActionCard
          stepNumber="01"
          tone="blue"
          title={isHi ? 'अपना दैनिक दूध प्लान चुनें' : 'Choose your Daily Milk Plan'}
          description={
            isHi
              ? 'आपके पास अभी कोई सक्रिय सदस्यता नहीं है। सुबह की डोरस्टेप डिलीवरी शुरू करने के लिए गाय या भैंस का शुद्ध दूध और दैनिक मात्रा चुनें।'
              : "You don't have an active subscription yet. Select pure cow or buffalo milk and daily quantity to start morning doorstep deliveries."
          }
          actionText={isHi ? 'दूध प्लान चुनें' : 'Select Milk Plan'}
          actionHref="/subscriptions"
        />
      ) : bill.balancePaise > 0 ? (
        <NextActionCard
          icon={<PaymentsIcon className="h-5 w-5 text-amber-700" />}
          tone="amber"
          title={`${isHi ? 'मासिक बिल देय' : 'Monthly Bill Due'}: ${formatPaise(bill.balancePaise)}`}
          description={
            isHi
              ? `${milkman?.businessName ?? 'अपनी डेयरी'} को सीधे UPI QR कोड से भुगतान करें और 1-टैप में दर्ज करें।`
              : `Pay ${milkman?.businessName ?? 'your milkman'} directly via UPI QR code and record payment in 1-tap.`
          }
          actionText={isHi ? 'UPI से अभी भरें' : 'Pay Now with UPI'}
          actionHref="/billing"
        />
      ) : paused.length > 0 && active.length === 0 ? (
        <NextActionCard
          icon={<CalendarIcon className="h-5 w-5 text-amber-700" />}
          tone="amber"
          title={isHi ? 'आपकी दूध डिलीवरी अभी रोकी गई है' : 'Your Milk Deliveries are Currently Paused'}
          description={
            isHi
              ? 'अवकाश (छुट्टी) मोड सक्रिय है। जब भी वापस आएं सुबह की डिलीवरी फिर से चालू करने के लिए सदस्यता प्रबंधित करें।'
              : 'Vacation mode is active. Resume your subscription whenever you are back to restart morning deliveries.'
          }
          actionText={isHi ? 'सदस्यता प्रबंधित करें' : 'Manage Subscriptions'}
          actionHref="/subscriptions"
        />
      ) : null}

      {/* ── Today's Scheduled Delivery ──────────────────────────────────── */}
      <section aria-labelledby="today-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 id="today-heading" className="font-heading text-sm font-extrabold uppercase tracking-wider text-slate-500">
              {isHi ? 'आज की डिलीवरी' : "Today's Delivery"} · {formatDate(today)}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isHi ? 'दैनिक डोरस्टेप डिलीवरी समय: 6:00 AM – 7:30 AM' : 'Daily doorstep arrival window: 6:00 AM – 7:30 AM'}
            </p>
          </div>
          {active.length > 0 && <CalendarVacationButton />}
        </div>

        {deliveries.length === 0 ? (
          active.length > 0 ? (
            <EmptyState
              icon={<DeliveryIcon className="h-8 w-8 text-blue-600" />}
              title={isHi ? 'आज के लिए कुछ भी निर्धारित नहीं है' : 'Nothing scheduled for today'}
              description={
                isHi
                  ? 'आपका प्लान सक्रिय है। आज का राउंड डिलीवरी से ठीक पहले तैयार किया जाता है, या आज डिलीवरी का दिन नहीं है।'
                  : "Your plan is active. Today's round is drawn up shortly before delivery, or today is not a scheduled delivery day."
              }
              action={
                <Link href="/subscriptions">
                  <Button variant="secondary">{isHi ? 'मेरा प्लान देखें' : 'View My Plan'}</Button>
                </Link>
              }
            />
          ) : paused.length > 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-8 w-8 text-amber-500" />}
              title={isHi ? 'आपका प्लान वर्तमान में रुका हुआ है' : 'Your plan is currently paused'}
              description={
                isHi
                  ? 'इसे पुनः चालू करें और कल सुबह से आपका ताज़ा दूध आने लगेगा।'
                  : 'Resume it and your fresh milk starts arriving from tomorrow morning.'
              }
              action={
                <Link href="/subscriptions">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isHi ? 'प्लान पुनः चालू करें' : 'Resume Plan'}
                  </Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<MilkDropIcon className="h-8 w-8 text-blue-600" />}
              title={isHi ? 'आज कोई सक्रिय दूध डिलीवरी नहीं है' : 'No active milk delivery today'}
              description={
                isHi
                  ? 'हर सुबह ताज़ा दूध पाने के लिए स्थानीय डेयरी प्लान सब्सक्राइब करें।'
                  : 'Subscribe to a local dairy plan to enjoy fresh milk every morning.'
              }
              action={
                <Link href="/subscriptions">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isHi ? 'दूध प्लान्स देखें' : 'Browse Milk Plans'}
                  </Button>
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
            {isHi ? 'इस महीने का सारांश' : 'This Month Summary'}
          </h2>
          <Link href="/billing" className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700">
            {isHi ? 'पूरा बिल देखें →' : 'View Full Bill →'}
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
            label={isHi ? 'डिलीवर हुआ' : 'Delivered'}
            value={`${bill.deliveredDays} ${isHi ? 'दिन' : 'days'}`}
          />
          <Stat
            icon={<MilkDropIcon className="h-5 w-5" />}
            tone="info"
            label={isHi ? 'कुल दूध' : 'Total Milk'}
            value={formatMilli(bill.deliveredMilli)}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            tone="neutral"
            label={isHi ? 'छुट्टी (₹0)' : 'Skipped (₹0)'}
            value={`${bill.skippedDays} ${isHi ? 'दिन' : 'days'}`}
            hint={isHi ? 'कोई शुल्क नहीं' : 'Not charged'}
          />
          <Stat
            icon={<PaymentsIcon className="h-5 w-5" />}
            tone="brand"
            label={isHi ? 'अब तक का बिल' : 'Bill So Far'}
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
                  {isHi ? 'ताज़ा डेयरी अतिरिक्त उत्पाद' : 'Fresh Dairy Extras'}
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  {isHi ? 'डोरस्टेप डिलीवरी' : 'Doorstep Delivery'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isHi ? 'कल सुबह के दूध के साथ आने वाले अतिरिक्त उत्पाद ऑर्डर करें' : "Order extras your milkman brings alongside tomorrow's milk"}
              </p>
            </div>
            <Link
              href="/shop"
              className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>{isHi ? `सभी देखें (${products.length})` : `See all (${products.length})`}</span>
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
