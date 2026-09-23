import { requireMilkman } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, EmptyState, Card, CardBody, CardHeader, Table, Th, Td, StatusBadge } from '@/components/ui/index.jsx';
import { OrdersIcon } from '@/components/ui/Icons.jsx';
import { OrderActions } from '@/components/milkman/Catalog.jsx';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  const actor = await requireMilkman();

  const [pending, accepted, history] = await Promise.all([
    productService.listOrders(actor, { status: 'PENDING', limit: 50 }),
    productService.listOrders(actor, { status: 'ACCEPTED', limit: 50 }),
    productService.listOrders(actor, { status: 'DELIVERED', limit: 30 }),
  ]);

  return (
    <>
      <PageHeader title="Orders" description="Extras your customers have asked for." />

      {[
        { title: 'New', description: 'Accept these to add them to your round', rows: pending },
        { title: 'To deliver', description: 'Accepted, not yet handed over', rows: accepted },
      ].map((section) =>
        section.rows.length > 0 ? (
          <section key={section.title} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {section.title} ({section.rows.length})
            </h2>
            <div className="space-y-3">
              {section.rows.map((order) => (
                <Card key={order.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{order.customerName}</p>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {Number(order.quantity)} {order.unit} of {order.productName} · ₹
                        {Number(order.amount).toFixed(2)}
                      </p>
                      {order.deliveryAddress ? (
                        <p className="mt-0.5 text-xs text-ink-subtle">{order.deliveryAddress}</p>
                      ) : null}
                    </div>
                    <OrderActions order={order} />
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ) : null,
      )}

      {pending.length === 0 && accepted.length === 0 ? (
        <EmptyState icon={<OrdersIcon className="h-6 w-6 text-blue-600" />} title="No open orders" description="New orders appear here." />
      ) : null}

      {history.length > 0 ? (
        <Card>
          <CardHeader title="Delivered" />
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Item</Th>
                  <Th numeric>Amount</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((order) => (
                  <tr key={order.id}>
                    <Td>{order.customerName}</Td>
                    <Td>{Number(order.quantity)} {order.unit} {order.productName}</Td>
                    <Td numeric>₹{Number(order.amount).toFixed(2)}</Td>
                    <Td>{formatDate(order.orderDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
