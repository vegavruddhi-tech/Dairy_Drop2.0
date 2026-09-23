import { requireCustomer } from '@/auth/session.js';
import { formatPaise } from '@/domain/money.js';
import { clashingSlots, slotLabel } from '@/domain/pricing.js';
import * as subscriptionService from '@/services/subscription.service.js';
import * as requestsRepo from '@/repositories/requests.repo.js';

import { PageHeader, Card, CardBody, CardHeader, EmptyState, StatusBadge, Badge, Notice } from '@/components/ui/index.jsx';
import { SubscriptionsIcon } from '@/components/ui/Icons.jsx';
import { SubscriptionCard, PlanCard } from '@/components/customer/Plans.jsx';

export const metadata = { title: 'My plans' };

export default async function SubscriptionsPage() {
  const actor = await requireCustomer();

  const [mine, available, pendingRequests] = await Promise.all([
    subscriptionService.listMine(actor),
    subscriptionService.listAvailablePlans(actor),
    requestsRepo.listMyPlanChangeRequests(actor, { limit: 10 }),
  ]);

  const pendingByRoot = new Map(
    pendingRequests.filter((r) => r.status === 'PENDING').map((r) => [r.subscriptionRootId, r]),
  );

  const subscribedPlanIds = new Set(mine.filter((s) => s.status !== 'CANCELLED').map((s) => s.planId));

  // The rate each subscribed plan was actually taken at, so a plan whose price
  // has moved since can say which one applies to this customer.
  const rateByPlan = new Map(
    mine.filter((s) => s.status !== 'CANCELLED').map((s) => [s.planId, s.unitPrice]),
  );

  /*
   * Which plans the customer cannot take, and what is in the way.
   *
   * A paused plan still holds its time — it is coming back, and freeing the
   * slot would let something else take it with no way to resume. Computed with
   * the same `clashingSlots` the service refuses on, so the picker and the
   * server never disagree about what is available.
   */
  /*
   * Plans the milkman has withdrawn since this customer signed up.
   *
   * Retiring a plan is a catalog action: it stops new customers taking it and
   * leaves existing agreements alone. Correct, but from the customer's side it
   * looked like a fault — their plan carried on working while "Change plan"
   * quietly vanished, because there was nothing left to change to, and nothing
   * said why.
   */
  const onOffer = new Set(available.map((plan) => plan.id));

  const holding = mine.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  const maxPlansReached = holding.length >= 2;
  const blockedByPlan = new Map();
  for (const plan of available) {
    if (subscribedPlanIds.has(plan.id)) continue;
    const wanted = { slot: plan.slot, productName: plan.productName };
    const clashes = clashingSlots(holding, wanted);
    if (clashes.length === 0) continue;
    blockedByPlan.set(plan.id, {
      times: clashes.map(slotLabel).join(' and '),
      productName: plan.productName,
    });
  }

  return (
    <>
      <PageHeader
        title="My plans"
        description="You are billed only for the milk that actually arrives. Maximum 2 active subscriptions per customer."
      />

      <section className="mb-10" aria-labelledby="mine-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="mine-heading" className="text-sm font-semibold text-ink">
            Active Subscriptions ({holding.length}/2)
          </h2>
          {maxPlansReached && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Maximum 2 plans limit reached
            </span>
          )}
        </div>

        {mine.length === 0 ? (
          <EmptyState
            icon={<SubscriptionsIcon className="h-6 w-6 text-blue-600" />}
            title="No plans yet"
            description="Choose one below to start daily deliveries."
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
          Available from your milkman
        </h2>

        {available.length === 0 ? (
          <EmptyState
            title={mine.length > 0 ? 'Nothing else on offer' : 'No plans on offer yet'}
            description={
              mine.length > 0
                ? 'Your milkman is not offering any other plans right now. What you already have keeps running.'
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
