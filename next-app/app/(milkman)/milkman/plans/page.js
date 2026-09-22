import { requireMilkman } from '@/auth/session.js';
import { businessMonth } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import { quotedMonthlyPaise, resolveUnitPrice } from '@/domain/pricing.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { PlanEditor, PlanList } from '@/components/milkman/Plans.jsx';

export const metadata = { title: 'Milk plans' };

export default async function MilkPlansPage() {
  const actor = await requireMilkman();
  const plans = await subscriptionsRepo.listPlans(actor);
  const month = businessMonth();

  // Price each plan up front, so the list can show a monthly quote without the
  // client repeating the arithmetic.
  const priced = plans.map((plan) => {
    try {
      return {
        ...plan,
        quotedMonthlyPaise: quotedMonthlyPaise(plan, month),
        unitPrice: resolveUnitPrice(plan, month).unitPrice,
      };
    } catch {
      return { ...plan, quotedMonthlyPaise: null, unitPrice: null };
    }
  });

  return (
    <>
      <PageHeader
        title="Milk plans"
        description="What your customers can subscribe to."
        action={<PlanEditor />}
      />

      {priced.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No plans yet"
          description="Create one so customers in your area can subscribe."
          action={<PlanEditor />}
        />
      ) : (
        <PlanList plans={priced} />
      )}
    </>
  );
}
