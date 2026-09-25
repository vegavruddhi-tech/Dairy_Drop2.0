import { requireMilkman } from '@/auth/session.js';
import { getT, getLocale } from '@/i18n/server.js';
import * as requestService from '@/services/request.service.js';

import { EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { RequestsIcon, MilkDropIcon, PlansIcon } from '@/components/ui/Icons.jsx';
import { QuantityRequest, PlanChangeRequest } from '@/components/milkman/Requests.jsx';

export const metadata = { title: 'Requests' };

/**
 * The inbox: everything a customer has asked for that needs a yes or no.
 */
export default async function RequestsPage() {
  const actor = await requireMilkman();
  const t = await getT();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const { quantity, plan } = await requestService.listInbox(actor);

  const total = quantity.length + plan.length;
  const empty = total === 0;

  const subtitle = empty
    ? isHi
      ? 'सब कुछ अपडेट है — कोई नया अनुरोध लंबित नहीं है।'
      : t('requests.allCaughtUp', {}, 'All caught up — nothing needs an answer.')
    : [
        `${total} ${isHi ? 'प्रतीक्षारत' : t('requests.waiting', {}, 'waiting')}`,
        quantity.length ? `${quantity.length} ${isHi ? 'एक दिन के लिए' : t('requests.forADay', {}, 'for a day')}` : null,
        plan.length ? `${plan.length} ${isHi ? 'प्लान बदलाव' : t('requests.planChanges', {}, 'plan changes')}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              {total > 0 ? (
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200" />
              ) : null}
              {isHi ? 'अनुरोध इनबॉक्स' : t('requests.inbox', {}, 'Inbox')}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {isHi ? 'ग्राहक अनुरोध' : t('requests.title', {}, 'Requests')}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>

          {/* The count, large, so it reads from the lock screen glance. */}
          <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/20 bg-white/15 px-4 py-2 backdrop-blur-md">
            <span className="stat-number text-3xl leading-none text-white">{total}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
              {isHi ? 'प्रतीक्षारत' : t('requests.waiting', {}, 'waiting')}
            </span>
          </div>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat
          label={isHi ? 'एक दिन के लिए' : t('requests.forADay', {}, 'For a day')}
          value={quantity.length}
          icon={<MilkDropIcon className="h-5 w-5" />}
          tone={quantity.length ? 'caution' : 'neutral'}
          hint={isHi ? 'एक दिन का मात्रा परिवर्तन' : t('requests.oneOffChanges', {}, 'One-off quantity changes')}
        />
        <Stat
          label={isHi ? 'प्लान बदलाव' : t('requests.planChanges', {}, 'Plan changes')}
          value={plan.length}
          icon={<PlansIcon className="h-5 w-5" />}
          tone={plan.length ? 'brand' : 'neutral'}
          hint={isHi ? 'कल से लागू होगा' : t('requests.applyFromTomorrow', {}, 'Apply from tomorrow')}
        />
      </div>

      {empty ? (
        <EmptyState
          icon={<RequestsIcon className="h-8 w-8 text-brand" />}
          title={isHi ? 'कोई अनुरोध प्रतीक्षारत नहीं है' : t('requests.nothingWaiting', {}, 'Nothing waiting')}
          description={
            isHi
              ? 'जब कोई ग्राहक किसी विशेष दिन के लिए मात्रा में बदलाव या दूसरे प्लान में जाने का अनुरोध करेगा, तो वह यहाँ स्वीकृति के लिए आएगा।'
              : t('requests.nothingWaitingDesc', {}, 'When a customer asks for a different amount on a day, or to move to another plan, it lands here for your yes or no.')
          }
          tip={
            isHi
              ? 'एक दिन के बदलाव को स्वीकृत करने पर केवल उस दिन की डिलीवरी प्रभावित होती है; प्लान बदलाव कल से शुरू होता है।'
              : t('requests.nothingWaitingTip', {}, 'Approving a one-day change touches only that delivery; a plan change starts tomorrow and never reprices days already delivered.')
          }
        />
      ) : (
        <div className="space-y-8">
          {quantity.length > 0 ? (
            <section aria-labelledby="qty-heading">
              <SectionHeading id="qty-heading" count={quantity.length} tone="caution">
                {isHi ? 'एक दिन के लिए मात्रा बदलाव' : t('requests.forADay', {}, 'For a day')}
              </SectionHeading>
              <div className="space-y-3">
                {quantity.map((request) => (
                  <QuantityRequest key={request.id} request={request} />
                ))}
              </div>
            </section>
          ) : null}

          {plan.length > 0 ? (
            <section aria-labelledby="plan-heading">
              <SectionHeading id="plan-heading" count={plan.length}>
                {isHi ? 'प्लान परिवर्तन अनुरोध' : t('requests.planChanges', {}, 'Plan changes')}
              </SectionHeading>
              <div className="space-y-3">
                {plan.map((request) => (
                  <PlanChangeRequest key={request.id} request={request} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
