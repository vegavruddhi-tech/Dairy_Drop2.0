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
        toast.error(result.message ?? 'Could not delete product.');
      }
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onDelete={() => setDeleting(product)} />
        ))}
      </div>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="danger" loading={pending} onClick={confirmDelete}>
              <TrashIcon className="h-4 w-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          It disappears from the shop straight away. Orders already placed for it are not affected.
          If you only want to pause it, edit the item and untick “Visible to customers” instead.
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
  const [stock, setStock] = useState(Number(product.availableQuantity));
  const [pending, startTransition] = useTransition();
  const img = resolveProductImage(product);
  const tone = stockTone(stock, product.unit);
  const step = STOCK_STEP[product.unit] ?? 1;

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
        toast.error(result.message ?? 'Could not update stock.');
      }
    });
  }

  return (
    <article
      className={cn(
        'card-surface flex flex-col overflow-hidden transition-shadow hover:shadow-card-hover',
        product.isActive ? '' : 'opacity-70',
      )}
    >
      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        {img ? (
          <img src={img} alt={product.name} className="h-full w-full object-cover" />
        ) : null}
        {/* A soft fade at the foot so the chips read on any photo. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          {product.isActive ? (
            <Badge tone={tone} dot className="bg-surface/90 shadow-sm backdrop-blur-sm">
              {STOCK_LABEL[tone]}
            </Badge>
          ) : (
            <Badge tone="neutral" className="bg-surface/90 shadow-sm backdrop-blur-sm">Hidden from shop</Badge>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
          <h3 className="font-heading text-lg font-extrabold leading-tight tracking-tight drop-shadow-sm">
            {product.name}
          </h3>
          <p className="shrink-0 text-right">
            <span className="stat-number text-xl leading-none drop-shadow-sm">
              {formatPaise(rupeesToPaise(product.pricePerUnit), { whole: true })}
            </span>
            <span className="ml-1 text-[11px] font-bold text-white/85">/{product.unit}</span>
          </p>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {product.description ? (
          <p className="line-clamp-2 text-xs font-medium leading-relaxed text-ink-muted">{product.description}</p>
        ) : null}

        {/* ── Stock ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5',
            tone === 'critical'
              ? 'border-critical/25 bg-critical-soft/50'
              : tone === 'caution'
                ? 'border-caution/25 bg-caution-soft/60'
                : 'border-border bg-surface-muted/70',
          )}
        >
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">Stock today</p>
            <p
              className={cn(
                'stat-number text-2xl leading-none',
                tone === 'critical' ? 'text-critical' : tone === 'caution' ? 'text-caution' : 'text-ink',
              )}
              aria-live="polite"
            >
              {stock}
              <span className="ml-1 font-sans text-xs font-bold text-ink-muted">{product.unit}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Adjust stock of ${product.name}`}>
            <button
              type="button"
              onClick={() => adjust(-step)}
              disabled={pending || stock <= 0}
              aria-label={`Less by ${step} ${product.unit}`}
              className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-lg font-black text-ink shadow-xs transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => adjust(step)}
              disabled={pending}
              aria-label={`More by ${step} ${product.unit}`}
              className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-lg font-black text-brand shadow-xs transition-colors hover:bg-brand/10 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-1">
          <ProductEditor
            product={product}
            trigger={
              <Button variant="outline" className="w-full">
                <EditIcon className="h-4 w-4" />
                Edit item
              </Button>
            }
          />
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${product.name}`}
            title="Delete item"
            className="tap flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-ink-subtle shadow-xs transition-colors hover:border-critical/40 hover:bg-critical-soft hover:text-critical"
          >
            <TrashIcon className="h-4 w-4" />
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
