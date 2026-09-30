import Link from 'next/link';

import { requireCustomer } from '@/auth/session.js';
import { getLocale } from '@/i18n/server.js';
import * as productService from '@/services/product.service.js';

import { PageHeader, EmptyState } from '@/components/ui/index.jsx';
import { CartIcon, TruckIcon } from '@/components/ui/Icons.jsx';
import { OrderCard } from '@/components/customer/OrderCard.jsx';

export const metadata = { title: 'Shop' };

/** The catalog. Order history has its own page under the menu. */
export default async function ShopPage() {
  const actor = await requireCustomer();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const products = await productService.listForCustomer(actor);

  return (
    <>
      <PageHeader
        title={isHi ? 'ताज़ा डेयरी दुकान' : 'Fresh Dairy Shop'}
        description={
          isHi
            ? 'ताज़ा पनीर, दही, घी व अन्य डेयरी उत्पाद सीधे आपके दरवाजे पर सुबह की डिलीवरी के साथ।'
            : 'Daily fresh paneer, curd, ghee and artisanal extras delivered straight to your doorstep.'
        }
        action={
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 font-heading text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <span>{isHi ? 'आपका ऑर्डर इतिहास →' : 'Your Orders History →'}</span>
          </Link>
        }
      />

      {/* ── Next-morning delivery: one line and three facts ──────────────── */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 to-sky-50/60 px-4 py-3 shadow-xs">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
          <TruckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-extrabold text-slate-900">
            {isHi ? 'आज ऑर्डर करें, कल सुबह पाएं' : 'Order today, get it tomorrow morning'}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <li className="rounded-full bg-white px-2 py-0.5 text-blue-700 ring-1 ring-blue-100">
              {isHi ? 'दूध के साथ' : 'With your milk'}
            </li>
            <li className="rounded-full bg-white px-2 py-0.5 text-blue-700 ring-1 ring-blue-100">5–8 AM</li>
            <li className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-100">
              {isHi ? 'मुफ़्त डिलीवरी' : 'Free delivery'}
            </li>
          </ul>
        </div>
      </div>

      <section aria-labelledby="catalog-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="catalog-heading" className="font-heading text-base font-bold text-slate-900">
            {isHi ? 'उपलब्ध डेयरी उत्पाद' : 'Available Extras Today'}
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {products.length} {isHi ? 'आइटम उपलब्ध' : products.length === 1 ? 'item in stock' : 'items in stock'}
          </span>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={<CartIcon className="h-6 w-6 text-brand" />}
            title={isHi ? 'वर्तमान में कोई सामान उपलब्ध नहीं है' : 'Nothing in stock right now'}
            description={
              isHi
                ? 'ताज़ा बैच (पनीर, दही, घी) तैयार होने पर आपका दूधवाला यहाँ सामान जोड़ देगा।'
                : 'Your milkman will update items here when fresh batches (paneer, curd, ghee) become available.'
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
            {products.map((product) => (
              <OrderCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
