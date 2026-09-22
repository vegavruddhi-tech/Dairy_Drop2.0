import { requireMilkman } from '@/auth/session.js';
import { formatMonth, formatInstant } from '@/domain/dates.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import * as paymentService from '@/services/payment.service.js';

import { PageHeader, Card, CardBody, CardHeader, EmptyState, Table, Th, Td, StatusBadge } from '@/components/ui/index.jsx';
import { VerifyPayment } from '@/components/milkman/Payments.jsx';

export const metadata = { title: 'Payments' };

export default async function PaymentsPage() {
  const actor = await requireMilkman();

  const [pending, outstanding] = await Promise.all([
    paymentService.listPending(actor, { limit: 50 }),
    paymentService.listOutstanding(actor, { limit: 50 }),
  ]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Confirm what has actually reached your account."
      />

      <section className="mb-8" aria-labelledby="verify-heading">
        <h2 id="verify-heading" className="mb-3 text-sm font-semibold text-ink">
          To confirm ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <EmptyState title="Nothing to confirm" description="Payments your customers record appear here." />
        ) : (
          <div className="space-y-3">
            {pending.map((payment) => (
              <VerifyPayment key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="outstanding-heading">
        <Card>
          <CardHeader title="Outstanding" description="Customers who still owe money" />
          <CardBody className="p-0">
            {outstanding.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">Everyone is up to date.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Month</Th>
                    <Th numeric>Billed</Th>
                    <Th numeric>Paid</Th>
                    <Th numeric>Due</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((row) => (
                    <tr key={row.billId}>
                      <Td>
                        <span className="font-medium">{row.customerName}</span>
                        {row.customerPhone ? (
                          <a href={`tel:${row.customerPhone}`} className="block text-xs text-brand">
                            {row.customerPhone}
                          </a>
                        ) : null}
                      </Td>
                      <Td>{formatMonth(row.month)}</Td>
                      <Td numeric>{formatPaise(toPaise(row.totalAmount))}</Td>
                      <Td numeric>{formatPaise(toPaise(row.paidAmount))}</Td>
                      <Td numeric className="font-medium text-critical">
                        {formatPaise(toPaise(row.balance))}
                      </Td>
                      <Td><StatusBadge status={row.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </section>
    </>
  );
}
