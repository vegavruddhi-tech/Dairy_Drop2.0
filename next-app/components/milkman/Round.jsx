'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge } from '@/components/ui/index.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import { Button, Modal, QuantityStepper, Textarea, Select } from '@/components/ui/interactive.jsx';
import { markDelivery, declareDayOff } from '@/actions/milkman.actions.js';

/**
 * One stop on the round.
 *
 * Status changes are optimistic — the pill flips immediately and rolls back if
 * the server rejects it. On a patchy connection in a stairwell that is the
 * difference between a usable app and an unusable one.
 */
export function RoundStop({ stop }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(stop.status);
  const [modal, setModal] = useState(null);

  const planned = Number(stop.adjustedQuantity ?? stop.plannedQuantity);
  // Only a genuine difference is a change. Matching the customer's own view,
  // which has always required this — the round flagged any non-null adjustment,
  // so confirming the dialog without moving the stepper looked like a change.
  const adjusted = stop.adjustedQuantity != null
    && Number(stop.adjustedQuantity) !== Number(stop.plannedQuantity);
  const settled = status !== 'PENDING';

  /*
   * A stop with no milk exists only to carry extras — the customer ordered
   * something but has no plan running today. There is no delivery row behind
   * it, so it has nothing to mark; the Orders screen owns purchase status.
   */
  const extras = stop.extras ?? [];
  const carryOnly = Boolean(stop.milkless);

  function mark(next, extra = {}) {
    startTransition(async () => {
      setStatus(next);
      const result = await markDelivery({ deliveryId: stop.id, status: next, ...extra });
      if (result.ok) {
        setModal(null);
      } else {
        setStatus(stop.status);
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  return (
    <>
      <Card className={settled ? 'opacity-70' : undefined}>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{stop.customerName}</p>
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
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div>
              <span className="text-xl font-semibold tnum text-ink">
                {status === 'DELIVERED' && stop.deliveredQuantity
                  ? Number(stop.deliveredQuantity)
                  : planned}
              </span>
              <span className="ml-1 text-sm text-ink-muted">{stop.unit}</span>
              {/*
                * Say what it was, not just what it is. "changed today" alone
                * left the milkman to guess whether 2 L was up from 1 or down
                * from 3 — and once delivered, whether the number shown was
                * what was asked for or what actually went out.
                */}
              {status === 'DELIVERED' && stop.deliveredQuantity
                ? Number(stop.deliveredQuantity) !== planned && (
                    <span className="ml-2 text-xs text-ink-muted">
                      asked {planned} {stop.unit}
                    </span>
                  )
                : adjusted && (
                    <span className="ml-2 text-xs text-ink-muted">
                      usually {Number(stop.plannedQuantity)} {stop.unit}
                    </span>
                  )}
            </div>
            <span className="text-sm text-ink-muted">{stop.productName}</span>
            {/*
              * The line total. Without it there was no way to see that changing
              * the litres changed what the customer owes — the round showed a
              * quantity and the money only appeared on another screen.
              */}
            {stop.unitPrice ? (
              <span className="tnum text-sm text-ink-muted">
                {status === 'DELIVERED'
                  ? formatPaise(Math.round(Number(stop.amount ?? 0) * 100))
                  : formatPaise(Math.round(planned * Number(stop.unitPrice) * 100))}
                <span className="ml-1 text-xs text-ink-subtle">
                  @ ₹{Number(stop.unitPrice)}/{stop.unit}
                </span>
              </span>
            ) : null}
            {adjusted ? <Badge tone="caution">changed today</Badge> : null}
            {stop.customerPhone ? (
              <a
                href={`tel:${stop.customerPhone}`}
                className="tap ml-auto rounded-lg border border-border px-3 py-2 text-sm text-ink-muted"
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
            mark('DELIVERED', { quantity: data.get('quantity') });
          }}
        >
          <p className="text-sm text-ink-muted">
            Planned: {planned} {stop.unit}. The bill follows what you actually leave.
          </p>
          <div className="flex justify-center py-2">
            <QuantityStepper name="quantity" defaultValue={planned} unit={stop.unit} />
          </div>
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
export function DayOffButton({ date, count }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Day off
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Take the day off?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              form="dayoff-form"
              type="submit"
              variant="danger"
              loading={pending}
            >
              Skip all {count}
            </Button>
          </>
        }
      >
        <form
          id="dayoff-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const note = new FormData(event.currentTarget).get('note');
            startTransition(async () => {
              const result = await declareDayOff({
                date,
                reason: 'MILKMAN_DAY_OFF',
                note: note || undefined,
              });
              if (result.ok) {
                toast.success(`${result.data.skipped} deliveries skipped.`);
                setOpen(false);
              } else {
                toast.error(result.message ?? 'Could not do that.');
              }
            });
          }}
        >
          <p className="text-sm text-ink-muted">
            All {count} remaining stops become skipped and nobody is charged.
            Anything you have already delivered today stays as it is.
          </p>
          <Textarea
            name="note"
            label="Message to your customers"
            placeholder="No delivery today — back tomorrow."
            maxLength={300}
          />
        </form>
      </Modal>
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
