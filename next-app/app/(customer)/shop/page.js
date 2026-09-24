import Link from 'next/link';

import { requireCustomer } from '@/auth/session.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { CartIcon, TruckIcon } from '@/components/ui/Icons.jsx';
import { OrderCard } from '@/components/customer/OrderCard.jsx';

export const metadata = { title: 'Shop' };

/** The catalog. Order history has its own page under the menu. */
export default async function ShopPage() {
  const actor = await requireCustomer();
  const products = await productService.listForCustomer(actor);

  return (
    <>
      <PageHeader
        title="Fresh Dairy Shop"
        description="Daily fresh paneer, curd, ghee and artisanal extras delivered straight to your doorstep."
        action={
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 font-heading text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <span>Your Orders History →</span>
          </Link>
        }
      />

      {/* ── Next-Morning Delivery Guarantee Banner ─────────────────────── */}
      <div className="mb-6 overflow-hidden rounded-3xl border-2 border-blue-200 bg-linear-to-r from-blue-50/90 via-sky-50/60 to-indigo-50/90 p-4.5 shadow-sm sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <TruckIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-sm sm:text-base font-extrabold text-slate-900">
                  Next-Morning Doorstep Delivery
                </h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  Guaranteed
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed max-w-xl">
                Any items ordered today will arrive fresh <strong>tomorrow morning</strong> alongside your daily milk delivery. No extra delivery charge.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/90 border border-blue-100 px-3.5 py-2 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Delivery Slot:</span>
            <span className="font-heading text-xs font-black text-blue-700">Tomorrow Morning (5:00 - 8:00 AM)</span>
          </div>
        </div>
      </div>

      <section aria-labelledby="catalog-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="catalog-heading" className="font-heading text-base font-bold text-slate-900">
            Available Extras Today
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {products.length} {products.length === 1 ? 'item' : 'items'} in stock
          </span>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={<CartIcon className="h-6 w-6 text-brand" />}
            title="Nothing in stock right now"
            description="Your milkman will update items here when fresh batches (paneer, curd, ghee) become available."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <OrderCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
