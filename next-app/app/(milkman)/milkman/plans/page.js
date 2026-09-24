import { requireMilkman } from '@/auth/session.js';
import { businessMonth } from '@/domain/dates.js';
import { quotedMonthlyPaise, resolveUnitPrice } from '@/domain/pricing.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';

import { EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { PlansIcon, UsersIcon, PlusIcon, RequestsIcon } from '@/components/ui/Icons.jsx';
import { PlanEditor, PlanList } from '@/components/milkman/Plans.jsx';

export const metadata = { title: 'Milk plans' };

/**
 * What customers can subscribe to.
 *
 * Plans on offer come first; retired ones sit below under their own heading,
 * still editable and deletable, so a mistake can be undone or cleared out.
 */
export default async function MilkPlansPage() {
  const actor = await requireMilkman();
  const plans = await subscriptionsRepo.listPlans(actor);
  const month = businessMonth();

  /*
   * How many people each plan would cut off.
   *
   * Retiring or deleting ends the subscriptions on a plan, so the milkman has
   * to see the cost before the click, not after it.
   */
  const subscriberCounts = Object.fromEntries(
    await Promise.all(
      plans.map(async (plan) => [
        plan.id,
        plan.isActive ? await subscriptionsRepo.countSubscribersOfPlan(actor, plan.id) : 0,
      ]),
    ),
  );

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

  const onOffer = priced.filter((plan) => plan.isActive);
  const retired = priced.filter((plan) => !plan.isActive);
  const subscribed = Object.values(subscriberCounts).reduce((total, count) => total + count, 0);
  const idle = onOffer.filter((plan) => (subscriberCounts[plan.id] ?? 0) === 0).length;

  const subtitle =
    priced.length === 0
      ? 'Nothing on offer yet — create a plan so customers in your area can subscribe.'
      : [
          `${onOffer.length} ${onOffer.length === 1 ? 'plan' : 'plans'} on offer`,
          `${subscribed} ${subscribed === 1 ? 'customer' : 'customers'} subscribed`,
          retired.length ? `${retired.length} retired` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  const newPlanChip = (
    <button
      type="button"
      className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
    >
      <PlusIcon className="h-4 w-4" />
      New plan
    </button>
  );

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              On offer
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              Milk plans
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>
          <PlanEditor trigger={newPlanChip} />
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="On offer" value={onOffer.length} icon={<PlansIcon className="h-5 w-5" />} tone="brand" />
        <Stat
          label="Subscribed"
          value={subscribed}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="positive"
          hint={idle ? `${idle} ${idle === 1 ? 'plan has' : 'plans have'} no one yet` : undefined}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label="Retired"
            value={retired.length}
            icon={<RequestsIcon className="h-5 w-5" />}
            tone="neutral"
            hint={retired.length ? 'Kept for the record — delete to clear' : 'Nothing retired'}
          />
        </div>
      </div>

      {priced.length === 0 ? (
        <EmptyState
          icon={<PlansIcon className="h-8 w-8 text-brand" />}
          title="No plans yet"
          description="A plan is a product, a quantity, a slot and a price. Create one and customers in your sectors can subscribe from their app."
          tip="Price it per litre and the monthly figure works itself out — morning-and-evening plans count two drops a day."
          action={<PlanEditor />}
        />
      ) : (
        <>
          {onOffer.length > 0 ? (
            <section className="mb-8" aria-labelledby="offer-heading">
              <SectionHeading id="offer-heading" count={onOffer.length}>
                On offer
              </SectionHeading>
              <PlanList plans={onOffer} subscriberCounts={subscriberCounts} />
            </section>
          ) : null}

          {retired.length > 0 ? (
            <section aria-labelledby="retired-heading">
              <SectionHeading id="retired-heading" count={retired.length} tone="neutral">
                Retired
              </SectionHeading>
              <PlanList plans={retired} subscriberCounts={subscriberCounts} />
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
