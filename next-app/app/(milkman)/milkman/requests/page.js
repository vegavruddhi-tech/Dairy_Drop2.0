import { requireMilkman } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import * as requestService from '@/services/request.service.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { QuantityRequest, PlanChangeRequest } from '@/components/milkman/Requests.jsx';

export const metadata = { title: 'Requests' };

export default async function RequestsPage() {
  const actor = await requireMilkman();
  const { quantity, plan } = await requestService.listInbox(actor);

  const empty = quantity.length === 0 && plan.length === 0;

  return (
    <>
      <PageHeader title="Requests" description="Things your customers have asked for." />

      {empty ? (
        <EmptyState icon="✋" title="Nothing waiting" description="Customer requests appear here." />
      ) : (
        <div className="space-y-8">
          {quantity.length > 0 ? (
            <section aria-labelledby="qty-heading">
              <h2 id="qty-heading" className="mb-3 text-sm font-semibold text-ink">
                Quantity changes ({quantity.length})
              </h2>
              <div className="space-y-3">
                {quantity.map((request) => (
                  <QuantityRequest key={request.id} request={request} />
                ))}
              </div>
            </section>
          ) : null}

          {plan.length > 0 ? (
            <section aria-labelledby="plan-heading">
              <h2 id="plan-heading" className="mb-3 text-sm font-semibold text-ink">
                Plan changes ({plan.length})
              </h2>
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
