import { requireMilkman } from '@/auth/session.js';
import { businessMonth, formatMonth, recentMonths, addMonths } from '@/domain/dates.js';
import { formatPaise, formatMilli, toPaise } from '@/domain/money.js';
import * as billingService from '@/services/billing.service.js';

import { PageHeader, Card, CardBody, CardHeader, Stat, Table, Th, Td, EmptyState } from '@/components/ui/index.jsx';

export const metadata = { title: 'Earnings' };

/**
 * Earnings.
 *
 * Computed by the same engine as the customer invoice, so these figures equal
 * the sum of this milkman's customers' bills exactly. The previous system used
 * different constants on each side and the two never agreed.
 */
export default async function EarningsPage({ searchParams }) {
  const actor = await requireMilkman();
  const params = await searchParams;
  const month = typeof params?.month === 'string' ? params.month : businessMonth();

  const earnings = await billingService.getEarnings(actor, { month });

  return (
    <>
      <PageHeader
        title="Earnings"
        description={formatMonth(month)}
        action={
          <div className="flex gap-2">
            <a href={`/milkman/earnings?month=${addMonths(month, -1)}`} className="tap rounded-lg border border-border px-3 py-2 text-sm">←</a>
            <a href={`/milkman/earnings?month=${addMonths(month, 1)}`} className="tap rounded-lg border border-border px-3 py-2 text-sm">→</a>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Billed" value={formatPaise(earnings.billedPaise, { whole: true })} tone="brand" />
        <Stat label="Collected" value={formatPaise(earnings.collectedPaise, { whole: true })} tone="positive" />
        <Stat
          label="Outstanding"
          value={formatPaise(Math.max(0, earnings.billedPaise - earnings.collectedPaise), { whole: true })}
          tone="caution"
        />
        <Stat label="Deliveries" value={earnings.deliveredCount} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where it came from" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Milk</dt>
                <dd className="tnum font-medium text-ink">{formatPaise(earnings.milkPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Extras ({earnings.purchaseCount} orders)</dt>
                <dd className="tnum font-medium text-ink">{formatPaise(earnings.productsPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-medium text-ink">Total billed</dt>
                <dd className="tnum font-semibold text-ink">{formatPaise(earnings.billedPaise)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top extras" description="By revenue this month" />
          <CardBody className="p-0">
            {earnings.topProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">No extras sold yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th numeric>Orders</Th>
                    <Th numeric>Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.topProducts.map((product) => (
                    <tr key={product.name}>
                      <Td>{product.name}</Td>
                      <Td numeric>{product.count}</Td>
                      <Td numeric>{formatPaise(product.paise)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
