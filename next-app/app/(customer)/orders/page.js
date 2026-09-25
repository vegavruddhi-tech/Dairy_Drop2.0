import { requireCustomer } from '@/auth/session.js';
import { formatDate } from '@/domain/dates.js';
import { getLocale } from '@/i18n/server.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, Card, CardBody, EmptyState, StatusBadge, Table, Th, Td } from '@/components/ui/index.jsx';
import { OrdersIcon } from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Orders' };

/**
 * Order history.
 * Dual Language Support (English / Hindi).
 * Product names and numbers remain in English.
 */
export default async function OrdersPage() {
  const actor = await requireCustomer();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const orders = await productService.listMyOrders(actor, { limit: 50 });

  return (
    <>
      <PageHeader
        title={isHi ? 'ऑर्डर्स' : 'Orders'}
        description={isHi ? 'आपके द्वारा ऑर्डर किए गए अतिरिक्त उत्पाद, इस महीने और पहले के।' : 'Extras you have ordered, this month and before.'}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<OrdersIcon className="h-6 w-6 text-brand" />}
          title={isHi ? 'अभी कोई ऑर्डर नहीं है' : 'No orders yet'}
          description={isHi ? 'दुकान से आप जो भी सामान ऑर्डर करेंगे वह यहां दिखाई देगा।' : 'Anything you order from the shop shows up here.'}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{isHi ? 'सामान' : 'Item'}</Th>
                <Th numeric>{isHi ? 'मात्रा' : 'Qty'}</Th>
                <Th numeric>{isHi ? 'राशि' : 'Amount'}</Th>
                <Th className="text-right sm:text-left">{isHi ? 'स्थिति' : 'Status'}</Th>
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
                  <Td className="text-right sm:text-left"><StatusBadge status={order.status} locale={locale} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
