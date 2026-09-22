import { requireMilkman } from '@/auth/session.js';
import { formatInstant } from '@/domain/dates.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as saasService from '@/services/saas.service.js';

import { PageHeader, Card, CardBody, CardHeader, Stat, Badge, StatusBadge, Notice, Table, Th, Td } from '@/components/ui/index.jsx';
import { SubmitSaasPayment } from '@/components/milkman/Activate.jsx';

export const metadata = { title: 'Membership' };

export default async function MembershipPage() {
  const actor = await requireMilkman();
  const membership = await saasService.getMembership(actor);

  const current = membership.current;

  return (
    <>
      <PageHeader title="Membership" description="Your DairyDrop subscription." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Plan" value={current?.planName ?? 'Free trial'} />
        <Stat
          label="Days left"
          value={membership.daysRemaining}
          tone={membership.daysRemaining <= 3 ? 'critical' : 'neutral'}
        />
        <Stat
          label="Customers"
          value={membership.customerLimit ? `${membership.customerCount} / ${membership.customerLimit}` : membership.customerCount}
          tone={membership.nearLimit ? 'caution' : 'neutral'}
        />
        <Stat label="Status" value={<StatusBadge status={current?.status ?? 'EXPIRED'} />} />
      </div>

      {membership.nearLimit ? (
        <div className="mb-6">
          <Notice tone="caution" title="Close to your customer limit">
            You can serve {membership.customerLimit} customers on this plan.
            Upgrade below to take on more.
          </Notice>
        </div>
      ) : null}

      <div className="mb-6">
        <SubmitSaasPayment plans={membership.plans} settings={membership.settings} />
      </div>

      <Card>
        <CardHeader title="History" />
        <CardBody className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th numeric>Paid</Th>
                <Th>Period</Th>
              </tr>
            </thead>
            <tbody>
              {membership.history.map((row) => (
                <tr key={row.id}>
                  <Td>{row.planName ?? 'Free trial'}</Td>
                  <Td><StatusBadge status={row.status} /></Td>
                  <Td numeric>{formatPaise(toPaise(row.pricePaid))}</Td>
                  <Td className="text-xs text-ink-muted">
                    {formatInstant(row.startsAt)} → {formatInstant(row.endsAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </>
  );
}
