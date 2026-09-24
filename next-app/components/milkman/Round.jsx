'use client';

import { useState, useTransition, useOptimistic } from 'react';
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
  DELIVERED: 'border-positive/30',
  UNDELIVERED: 'border-critical/30',
  SKIPPED: 'border-border',
};

export function RoundStop({ stop }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(stop.status);
  const [modal, setModal] = useState(null);

  /*
   * A stop is one visit, carrying one or more products.
   *
   * A customer may take cow milk and buffalo milk in the same morning. That is
   * two delivery rows but one knock at the door, so the card lists them and the
   * buttons act on all of them together.
   */
  const items = stop.items ?? [];
  const settled = status !== 'PENDING';

  /*
   * A stop with no milk exists only to carry extras — the customer ordered
   * something but has no plan running today. There is no delivery row behind
   * it, so it has nothing to mark; the Orders screen owns purchase status.
   */
  const extras = stop.extras ?? [];
  const carryOnly = Boolean(stop.milkless);

  /**
   * Mark every line on this visit.
   *
   * `quantities` maps a delivery id to what actually went out, for the case
   * where one product differed; anything absent keeps its planned amount.
   * A single failure rolls the whole card back rather than leaving the milkman
   * looking at a stop that is half saved.
   */
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
          'card-surface overflow-hidden transition-shadow',
          settled ? STATUS_EDGE[status] ?? 'border-border' : 'hover:shadow-card-hover',
          status === 'SKIPPED' ? 'opacity-75' : '',
        )}
        aria-label={`${stop.customerName}, ${SLOT_LABEL[stop.slot] ?? ''}`}
      >
        {/* ── Who and where ─────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
          <span
            aria-hidden="true"
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', slot.tile)}
          >
            <slot.Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-base font-extrabold tracking-tight text-ink">
                {stop.customerName}
              </h3>
              {/*
                * Which round this stop belongs to.
                *
                * A "morning & evening" customer has two stops, and without
                * this they were two identical cards — same name, same
                * address, same quantity — with no way to tell which one had
                * just been marked delivered.
                */}
              {SLOT_LABEL[stop.slot] ? <Badge tone={slot.tone}>{SLOT_LABEL[stop.slot]}</Badge> : null}
            </div>

            {address ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-ink-muted">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                <span>
                  {address}
                  {stop.addressLandmark ? (
                    <span className="block text-xs font-medium text-ink-subtle">Near {stop.addressLandmark}</span>
                  ) : null}
                </span>
              </p>
            ) : null}

            {/* The window this customer was promised, so the round can be
                ordered against it rather than against memory. */}
            {dueWindow ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <ClockIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
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
                className="tap flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
              >
                <PhoneIcon className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        {stop.deliveryInstructions ? (
          <div className="mx-4 mb-3 rounded-xl border border-info/15 bg-info-soft px-3 py-2 text-xs font-semibold text-info sm:mx-5">
            {stop.deliveryInstructions}
          </div>
        ) : null}

        {/* ── What goes out ─────────────────────────────────────────── */}
        {carryOnly ? null : (
          <ul className="divide-y divide-border border-t border-border">
            {items.map((item) => (
              <ItemLine key={item.id} item={item} status={status} />
            ))}
          </ul>
        )}

        {/* ── Extras to carry ───────────────────────────────────────── */}
        {extras.length > 0 ? (
          <div className="border-t border-border bg-surface-muted/60 px-4 py-3 sm:px-5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
              <CartIcon className="h-4 w-4" />
              Also carry
            </p>
            <ul className="space-y-1.5">
              {extras.map((extra) => (
                <li key={extra.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <span className="tnum font-extrabold">{Number(extra.quantity)}</span>
                    <span className="text-ink-muted"> {extra.unit} </span>
                    <span className="font-semibold">{extra.productName}</span>
                  </span>
                  <span className="tnum font-semibold text-ink-muted">
                    {formatPaise(Math.round(Number(extra.amount ?? 0) * 100))}
                  </span>
                </li>
              ))}
            </ul>
            {carryOnly ? (
              <p className="mt-2 text-xs font-medium text-ink-subtle">
                No milk plan today — this stop is for the extras. Mark them on Orders.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="border-t border-border p-3 sm:px-5 sm:py-4">
          {carryOnly ? (
            <a
              href="/milkman/orders"
              className="tap flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-sm font-bold text-ink shadow-xs transition-colors hover:bg-surface-muted"
            >
              Open orders
            </a>
          ) : !settled ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" loading={pending} onClick={() => mark('DELIVERED')} className="col-span-2">
                {pending ? null : <CheckIcon className="h-5 w-5" />}
                Delivered
              </Button>
              <Button size="lg" variant="outline" onClick={() => setModal('partial')}>
                Different qty
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setModal('not')}
                className="text-critical hover:border-critical/40 hover:bg-critical-soft"
              >
                Not delivered
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink-subtle">
                {status === 'DELIVERED'
                  ? 'Marked delivered.'
                  : status === 'UNDELIVERED'
                    ? 'Marked not delivered — not charged.'
                    : 'Skipped — not charged.'}
              </p>
              <Button size="sm" variant="ghost" loading={pending} onClick={() => mark('PENDING')}>
                <UndoIcon className="h-4 w-4" />
                Undo
              </Button>
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
