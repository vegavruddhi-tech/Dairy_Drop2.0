import Link from 'next/link';

import { requireMilkman } from '@/auth/session.js';
import { businessDate, businessMonth, formatDate } from '@/domain/dates.js';
import { getT, getGreeting, getLocale } from '@/i18n/server.js';
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
  const t = await getT();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const greet = await getGreeting();

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
        eyebrow={`${isHi ? 'आज' : t('common.today', {}, 'Today')} · ${formatDate(today)}`}
        greeting={greet}
        name={actor.name?.split(' ')[0] ?? 'there'}
        subtitle={
          remaining > 0
            ? isHi
              ? `आज के राउंड में ${remaining} स्टॉप्स डिलीवरी के लिए बाकी हैं${extras.length > 0 ? ` · ${extras.length} अतिरिक्त उत्पाद ऑर्डर` : ''}`
              : `${remaining} ${t('dashboard.pendingDeliveries', {}, 'stops pending delivery on today\'s round')}${extras.length > 0 ? ` · ${extras.length} ${t('dashboard.addFarmProducts', {}, 'extra product orders')}` : ''}`
            : isHi
              ? 'आज के सभी स्टॉप्स पूरे हो गए हैं।'
              : t('dashboard.todaysOverview', {}, 'All stops completed for today.')
        }
        action={
          <HeroAction href="/milkman/round">
            {remaining > 0
              ? isHi
                ? 'राउंड शुरू करें'
                : t('dashboard.markAllDelivered', {}, 'Start Round')
              : isHi
                ? 'राउंड देखें'
                : t('deliveries.title', {}, 'View Round')}
          </HeroAction>
        }
      />

      <PushNotificationPrompt role="milkman" />

      {/* ── PSYCHOLOGY-DRIVEN GUIDED NEXT ACTION BANNER ─────────────────── */}
      {pendingCustomers > 0 ? (
        <NextActionCard
          stepNumber="!"
          tone="amber"
          title={
            isHi
              ? `${pendingCustomers} नए ग्राहकों की स्वीकृति बाकी है`
              : `${pendingCustomers} ${t('customers.pendingApprovals', {}, 'New Customer Approvals Waiting')}`
          }
          description={
            isHi
              ? 'नए परिवारों ने आपकी डेयरी से जुड़ने का अनुरोध किया है। कल से डिलीवरी शुरू करने के लिए उनकी समीक्षा करें और स्वीकार करें।'
              : t('customers.subtitle', {}, 'New households have requested to subscribe to your dairy. Review and accept them to start delivery tomorrow.')
          }
          actionText={isHi ? 'ग्राहकों की समीक्षा करें' : t('customers.pendingApprovals', {}, 'Review Customers')}
          actionHref="/milkman/customers?status=PENDING"
        />
      ) : pendingOrdersCount > 0 ? (
        <NextActionCard
          icon={<PackageIcon className="h-5 w-5 text-blue-600" />}
          tone="blue"
          title={
            isHi
              ? `${pendingOrdersCount} नए अतिरिक्त उत्पाद ऑर्डर जांचने के लिए`
              : `${pendingOrdersCount} ${t('shop.myOrders', {}, 'New Extra Item Orders to Review')}`
          }
          description={
            isHi
              ? 'ग्राहकों ने डिलीवरी के लिए पनीर, दही या घी का ऑर्डर दिया है। उन्हें स्वीकार करें ताकि वे राउंड में साथ जा सकें।'
              : t('shop.subtitle', {}, 'Customers ordered paneer, curd, or ghee for delivery. Accept them so they ride along on the round.')
          }
          actionText={isHi ? 'ऑर्डर देखें' : t('nav.orders', {}, 'View Orders')}
          actionHref="/milkman/orders"
        />
      ) : reqs.total > 0 ? (
        <NextActionCard
          stepNumber="!"
          tone="blue"
          title={
            isHi
              ? `${reqs.total} ग्राहकों के अनुरोध हल करने के लिए`
              : `${reqs.total} ${t('planRequests.title', {}, 'Customer Requests to Resolve')}`
          }
          description={
            isHi
              ? 'ग्राहकों ने आगामी डिलीवरी के लिए मात्रा या प्लान बदलने का अनुरोध भेजा है।'
              : t('planRequests.subtitle', {}, 'Customers have submitted quantity or plan change requests for upcoming deliveries.')
          }
          actionText={isHi ? 'अनुरोध देखें' : t('nav.requests', {}, 'View Requests')}
          actionHref="/milkman/requests"
        />
      ) : remaining > 0 ? (
        <NextActionCard
          icon={<SunIcon className="h-5 w-5 text-emerald-600" />}
          tone="emerald"
          title={isHi ? 'सुबह का डिलीवरी राउंड जारी है' : t('dashboard.dailyDeliveriesProgress', {}, 'Morning Delivery Round in Progress')}
          description={
            isHi
              ? `${summary.delivered} डिलीवर / ${summary.total} कुल स्टॉप (${progressPercent}%).`
              : `${summary.delivered} ${t('common.delivered', {}, 'delivered')} / ${summary.total} ${t('deliveries.allDeliveries', {}, 'stops')} (${progressPercent}%).`
          }
          actionText={isHi ? 'डिलीवरी सूची खोलें' : t('deliveries.deliveryList', {}, 'Open Delivery Sheet')}
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
                    {isHi ? 'गाड़ी में लोड करने और पैक करने की सूची' : t('deliveries.productOrders', {}, 'Vehicle Packing & Products Load List')}
                  </h3>
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-900">
                    {extras.length} {isHi ? 'ऑर्डर' : t('nav.orders', {}, 'orders')}
                  </span>
                </div>
                <p className="text-xs font-semibold text-amber-900/80 mt-0.5">
                  {isHi
                    ? 'राउंड पर निकलने से पहले इन वस्तुओं को अपने थैले / क्रेट में पैक करें:'
                    : t('dashboard.addFarmProducts', {}, 'Pack these items in your carry bag before heading out for the round')}:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/milkman/orders"
                className="tap font-heading text-xs font-bold text-amber-900 bg-white border border-amber-300 px-3.5 py-2 rounded-xl hover:bg-amber-100 transition-all shadow-2xs"
              >
                {isHi ? 'सभी ऑर्डर' : t('common.viewAll', {}, 'All Orders')} →
              </Link>
            </div>
          </div>

          {/* Aggregated totals chips */}
          {aggregatedExtras.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-amber-100/70 p-3 border border-amber-200">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 self-center mr-1">
                {isHi ? 'कुल पैकिंग' : t('common.total', {}, 'Total to pack')}:
              </span>
              {aggregatedExtras.map((agg) => (
                <span
                  key={`${agg.productName}_${agg.unit}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1 font-heading text-xs font-black text-amber-950 shadow-2xs border border-amber-200"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{agg.totalQty} {agg.unit}</span>
                  <span className="text-slate-700">{agg.productName}</span>
                  <span className="text-[10px] font-bold text-amber-700">({agg.orderCount} {isHi ? 'स्टॉप्स' : 'stops'})</span>
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
                        {isHi ? 'कॉल करें' : t('common.call', {}, 'Call')}
                      </a>
                    ) : null}
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                    {item.deliveryAddress || (isHi ? 'घर पर डिलीवरी' : t('subscriptions.doorstepScheduled', {}, 'Doorstep drop'))}
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
          title={
            isHi
              ? `आपके प्लान में ${left} दिन शेष हैं`
              : `${left} ${t('common.date', {}, 'days')} ${t('auth.trialExpired', {}, 'left on your plan')}`
          }
          action={
            <Link href="/milkman/membership">
              <Button size="sm">{isHi ? 'सदस्यता रिन्यू करें' : t('plans.upgradePlan', {}, 'Renew Membership')}</Button>
            </Link>
          }
        >
          {isHi
            ? 'प्लान समाप्त होने पर आपका पैनल बंद हो जाएगा। आपके ग्राहक और पुराना डेटा सुरक्षित रहेगा।'
            : t('auth.securityDesc', {}, 'Your panel closes when it ends. Your customers and history are kept safely.')}
        </Notice>
      ) : null}

      {nearLimit ? (
        <Notice
          tone="caution"
          title={
            isHi
              ? `${customerCount} / ${limit} ग्राहक क्षमता उपयोग में`
              : `${customerCount} / ${limit} ${t('customers.totalCustomers', {}, 'capacity used')}`
          }
          action={
            <Link href="/milkman/membership">
              <Button size="sm" variant="outline">{isHi ? 'प्लान अपग्रेड करें' : t('plans.upgradePlan', {}, 'Upgrade Plan')}</Button>
            </Link>
          }
        >
          {isHi
            ? 'आप अपनी ग्राहक क्षमता सीमा के करीब हैं। अधिक परिवारों को जोड़ने के लिए प्लान अपग्रेड करें।'
            : t('subscriptions.maxPlansNotice', {}, 'You are close to your subscription capacity. Upgrade to add more households.')}
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
                {isHi ? 'आज का डिलीवरी राउंड' : t('dashboard.todayDelivery', {}, "Today's Delivery Round")}
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 border border-blue-200">
                {formatDate(today)}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {remaining > 0
                ? isHi
                  ? `${remaining} स्टॉप्स डिलीवरी के लिए बाकी हैं`
                  : `${remaining} ${t('dashboard.pendingDeliveries', {}, 'stops left to deliver')}`
                : isHi
                  ? 'सुबह का राउंड 100% पूरा हो गया है'
                  : t('dashboard.todaysOverview', {}, 'Morning round 100% completed')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <DayOffButton date={today} count={remaining} />
            <Link href="/milkman/round">
              <button
                type="button"
                className="tap inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                <span>
                  {remaining > 0
                    ? isHi
                      ? 'राउंड खोलें'
                      : t('deliveries.title', {}, 'Open Round')
                    : isHi
                      ? 'शीट देखें'
                      : t('common.details', {}, 'View Sheet')}
                </span>
                <span>→</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Live Delivery Progress Bar */}
        {summary.total > 0 ? (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>{isHi ? 'डिलीवरी प्रगति' : t('dashboard.dailyDeliveriesProgress', {}, 'Delivery Progress')}</span>
              <span className="text-blue-600">
                {progressPercent}% {isHi ? 'पूर्ण' : t('common.delivered', {}, 'Completed')}
              </span>
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
          <Stat
            icon={<RoutesIcon className="h-5 w-5" />}
            tone="info"
            label={isHi ? 'कुल स्टॉप्स' : t('deliveries.allDeliveries', {}, 'Total Stops')}
            value={summary.total}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            tone="positive"
            label={isHi ? 'डिलीवर किया' : t('common.delivered', {}, 'Delivered')}
            value={summary.delivered}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            tone={remaining > 0 ? 'caution' : 'neutral'}
            label={isHi ? 'बाकी' : t('deliveries.pendingOnly', {}, 'Remaining')}
            value={remaining}
          />
          <Stat
            icon={<MilkDropIcon className="h-5 w-5" />}
            tone="brand"
            label={isHi ? 'कुल दूध' : t('dashboard.totalMilkRequired', {}, 'Milk Out')}
            value={formatMilli(Math.round(Number(summary.litres) * 1000))}
            hint={extras.length > 0 ? (isHi ? `+ ${extras.length} अतिरिक्त उत्पाद` : `+ ${extras.length} ${t('shop.dairyCategory', {}, 'extras')}`) : undefined}
          />
        </div>
      </div>

      {/* ── Monthly Financial Overview ──────────────────────────────────── */}
      <section aria-labelledby="money-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="money-heading" className="font-heading text-sm font-extrabold uppercase tracking-wider text-slate-500">
            {isHi ? 'इस महीने का वित्तीय विवरण' : t('earnings.title', {}, "This Month's Financials")}
          </h2>
          <Link href="/milkman/earnings" className="font-heading text-xs font-bold text-blue-600 hover:text-blue-700">
            {isHi ? 'खाता / बहीखाता देखें' : t('earnings.customerStatements', {}, 'View Ledger')} →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={<PaymentsIcon className="h-5 w-5" />}
            tone="brand"
            label={isHi ? 'कुल बिल (Billed)' : t('earnings.monthlyRevenue', {}, 'Total Billed')}
            value={formatPaise(billedPaise, { whole: true })}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
            tone="positive"
            label={isHi ? 'प्राप्त (Collected)' : t('earnings.cashCollected', {}, 'Collected')}
            value={formatPaise(collectedPaise, { whole: true })}
          />
          <Stat
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            tone="caution"
            label={isHi ? 'बाकी राशि (Pending Due)' : t('earnings.pendingDues', {}, 'Pending Due')}
            value={formatPaise(pendingDuePaise, { whole: true })}
          />
          <Stat
            icon={<UsersIcon className="h-5 w-5" />}
            tone={nearLimit ? 'caution' : 'info'}
            label={isHi ? 'सक्रिय ग्राहक' : t('customers.totalCustomers', {}, 'Active Customers')}
            value={limit ? `${customerCount} / ${limit}` : customerCount}
          />
        </div>
      </section>

      {/* ── Pending Tasks & Attention ───────────────────────────────────── */}
      {reqs.total > 0 || pendingCustomers > 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-3">
          <h3 className="font-heading text-base font-black text-slate-900">
            {isHi ? 'आपके ध्यान की आवश्यकता है' : t('dashboard.quickDeliveryActions', {}, 'Requires Your Attention')}
          </h3>
          <div className="space-y-2">
            {pendingCustomers > 0 ? (
              <ActionRow
                href="/milkman/customers?status=PENDING"
                badge={isHi ? `${pendingCustomers} नए` : `${pendingCustomers} ${t('common.pending', {}, 'new')}`}
                label={
                  isHi
                    ? `${pendingCustomers} ग्राहकों की स्वीकृति बाकी है`
                    : `${pendingCustomers} ${t('customers.pendingApprovals', {}, 'customers waiting for approval')}`
                }
              />
            ) : null}
            {reqs.quantity > 0 ? (
              <ActionRow
                href="/milkman/requests"
                badge={isHi ? `${reqs.quantity} अनुरोध` : `${reqs.quantity} ${t('nav.requests', {}, 'requests')}`}
                label={
                  isHi
                    ? `${reqs.quantity} मात्रा परिवर्तन अनुरोधों का उत्तर दें`
                    : `${reqs.quantity} ${t('planRequests.requestedQty', {}, 'quantity changes to answer')}`
                }
              />
            ) : null}
            {reqs.plan > 0 ? (
              <ActionRow
                href="/milkman/requests"
                badge={isHi ? `${reqs.plan} अनुरोध` : `${reqs.plan} ${t('nav.requests', {}, 'requests')}`}
                label={
                  isHi
                    ? `${reqs.plan} प्लान परिवर्तन अनुरोधों का उत्तर दें`
                    : `${reqs.plan} ${t('planRequests.title', {}, 'plan changes to answer')}`
                }
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
