'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveProduct, addCatalogPresets, updateOrderStatus } from '@/actions/milkman.actions.js';

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

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>{product ? 'Edit' : 'Add item'}</Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={product ? 'Edit item' : 'Add item'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="product-form" type="submit" loading={pending}>Save</Button>
          </>
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
                isActive: data.isActive === 'on' || data.isActive === true,
              });
              if (result.ok) {
                toast.success('Saved.');
                setOpen(false);
                setErrors({});
              } else {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save.');
              }
            });
          }}
        >
          <Input name="name" label="Name" defaultValue={product?.name} error={errors.name} required placeholder="Paneer" />

          <div className="grid grid-cols-2 gap-3">
            <Input name="pricePerUnit" label="Price (₹)" inputMode="decimal" defaultValue={product ? Number(product.pricePerUnit) : ''} error={errors.pricePerUnit} required />
            <Select name="unit" label="Per" defaultValue={product?.unit ?? 'kg'} options={UNITS} />
          </div>

          <Input
            name="availableQuantity"
            label="Stock today"
            inputMode="decimal"
            defaultValue={product ? Number(product.availableQuantity) : '0'}
            error={errors.availableQuantity}
            hint="Customers cannot order more than this."
            required
          />

          <Textarea name="description" label="Description (optional)" defaultValue={product?.description ?? ''} maxLength={500} />

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product ? product.isActive : true}
              className="h-4 w-4 rounded border-border"
            />
            Show to customers
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
      onClick={() =>
        startTransition(async () => {
          const result = await addCatalogPresets();
          if (result.ok) {
            toast.success(`Added ${result.data.added} items. Set your prices and stock.`);
          } else {
            toast.error(result.message ?? 'Could not add those.');
          }
        })
      }
    >
      Add the usual dairy items
    </Button>
  );
}

export function ProductList({ products }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const stock = Number(product.availableQuantity);
        return (
          <Card key={product.id} className={product.isActive ? undefined : 'opacity-60'}>
            <CardBody className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{product.name}</p>
                {product.isActive ? (
                  <Badge tone={stock > 0 ? 'positive' : 'caution'}>
                    {stock > 0 ? `${stock} ${product.unit}` : 'Out of stock'}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Hidden</Badge>
                )}
              </div>

              <div>
                <span className="text-xl font-semibold tnum text-ink">
                  ₹{Number(product.pricePerUnit)}
                </span>
                <span className="ml-1 text-sm text-ink-muted">per {product.unit}</span>
              </div>

              <div className="mt-auto pt-2">
                <ProductEditor
                  product={product}
                  trigger={<Button size="sm" variant="outline">Edit</Button>}
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

  function set(status, message) {
    startTransition(async () => {
      const result = await updateOrderStatus({ purchaseId: order.id, status });
      if (result.ok) toast.success(message);
      else toast.error(result.message ?? 'Could not update that order.');
    });
  }

  return (
    <div className="flex gap-2">
      {order.status === 'PENDING' ? (
        <>
          <Button size="sm" loading={pending} onClick={() => set('ACCEPTED', 'Accepted.')}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => set('CANCELLED', 'Cancelled — stock returned.')}
          >
            Cannot supply
          </Button>
        </>
      ) : null}

      {order.status === 'ACCEPTED' ? (
        <Button size="sm" loading={pending} onClick={() => set('DELIVERED', 'Marked delivered.')}>
          Delivered
        </Button>
      ) : null}
    </div>
  );
}
