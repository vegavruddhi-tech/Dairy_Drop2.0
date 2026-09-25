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
                  {isHi ? 'अगली सुबह दरवाजे पर डिलीवरी' : 'Next-Morning Doorstep Delivery'}
                </h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  {isHi ? 'गारंटीड' : 'Guaranteed'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed max-w-xl">
                {isHi
                  ? 'आज ऑर्डर किया गया कोई भी सामान कल सुबह आपकी नियमित दूध डिलीवरी के साथ आ जाएगा। कोई अतिरिक्त डिलीवरी शुल्क नहीं।'
                  : 'Any items ordered today will arrive fresh tomorrow morning alongside your daily milk delivery. No extra delivery charge.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white/90 border border-blue-100 px-3.5 py-2 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">
              {isHi ? 'डिलीवरी समय:' : 'Delivery Slot:'}
            </span>
            <span className="font-heading text-xs font-black text-blue-700">
              {isHi ? 'कल सुबह (5:00 - 8:00 AM)' : 'Tomorrow Morning (5:00 - 8:00 AM)'}
            </span>
          </div>
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
