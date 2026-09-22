import { requireAdmin } from '@/auth/session.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as adminService from '@/services/admin.service.js';

import { PageHeader, Card, CardBody, Badge, EmptyState, Notice } from '@/components/ui/index.jsx';
import { SaasPlanEditor } from '@/components/admin/Plans.jsx';

export const metadata = { title: 'Plans' };

export default async function AdminPlansPage() {
  await requireAdmin();
  const plans = await adminService.listPlans();

  return (
    <>
      <PageHeader
        title="Plans"
        description="What milkmen pay to use DairyDrop."
        action={<SaasPlanEditor />}
      />

      <div className="mb-5">
        <Notice tone="info" title="Changing a limit affects everyone on the plan">
          A milkman already above a lowered ceiling is not downgraded — they simply
          cannot approve anyone new until they upgrade.
        </Notice>
      </div>

      {plans.length === 0 ? (
        <EmptyState title="No plans yet" action={<SaasPlanEditor />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.isActive ? undefined : 'opacity-60'}>
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{plan.name}</p>
                  {plan.isActive ? null : <Badge tone="neutral">Retired</Badge>}
                </div>

                <div>
                  <span className="text-2xl font-semibold tnum text-ink">
                    {formatPaise(toPaise(plan.monthlyPrice), { whole: true })}
                  </span>
                  <span className="ml-1 text-sm text-ink-muted">/ {plan.durationDays} days</span>
                </div>

                <p className="text-sm text-ink-muted">
                  Up to <strong className="text-ink">{plan.maxCustomers}</strong> customers
                </p>

                {plan.description ? (
                  <p className="text-sm text-ink-muted">{plan.description}</p>
                ) : null}

                <div className="mt-auto pt-2">
                  <SaasPlanEditor plan={plan} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
