'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge } from '@/components/ui/index.jsx';
import { Button, Modal, QuantityStepper, Textarea } from '@/components/ui/interactive.jsx';
import { skipDay, resumeDay, adjustQuantity } from '@/actions/customer.actions.js';
import { formatWindow } from '@/domain/dates.js';

/**
 * One plan's delivery for today.
 *
 * The two actions — skip, and change today's quantity — are the whole customer
 * product. Both apply to this single day and never touch the subscription.
 */
export function TodayCard({ delivery }) {
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();

  const quantity = Number(delivery.adjustedQuantity ?? delivery.plannedQuantity);
  const planned = Number(delivery.plannedQuantity);
  const adjusted = delivery.adjustedQuantity != null && quantity !== planned;
  const actionable = delivery.status === 'PENDING';

  function run(action, payload, successMessage) {
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        toast.success(successMessage);
        setModal(null);
      } else {
        toast.error(result.message ?? 'Something went wrong.');
      }
    });
  }

  return (
    <>
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{delivery.productName}</p>
              {/*
                * The slot with the hour attached, because "Morning" alone does
                * not tell anyone whether to leave the gate unlocked at six or
                * at eight. Falls back to the bare slot for plans created before
                * windows existed.
                */}
              <p className="mt-0.5 text-sm text-ink-muted">
                <SlotLine delivery={delivery} />
              </p>
            </div>
            <StatusBadge status={delivery.status} />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tnum text-ink">
              {delivery.status === 'DELIVERED' ? Number(delivery.deliveredQuantity) : quantity}
            </span>
            <span className="text-sm text-ink-muted">{delivery.unit}</span>
            {adjusted ? (
              <span className="text-xs text-caution">changed from {planned}</span>
            ) : null}
          </div>

          {delivery.status === 'SKIPPED' ? (
            <p className="text-sm text-ink-muted">
              Skipped{delivery.note ? ` — ${delivery.note}` : ''}. You will not be charged.
            </p>
          ) : null}

          {actionable ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setModal('quantity')}>
                Change quantity
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setModal('skip')}>
                Skip today
              </Button>
            </div>
          ) : null}

          {delivery.status === 'SKIPPED' ? (
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              onClick={() => run(resumeDay, { deliveryId: delivery.id }, 'Delivery resumed.')}
            >
              Undo skip
            </Button>
          ) : null}
        </CardBody>
      </Card>

      {/* ── Change quantity ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'quantity'}
        onClose={() => setModal(null)}
        title="How much today?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              form="quantity-form"
              type="submit"
              loading={pending}
            >
              Confirm
            </Button>
          </>
        }
      >
        <form
          id="quantity-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              adjustQuantity,
              {
                deliveryId: delivery.id,
                quantity: data.get('quantity'),
                note: data.get('note') || undefined,
              },
              'Quantity updated for today.',
            );
          }}
          className="space-y-4"
        >
          <p className="text-sm text-ink-muted">
            This changes today only. Your plan stays at {planned} {delivery.unit} a day.
          </p>
          <div className="flex justify-center py-2">
            <QuantityStepper name="quantity" defaultValue={quantity} unit={delivery.unit} />
          </div>
          <Textarea name="note" label="Note for your milkman (optional)" maxLength={300} />
        </form>
      </Modal>

      {/* ── Skip ────────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'skip'}
        onClose={() => setModal(null)}
        title="Skip today's delivery?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Keep it
            </Button>
            <Button form="skip-form" type="submit" variant="danger" loading={pending}>
              Skip today
            </Button>
          </>
        }
      >
        <form
          id="skip-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              skipDay,
              { deliveryId: delivery.id, note: data.get('note') || undefined },
              'Today has been skipped.',
            );
          }}
          className="space-y-4"
        >
          <p className="text-sm text-ink-muted">
            You will not be charged for today. Your milkman will be told.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Out of town', 'Enough at home', 'Travelling'].map((reason) => (
              <label key={reason} className="cursor-pointer">
                <input type="radio" name="note" value={reason} className="peer sr-only" />
                <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand">
                  {reason}
                </span>
              </label>
            ))}
          </div>
        </form>
      </Modal>
    </>
  );
}

/** 'Morning 6:00 – 7:30 am', or just 'Morning' when no window is set. */
function SlotLine({ delivery }) {
  const morning = formatWindow(delivery.morningStart, delivery.morningEnd);
  const evening = formatWindow(delivery.eveningStart, delivery.eveningEnd);

  if (delivery.slot === 'MORNING') return <>Morning{morning ? ` · ${morning}` : ''}</>;
  if (delivery.slot === 'EVENING') return <>Evening{evening ? ` · ${evening}` : ''}</>;

  // Both slots: show each window on its own, since they are different hours.
  if (!morning && !evening) return <>Morning &amp; evening</>;
  return (
    <>
      {morning ? `Morning · ${morning}` : 'Morning'}
      {' · '}
      {evening ? `Evening · ${evening}` : 'Evening'}
    </>
  );
}
