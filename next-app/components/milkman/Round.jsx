'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn, StatusBadge, Badge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import { Button, Modal, QuantityStepper, Textarea, Select } from '@/components/ui/interactive.jsx';
import {
  CheckIcon,
  PhoneIcon,
  ClockIcon,
  MapPinIcon,
  SunIcon,
  MoonIcon,
  CartIcon,
  UndoIcon,
  CalendarIcon,
  PackageIcon,
  NoteIcon,
  CloseIcon,
  TruckIcon,
} from '@/components/ui/Icons.jsx';
import { markDelivery, declareDayOff } from '@/actions/milkman.actions.js';
import { HolidayManagerModal } from './HolidayManagerModal.jsx';

/**
 * One stop on the round.
 *
 * Status changes are optimistic — the pill flips immediately and rolls back if
 * the server rejects it. On a patchy connection in a stairwell that is the
 * difference between a usable app and an unusable one.
 */
/**
 * How a stop's slot reads on the card.
 *
 * `BOTH` only appears on rows written before morning and evening were split
 * into separate deliveries; it is labelled plainly rather than hidden, because
 * one of those rows covers a whole day on its own.
 */
const SLOT_LABEL = { MORNING: 'Morning', EVENING: 'Evening', BOTH: 'All day' };

/** The slot's glyph and tint: amber sun for the morning, blue moon for the evening. */
const SLOT_STYLE = {
  MORNING: { Icon: SunIcon, tile: 'bg-caution-soft text-caution', tone: 'caution' },
  EVENING: { Icon: MoonIcon, tile: 'bg-info-soft text-info', tone: 'info' },
  BOTH: { Icon: SunIcon, tile: 'bg-brand-soft text-brand', tone: 'brand' },
};

/** How a settled card is edged, so the state reads from across the room. */
const STATUS_EDGE = {
  DELIVERED: 'border-2 border-emerald-500 bg-emerald-50/20 shadow-sm',
  UNDELIVERED: 'border-2 border-rose-300 bg-rose-50/20 opacity-80',
  SKIPPED: 'border border-slate-200 bg-slate-50/60 opacity-75',
};

