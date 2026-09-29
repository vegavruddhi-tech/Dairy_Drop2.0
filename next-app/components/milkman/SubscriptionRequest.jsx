'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatInstant, formatWindow } from '@/domain/dates.js';
import { CheckIcon, PhoneIcon, MilkDropIcon, SunIcon, MoonIcon } from '@/components/ui/Icons.jsx';
import { decideSubscription } from '@/actions/milkman.actions.js';

const SLOT_LABEL = { MORNING: 'Morning', EVENING: 'Evening', BOTH: 'Morning & evening' };
const FREQUENCY_LABEL = { DAILY: 'Every day', ALTERNATE_DAYS: 'Alternate days', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

/**
 * A customer asking to start a plan, at the quantity they chose.
 *
 * Approving starts it with the next round the cut-off allows and builds its
 * deliveries; declining frees the slot and tells the customer why.
 */
export function SubscriptionRequest({ request }) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState(false);

  function decide(approve, note) {
    startTransition(async () => {
      setDone(true);
      setDeclining(false);
      const result = await decideSubscription({ rootId: request.rootId, approve, note });
      if (result.ok) {
        toast.success(
          approve
            ? `Approved — starts ${result.data?.startsOn ?? 'with the next round'}.`
            : 'Declined. The customer has been told.',
        );
      } else {
        setDone(false);
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  if (done) return null;

  const monthlyPaise = Math.round(Number(request.quotedMonthlyPrice ?? 0) * 100);
  const rate = Number(request.unitPrice ?? 0);
  const SlotIcon = request.slot === 'EVENING' ? MoonIcon : SunIcon;
  const window =
    request.slot === 'EVENING'
      ? formatWindow(request.eveningStart, request.eveningEnd)
      : request.slot === 'MORNING'
        ? formatWindow(request.morningStart, request.morningEnd)
        : [formatWindow(request.morningStart, request.morningEnd), formatWindow(request.eveningStart, request.eveningEnd)]
            .filter(Boolean)
            .join(' · ');

  return (
    <>
      <article className="card-surface relative overflow-hidden p-4 sm:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-positive" />

        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-positive-soft text-positive">
            <MilkDropIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-base font-extrabold tracking-tight text-ink">{request.customerName}</h3>
              <Badge tone="positive" dot>New plan</Badge>
              {request.customerApproval === 'PENDING' ? <Badge tone="caution">New customer</Badge> : null}
            </div>
            {request.customerApproval === 'PENDING' ? (
              <p className="mt-1 text-xs font-semibold text-caution">
                Approve them under Customers → Waiting — that approves this plan too.
              </p>
            ) : null}
            <p className="mt-0.5 text-sm font-medium text-ink-muted">Wants {request.planName ?? request.productName}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-subtle">Asked {formatInstant(request.createdAt)}</p>
          </div>
          {request.customerPhone ? (
            <a
              href={`tel:${request.customerPhone}`}
              aria-label={`Call ${request.customerName}`}
              className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
            >
              <PhoneIcon className="h-4 w-4" />
            </a>
          ) : null}
        </div>

        {/* What they chose: the quantity large, the price it comes to beside it. */}
        <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-surface-muted/70 px-4 py-3">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">Per delivery</p>
            <p className="stat-number text-3xl leading-none text-ink">
              {Number(request.quantity)}
              <span className="ml-1 font-sans text-sm font-semibold text-ink-muted">{request.unit}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-muted">{request.productName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">About a month</p>
            <p className="stat-number text-xl leading-none text-ink">{formatPaise(monthlyPaise, { whole: true })}</p>
            {rate > 0 ? <p className="tnum mt-1 text-[11px] font-semibold text-ink-subtle">₹{rate % 1 === 0 ? rate : rate.toFixed(2)}/{request.unit}</p> : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <SlotIcon className="h-3.5 w-3.5" />
            {SLOT_LABEL[request.slot] ?? request.slot}
            {window ? ` · ${window}` : ''}
          </span>
          <span>{FREQUENCY_LABEL[request.frequency] ?? request.frequency}</span>
        </div>

        <p className="mt-3 text-xs font-medium text-ink-subtle">
          Starts with the next round your cut-off allows — today if that round has not set off yet.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" loading={pending} onClick={() => decide(true)}>
            {pending ? null : <CheckIcon className="h-5 w-5" />}
            Approve
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setDeclining(true)}
            className="text-critical hover:border-critical/40 hover:bg-critical-soft"
          >
            Decline
          </Button>
        </div>
      </article>

      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title={`Decline ${request.customerName}'s plan?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button>
            <Button form={`decline-sub-${request.rootId}`} type="submit" variant="danger" loading={pending}>
              Decline
            </Button>
          </>
        }
      >
        <form
          id={`decline-sub-${request.rootId}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            decide(false, new FormData(event.currentTarget).get('note') || undefined);
          }}
        >
          <p className="text-sm text-ink-muted">Your customer sees this and can choose another plan.</p>
          <Textarea name="note" label="Reason (optional)" maxLength={500} placeholder="e.g. I cannot do evening rounds in your sector yet." />
        </form>
      </Modal>
    </>
  );
}
