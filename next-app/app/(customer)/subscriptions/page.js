import { requireCustomer } from '@/auth/session.js';
import { formatPaise } from '@/domain/money.js';
import { clashingSlots, slotLabel } from '@/domain/pricing.js';
import { getLocale } from '@/i18n/server.js';
import * as subscriptionService from '@/services/subscription.service.js';
import * as requestsRepo from '@/repositories/requests.repo.js';

import { PageHeader, Card, CardBody, CardHeader, EmptyState, StatusBadge, Badge, Notice } from '@/components/ui/index.jsx';
import { SubscriptionsIcon } from '@/components/ui/Icons.jsx';
import { SubscriptionCard, PlanCard } from '@/components/customer/Plans.jsx';

export const metadata = { title: 'My plans' };

/**
 * Subscriptions & Available Plans.
 * Dual Language Support (English / Hindi).
 * Product names and numbers remain in English.
 */
export default async function SubscriptionsPage() {
  const actor = await requireCustomer();
  const locale = await getLocale();
  const isHi = locale === 'hi';

  const [mine, available, pendingRequests] = await Promise.all([
    subscriptionService.listMine(actor),
    subscriptionService.listAvailablePlans(actor),
    requestsRepo.listMyPlanChangeRequests(actor, { limit: 10 }),
  ]);

  const pendingByRoot = new Map(
    pendingRequests.filter((r) => r.status === 'PENDING').map((r) => [r.subscriptionRootId, r]),
  );

  const subscribedPlanIds = new Set(mine.filter((s) => s.status !== 'CANCELLED').map((s) => s.planId));

  const rateByPlan = new Map(
    mine.filter((s) => s.status !== 'CANCELLED').map((s) => [s.planId, s.unitPrice]),
  );

  const onOffer = new Set(available.map((plan) => plan.id));
  const holding = mine.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  const maxPlansReached = holding.length >= 2;
  const blockedByPlan = new Map();

  for (const plan of available) {
    if (subscribedPlanIds.has(plan.id)) continue;
    const wanted = { slot: plan.slot, productName: plan.productName };
    const clashes = clashingSlots(holding, wanted);
    if (clashes.length === 0) continue;

    const blocker = holding.find((s) => clashingSlots([s], wanted).length > 0);
    const strandedOn = blocker && !onOffer.has(blocker.planId) ? blocker.rootId : null;

    blockedByPlan.set(plan.id, {
      times: clashes.map(slotLabel).join(isHi ? ' और ' : ' and '),
      productName: plan.productName,
      switchFrom: strandedOn,
    });
  }

  return (
    <>
      <PageHeader
        title={isHi ? 'मेरी सदस्यता' : 'My plans'}
        description={
          isHi
            ? 'आपसे केवल उसी दूध का शुल्क लिया जाता है जो वास्तव में पहुंचता है। प्रति ग्राहक अधिकतम 2 सक्रिय प्लान।'
            : 'You are billed only for the milk that actually arrives. Maximum 2 active subscriptions per customer.'
        }
      />

      <section className="mb-10" aria-labelledby="mine-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="mine-heading" className="text-sm font-semibold text-ink">
            {isHi ? `सक्रिय सदस्यता (${holding.length}/2)` : `Active Subscriptions (${holding.length}/2)`}
          </h2>
          {maxPlansReached && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              {isHi ? 'अधिकतम 2 प्लान की सीमा पूरी' : 'Maximum 2 plans limit reached'}
            </span>
          )}
        </div>

        {mine.length === 0 ? (
          <EmptyState
            icon={<SubscriptionsIcon className="h-6 w-6 text-blue-600" />}
            title={isHi ? 'अभी कोई प्लान नहीं है' : 'No plans yet'}
            description={isHi ? 'दैनिक डिलीवरी शुरू करने के लिए नीचे दिए गए प्लान में से चुनें।' : 'Choose one below to start daily deliveries.'}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                availablePlans={available}
                pendingRequest={pendingByRoot.get(subscription.rootId) ?? null}
                withdrawn={Boolean(subscription.planId) && !onOffer.has(subscription.planId)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="available-heading">
        <h2 id="available-heading" className="mb-3 text-sm font-semibold text-ink">
          {isHi ? 'आपकी डेयरी द्वारा उपलब्ध प्लान्स' : 'Available from your milkman'}
        </h2>

        {available.length === 0 ? (
          <EmptyState
            title={
              mine.length > 0
                ? isHi ? 'अन्य कोई प्लान उपलब्ध नहीं' : 'Nothing else on offer'
                : isHi ? 'अभी कोई प्लान उपलब्ध नहीं' : 'No plans on offer yet'
            }
            description={
              mine.length > 0
                ? isHi
                  ? 'आपकी डेयरी अभी कोई अन्य प्लान नहीं दे रही है। आपका मौजूदा प्लान जारी रहेगा।'
                  : 'Your milkman is not offering any other plans right now. What you already have keeps running.'
                : isHi
                ? 'आपकी डेयरी ने अभी कोई प्लान प्रकाशित नहीं किया है।'
                : 'Your milkman has not published any plans.'
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                alreadySubscribed={subscribedPlanIds.has(plan.id)}
                subscribedRate={rateByPlan.get(plan.id) ?? null}
                blockedBy={blockedByPlan.get(plan.id) ?? null}
                maxPlansReached={maxPlansReached}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
