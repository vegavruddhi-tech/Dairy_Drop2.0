'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, cn } from '@/components/ui/index.jsx';
import { Button, Modal, QuantityStepper, Textarea } from '@/components/ui/interactive.jsx';
import { MilkDropIcon, EditIcon, VacationIcon, UndoIcon } from '@/components/ui/Icons.jsx';
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
      <div className="group relative overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md">
        {/* Top accent line based on status */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5',
            delivery.status === 'DELIVERED'
              ? 'bg-emerald-500'
              : delivery.status === 'SKIPPED'
                ? 'bg-slate-300'
                : 'bg-blue-600',
          )}
        />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <MilkDropIcon className="h-4 w-4" />
                </span>
                <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">
                  {delivery.productName}
                </h3>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <SlotLine delivery={delivery} />
              </p>
              <EndingNote delivery={delivery} />
            </div>
            <StatusBadge status={delivery.status} />
          </div>

          <div className="flex items-baseline gap-2 rounded-2xl bg-slate-50/90 border border-slate-200/70 px-4 py-3">
            <span className="font-heading text-3xl font-black text-slate-950 tnum">
              {delivery.status === 'DELIVERED' ? Number(delivery.deliveredQuantity) : quantity}
            </span>
            <span className="font-heading text-sm font-bold text-slate-600">{delivery.unit}</span>
            {adjusted ? (
              <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                Changed for today (usually {planned} {delivery.unit})
              </span>
            ) : null}
          </div>

          {delivery.status === 'SKIPPED' ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-600">
              Skipped{delivery.note ? ` — ${delivery.note}` : ''}. You will not be charged.
            </p>
          ) : null}

          {actionable ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white px-4 py-3 font-heading text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition-all active:scale-[0.98]"
                onClick={() => setModal('quantity')}
              >
                <EditIcon className="h-4 w-4" />
                <span>Change Quantity</span>
              </button>
              <button
                type="button"
                className="tap flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-heading text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-[0.98]"
                onClick={() => setModal('skip')}
              >
                <VacationIcon className="h-4 w-4" />
                <span>Skip Today</span>
              </button>
            </div>
          ) : null}

          {delivery.status === 'SKIPPED' ? (
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-blue-50 px-4 py-3 font-heading text-xs font-bold text-blue-700 transition-all hover:bg-blue-100"
              disabled={pending}
              onClick={() => run(resumeDay, { deliveryId: delivery.id }, 'Delivery resumed.')}
            >
              <UndoIcon className="h-4 w-4" />
              <span>Undo Skip</span>
            </button>
          ) : null}
        </div>
      </div>

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

/**
 * A short line explaining that these terms are ending, or that the plan behind
 * them has been withdrawn.
 *
 * Silent in the ordinary case — a note on every card would be noise.
 */
function EndingNote({ delivery }) {
  // The version behind this delivery has been closed: today is owed, later
  // days come from the successor instead.
  if (delivery.termsEndOn) {
    // Deliberately not "last delivery": the new plan may well cover this slot
    // too, just on different terms. What ends is the plan, not the milk.
    return (
      <p className="mt-1 text-xs font-medium text-caution">
        On your old plan — the new one starts tomorrow.
      </p>
    );
  }

  if (delivery.planRetired) {
    return (
      <p className="mt-1 text-xs text-ink-muted">
        Your milkman no longer offers this plan. Yours keeps running.
      </p>
    );
  }

  return null;
}
