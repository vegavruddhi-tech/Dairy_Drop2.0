import Link from 'next/link';

import { requireCustomer } from '@/auth/session.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { CartIcon } from '@/components/ui/Icons.jsx';
import { OrderCard } from '@/components/customer/OrderCard.jsx';

export const metadata = { title: 'Shop' };

/** The catalog. Order history has its own page under the menu. */
export default async function ShopPage() {
  const actor = await requireCustomer();
  const products = await productService.listForCustomer(actor);

  return (
    <>
      <PageHeader
        title="Shop"
        description="Extras your milkman brings with tomorrow's milk."
        action={
          <Link href="/orders" className="text-sm font-semibold text-brand hover:underline">
            Your orders →
          </Link>
        }
      />

      <section aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="mb-3 text-sm font-semibold text-ink">
          Available today
        </h2>

        {products.length === 0 ? (
          <EmptyState
            icon={<CartIcon className="h-6 w-6 text-brand" />}
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
    </>
  );
}
