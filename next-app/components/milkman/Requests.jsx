'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn, Badge, Notice } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatDate, formatInstant } from '@/domain/dates.js';
import {
  CheckIcon,
  PhoneIcon,
  CalendarIcon,
  MilkDropIcon,
  PlansIcon,
  SunIcon,
  MoonIcon,
} from '@/components/ui/Icons.jsx';
import { resolveQuantityRequest, resolvePlanChangeRequest } from '@/actions/milkman.actions.js';

function useResolver(action, labels) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(false);
  const [removed, setRemoved] = useState(false);

  function resolve(requestId, approve, note) {
    startTransition(async () => {
      setRemoved(true);
      setModal(false);
      const result = await action({ requestId, approve, note });
      if (result.ok) {
        toast.success(approve ? labels.approved : labels.rejected);
        router.refresh();
      } else {
        setRemoved(false);
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  return { pending, modal, setModal, resolve, removed };
}

const SLOT_LABEL = { MORNING: 'Morning', EVENING: 'Evening', BOTH: 'Morning & evening' };

/** Name, phone and when it was asked — the same top strip on both card types. */
function RequestHeader({ request, icon, tile, children }) {
  return (
    <div className="flex items-start gap-3.5">
      <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs', tile)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">{request.customerName}</h3>
        <div className="mt-0.5 text-xs font-semibold text-slate-600">{children}</div>
        <p className="mt-0.5 text-[11px] font-medium text-slate-400">Asked {formatInstant(request.createdAt)}</p>
      </div>
      {request.customerPhone ? (
        <a
          href={`tel:${request.customerPhone}`}
          aria-label={`Call ${request.customerName}`}
          title={`Call ${request.customerName}`}
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 shadow-xs transition-colors hover:bg-blue-600 hover:text-white"
        >
          <PhoneIcon className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

function CustomerNote({ note }) {
  if (!note) return null;
  return (
    <blockquote className="rounded-2xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-bold text-blue-900">
      “{note}”
    </blockquote>
  );
}

function Decision({ pending, disabled, onApprove, onDecline, approveLabel = 'Approve' }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={onApprove}
        className="tap flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 font-heading text-xs font-black text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? null : <CheckIcon className="h-4 w-4 stroke-[2.5]" />}
        <span>{approveLabel}</span>
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="tap flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 font-heading text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98]"
      >
        Decline
      </button>
    </div>
  );
}

/** A one-day quantity change. Approving touches only that delivery. */
export function QuantityRequest({ request }) {
  const { pending, modal, setModal, resolve, removed } = useResolver(resolveQuantityRequest, {
    approved: 'Approved for that day.',
    rejected: 'Declined.',
  });

  const from = Number(request.currentQuantity);
  const to = Number(request.requestedQuantity);
  const more = to > from;
  const unit = request.unit ?? 'L';
  const delta = Number((to - from).toFixed(3));

  if (removed) return null;

  return (
    <>
      <article className="group relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-md">
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-1.5', more ? 'bg-blue-600' : 'bg-amber-500')} />

        <RequestHeader
          request={request}
          icon={<MilkDropIcon className="h-5 w-5" />}
          tile={more ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}
        >
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
            <strong className="text-slate-900">{formatDate(request.deliveryDate)}</strong>
            <span className="text-slate-300">·</span>
            <span>{request.productName}</span>
          </span>
        </RequestHeader>

        {/* The ask, as one glance: what they get now, what they want. */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3">
          <div>
            <p className="font-heading text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Regular</p>
            <p className="font-heading text-lg font-bold text-slate-400 line-through decoration-slate-400/80">
              {from}
              <span className="ml-1 font-sans text-xs font-semibold no-underline">{unit}</span>
            </p>
          </div>
          <span aria-hidden="true" className="text-base font-black text-slate-300">→</span>
          <div className="text-right">
            <p className="font-heading text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Requested</p>
            <p className="font-heading text-2xl font-black text-slate-950">
              {to}
              <span className="ml-1 font-sans text-xs font-bold text-slate-500">{unit}</span>
            </p>
          </div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-black shadow-2xs shrink-0', more ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')}>
            {delta > 0 ? `+${delta}` : delta} {unit}
          </span>
        </div>

        <div className="mt-3.5 space-y-3">
          <CustomerNote note={request.customerNote} />
          <p className="text-[11px] font-medium text-slate-400">
            Affects this single day only — their ongoing daily plan remains unchanged.
          </p>
          <Decision
            pending={pending}
            onApprove={() => resolve(request.id, true)}
            onDecline={() => setModal(true)}
          />
        </div>
      </article>

      <DeclineModal
        open={modal}
        onClose={() => setModal(false)}
        pending={pending}
        title={`Decline ${request.customerName}'s request?`}
        onSubmit={(note) => resolve(request.id, false, note)}
      />
    </>
  );
}

/** A permanent plan change. Approving versions the subscription from tomorrow. */
export function PlanChangeRequest({ request }) {
  const { pending, modal, setModal, resolve, removed } = useResolver(resolvePlanChangeRequest, {
    approved: 'Plan changed from tomorrow.',
    rejected: 'Declined.',
  });

  const retired = request.planIsActive === false;
  const nowPaise = Math.round(Number(request.currentMonthlyPrice ?? 0) * 100);
  const wantsPaise = Math.round(Number(request.requestedMonthlyPrice ?? 0) * 100);
  const SlotIcon = request.requestedSlot === 'EVENING' ? MoonIcon : SunIcon;

  if (removed) return null;

  return (
    <>
      <article className="card-surface relative overflow-hidden p-4 sm:p-5">
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', retired ? 'bg-critical' : 'bg-brand')} />

        <RequestHeader
          request={request}
          icon={<PlansIcon className="h-5 w-5" />}
          tile="bg-brand-soft text-brand"
        >
          Wants to change plan
        </RequestHeader>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-border bg-surface-muted/50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Now</p>
            <p className="mt-1 truncate text-sm font-bold text-ink">{request.currentPlanName}</p>
            <p className="stat-number mt-0.5 text-lg text-ink-muted">
              {Number(request.currentQuantity)}
              <span className="ml-1 font-sans text-xs font-semibold">{request.currentUnit}</span>
            </p>
            {nowPaise > 0 ? (
              <p className="tnum text-[11px] font-semibold text-ink-subtle">{formatPaise(nowPaise, { whole: true })}/mo</p>
            ) : null}
          </div>
          <div className={cn('rounded-2xl border p-3', retired ? 'border-critical/30 bg-critical-soft/40' : 'border-brand/40 bg-brand-soft/60')}>
            <p className={cn('text-[11px] font-bold uppercase tracking-wide', retired ? 'text-critical' : 'text-brand')}>Wants</p>
            <p className="mt-1 truncate text-sm font-bold text-ink">{request.requestedPlanName}</p>
            <p className="stat-number mt-0.5 text-lg text-ink">
              {Number(request.requestedQuantity)}
              <span className="ml-1 font-sans text-xs font-semibold text-ink-muted">{request.requestedUnit}</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {wantsPaise > 0 ? (
                <p className="tnum text-[11px] font-semibold text-ink-subtle">{formatPaise(wantsPaise, { whole: true })}/mo</p>
              ) : null}
              {SLOT_LABEL[request.requestedSlot] ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
                  <SlotIcon className="h-3.5 w-3.5" />
                  {SLOT_LABEL[request.requestedSlot]}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <CustomerNote note={request.customerNote} />
          {retired ? (
            <Notice tone="critical" title="That plan is retired">
              You cannot approve a change onto a plan you have retired.
            </Notice>
          ) : null}
          <p className="text-xs font-medium text-ink-subtle">
            Takes effect tomorrow. Days already delivered this month keep today's price.
          </p>
          <Decision
            pending={pending}
            disabled={retired}
            onApprove={() => resolve(request.id, true)}
            onDecline={() => setModal(true)}
            approveLabel="Approve change"
          />
        </div>
      </article>

      <DeclineModal
        open={modal}
        onClose={() => setModal(false)}
        pending={pending}
        title={`Decline ${request.customerName}'s plan change?`}
        onSubmit={(note) => resolve(request.id, false, note)}
      />
    </>
  );
}

function DeclineModal({ open, onClose, pending, title, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="decline-form" type="submit" variant="danger" loading={pending}>
            Decline
          </Button>
        </>
      }
    >
      <form
        id="decline-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget).get('note') || undefined);
        }}
      >
        <p className="text-sm text-ink-muted">Your customer will see this.</p>
        <Textarea name="note" label="Reason (optional)" maxLength={500} />
      </form>
    </Modal>
  );
}
