'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Badge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveProduct, deleteProduct, updateOrderStatus } from '@/actions/milkman.actions.js';
import { TOP_CATALOG_PRODUCTS, resolveProductImage } from '@/domain/catalogPresets.js';
import { CheckIcon, DeliveryIcon, PlusIcon, EditIcon, TrashIcon } from '@/components/ui/Icons.jsx';

const UNITS = [
  { value: 'L', label: 'Litres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'g', label: 'Grams' },
  { value: 'pcs', label: 'Pieces' },
];

/** How far one tap on the stock stepper moves, by unit. */
const STOCK_STEP = { L: 0.5, kg: 0.5, ml: 100, g: 100, pcs: 1 };

/** Below this many units the card turns amber. Rough, but it catches a stock-out before it happens. */
const LOW_STOCK = { L: 3, kg: 3, ml: 500, g: 500, pcs: 5 };

function stockTone(stock, unit) {
  if (stock <= 0) return 'critical';
  if (stock <= (LOW_STOCK[unit] ?? 3)) return 'caution';
  return 'positive';
}

const STOCK_LABEL = { critical: 'Out of stock', caution: 'Running low', positive: 'In stock' };

const rupeesToPaise = (value) => Math.round(Number(value ?? 0) * 100);

export function ProductEditor({ product, trigger }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(product?.name ?? 'Fresh Malai Paneer');
  const [unit, setUnit] = useState(product?.unit ?? 'kg');
  const [pricePerUnit, setPricePerUnit] = useState(
    product ? String(Number(product.pricePerUnit)) : '420.00',
  );
  const [availableQuantity, setAvailableQuantity] = useState(
    product ? String(Number(product.availableQuantity)) : '15',
  );
  const [description, setDescription] = useState(
    product?.description ??
      'Fresh, soft, and hygienic malai paneer made from pure whole milk without any preservatives.',
  );
  const [imageUrl, setImageUrl] = useState(
    product ? resolveProductImage(product) : '/products/paneer.jpg',
  );

  function close() {
    setOpen(false);
    setConfirmDelete(false);
  }

  function handlePresetSelect(presetId) {
    const item = TOP_CATALOG_PRODUCTS.find((p) => p.id === presetId);
    if (item) {
      setName(item.name);
      setUnit(item.unit);
      setPricePerUnit(item.defaultPrice);
      setAvailableQuantity(item.defaultStock);
      setDescription(item.description);
      setImageUrl(item.imageUrl);
    }
  }

  /* Two taps to delete — the second on a button that has changed its mind
     about what it is — rather than a browser confirm() over the sheet. */
  function handleDelete() {
    if (!product?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteProduct({ id: product.id });
      if (result.ok) {
        toast.success(`Deleted ${product.name}`);
        close();
      } else {
        toast.error(result.message ?? 'Could not delete product.');
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          {product ? <EditIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          {product ? 'Edit' : 'Add item'}
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={product ? `Edit · ${product.name}` : 'Add to your catalog'}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            {product?.id ? (
              <Button
                type="button"
                variant={confirmDelete ? 'danger' : 'ghost'}
                className={confirmDelete ? '' : 'text-critical hover:bg-critical-soft'}
                loading={pending && confirmDelete}
                onClick={handleDelete}
              >
                <TrashIcon className="h-4 w-4" />
                {confirmDelete ? 'Really delete' : 'Delete'}
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button form="product-form" type="submit" loading={pending && !confirmDelete}>
                <CheckIcon className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="product-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            close();
            const toastId = toast.loading(product?.id ? 'Updating item…' : 'Adding item to catalog…');
            startTransition(async () => {
              const result = await saveProduct({
                ...data,
                id: product?.id,
                imageUrl: imageUrl || undefined,
                isActive: data.isActive === 'on' || data.isActive === true,
              });
              if (result.ok) {
                toast.success('Saved to your catalog.', { id: toastId });
                setErrors({});
              } else {
                setOpen(true);
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save product.', { id: toastId });
              }
            });
          }}
        >
          {/* Presets: the usual dairy items with a photo and a description ready. */}
          <div className="space-y-2 rounded-2xl border border-brand/20 bg-brand-soft/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Start from a preset</span>
              <span className="text-[10px] font-medium text-ink-subtle">Fills photo, price and description</span>
            </div>
            <select
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink shadow-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              defaultValue=""
            >
              <option value="" disabled>Choose a dairy item…</option>
              {TOP_CATALOG_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ₹{p.defaultPrice}/{p.unit}
                </option>
              ))}
            </select>
          </div>

          {imageUrl ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface-muted/60 p-3">
              <img src={imageUrl} alt={name} className="h-16 w-16 rounded-xl border border-border object-cover shadow-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{name || 'Untitled'}</p>
                <p className="line-clamp-2 text-xs text-ink-muted">{description}</p>
                <input type="hidden" name="imageUrl" value={imageUrl} />
              </div>
            </div>
          ) : null}

          <Input
            name="name"
            label="Product name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setImageUrl(resolveProductImage({ name: e.target.value }));
            }}
            error={errors.name}
            required
            placeholder="Fresh Malai Paneer"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              name="pricePerUnit"
              label="Price (₹)"
              inputMode="decimal"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              error={errors.pricePerUnit}
              required
            />
            <Select
              name="unit"
              label="Per"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              options={UNITS}
            />
          </div>

          <Input
            name="availableQuantity"
            label="Stock available today"
            inputMode="decimal"
            value={availableQuantity}
            onChange={(e) => setAvailableQuantity(e.target.value)}
            error={errors.availableQuantity}
            hint="Customers cannot order more than this."
            required
          />

          <Textarea
            name="description"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product ? product.isActive : true}
              className="h-4 w-4 rounded border-border accent-brand"
            />
            Visible to customers in the shop
          </label>
        </form>
      </Modal>
    </>
  );
}

