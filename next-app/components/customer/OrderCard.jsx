'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, QuantityStepper, Modal } from '@/components/ui/interactive.jsx';
import { orderProduct } from '@/actions/customer.actions.js';

export function OrderCard({ product }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const stock = Number(product.availableQuantity);
  const price = Number(product.pricePerUnit);

  return (
    <>
      <Card>
        <CardBody className="flex h-full flex-col gap-3">
          <div>
            <p className="font-medium text-ink">{product.name}</p>
            {product.description ? (
              <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{product.description}</p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tnum text-ink">₹{price}</span>
            <span className="text-sm text-ink-muted">per {product.unit}</span>
          </div>

          <Badge tone={stock > 2 ? 'positive' : 'caution'}>
            {stock} {product.unit} left
          </Badge>

          <div className="mt-auto pt-1">
            <Button className="w-full" onClick={() => setOpen(true)}>
              Order
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
