'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, QuantityStepper, Modal } from '@/components/ui/interactive.jsx';
import { orderProduct } from '@/actions/customer.actions.js';

import { resolveProductImage, resolveProductDescription, formatProductName } from '@/domain/catalogPresets.js';

export function OrderCard({ product }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const stock = Number(product.availableQuantity);
  const price = Number(product.pricePerUnit);
  const img = resolveProductImage(product);
  const displayName = formatProductName(product.name);
  const displayDescription = resolveProductDescription(product);

  const [quantity, setQuantity] = useState(1);

  return (
    <>
      <Card className="rounded-3xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-blue-200 flex flex-col bg-white">
        {img && (
          <div className="relative h-44 w-full overflow-hidden bg-slate-100 border-b border-border">
            <img
              src={img}
              alt={displayName}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute top-3 left-3">
              <span className="rounded-full bg-white/95 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-bold text-slate-800 shadow-sm border border-slate-200/80">
                Fresh Today
              </span>
            </div>
            <div className="absolute top-3 right-3">
              <Badge tone={stock > 2 ? 'positive' : 'caution'}>
                {stock} {product.unit} left
              </Badge>
            </div>
          </div>
        )}

        <CardBody className="flex flex-1 flex-col gap-2.5 p-5">
          <div>
            <h3 className="font-heading text-base font-bold text-ink">{displayName}</h3>
            {displayDescription ? (
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted leading-relaxed">
                {displayDescription}
              </p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="font-heading text-2xl font-black text-ink">₹{price}</span>
            <span className="text-xs font-semibold text-ink-subtle">per {product.unit}</span>
          </div>

          <div className="mt-auto pt-3 border-t border-border">
            <Button
              className="w-full font-bold shadow-sm"
              disabled={stock <= 0}
              onClick={() => {
                setQuantity(product.unit === 'pcs' ? 1 : 0.5);
                setOpen(true);
              }}
            >
              {stock > 0 ? '+ Order for Tomorrow' : 'Out of Stock'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Order ${displayName}`}
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
            const formQuantity = new FormData(event.currentTarget).get('quantity') || quantity;
            startTransition(async () => {
              const result = await orderProduct({ productId: product.id, quantity: formQuantity });
              if (result.ok) {
                toast.success(`Ordered ${displayName}! It will arrive with your morning delivery.`);
                setOpen(false);
              } else {
                toast.error(result.message ?? 'Could not place that order.');
              }
            });
          }}
        >
          <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-center">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              {displayName}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              ₹{price} per {product.unit} · {stock} {product.unit} in stock
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-2 gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
              Select Quantity ({product.unit})
            </label>
            <QuantityStepper
              name="quantity"
              defaultValue={product.unit === 'pcs' ? 1 : 0.5}
              step={product.unit === 'pcs' ? 1 : 0.5}
              min={product.unit === 'pcs' ? 1 : 0.25}
              max={Math.max(1, Math.min(stock, 20))}
              unit={product.unit}
            />
          </div>

          <p className="text-center text-xs text-ink-muted">
            Delivered with tomorrow's milk and billed to this month's statement.
          </p>
        </form>
      </Modal>
    </>
  );
}
