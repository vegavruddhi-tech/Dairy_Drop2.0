import { requireMilkman } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import { db } from '@/db/index.js';

import { PageHeader, Card, CardBody, EmptyState, StatusBadge, Notice } from '@/components/ui/index.jsx';
import { TabLinks } from '@/components/ui/interactive.jsx';
import { UsersIcon } from '@/components/ui/Icons.jsx';
import { ApprovalCard, CustomerRow } from '@/components/milkman/Customers.jsx';

export const metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }) {
  const actor = await requireMilkman();
  const params = await searchParams;
  const status = params?.status === 'PENDING' || params?.tab === 'pending' ? 'PENDING' : 'APPROVED';

  const [customers, pendingCount, customerCount] = await Promise.all([
    usersRepo.listCustomers(actor, { status, limit: 200 }),
    usersRepo.countPendingCustomers(actor),
    subscriptionsRepo.countActiveCustomers(db, actor.userId),
  ]);

  const summaries = await subscriptionsRepo.summariseByCustomer(
    actor,
    customers.map((customer) => customer.id),
  );

  const limit = actor.saas?.customerLimit;
  const atLimit = limit ? customerCount >= limit : false;

  return (
    <>
      <PageHeader
        title="Customers"
        description={limit ? `${customerCount} of ${limit} on your plan` : `${customerCount} active`}
      />

      <TabLinks
        basePath="/milkman/customers"
        current={status === 'PENDING' ? 'pending' : 'active'}
        tabs={[
          { value: 'active', label: 'Active' },
          { value: 'pending', label: 'Waiting', count: pendingCount },
        ]}
      />

      {status === 'PENDING' && atLimit ? (
        <div className="mb-5">
          <Notice tone="caution" title="You are at your plan limit">
            Upgrade your plan before approving anyone else — approvals will be
            refused while you are at {limit} customers.
          </Notice>
        </div>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8 text-blue-600" />}
          title={status === 'PENDING' ? 'Nobody waiting' : 'No customers yet'}
          description={
            status === 'PENDING'
              ? 'New sign-ups in your area will appear here for approval.'
              : 'Customers who sign up for your area will appear here once approved.'
          }
        />
      ) : status === 'PENDING' ? (
        <div className="space-y-3">
          {customers.map((customer) => (
            <ApprovalCard
              key={customer.id}
              customer={customer}
              summary={summaries.get(customer.id)}
              atLimit={atLimit}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {customers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  summary={summaries.get(customer.id)}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
