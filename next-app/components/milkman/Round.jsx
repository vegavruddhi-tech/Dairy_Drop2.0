'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge } from '@/components/ui/index.jsx';
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
  const adjusted = stop.adjustedQuantity != null;
  const settled = status !== 'PENDING';

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
              {stop.deliveryInstructions ? (
                <p className="mt-1 rounded-lg bg-info-soft px-2 py-1 text-xs text-info">
                  {stop.deliveryInstructions}
                </p>
              ) : null}
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div>
              <span className="text-xl font-semibold tnum text-ink">
                {status === 'DELIVERED' && stop.deliveredQuantity
                  ? Number(stop.deliveredQuantity)
                  : planned}
              </span>
              <span className="ml-1 text-sm text-ink-muted">{stop.unit}</span>
            </div>
            <span className="text-sm text-ink-muted">{stop.productName}</span>
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

          {!settled ? (
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
        open={modal === 'partial'}
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
        open={modal === 'not'}
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
