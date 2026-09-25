import { requireCustomer } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, Card, CardBody, EmptyState, StatusBadge, Table, Th, Td } from '@/components/ui/index.jsx';
import { OrdersIcon } from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Orders' };

/**
 * Order history, on its own.
 *
 * It used to sit beneath the catalog on /shop, which made "Shop & Orders" one
 * bottom-bar item doing two jobs. Buying and checking what you bought are
 * different errands; the second now lives in the menu.
 */
export default async function OrdersPage() {
  const actor = await requireCustomer();
  const orders = await productService.listMyOrders(actor, { limit: 50 });

  return (
    <>
      <PageHeader title="Orders" description="Extras you have ordered, this month and before." />

      {orders.length === 0 ? (
        <EmptyState
          icon={<OrdersIcon className="h-6 w-6 text-brand" />}
          title="No orders yet"
          description="Anything you order from the shop shows up here."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Amount</Th>
                <Th className="text-right sm:text-left">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <Td>
                    <span className="font-bold text-slate-900">{order.productName}</span>
                    <span className="block text-xs font-medium text-slate-400">{formatDate(order.orderDate)}</span>
                  </Td>
                  <Td numeric className="font-semibold text-slate-700">{Number(order.quantity)} {order.unit}</Td>
                  <Td numeric className="font-bold text-slate-900">₹{Number(order.amount).toFixed(2)}</Td>
                  <Td className="text-right sm:text-left"><StatusBadge status={order.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
