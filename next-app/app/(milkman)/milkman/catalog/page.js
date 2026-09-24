import { requireMilkman } from '@/auth/session.js';
import * as productService from '@/services/product.service.js';

import { EmptyState, Stat, SectionHeading } from '@/components/ui/index.jsx';
import { CatalogIcon, CartIcon, RequestsIcon, PlusIcon } from '@/components/ui/Icons.jsx';
import { ProductEditor, ProductList, AddPresets } from '@/components/milkman/Catalog.jsx';

export const metadata = { title: 'Catalog' };

/**
 * The extras a milkman sells alongside milk — paneer, ghee, curd.
 *
 * Stock is the number that matters on this page: a customer can only order
 * what is here, so each card carries it large with a stepper beside it.
 */
export default async function CatalogPage() {
  const actor = await requireMilkman();
  const products = await productService.listCatalog(actor);

  const live = products.filter((product) => product.isActive);
  const outOfStock = live.filter((product) => Number(product.availableQuantity) <= 0);
  const hidden = products.length - live.length;

  const subtitle =
    products.length === 0
      ? 'Nothing listed yet — add the usual dairy items in one tap.'
      : [
          `${live.length} ${live.length === 1 ? 'item' : 'items'} in the shop`,
          outOfStock.length ? `${outOfStock.length} out of stock` : null,
          hidden ? `${hidden} hidden` : null,
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
              Shop
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              Catalog
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
                Add item
              </button>
            }
          />
        </div>
      </section>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Items" value={products.length} icon={<CatalogIcon className="h-5 w-5" />} tone="brand" />
        <Stat
          label="In the shop"
          value={live.length}
          icon={<CartIcon className="h-5 w-5" />}
          tone="positive"
          hint={hidden ? `${hidden} hidden` : undefined}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label="Out of stock"
            value={outOfStock.length}
            icon={<RequestsIcon className="h-5 w-5" />}
            tone={outOfStock.length ? 'critical' : 'neutral'}
            hint={outOfStock.length ? outOfStock.map((product) => product.name).join(', ') : 'Everything is available'}
          />
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<CatalogIcon className="h-8 w-8 text-brand" />}
          title="Nothing in your catalog"
          description="Add the usual dairy items in one tap, then set your prices and stock. Customers order these with their milk and you carry them on the round."
          tip="Stock is per day: what you enter is the most a customer can order before you top it up."
          action={<AddPresets />}
        />
      ) : (
        <section aria-labelledby="items-heading">
          <SectionHeading id="items-heading" count={products.length}>
            Your items
          </SectionHeading>
          <ProductList products={products} />
        </section>
      )}
    </>
  );
}
