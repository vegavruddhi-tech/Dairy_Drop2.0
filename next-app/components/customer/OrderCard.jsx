'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge, cn } from '@/components/ui/index.jsx';
import { Button, QuantityStepper, Modal } from '@/components/ui/interactive.jsx';
import { TruckIcon, InfoIcon } from '@/components/ui/Icons.jsx';
import { orderProduct } from '@/actions/customer.actions.js';
import { useT } from '@/i18n/provider.jsx';
import { resolveProductImage, resolveProductDescription, formatProductName } from '@/domain/catalogPresets.js';

export function OrderCard({ product }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const stock = Number(product.availableQuantity);
  const price = Number(product.pricePerUnit);
  const img = resolveProductImage(product);
  // Product name stays strictly in English Title Case
  const displayName = formatProductName(product.name);
  const displayDescription = resolveProductDescription(product);

  const isPiece = product.unit === 'pcs';
  const defaultStep = isPiece ? 1 : 0.25;
  const defaultMin = isPiece ? 1 : 0.25;

  const [quantity, setQuantity] = useState(defaultMin);

  // Quick preset chips for 250g multiples (250g, 500g, 750g, 1kg)
  const presets = isPiece
    ? [1, 2, 3, 5].map((v) => ({ label: `${v} pcs`, val: v }))
    : product.unit === 'kg'
      ? [
          { label: '250 g', val: 0.25 },
          { label: '500 g', val: 0.5 },
          { label: '750 g', val: 0.75 },
          { label: '1 kg', val: 1.0 },
        ]
      : [
          { label: '250 ml', val: 0.25 },
          { label: '500 ml', val: 0.5 },
          { label: '750 ml', val: 0.75 },
          { label: '1 L', val: 1.0 },
        ];

  const totalAmount = ((Number(quantity) || 0) * price).toFixed(2);

  return (
    <>
      <Card className="rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-blue-200 flex flex-col bg-white border border-slate-200">
        {img && (
          <div className="relative aspect-[4/3] sm:h-44 w-full overflow-hidden bg-slate-100 border-b border-border">
            <img
              src={img}
              alt={displayName}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
              <span className="rounded-full bg-white/95 backdrop-blur-sm px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-800 shadow-sm border border-slate-200/80">
                {isHi ? 'ताज़ा आज' : 'Fresh Today'}
              </span>
            </div>
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
              <Badge tone={stock > 2 ? 'positive' : 'caution'} className="text-[10px] sm:text-xs py-0.5 px-1.5 sm:px-2">
                {stock} {product.unit} {isHi ? 'शेष' : 'left'}
              </Badge>
            </div>
          </div>
        )}

        <CardBody className="flex flex-1 flex-col gap-2 p-2.5 sm:p-5">
          <div>
            <h3 className="font-heading text-xs sm:text-base font-bold text-ink truncate">{displayName}</h3>
            {displayDescription ? (
              <p className="mt-0.5 line-clamp-1 sm:line-clamp-2 text-[10.5px] sm:text-xs text-ink-muted leading-relaxed">
                {displayDescription}
              </p>
            ) : null}
          </div>

          <div className="flex items-baseline gap-1 pt-0.5">
            <span className="font-heading text-base sm:text-2xl font-black text-ink">₹{price}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-ink-subtle">
              {isHi ? `/${product.unit}` : `per ${product.unit}`}
            </span>
          </div>

          <div className="mt-auto pt-2 sm:pt-3 border-t border-border">
            <div className="mb-1.5 hidden sm:flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5 text-blue-700">
                <TruckIcon className="h-3.5 w-3.5 text-blue-600" />
                <span>{isHi ? 'कल सुबह पहुंचेगा' : 'Arrives Tomorrow Morning'}</span>
              </span>
              <span>{isHi ? 'मासिक बिल में जुड़ेगा' : 'Billed in monthly tab'}</span>
            </div>
            <Button
              className="w-full text-xs font-bold shadow-sm py-1.5 sm:py-2.5"
              disabled={stock <= 0}
              onClick={() => {
                setQuantity(defaultMin);
                setOpen(true);
              }}
            >
              {stock > 0
                ? isHi
                  ? '+ ऑर्डर करें'
                  : '+ Order'
                : isHi
                  ? 'स्टॉक समाप्त'
                  : 'Out of Stock'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isHi ? `${displayName} ऑर्डर करें` : `Order ${displayName}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {isHi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button form={`order-form-${product.id}`} type="submit" loading={pending}>
              {isHi ? 'कल के लिए ऑर्डर कन्फर्म करें' : 'Confirm Order for Tomorrow'}
            </Button>
          </>
        }
      >
        <form
          id={`order-form-${product.id}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formQuantity = new FormData(event.currentTarget).get('quantity') || quantity;
            startTransition(async () => {
              const result = await orderProduct({ productId: product.id, quantity: formQuantity });
              if (result.ok) {
                toast.success(
                  isHi
                    ? `${displayName} का ऑर्डर दर्ज हो गया! यह कल सुबह आपके दूध के साथ पहुंचेगा।`
                    : `Ordered ${displayName}! It will be delivered tomorrow morning with your milk.`
                );
                setOpen(false);
              } else {
                toast.error(result.message ?? (isHi ? 'ऑर्डर नहीं हो सका।' : 'Could not place that order.'));
              }
            });
          }}
        >
          <div className="rounded-2xl bg-blue-50/80 border border-blue-200/80 p-4 text-center">
            <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider mb-1">
              {isHi ? 'अगली सुबह डिलीवरी' : 'Next-Morning Delivery'}
            </span>
            <p className="text-sm font-bold text-slate-900">
              {displayName}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              ₹{price} {isHi ? `प्रति ${product.unit}` : `per ${product.unit}`} · {stock} {product.unit} {isHi ? 'उपलब्ध' : 'currently in stock'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-2 gap-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
              {isHi ? `मात्रा चुनें (${product.unit})` : `Select Quantity (${product.unit})`}
            </label>
            <QuantityStepper
              name="quantity"
              value={quantity}
              onChange={setQuantity}
              defaultValue={defaultMin}
              step={defaultStep}
              min={defaultMin}
              max={Math.max(defaultMin, Math.min(stock, 20))}
              unit={product.unit}
            />

            {/* Quick 250g / 500g / 750g / 1kg Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {presets.map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setQuantity(preset.val)}
                  className={cn(
                    'tap px-3 py-1 rounded-xl text-xs font-bold transition-all border shadow-2xs',
                    Number(quantity) === preset.val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Live Price Estimation */}
            <div className="mt-1 rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-1.5 text-center">
              <span className="text-xs text-slate-500 font-semibold">
                {isHi ? 'कुल मूल्य: ' : 'Total Amount: '}
              </span>
              <strong className="text-base font-black text-slate-900 ml-1">
                ₹{totalAmount}
              </strong>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950 flex items-start gap-2.5">
            <InfoIcon className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p>
              {isHi
                ? 'यह आइटम कल सुबह की दूध डिलीवरी के साथ सीधे आपके दरवाजे पर रख दिया जाएगा और आपके मासिक बिल में जुड़ जाएगा।'
                : 'This item will ride along on tomorrow morning’s round, placed at your doorstep and added to your monthly ledger.'}
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}
