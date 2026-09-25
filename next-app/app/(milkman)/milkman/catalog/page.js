import { requireMilkman } from '@/auth/session.js';
import { getT, getLocale } from '@/i18n/server.js';
import * as productService from '@/services/product.service.js';

import { EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { CatalogIcon, CartIcon, RequestsIcon, PlusIcon } from '@/components/ui/Icons.jsx';
import { ProductEditor, ProductList } from '@/components/milkman/Catalog.jsx';

export const metadata = { title: 'Catalog' };

/**
 * The extras a milkman sells alongside milk — paneer, ghee, curd.
 */
export default async function CatalogPage() {
  const actor = await requireMilkman();
  const t = await getT();
  const locale = await getLocale();
  const isHi = locale === 'hi';
  const products = await productService.listCatalog(actor);

  const live = products.filter((product) => product.isActive);
  const outOfStock = live.filter((product) => Number(product.availableQuantity) <= 0);
  const hidden = products.length - live.length;

  const subtitle =
    products.length === 0
      ? isHi
        ? 'अभी कोई उत्पाद सूचीबद्ध नहीं है — अपने उत्पाद जोड़ने के लिए "आइटम जोड़ें" पर क्लिक करें।'
        : t('shop.subtitle', {}, 'Nothing listed yet — click Add item to list your products.')
      : [
          `${live.length} ${isHi ? 'दुकान में उपलब्ध' : t('shop.allProducts', {}, 'items in the shop')}`,
          outOfStock.length ? `${outOfStock.length} ${isHi ? 'आउट ऑफ स्टॉक' : t('shop.outOfStock', {}, 'out of stock')}` : null,
          hidden ? `${hidden} ${isHi ? 'छिपे हुए' : t('common.inactive', {}, 'hidden')}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <>
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-hero-blue p-5 text-white shadow-hero sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/25 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
              {isHi ? 'उत्पाद दुकान' : t('nav.shop', {}, 'Shop')}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {isHi ? 'उत्पाद कैटलॉग' : t('nav.catalog', {}, 'Catalog')}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
          </div>

          <ProductEditor
            trigger={
              <button
                type="button"
                className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95"
              >
                <PlusIcon className="h-4 w-4" />
                {isHi ? 'आइटम जोड़ें' : t('shop.add', {}, 'Add item')}
              </button>
            }
          />
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={isHi ? 'कुल उत्पाद' : t('orders.item', {}, 'Items')}
          value={products.length}
          icon={<CatalogIcon className="h-5 w-5" />}
          tone="brand"
        />
        <Stat
          label={isHi ? 'दुकान में सक्रिय' : t('shop.allProducts', {}, 'In the shop')}
          value={live.length}
          icon={<CartIcon className="h-5 w-5" />}
          tone="positive"
          hint={hidden ? `${hidden} ${isHi ? 'छिपे हुए' : t('common.inactive', {}, 'hidden')}` : undefined}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={isHi ? 'आउट ऑफ स्टॉक' : t('shop.outOfStock', {}, 'Out of stock')}
            value={outOfStock.length}
            icon={<RequestsIcon className="h-5 w-5" />}
            tone={outOfStock.length ? 'critical' : 'neutral'}
            hint={outOfStock.length ? outOfStock.map((product) => product.name).join(', ') : (isHi ? 'सभी उत्पाद उपलब्ध हैं' : t('common.active', {}, 'Everything is available'))}
          />
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<CatalogIcon className="h-8 w-8 text-brand" />}
          title={isHi ? 'आपके कैटलॉग में कुछ नहीं है' : t('shop.noProductsTitle', {}, 'Nothing in your catalog')}
          description={
            isHi
              ? 'पनीर, घी, और दही जैसे डेयरी उत्पाद जोड़ें, फिर उनकी कीमतें और स्टॉक सेट करें। ग्राहक इन्हें अपने दैनिक दूध के साथ ऑर्डर कर सकते हैं।'
              : t('shop.noProductsDesc', {}, 'Add dairy products like Paneer, Ghee, and Curd, then set your prices and stock. Customers can order these along with their daily milk.')
          }
          tip={
            isHi
              ? 'स्टॉक दैनिक होता है: ग्राहक आपके द्वारा दर्ज अधिकतम स्टॉक तक ही ऑर्डर कर सकते हैं।'
              : t('shop.noProductsTip', {}, 'Stock is per day: what you enter is the most a customer can order before you top it up.')
          }
          action={
            <ProductEditor
              trigger={
                <button
                  type="button"
                  className="tap inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                >
                  <PlusIcon className="h-4 w-4" />
                  {isHi ? 'अपना पहला आइटम जोड़ें' : t('shop.addFirstItem', {}, 'Add your first item')}
                </button>
              }
            />
          }
        />
      ) : (
        <section aria-labelledby="items-heading">
          <SectionHeading id="items-heading" count={products.length}>
            {isHi ? 'आपके उत्पाद' : t('shop.title', {}, 'Your items')}
          </SectionHeading>
          <ProductList products={products} />
        </section>
      )}
    </>
  );
}