export function RoundStop({ stop }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(stop.status);
  const [modal, setModal] = useState(null);

  const items = stop.items ?? [];
  const settled = status !== 'PENDING';
  const extras = stop.extras ?? [];
  const carryOnly = Boolean(stop.milkless);

  function mark(next, { quantities, ...extra } = {}) {
    startTransition(async () => {
      setStatus(next);
      const results = await Promise.all(
        items.map((item) =>
          markDelivery({
            deliveryId: item.id,
            status: next,
            ...(quantities?.[item.id] != null ? { quantity: quantities[item.id] } : {}),
            ...extra,
          }),
        ),
      );
      const failed = results.find((result) => !result.ok);
      if (failed) {
        setStatus(stop.status);
        toast.error(failed.message ?? 'Could not save that.');
      } else {
        setModal(null);
        router.refresh();
      }
    });
  }

  const slot = SLOT_STYLE[stop.slot] ?? SLOT_STYLE.BOTH;
  const dueWindow = stopWindow(stop);
  const address = [stop.addressLine1, stop.addressArea].filter(Boolean).join(', ');

  return (
    <>
      <article
        className={cn(
          'group relative overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition-all',
          settled
            ? STATUS_EDGE[status] ?? 'border-slate-200'
            : 'border-slate-200 hover:border-blue-400 hover:shadow-md',
        )}
        aria-label={`${stop.customerName}, ${SLOT_LABEL[stop.slot] ?? ''}`}
      >
        {/* Top status indicator line */}
        <div
          className={cn(
            'h-1.5 w-full',
            status === 'DELIVERED'
              ? 'bg-emerald-500'
              : status === 'UNDELIVERED'
                ? 'bg-rose-500'
                : status === 'SKIPPED'
                  ? 'bg-slate-300'
                  : 'bg-blue-600',
          )}
        />

        {/* ── Who and where ─────────────────────────────────────────── */}
        <div className="flex items-start gap-3.5 p-4 sm:p-5">
          <span
            aria-hidden="true"
            className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs', slot.tile)}
          >
            <slot.Icon className="h-6 w-6" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-lg font-black tracking-tight text-slate-950">
                {stop.customerName}
              </h3>
              {SLOT_LABEL[stop.slot] ? (
                <Badge tone={slot.tone}>{SLOT_LABEL[stop.slot]}</Badge>
              ) : null}
            </div>

            {address ? (
              <p className="mt-1 flex items-start gap-1.5 text-xs sm:text-sm font-medium text-slate-600">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  <strong className="text-slate-900">{stop.addressLine1}</strong>
                  {stop.addressArea ? `, ${stop.addressArea}` : ''}
                  {stop.addressLandmark ? (
                    <span className="block text-[11px] font-medium text-slate-400">Near {stop.addressLandmark}</span>
                  ) : null}
                </span>
              </p>
            ) : null}

            {dueWindow ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {dueWindow}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={status} />
            {stop.customerPhone ? (
              <a
                href={`tel:${stop.customerPhone}`}
                aria-label={`Call ${stop.customerName}`}
                className="tap flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 shadow-xs transition-colors hover:bg-blue-600 hover:text-white active:scale-95"
              >
                <PhoneIcon className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>

        {stop.deliveryInstructions ? (
          <div className="mx-4 mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs font-bold text-amber-900 sm:mx-5 flex items-center gap-2">
            <NoteIcon className="h-4 w-4 shrink-0 text-amber-800" />
            <span>{stop.deliveryInstructions}</span>
          </div>
        ) : null}

        {/* ── What goes out ─────────────────────────────────────────── */}
        {carryOnly ? null : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40">
            {items.map((item) => (
              <ItemLine key={item.id} item={item} status={status} />
            ))}
          </ul>
        )}

        {/* ── Extras to carry ───────────────────────────────────────── */}
        {extras.length > 0 ? (
          <div className="border-t-2 border-dashed border-amber-300 bg-linear-to-r from-amber-50 via-orange-50/60 to-amber-50 px-4 py-3.5 sm:px-5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900">
                <PackageIcon className="h-4 w-4 text-amber-800" />
                <span>Deliver Extra Products Today</span>
              </p>
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-900">
                {extras.length} {extras.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <ul className="space-y-2">
              {extras.map((extra) => (
                <li key={extra.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/90 border border-amber-200/80 px-3 py-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                      <PackageIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-slate-900">
                      <span className="tnum font-black text-base text-slate-950">{Number(extra.quantity)}</span>
                      <span className="text-slate-500 text-xs font-semibold"> {extra.unit} </span>
                      <strong className="font-heading text-sm font-bold text-slate-900">{extra.productName}</strong>
                    </span>
                  </div>
                  <span className="tnum font-extrabold text-sm text-amber-950">
                    {formatPaise(Math.round(Number(extra.amount ?? 0) * 100))}
                  </span>
                </li>
              ))}
            </ul>
            {carryOnly ? (
              <p className="mt-2 text-xs font-medium text-amber-800">
                No milk subscription scheduled for today — this stop is exclusively for delivering these ordered extras.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Big Tactile Actions ───────────────────────────────────── */}
        <div className="border-t border-slate-200/80 p-3.5 sm:px-5 sm:py-4 bg-white">
          {carryOnly ? (
            <a
              href="/milkman/orders"
              className="tap flex h-12 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white font-heading text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
            >
              Open Orders
            </a>
          ) : !settled ? (
            <div className="space-y-2">
              <button
                type="button"
                className="tap flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-heading text-sm font-black text-white shadow-md shadow-emerald-500/25 transition-all hover:bg-emerald-700 active:scale-[0.98]"
                disabled={pending}
                onClick={() => mark('DELIVERED')}
              >
                {pending ? null : <CheckIcon className="h-5 w-5 stroke-[2.5]" />}
                <span>
                  {extras.length > 0
                    ? `MARK DELIVERED (Milk + ${extras.map(e => e.productName).join(', ')})`
                    : 'MARK DELIVERED'}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="tap flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 font-heading text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-[0.98]"
                  onClick={() => setModal('partial')}
                >
                  Different Qty
                </button>
                <button
                  type="button"
                  className="tap flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 font-heading text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
                  onClick={() => setModal('not')}
                >
                  Not Delivered
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 py-1">
              <p className="font-heading text-xs font-bold text-slate-700 flex items-center gap-1.5">
                {status === 'DELIVERED' ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
                    <span>Marked Delivered</span>
                  </>
                ) : status === 'UNDELIVERED' ? (
                  <>
                    <CloseIcon className="h-4 w-4 text-rose-600 stroke-[2.5]" />
                    <span>Not Delivered (Not charged)</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-bold">PAUSED</span>
                    <span>Skipped (Not charged)</span>
                  </>
                )}
              </p>
              <button
                type="button"
                className="tap flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 font-heading text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                disabled={pending}
                onClick={() => mark('PENDING')}
              >
                <UndoIcon className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
            </div>
          )}
        </div>
      </article>

      {/* ── Delivered a different amount ─────────────────────────────── */}
      <Modal
        open={!carryOnly && modal === 'partial'}
        onClose={() => setModal(null)}
        title={`How much for ${stop.customerName}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button form="qty-form" type="submit" loading={pending}>Mark delivered</Button>
          </>
        }
      >
        <form
          id="qty-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            // One stepper per product: a visit carrying cow and buffalo milk
            // may differ on one of them and not the other.
            const quantities = Object.fromEntries(
              items.map((item) => [item.id, data.get(`qty:${item.id}`)]),
            );
            mark('DELIVERED', { quantities });
          }}
        >
          <p className="text-sm text-ink-muted">
            The bill follows what you actually leave.
          </p>
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <p className="mb-2 text-sm font-medium text-ink">
                {item.productName}
                <span className="ml-1.5 font-normal text-ink-muted">
                  planned {plannedFor(item)} {item.unit}
                </span>
              </p>
              <div className="flex justify-center">
                <QuantityStepper
                  name={`qty:${item.id}`}
                  defaultValue={plannedFor(item)}
                  unit={item.unit}
                />
              </div>
            </div>
          ))}
        </form>
      </Modal>

      {/* ── Not delivered ────────────────────────────────────────────── */}
      <Modal
        open={!carryOnly && modal === 'not'}
        onClose={() => setModal(null)}
        title="Why was it not delivered?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button form="not-form" type="submit" variant="danger" loading={pending}>Save</Button>
          </>
        }
      >
        <form
          id="not-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const reason = data.get('skipReason');
            mark(reason === 'CUSTOMER_ABSENT' ? 'UNDELIVERED' : 'SKIPPED', {
              skipReason: reason,
              note: data.get('note') || undefined,
            });
          }}
        >
          <p className="text-sm text-ink-muted">The customer is not charged either way.</p>
          <Select
            name="skipReason"
            label="Reason"
            options={[
              { value: 'CUSTOMER_ABSENT', label: 'Nobody home' },
              { value: 'CUSTOMER_REQUEST', label: 'Customer asked to skip' },
              { value: 'OUT_OF_STOCK', label: 'I ran out' },
              { value: 'OTHER', label: 'Something else' },
            ]}
          />
          <Textarea name="note" label="Note (optional)" maxLength={300} />
        </form>
      </Modal>
    </>
  );
}

/** Declare a day off — every remaining stop is skipped at no charge. */
/** Declare a route day off or holiday — only remaining pending stops are skipped at ₹0. */
export function DayOffButton({ date, count }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-muted hover:border-critical/40 hover:bg-critical-soft hover:text-critical"
      >
        <CalendarIcon className="h-4 w-4" />
        Day off / holiday
      </Button>

      <HolidayManagerModal
        open={open}
        onClose={() => setOpen(false)}
        defaultDate={date}
        remainingCount={count}
      />
    </>
  );
}

/**
 * The window a stop is due in, for the slot it actually runs.
 *
 * Empty for a stop with no window — plans predate this — and for a carry-only
 * stop, which has no subscription behind it.
 */
function stopWindow(stop) {
  const morning = formatWindow(stop.morningStart, stop.morningEnd);
  const evening = formatWindow(stop.eveningStart, stop.eveningEnd);

  if (stop.slot === 'MORNING') return morning;
  if (stop.slot === 'EVENING') return evening;
  return [morning, evening].filter(Boolean).join(' · ');
}

/** What this line was due to deliver today, adjustment included. */
function plannedFor(item) {
  return Number(item.adjustedQuantity ?? item.plannedQuantity);
}

/**
 * One product on a stop.
 *
 * Shows what is due, what it comes to, and — when they differ — what was
 * originally asked for, so the milkman is never left guessing whether a number
 * is the plan or a change to it.
 */
function ItemLine({ item, status }) {
  const planned = plannedFor(item);
  const delivered = status === 'DELIVERED' && item.deliveredQuantity != null;
  // Only a genuine difference is a change; confirming the dialog without
  // moving the stepper is not one.
  const adjusted =
    item.adjustedQuantity != null &&
    Number(item.adjustedQuantity) !== Number(item.plannedQuantity);

  const shownQuantity = delivered ? Number(item.deliveredQuantity) : planned;
  const shownPaise = delivered
    ? Math.round(Number(item.amount ?? 0) * 100)
    : Math.round(planned * Number(item.unitPrice ?? 0) * 100);

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-baseline gap-x-2 gap-y-0.5 flex-wrap">
        <span className={cn('stat-number text-2xl leading-none', delivered ? 'text-positive' : 'text-ink')}>
          {shownQuantity}
          <span className="ml-1 font-sans text-sm font-semibold text-ink-muted">{item.unit}</span>
        </span>
        <span className="text-sm font-semibold text-ink">{item.productName}</span>
        {delivered && Number(item.deliveredQuantity) !== planned ? (
          <span className="text-xs font-medium text-ink-subtle">asked {planned} {item.unit}</span>
        ) : null}
        {!delivered && adjusted ? (
          <span className="text-xs font-medium text-ink-subtle">usually {Number(item.plannedQuantity)} {item.unit}</span>
        ) : null}
        {adjusted ? <Badge tone="caution">changed today</Badge> : null}
      </div>
      {item.unitPrice ? (
        <div className="shrink-0 text-right">
          <p className="tnum text-sm font-extrabold text-ink">{formatPaise(shownPaise)}</p>
          <p className="tnum text-[11px] font-medium text-ink-subtle">₹{Number(item.unitPrice)}/{item.unit}</p>
        </div>
      ) : null}
    </li>
  );
}
