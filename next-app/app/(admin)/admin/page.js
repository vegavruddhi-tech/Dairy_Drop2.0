import Link from 'next/link';

import { requireAdmin } from '@/auth/session.js';
import { formatMonth } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';
import * as adminService from '@/services/admin.service.js';

import {
  Stat, Card, CardBody, CardHeader, Table, Th, Td, Notice, HeroBanner,
} from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { PaymentsIcon, EarningsIcon, UsersIcon, DeliveryIcon, MembershipIcon, CalendarIcon } from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Overview' };

export default async function AdminDashboard() {
  await requireAdmin();

  const [stats, distribution] = await Promise.all([
    adminService.getDashboard(),
    adminService.getPlanDistribution(),
  ]);

  return (
    <>
      <HeroBanner
        eyebrow="Platform"
        name="Overview"
        subtitle={`${formatMonth(stats.month)} · ${stats.milkmen} milkmen, ${stats.approvedCustomers} customers`}
      />

      {stats.paymentsAwaiting > 0 ? (
        <div className="mb-5">
          <Notice
            tone="caution"
            title={`${stats.paymentsAwaiting} payment${stats.paymentsAwaiting === 1 ? '' : 's'} to verify`}
            action={
              <Link href="/admin/verifications">
                <Button size="sm">Review</Button>
              </Link>
            }
          >
            Milkmen are waiting for their panels to open.
          </Notice>
        </div>
      ) : null}

      {stats.unverifiedMilkmen > 0 ? (
        <div className="mb-5">
          <Notice
            tone="caution"
            title={`${stats.unverifiedMilkmen} milkman application${stats.unverifiedMilkmen === 1 ? '' : 's'} waiting`}
            action={
              <Link href="/admin/milkmen?tab=unverified">
                <Button size="sm">Review</Button>
              </Link>
            }
          >
            They cannot take a single customer until you verify them.
          </Notice>
        </div>
      ) : null}

      <section className="mb-6" aria-labelledby="revenue-heading">
        <h2 id="revenue-heading" className="mb-3 text-sm font-semibold text-ink">Platform revenue</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<PaymentsIcon className="h-5 w-5" />} tone="brand" label="This month" value={formatPaise(stats.revenueMonthPaise ?? 0, { whole: true })} />
          <Stat icon={<EarningsIcon className="h-5 w-5" />} tone="neutral" label="All time" value={formatPaise(stats.revenueAllTimePaise ?? 0, { whole: true })} />
          <Stat icon={<MembershipIcon className="h-5 w-5" />} tone="positive" label="Paying" value={stats.subscriptions?.active ?? 0} />
          <Stat icon={<CalendarIcon className="h-5 w-5" />} tone="info" label="On trial" value={stats.subscriptions?.trial ?? 0} />
        </div>
      </section>

      <section className="mb-6" aria-labelledby="network-heading">
        <h2 id="network-heading" className="mb-3 text-sm font-semibold text-ink">Network</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<DeliveryIcon className="h-5 w-5" />} tone="info" label="Milkmen" value={stats.milkmen ?? 0} />
          <Stat icon={<UsersIcon className="h-5 w-5" />} tone="brand" label="Customers" value={stats.approvedCustomers ?? 0} hint={`${stats.pendingCustomers ?? 0} pending`} />
          <Stat icon={<PaymentsIcon className="h-5 w-5" />} tone="caution" label="Awaiting payment" value={stats.subscriptions?.awaiting ?? 0} />
          <Stat icon={<CalendarIcon className="h-5 w-5" />} tone="critical" label="Lapsed" value={stats.subscriptions?.expired ?? 0} />
        </div>
      </section>

      <Card>
        <CardHeader title="Plan distribution" description="Live subscriptions by tier" />
        <CardBody className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Plan</Th>
                <Th numeric>Milkmen</Th>
                <Th numeric>Monthly run rate</Th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((row) => (
                <tr key={row.planId ?? 'trial'}>
                  <Td>{row.planName}</Td>
                  <Td numeric>{row.count}</Td>
                  <Td numeric>
                    {row.monthlyPrice
                      ? formatPaise(Math.round(Number(row.monthlyPrice) * 100) * row.count, { whole: true })
                      : '—'}
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
