'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge, Notice, cn } from '@/components/ui/index.jsx';
import { Button, Modal, Select, Textarea } from '@/components/ui/interactive.jsx';
import { MilkDropIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { formatPaise } from '@/domain/money.js';
import { formatWindow } from '@/domain/dates.js';
import {
  subscribe,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  requestPlanChange,
  switchFromRetiredPlan,
} from '@/actions/customer.actions.js';

/** A plan the customer already holds, with its lifecycle actions. */
export function SubscriptionCard({ subscription, availablePlans, pendingRequest, withdrawn }) {
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();

  function run(action, payload, message) {
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        toast.success(message);
        setModal(null);
      } else {
        toast.error(result.message ?? 'Something went wrong.');
      }
    });
  }

  const otherPlans = availablePlans.filter((plan) => plan.id !== subscription.planId);

  return (
    <>
      <div className="group relative overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md">
        {/* Top Accent line */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5',
            subscription.status === 'ACTIVE'
              ? 'bg-emerald-500'
              : subscription.status === 'PAUSED'
                ? 'bg-amber-500'
                : 'bg-slate-300',
          )}
        />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <MilkDropIcon className="h-4 w-4" />
                </span>
                <h3 className="font-heading text-lg font-black tracking-tight text-slate-900">
                  {subscription.productName}
                </h3>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {Number(subscription.quantity)} {subscription.unit} ·{' '}
                {subscription.frequency.replace('_', ' ').toLowerCase()} ·{' '}
                {subscription.slot.toLowerCase()}
              </p>
              <DeliveryWindows source={subscription} className="mt-1" />
            </div>
            <StatusBadge status={subscription.status} />
          </div>

          <div className="flex items-baseline gap-2 rounded-2xl bg-slate-50/90 border border-slate-200/70 px-4 py-3">
            <span className="font-heading text-2xl font-black tnum text-slate-950">
              ₹{Number(subscription.unitPrice).toFixed(2)}
            </span>
            <span className="font-heading text-xs font-bold text-slate-500">per {subscription.unit}</span>
          </div>

          <RateNote subscription={subscription} plans={availablePlans} />

          {withdrawn ? (
            <Notice tone="info" title="No longer offered">
              Your milkman has stopped offering this plan. Yours keeps running on
              these terms for as long as you want it.
            </Notice>
          ) : null}

          {pendingRequest ? (
            <Notice tone="caution" title="Change requested">
              Waiting for your milkman to approve the move to {pendingRequest.requestedPlanName}.
            </Notice>
          ) : null}

          {!pendingRequest && subscription.status === 'ACTIVE' ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {otherPlans.length > 0 ? (
                <button
                  type="button"
                  className="tap flex-1 rounded-2xl border border-blue-600 bg-white px-3.5 py-2.5 font-heading text-xs font-bold text-blue-700 hover:bg-blue-50 transition-all active:scale-[0.98]"
                  onClick={() => setModal('change')}
                >
                  Change Plan
                </button>
              ) : null}
              <button
                type="button"
                className="tap flex-1 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 font-heading text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all active:scale-[0.98]"
                disabled={pending}
                onClick={() => run(pauseSubscription, { rootId: subscription.rootId }, 'Deliveries paused.')}
              >
                Pause
              </button>
              <button
                type="button"
                className="tap rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-heading text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-[0.98]"
                onClick={() => setModal('cancel')}
              >
                Cancel
              </button>
            </div>
          ) : null}

          {subscription.status === 'PAUSED' ? (
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-heading text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
              disabled={pending}
              onClick={() => run(resumeSubscription, { rootId: subscription.rootId }, 'Deliveries resumed!')}
            >
              <span>▶ Resume Deliveries</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Request a plan change ───────────────────────────────────── */}
      <Modal
        open={modal === 'change'}
        onClose={() => setModal(null)}
        title="Change plan"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button form="change-form" type="submit" loading={pending}>Send request</Button>
          </>
        }
      >
        <form
          id="change-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              requestPlanChange,
              {
                rootId: subscription.rootId,
                planId: data.get('planId'),
                note: data.get('note'),
              },
              'Request sent to your milkman.',
            );
          }}
        >
          <p className="text-sm text-ink-muted">
            Your milkman approves the change. It takes effect from tomorrow — this
            month's bill keeps today's price for the days already delivered.
          </p>

          <Select
            name="planId"
            label="New plan"
            options={otherPlans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} · ${Number(plan.quantity)} ${plan.unit} · ${formatPaise(plan.quotedMonthlyPaise, { whole: true })}/mo`,
            }))}
          />

          <Textarea
            name="note"
            label="Why are you changing?"
            required
            maxLength={500}
            placeholder="We need more milk now that my parents have moved in."
          />
        </form>
      </Modal>

      {/* ── Cancel ──────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title="Cancel this plan?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Keep it</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(cancelSubscription, { rootId: subscription.rootId }, 'Plan cancelled.')}
            >
              Cancel plan
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Deliveries stop from tomorrow. Today's delivery, and everything already
          delivered this month, is still billed as normal.
        </p>
      </Modal>
    </>
  );
}

/** A plan on offer from the customer's milkman. */
export function PlanCard({ plan, alreadySubscribed, subscribedRate, blockedBy, maxPlansReached }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-2">
              <MilkDropIcon className="h-5 w-5" />
            </span>
            <h3 className="font-heading text-lg font-black tracking-tight text-slate-900 mt-1">
              {plan.name}
            </h3>
            <p className="text-xs font-semibold text-blue-600">{plan.productName}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 border border-blue-200/60">
            {plan.slot.toLowerCase()}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 rounded-2xl bg-slate-50 border border-slate-200/70 p-3">
          <span className="font-heading text-2xl font-black text-slate-950 tnum">
            {formatPaise(plan.quotedMonthlyPaise, { whole: true })}
          </span>
          <span className="font-heading text-xs font-bold text-slate-500">/ estimated mo.</span>
        </div>

        <ul className="space-y-1.5 text-xs font-medium text-slate-600">
          <li className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
            <span><strong className="text-slate-900">{Number(plan.quantity)} {plan.unit}</strong> per morning</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
            <span>{plan.frequency.replace('_', ' ').toLowerCase()} delivery</span>
          </li>
          <WindowItems source={plan} />
        </ul>

        <p className="text-[11px] font-medium text-slate-400">
          Transparent billing: ₹{Number(plan.unitPrice).toFixed(2)} per {plan.unit} actually received.
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100">
        {alreadySubscribed ? (
          <div className="flex items-center justify-center gap-1.5 w-full text-center rounded-2xl bg-emerald-50 border border-emerald-200 py-3 font-heading text-xs font-extrabold text-emerald-800">
            <CheckIcon className="h-4 w-4" />
            <span>
              {subscribedRate && Number(subscribedRate) !== Number(plan.unitPrice)
                ? `Active · Billed at ₹${Number(subscribedRate).toFixed(2)}`
                : 'Currently Subscribed'}
            </span>
          </div>
        ) : blockedBy?.switchFrom ? (
          <>
            <button
              type="button"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await switchFromRetiredPlan({
                    rootId: blockedBy.switchFrom,
                    planId: plan.id,
                  });
                  if (result.ok) toast.success(`Switched to ${plan.name}. It starts tomorrow.`);
                  else toast.error(result.message ?? 'Could not switch to that plan.');
                })
              }
            >
              <span>Switch to this Plan</span>
              <span>→</span>
            </button>
            <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
              Your old plan is retired. Switch seamlessly starting tomorrow.
            </p>
          </>
        ) : blockedBy ? (
          <>
            <button className="tap flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-heading text-xs font-bold text-slate-400 cursor-not-allowed" disabled>
              Already on this slot
            </button>
            <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
              You already receive {blockedBy.productName} in the {blockedBy.times}.
            </p>
          </>
        ) : maxPlansReached ? (
          <>
            <button className="tap flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-heading text-xs font-bold text-slate-400 cursor-not-allowed" disabled>
              Max 2 Plans Active
            </button>
            <p className="mt-1.5 text-center text-[11px] text-amber-700 font-medium">
              Limit reached. Change or cancel an existing plan to subscribe.
            </p>
          </>
        ) : (
          <button
            type="button"
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await subscribe({ planId: plan.id });
                if (result.ok) {
                  if (result.data?.requiresApproval) {
                    toast.success(`Subscribed to ${plan.name}! Waiting for milkman approval.`);
                    window.location.href = '/pending';
                  } else {
                    toast.success(`Subscribed to ${plan.name}. Deliveries start tomorrow!`);
                  }
                } else {
                  toast.error(result.message ?? 'Could not subscribe.');
                }
              })
            }
          >
            <span>Subscribe Now</span>
            <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The delivery hours held on a plan or a subscription.
 *
 * Renders nothing when no window is set, which is the case for anything
 * created before windows existed — a missing time is not midnight.
 */
function DeliveryWindows({ source, className }) {
  const morning = formatWindow(source.morningStart, source.morningEnd);
  const evening = formatWindow(source.eveningStart, source.eveningEnd);
  if (!morning && !evening) return null;

  return (
    <p className={`text-sm text-ink ${className ?? ''}`}>
      {[morning && `Morning ${morning}`, evening && `Evening ${evening}`]
        .filter(Boolean)
        .join(' · ')}
    </p>
  );
}

/** The same thing as list items, for the plan card's feature list. */
function WindowItems({ source }) {
  const morning = formatWindow(source.morningStart, source.morningEnd);
  const evening = formatWindow(source.eveningStart, source.eveningEnd);
  return (
    <>
      {morning ? <li className="text-ink">Morning {morning}</li> : null}
      {evening ? <li className="text-ink">Evening {evening}</li> : null}
    </>
  );
}

/**
 * Says so when the rate you agreed to differs from the plan's rate today.
 *
 * Silent when they match, which is the normal case — a note on every card
 * would be noise, and the number above already says what you pay.
 */
function RateNote({ subscription, plans }) {
  const plan = (plans ?? []).find((p) => p.id === subscription.planId);
  if (!plan?.unitPrice) return null;

  const agreed = Number(subscription.unitPrice);
  const current = Number(plan.unitPrice);
  if (!Number.isFinite(agreed) || !Number.isFinite(current) || agreed === current) return null;

  return (
    <p className="text-xs text-ink-muted">
      This is the rate you signed up at. {plan.name} is now ₹{current.toFixed(2)} per{' '}
      {subscription.unit} — your price only changes if you move to it.
    </p>
  );
}
