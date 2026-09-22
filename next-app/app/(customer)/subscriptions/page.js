import { requireCustomer } from '@/auth/session.js';
import { formatPaise } from '@/domain/money.js';
import * as subscriptionService from '@/services/subscription.service.js';
import * as requestsRepo from '@/repositories/requests.repo.js';

import { PageHeader, Card, CardBody, CardHeader, EmptyState, StatusBadge, Badge, Notice } from '@/components/ui/index.jsx';
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

  return (
    <>
      <PageHeader
        title="My plans"
        description="You are billed only for the milk that actually arrives."
      />

      <section className="mb-10" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="mb-3 text-sm font-semibold text-ink">
          Active
        </h2>

        {mine.length === 0 ? (
          <EmptyState
            icon="🔁"
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
          <EmptyState title="No plans on offer yet" description="Your milkman has not published any plans." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                alreadySubscribed={subscribedPlanIds.has(plan.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
