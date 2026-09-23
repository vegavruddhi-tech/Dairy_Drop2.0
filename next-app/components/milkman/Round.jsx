'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import { Button, Modal, QuantityStepper, Textarea, Select } from '@/components/ui/interactive.jsx';
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

  return (
    <>
      <Card className={settled ? 'opacity-70' : undefined}>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{stop.customerName}</p>
                {/*
                  * Which round this stop belongs to.
                  *
                  * A "morning & evening" customer now has two stops, and
                  * without this they were two identical cards — same name,
                  * same address, same quantity — with no way to tell which
                  * one had just been marked delivered.
                  */}
                {SLOT_LABEL[stop.slot] ? (
                  <Badge tone={stop.slot === 'EVENING' ? 'info' : 'caution'}>
                    {SLOT_LABEL[stop.slot]}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">
                {[stop.addressLine1, stop.addressArea].filter(Boolean).join(', ')}
              </p>
              {stop.addressLandmark ? (
                <p className="text-xs text-ink-subtle">Near {stop.addressLandmark}</p>
              ) : null}
              {/* The window this customer was promised, so the round can be
                  ordered against it rather than against memory. */}
              {stopWindow(stop) ? (
                <p className="mt-0.5 text-xs font-medium text-ink-muted">
                  {stopWindow(stop)}
                </p>
              ) : null}
              {stop.deliveryInstructions ? (
                <p className="mt-1 rounded-lg bg-info-soft px-2 py-1 text-xs text-info">
                  {stop.deliveryInstructions}
                </p>
              ) : null}
            </div>
            <StatusBadge status={status} />
          </div>

          {carryOnly ? null : (
            <div className="space-y-2 border-t border-border pt-3">
              {items.map((item) => (
                <ItemLine key={item.id} item={item} status={status} />
              ))}
              {stop.customerPhone ? (
                <a
                  href={`tel:${stop.customerPhone}`}
                  className="tap inline-block rounded-lg border border-border px-3 py-2 text-sm text-ink-muted"
                >
                  Call
                </a>
              ) : null}
            </div>
          )}

          {/* ── Extras to carry ──────────────────────────────────────── */}
          {extras.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                Also carry
              </p>
              <ul className="space-y-1.5">
                {extras.map((extra) => (
                  <li key={extra.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink">
                      <span className="font-medium tnum">{Number(extra.quantity)}</span>
                      <span className="text-ink-muted"> {extra.unit} </span>
                      {extra.productName}
                    </span>
                    <span className="tnum text-ink-muted">
                      {formatPaise(Math.round(Number(extra.amount ?? 0) * 100))}
                    </span>
                  </li>
                ))}
              </ul>
              {carryOnly ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  No milk plan today — this stop is for the extras. Mark them on Orders.
                </p>
              ) : null}
            </div>
          ) : null}

          {carryOnly ? (
            <a
              href="/milkman/orders"
              className="tap block rounded-lg border border-border px-3 py-2 text-center text-sm text-ink-muted"
            >
              Open orders
            </a>
          ) : !settled ? (
            <div className="grid grid-cols-3 gap-2">
              <Button size="lg" loading={pending} onClick={() => mark('DELIVERED')}>
                Delivered
              </Button>
              <Button size="lg" variant="outline" onClick={() => setModal('partial')}>
                Different qty
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setModal('not')}>
                Not delivered
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" loading={pending} onClick={() => mark('PENDING')}>
              Undo
            </Button>
          )}
        </CardBody>
      </Card>

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
        className="font-semibold text-xs border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-red-700 hover:border-red-300 transition-colors"
      >
        Route Day Off / Holiday
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

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div>
        <span className="text-xl font-semibold tnum text-ink">
          {delivered ? Number(item.deliveredQuantity) : planned}
        </span>
        <span className="ml-1 text-sm text-ink-muted">{item.unit}</span>
        {delivered
          ? Number(item.deliveredQuantity) !== planned && (
              <span className="ml-2 text-xs text-ink-muted">
                asked {planned} {item.unit}
              </span>
            )
          : adjusted && (
              <span className="ml-2 text-xs text-ink-muted">
                usually {Number(item.plannedQuantity)} {item.unit}
              </span>
            )}
      </div>
      <span className="text-sm text-ink-muted">{item.productName}</span>
      {item.unitPrice ? (
        <span className="tnum text-sm text-ink-muted">
          {delivered
            ? formatPaise(Math.round(Number(item.amount ?? 0) * 100))
            : formatPaise(Math.round(planned * Number(item.unitPrice) * 100))}
          <span className="ml-1 text-xs text-ink-subtle">
            @ ₹{Number(item.unitPrice)}/{item.unit}
          </span>
        </span>
      ) : null}
      {adjusted ? <Badge tone="caution">changed today</Badge> : null}
    </div>
  );
}
