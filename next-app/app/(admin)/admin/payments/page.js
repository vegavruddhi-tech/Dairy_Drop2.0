import { requireAdmin } from '@/auth/session.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as adminService from '@/services/admin.service.js';

import { PageHeader, Card, CardBody, Table, Th, Td, StatusBadge, EmptyState } from '@/components/ui/index.jsx';

export const metadata = { title: 'Payments' };

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const payments = await adminService.listPayments({ limit: 100 });

  const verifiedPaise = payments
    .filter((p) => p.status === 'VERIFIED')
    .reduce((total, p) => total + toPaise(p.amount), 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description={`${formatPaise(verifiedPaise)} verified across ${payments.length} records`}
      />

      {payments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Milkman</Th>
                  <Th>Reference</Th>
                  <Th numeric>Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td>
                      <span className="font-medium">{payment.businessName ?? payment.milkmanName}</span>
                      <span className="block text-xs text-ink-muted">{payment.milkmanName}</span>
                    </Td>
                    <Td className="font-mono text-xs">{payment.reference ?? '—'}</Td>
                    <Td numeric>{formatPaise(toPaise(payment.amount))}</Td>
                    <Td><StatusBadge status={payment.status} /></Td>
                    <Td className="text-xs text-ink-muted">
                      {new Date(payment.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </>
  );
}