export function ProductList({ products }) {
  const { t } = useT();
  const [deleting, setDeleting] = useState(null); // the product awaiting confirmation
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    const product = deleting;
    if (!product) return;
    startTransition(async () => {
      const result = await deleteProduct({ id: product.id });
      if (result.ok) {
        toast.success(`Deleted ${product.name}`);
        setDeleting(null);
      } else {
        toast.error(result.message ?? t('common.tryAgain', {}, 'Could not delete product.'));
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onDelete={() => setDeleting(product)} />
        ))}
      </div>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `${t('common.delete', {}, 'Delete')} ${deleting.name}?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel', {}, 'Keep it')}</Button>
            <Button variant="danger" loading={pending} onClick={confirmDelete}>
              <TrashIcon className="h-4 w-4" />
              {t('common.delete', {}, 'Delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {t('shop.subtitle', {}, 'It disappears from the shop straight away. Orders already placed for it are not affected.')}
        </p>
      </Modal>
    </>
  );
}

/**
 * One item in the catalog.
 *
 * The stock strip is the working part: a milkman who has just sold the last
 * two kilos of paneer taps “−” twice and is done, without opening the editor.
 * Each tap saves the whole product, because the save action validates a
 * complete item — there is no stock-only endpoint to drift from it.
 */
function ProductCard({ product, onDelete }) {
  const { t } = useT();
  const [stock, setStock] = useState(Number(product.availableQuantity));
  const [pending, startTransition] = useTransition();
  const img = resolveProductImage(product);
  const tone = stockTone(stock, product.unit);
  const step = STOCK_STEP[product.unit] ?? 1;

  const STOCK_LABEL_MAP = {
    critical: t('shop.outOfStock', {}, 'Out of stock'),
    caution: t('common.warning', {}, 'Running low'),
    positive: t('common.active', {}, 'In stock'),
  };

  function adjust(delta) {
    const next = Math.max(0, Number((stock + delta).toFixed(3)));
    if (next === stock) return;
    const previous = stock;
    setStock(next);
    startTransition(async () => {
      const result = await saveProduct({
        id: product.id,
        name: product.name,
        description: product.description ?? '',
        imageUrl: product.imageUrl ?? '',
        unit: product.unit,
        pricePerUnit: String(Number(product.pricePerUnit)),
        availableQuantity: String(next),
        isActive: product.isActive,
      });
      if (!result.ok) {
        setStock(previous);
        toast.error(result.message ?? t('common.tryAgain', {}, 'Could not update stock.'));
      }
    });
  }

  return (
    <article
      className={cn(
        'card-surface flex flex-col overflow-hidden transition-all hover:shadow-card-hover rounded-2xl border border-slate-200/90',
        product.isActive ? 'bg-white' : 'opacity-70 bg-slate-50',
      )}
    >
      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        {img ? (
          <img src={img} alt={product.name} className="h-full w-full object-cover" />
        ) : null}
        {/* A soft fade at the foot so the chips read on any photo. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute left-2 top-2 sm:left-3 sm:top-3 flex items-center gap-1">
          {product.isActive ? (
            <Badge tone={tone} dot className="bg-surface/90 text-[10px] sm:text-xs py-0.5 px-1.5 sm:px-2 shadow-sm backdrop-blur-sm">
              {STOCK_LABEL_MAP[tone]}
            </Badge>
          ) : (
            <Badge tone="neutral" className="bg-surface/90 text-[10px] sm:text-xs py-0.5 px-1.5 shadow-sm backdrop-blur-sm">{t('common.inactive', {}, 'Hidden')}</Badge>
          )}
        </div>

        <div className="absolute bottom-2 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 flex items-end justify-between gap-1 text-white">
          <h3 className="font-heading text-xs sm:text-base font-black leading-tight tracking-tight drop-shadow-sm truncate">
            {product.name}
          </h3>
          <p className="shrink-0 text-right leading-none">
            <span className="stat-number text-xs sm:text-base font-black leading-none drop-shadow-sm">
              {formatPaise(rupeesToPaise(product.pricePerUnit), { whole: true })}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-white/90">/{product.unit}</span>
          </p>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3.5">
        {product.description ? (
          <p className="line-clamp-1 text-[10.5px] sm:text-xs font-medium leading-tight text-slate-500">{product.description}</p>
        ) : null}

        {/* ── Stock ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 sm:px-2.5 sm:py-2',
            tone === 'critical'
              ? 'border-rose-200 bg-rose-50/60'
              : tone === 'caution'
                ? 'border-amber-200 bg-amber-50/70'
                : 'border-slate-200/80 bg-slate-50/80',
          )}
        >
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{t('common.quantity', {}, 'Stock')}</p>
            <p
              className={cn(
                'stat-number text-base sm:text-xl font-black leading-none',
                tone === 'critical' ? 'text-rose-600' : tone === 'caution' ? 'text-amber-600' : 'text-slate-900',
              )}
              aria-live="polite"
            >
              {stock}
              <span className="ml-0.5 font-sans text-[10px] sm:text-xs font-bold text-slate-500">{product.unit}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Adjust stock of ${product.name}`}>
            <button
              type="button"
              onClick={() => adjust(-step)}
              disabled={pending || stock <= 0}
              aria-label={`Less by ${step} ${product.unit}`}
              className="tap flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-black text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 disabled:opacity-30 active:scale-95"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => adjust(step)}
              disabled={pending}
              aria-label={`More by ${step} ${product.unit}`}
              className="tap flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-base font-black text-blue-700 shadow-2xs transition-colors hover:bg-blue-100 disabled:opacity-30 active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-1.5 pt-1">
          <ProductEditor
            product={product}
            trigger={
              <button
                type="button"
                className="tap flex h-8 sm:h-9 w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white font-heading text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                <EditIcon className="h-3.5 w-3.5" />
                <span className="truncate">{t('common.edit', {}, 'Edit')}</span>
              </button>
            }
          />
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${product.name}`}
            title="Delete item"
            className="tap flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-2xs transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function OrderActions({ order }) {
  const [pending, startTransition] = useTransition();
  /*
   * Which action is in flight, not merely that one is.
   *
   * `useTransition` gives one flag for the whole component, and Accept and
   * Cannot supply are visible side by side — so pressing either spun both,
   * which reads as "the order is being accepted AND refused". The sibling is
   * disabled instead, so a second press cannot race the first.
   */
  const [active, setActive] = useState(null);

  function set(status, message) {
    setActive(status);
    startTransition(async () => {
      try {
        const result = await updateOrderStatus({ purchaseId: order.id, status });
        if (result.ok) toast.success(message);
        else toast.error(result.message ?? 'Could not update that order.');
      } finally {
        setActive(null);
      }
    });
  }

  const busy = (status) => ({
    loading: active === status,
    disabled: pending && active !== status,
  });

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      {order.status === 'PENDING' ? (
        <>
          <Button {...busy('ACCEPTED')} onClick={() => set('ACCEPTED', 'Accepted — it is on your round.')}>
            {active === 'ACCEPTED' ? null : <CheckIcon className="h-4 w-4" />}
            Accept
          </Button>
          <Button
            variant="outline"
            {...busy('CANCELLED')}
            onClick={() => set('CANCELLED', 'Cancelled — stock returned.')}
            className="text-critical hover:border-critical/40 hover:bg-critical-soft"
          >
            Cannot supply
          </Button>
        </>
      ) : null}

      {order.status === 'ACCEPTED' ? (
        <Button
          {...busy('DELIVERED')}
          onClick={() => set('DELIVERED', 'Marked delivered.')}
          className="col-span-2"
        >
          {active === 'DELIVERED' ? null : <DeliveryIcon className="h-4 w-4" />}
          Handed over
        </Button>
      ) : null}
    </div>
  );
}
