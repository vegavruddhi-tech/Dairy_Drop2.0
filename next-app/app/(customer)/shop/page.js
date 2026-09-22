import { requireCustomer } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, Card, CardBody, CardHeader, EmptyState, StatusBadge, Table, Th, Td } from '@/components/ui/index.jsx';
import { OrderCard } from '@/components/customer/OrderCard.jsx';

export const metadata = { title: 'Shop' };

export default async function ShopPage() {
  const actor = await requireCustomer();

  const [products, orders] = await Promise.all([
    productService.listForCustomer(actor),
    productService.listMyOrders(actor, { limit: 20 }),
  ]);

  return (
    <>
      <PageHeader
        title="Shop"
        description="Extras your milkman brings with tomorrow's milk."
      />

      <section className="mb-10" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="mb-3 text-sm font-semibold text-ink">
          Available today
        </h2>

        {products.length === 0 ? (
          <EmptyState
            icon="🧈"
            title="Nothing in stock right now"
            description="Your milkman adds items here when they have them."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <OrderCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="orders-heading">
        <Card>
          <CardHeader title="Your orders" description="Extras ordered this month and before" />
          <CardBody className="p-0">
            {orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">No orders yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <Td>
                        <span className="font-medium">{order.productName}</span>
                        <span className="block text-xs text-ink-muted">
                          {formatDate(order.orderDate)}
                        </span>
                      </Td>
                      <Td numeric>{Number(order.quantity)} {order.unit}</Td>
                      <Td numeric>₹{Number(order.amount).toFixed(2)}</Td>
                      <Td><StatusBadge status={order.status} /></Td>
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
