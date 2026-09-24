'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/components/ui/index.jsx';

/**
 * The customer picker at the top of the earnings page.
 *
 * Choosing a name puts `?customer=<id>` in the URL, so the filter survives a
 * reload, can be shared, and narrows every figure on the page — tiles,
 * breakdown, extras, payments — without any client state of its own.
 *
 * @param {object} props
 * @param {string} props.month
 * @param {Array<{id: string, name: string}>} props.customers
 * @param {string|null} props.value  the selected customer id
 */
export function CustomerFilter({ month, customers, value }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(customerId) {
    const query = new URLSearchParams({ month });
    if (customerId) query.set('customer', customerId);
    startTransition(() => {
      router.push(`/milkman/earnings?${query}`, { scroll: false });
    });
  }

  return (
    <label className="flex w-full items-center gap-2 sm:w-auto">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Customer</span>
      <select
        value={value ?? ''}
        onChange={(event) => choose(event.target.value)}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          'h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-ink shadow-xs transition-all sm:w-64',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60',
        )}
      >
        <option value="">All customers</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
    </label>
  );
}
