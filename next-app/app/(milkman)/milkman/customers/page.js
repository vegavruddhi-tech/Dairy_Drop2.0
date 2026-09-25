import { requireMilkman } from '@/auth/session.js';
import { getT, getLocale } from '@/i18n/server.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import { db } from '@/db/index.js';

import { Card, CardBody, EmptyState, Notice, Stat } from '@/components/ui/index.jsx';
import { TabLinks } from '@/components/ui/interactive.jsx';
import { UsersIcon, RequestsIcon, MembershipIcon } from '@/components/ui/Icons.jsx';
import { ApprovalCard, CustomerRow } from '@/components/milkman/Customers.jsx';

export const metadata = { title: 'Customers' };

/**
 * The customer book.
 */
export default async function CustomersPage({ searchParams }) {
  const actor = await requireMilkman();
  const t = await getT();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const params = await searchParams;
  const status = params?.status === 'PENDING' || params?.tab === 'pending' ? 'PENDING' : 'APPROVED';

  const [customers, pendingCount, customerCount] = await Promise.all([
    usersRepo.listCustomers(actor, { status, limit: 200 }),
    usersRepo.countPendingCustomers(actor),
    subscriptionsRepo.countActiveCustomers(db, actor.userId),
  ]);

  const summaries = await subscriptionsRepo.summariseByCustomer(
    actor,
    customers.map((customer) => customer.id),
  );

  const limit = actor.saas?.customerLimit;
  const atLimit = limit ? customerCount >= limit : false;
  const usage = limit ? Math.min(100, Math.round((customerCount / limit) * 100)) : null;
  const slotsLeft = limit ? Math.max(0, limit - customerCount) : null;

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
                {isHi ? 'ग्राहक बहीखाता (Customer book)' : t('customers.customerBook', {}, 'Customer book')}
              </span>
              <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {isHi ? 'ग्राहक सूची' : t('customers.title', {}, 'Customers')}
              </h1>
              <p className="mt-1 text-sm font-medium text-white/85">
                {customerCount} {isHi ? 'सक्रिय ग्राहक' : t('common.active', {}, 'active')}
                {pendingCount
                  ? ` · ${pendingCount} ${isHi ? 'स्वीकृति की प्रतीक्षा में' : t('customers.waitingForYes', {}, 'waiting for a yes')}`
                  : ''}
              </p>
            </div>

            {limit && slotsLeft === 0 ? (
              <a
                href="/milkman/membership"
                className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                {isHi ? 'अपग्रेड करें' : t('plans.upgradePlan', {}, 'Upgrade')}
                <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>

          {limit ? (
            <div className="mt-5">
              <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/85">
                <span>
                  {customerCount} / {limit} {isHi ? 'प्लान क्षमता' : t('plans.title', {}, 'on your plan')}
                  {slotsLeft > 0
                    ? ` · ${slotsLeft} ${isHi ? 'स्थान बाकी' : t('customers.slotsLeft', {}, 'slots left')}`
                    : ` · ${isHi ? 'क्षमता पूर्ण' : t('customers.full', {}, 'full')}`}
                </span>
                <span className="tnum shrink-0 font-heading text-lg font-black text-white">{usage}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={usage}
                aria-label="Plan usage"
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
              >
                <div
                  className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-[width] duration-500 ease-out-expo"
                  style={{ width: `${usage}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={isHi ? 'सक्रिय ग्राहक' : t('common.active', {}, 'Active')}
          value={customerCount}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="brand"
        />
        <Stat
          label={isHi ? 'प्रतीक्षारत' : t('customers.pendingApprovals', {}, 'Waiting')}
          value={pendingCount}
          icon={<RequestsIcon className="h-5 w-5" />}
          tone={pendingCount ? 'caution' : 'neutral'}
        />
        <Stat
          label={isHi ? 'प्लान स्लॉट' : t('customers.planSlots', {}, 'Plan slots')}
          value={limit ? `${slotsLeft} ${isHi ? 'बाकी' : t('deliveries.pendingOnly', {}, 'left')}` : (isHi ? 'असीमित' : t('plans.portalMembership', {}, 'Unlimited'))}
          icon={<MembershipIcon className="h-5 w-5" />}
          tone={limit && slotsLeft === 0 ? 'critical' : 'info'}
          hint={limit ? `${limit} ${isHi ? 'अधिकतम सीमा' : t('plans.title', {}, 'on your plan')}` : undefined}
        />
      </div>

      <TabLinks
        basePath="/milkman/customers"
        current={status === 'PENDING' ? 'pending' : 'active'}
        tabs={[
          { value: 'active', label: isHi ? 'सक्रिय' : t('common.active', {}, 'Active') },
          { value: 'pending', label: isHi ? 'प्रतीक्षारत' : t('customers.pendingApprovals', {}, 'Waiting'), count: pendingCount },
        ]}
      />

      {status === 'PENDING' && atLimit ? (
        <div className="mb-5">
          <Notice tone="caution" title={isHi ? 'आप अपने प्लान की सीमा पर पहुँच चुके हैं' : t('plans.upgradePlan', {}, 'You are at your plan limit')}>
            {isHi
              ? `किसी अन्य ग्राहक को स्वीकृत करने से पहले अपना प्लान अपग्रेड करें — ${limit} ग्राहकों की सीमा पर होने पर स्वीकृति अस्वीकार कर दी जाएगी।`
              : `Upgrade your plan before approving anyone else — approvals will be refused while you are at ${limit} customers.`}
          </Notice>
        </div>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8 text-brand" />}
          title={
            status === 'PENDING'
              ? (isHi ? 'कोई प्रतीक्षारत नहीं है' : t('customers.nobodyWaiting', {}, 'Nobody waiting'))
              : (isHi ? 'अभी कोई ग्राहक नहीं है' : t('customers.noCustomersYet', {}, 'No customers yet'))
          }
          description={
            status === 'PENDING'
              ? (isHi ? 'आपके क्षेत्र के नए ग्राहक अनुरोध यहाँ स्वीकृति के लिए दिखाई देंगे।' : t('customers.nobodyWaitingDesc', {}, 'New sign-ups in your area will appear here for approval.'))
              : (isHi ? 'आपके क्षेत्र में साइन अप करने वाले ग्राहक स्वीकृत होने के बाद यहाँ दिखाई देंगे।' : t('customers.noCustomersYetDesc', {}, 'Customers who sign up for your area will appear here once approved.'))
          }
        />
      ) : status === 'PENDING' ? (
        <div className="space-y-3">
          {customers.map((customer) => (
            <ApprovalCard
              key={customer.id}
              customer={customer}
              summary={summaries.get(customer.id)}
              atLimit={atLimit}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} summary={summaries.get(customer.id)} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
