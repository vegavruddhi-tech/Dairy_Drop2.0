'use client';

import { quoteForQuantity } from '@/domain/pricing.js';
import { businessMonth } from '@/domain/dates.js';
import { formatPaise } from '@/domain/money.js';

export const SLOT_LABEL = { MORNING: 'Morning', EVENING: 'Evening', BOTH: 'Morning & evening' };
export const FREQUENCY_LABEL = { DAILY: 'Every day', ALTERNATE_DAYS: 'Alternate days', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

/** "₹64.00/L" — the plan's per-unit rate, whatever basis it was saved on. */
export function rateLabel(plan) {
  try {
    const { unitPrice } = quoteForQuantity(plan, { quantity: plan.quantity }, businessMonth());
    return `₹${Number(unitPrice).toFixed(2)}/${plan.unit}`;
  } catch {
    return plan.pricePerDelivery ? `₹${plan.pricePerDelivery}/drop` : '—';
  }
}

/**
 * Litres per delivery for a chosen plan, with the price it comes to.
 *
 * Uses the same pricing function the server bills with, so the estimate here
 * is the figure the milkman sees when approving.
 */
export function QuantityPicker({ plan, value, onChange }) {
  const qty = Number(value);
  const valid = /^\d+(\.\d{1,3})?$/.test(value) && qty > 0;
  let quote = null;
  if (valid) {
    try {
      quote = quoteForQuantity(plan, { quantity: value }, businessMonth());
    } catch {
      quote = null;
    }
  }

  return (
    <div
      className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5"
      onClick={(event) => event.stopPropagation()}
    >
      <label htmlFor={`reg-qty-${plan.id}`} className="block text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
        How much per delivery
      </label>
      {/*
        Two rows, not one: in a half-width card the input, unit and a
        five-digit monthly price do not fit side by side, and the price spilled
        out of the box.
      */}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={`reg-qty-${plan.id}`}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-20 shrink-0 rounded-lg border bg-white px-2 text-center font-heading text-base font-black text-slate-900 focus:outline-none focus:ring-2 ${
            valid ? 'border-blue-200 focus:ring-blue-500/30' : 'border-rose-400 focus:ring-rose-400/30'
          }`}
        />
        <span className="text-xs font-bold text-slate-500">
          {plan.unit} {plan.slot === 'BOTH' ? 'each time' : 'per delivery'}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-blue-100 pt-2">
        <span className="font-heading text-base font-black text-slate-950 tnum">
          {quote ? formatPaise(quote.monthlyPaise, { whole: true }) : '—'}
          <span className="ml-0.5 text-[10px] font-bold text-slate-500">/month</span>
        </span>
        <span className="text-[11px] font-semibold text-slate-500 tnum">
          {quote
            ? `${formatPaise(quote.perDeliveryPaise)} × ${quote.deliveries} deliveries`
            : 'Enter an amount'}
        </span>
      </div>
    </div>
  );
}
