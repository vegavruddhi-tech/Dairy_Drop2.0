'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, QuantityStepper, Modal } from '@/components/ui/interactive.jsx';
import { orderProduct } from '@/actions/customer.actions.js';

import { resolveProductImage } from '@/domain/catalogPresets.js';

export function OrderCard({ product }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const stock = Number(product.availableQuantity);
  const price = Number(product.pricePerUnit);
  const img = resolveProductImage(product);

  return (
    <>
      <Card className="rounded-3xl overflow-hidden transition-shadow hover:shadow-card-hover flex flex-col">
        {img && (
          <div className="relative h-44 w-full overflow-hidden bg-surface-muted border-b border-border">
            <img
              src={img}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
            <div className="absolute top-3 right-3">
              <Badge tone={stock > 2 ? 'positive' : 'caution'}>
                {stock} {product.unit} left
              </Badge>
            </div>
          </div>
        )}

        <CardBody className="flex flex-1 flex-col gap-2.5 p-5">
          <div>
            <h3 className="font-heading text-base font-bold text-ink">{product.name}</h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">{product.description}</p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="font-heading text-2xl font-black text-ink">₹{price}</span>
            <span className="text-xs font-semibold text-ink-subtle">per {product.unit}</span>
          </div>

          <div className="mt-auto pt-3 border-t border-border">
            <Button
              className="w-full font-bold"
              disabled={stock <= 0}
              onClick={() => setOpen(true)}
            >
              {stock > 0 ? '+ Order for Tomorrow' : 'Out of Stock'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={product.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="order-form" type="submit" loading={pending}>Place order</Button>
          </>
        }
      >
        <form
          id="order-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const quantity = new FormData(event.currentTarget).get('quantity');
            startTransition(async () => {
              const result = await orderProduct({ productId: product.id, quantity });
              if (result.ok) {
                toast.success('Ordered. It will come with your next delivery.');
                setOpen(false);
              } else {
                toast.error(result.message ?? 'Could not place that order.');
              }
            });
          }}
        >
          <p className="text-sm text-ink-muted">
            ₹{price} per {product.unit} · {stock} {product.unit} available
          </p>

          <div className="flex justify-center py-2">
            <QuantityStepper
              name="quantity"
              defaultValue={1}
              step={product.unit === 'pcs' ? 1 : 0.5}
              min={product.unit === 'pcs' ? 1 : 0.25}
              max={Math.max(1, Math.min(stock, 20))}
              unit={product.unit}
            />
          </div>

          <p className="text-center text-xs text-ink-muted">
            Added to this month's bill.
          </p>
        </form>
      </Modal>
    </>
  );
}
