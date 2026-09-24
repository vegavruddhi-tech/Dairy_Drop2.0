import { requireMilkman } from '@/auth/session.js';
import * as requestService from '@/services/request.service.js';

import { EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { RequestsIcon, MilkDropIcon, PlansIcon } from '@/components/ui/Icons.jsx';
import { QuantityRequest, PlanChangeRequest } from '@/components/milkman/Requests.jsx';

export const metadata = { title: 'Requests' };

/**
 * The inbox: everything a customer has asked for that needs a yes or no.
 *
 * Quantity changes come first — they are for a specific day and go stale;
 * a plan change waits happily until tomorrow.
 */
export default async function RequestsPage() {
  const actor = await requireMilkman();
  const { quantity, plan } = await requestService.listInbox(actor);

  const total = quantity.length + plan.length;
  const empty = total === 0;

  const subtitle = empty
    ? 'All caught up — nothing needs an answer.'
    : [
        `${total} waiting`,
        quantity.length ? `${quantity.length} for a day` : null,
        plan.length ? `${plan.length} plan ${plan.length === 1 ? 'change' : 'changes'}` : null,
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
              Inbox
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              Requests
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>

          {/* The count, large, so it reads from the lock screen glance. */}
          <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/20 bg-white/15 px-4 py-2 backdrop-blur-md">
            <span className="stat-number text-3xl leading-none text-white">{total}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">waiting</span>
          </div>
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat
          label="For a day"
          value={quantity.length}
          icon={<MilkDropIcon className="h-5 w-5" />}
          tone={quantity.length ? 'caution' : 'neutral'}
          hint="One-off quantity changes"
        />
        <Stat
          label="Plan changes"
          value={plan.length}
          icon={<PlansIcon className="h-5 w-5" />}
          tone={plan.length ? 'brand' : 'neutral'}
          hint="Apply from tomorrow"
        />
      </div>

      {empty ? (
        <EmptyState
          icon={<RequestsIcon className="h-8 w-8 text-brand" />}
          title="Nothing waiting"
          description="When a customer asks for a different amount on a day, or to move to another plan, it lands here for your yes or no."
          tip="Approving a one-day change touches only that delivery; a plan change starts tomorrow and never reprices days already delivered."
        />
      ) : (
        <div className="space-y-8">
          {quantity.length > 0 ? (
            <section aria-labelledby="qty-heading">
              <SectionHeading id="qty-heading" count={quantity.length} tone="caution">
                For a day
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
                Plan changes
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
