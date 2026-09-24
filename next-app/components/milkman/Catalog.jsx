'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveProduct, deleteProduct, addCatalogPresets, updateOrderStatus } from '@/actions/milkman.actions.js';
import { TOP_CATALOG_PRODUCTS, resolveProductImage } from '@/domain/catalogPresets.js';

const UNITS = [
  { value: 'L', label: 'Litres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'g', label: 'Grams' },
  { value: 'pcs', label: 'Pieces' },
];

export function ProductEditor({ product, trigger }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

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

  function handleDelete() {
    if (!product?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${product.name}" from your catalog?`)) return;

    startTransition(async () => {
      const result = await deleteProduct({ id: product.id });
      if (result.ok) {
        toast.success(`Deleted ${product.name}`);
        setOpen(false);
      } else {
        toast.error(result.message ?? 'Could not delete product.');
      }
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700 font-bold">
          {product ? 'Edit' : '+ Add Dairy Item'}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={product ? `Edit Item · ${product.name}` : 'Add Item to Catalog'}
        footer={
          <div className="flex w-full items-center justify-between">
            {product?.id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold text-xs"
                loading={pending}
                onClick={handleDelete}
              >
                Delete Item
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button form="product-form" type="submit" loading={pending} className="bg-blue-600 hover:bg-blue-700 font-bold">Save Item</Button>
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
            startTransition(async () => {
              const result = await saveProduct({
                ...data,
                id: product?.id,
                imageUrl: imageUrl || undefined,
                isActive: data.isActive === 'on' || data.isActive === true,
              });
              if (result.ok) {
                toast.success('Product saved to catalog.');
                setOpen(false);
                setErrors({});
              } else {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save product.');
              }
            });
          }}
        >
          {/* Top 10 Dairy Product Dropdown */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                ⚡ Top 10 Dairy Catalog Presets
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Auto-fills description & photo</span>
            </div>

            <select
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>-- Select from Top 10 Dairy Items --</option>
              {TOP_CATALOG_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ₹{p.defaultPrice}/{p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Product Image Preview */}
          {imageUrl && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <img
                src={imageUrl}
                alt={name}
                className="h-16 w-16 rounded-xl object-cover border border-slate-200 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">{name}</p>
                <p className="text-[11px] text-slate-500 line-clamp-1">{description}</p>
                <input type="hidden" name="imageUrl" value={imageUrl} />
              </div>
            </div>
          )}

          <Input
            name="name"
            label="Product Name"
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
            label="Stock Available Today"
            inputMode="decimal"
            value={availableQuantity}
            onChange={(e) => setAvailableQuantity(e.target.value)}
            error={errors.availableQuantity}
            hint="Customers cannot order more than this quantity."
            required
          />

          <Textarea
            name="description"
            label="Product Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product ? product.isActive : true}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Visible to customers in Shop
          </label>
        </form>
      </Modal>
    </>
  );
}

export function AddPresets() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      loading={pending}
      className="bg-blue-600 hover:bg-blue-700 font-bold"
      onClick={() =>
        startTransition(async () => {
          const result = await addCatalogPresets();
          if (result.ok) {
            toast.success(`Added ${result.data.added} items. Set your stock and prices.`);
          } else {
            toast.error(result.message ?? 'Could not add those.');
          }
        })
      }
    >
      + Add Top 10 Dairy Catalog Items
    </Button>
  );
}

export function ProductList({ products }) {
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState(null);

  function handleDeleteItem(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.name}" from your catalog?`)) return;

    setDeletingId(product.id);
    startTransition(async () => {
      try {
        const result = await deleteProduct({ id: product.id });
        if (result.ok) {
          toast.success(`Deleted ${product.name}`);
        } else {
          toast.error(result.message ?? 'Could not delete product.');
        }
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const stock = Number(product.availableQuantity);
        const img = resolveProductImage(product);

        return (
          <Card
            key={product.id}
            className={`border border-slate-200 bg-white shadow-sm hover:border-blue-400 hover:shadow-md transition-all rounded-3xl overflow-hidden flex flex-col ${
              product.isActive ? '' : 'opacity-60'
            }`}
          >
            {img && (
              <div className="relative h-44 w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                <img
                  src={img}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {product.isActive ? (
                    <Badge tone={stock > 0 ? 'positive' : 'caution'}>
                      {stock > 0 ? `${stock} ${product.unit} in stock` : 'Out of stock'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Hidden</Badge>
                  )}
                </div>
              </div>
            )}

            <CardBody className="flex flex-1 flex-col gap-2.5 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-950">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="font-heading text-2xl font-black text-slate-900">
                  ₹{Number(product.pricePerUnit)}
                </span>
                <span className="text-xs font-semibold text-slate-500">per {product.unit}</span>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deletingId === product.id}
                  disabled={pending && deletingId !== product.id}
                  onClick={() => handleDeleteItem(product)}
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold px-2"
                >
                  Delete
                </Button>

                <ProductEditor
                  product={product}
                  trigger={<Button size="sm" variant="outline" className="font-bold">Edit Item</Button>}
                />
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
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
    <div className="flex gap-2">
      {order.status === 'PENDING' ? (
        <>
          <Button size="sm" {...busy('ACCEPTED')} onClick={() => set('ACCEPTED', 'Accepted.')}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            {...busy('CANCELLED')}
            onClick={() => set('CANCELLED', 'Cancelled — stock returned.')}
          >
            Cannot supply
          </Button>
        </>
      ) : null}

      {order.status === 'ACCEPTED' ? (
        <Button size="sm" {...busy('DELIVERED')} onClick={() => set('DELIVERED', 'Marked delivered.')}>
          Delivered
        </Button>
      ) : null}
    </div>
  );
}
