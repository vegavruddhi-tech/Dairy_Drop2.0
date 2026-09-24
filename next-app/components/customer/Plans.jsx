'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, StatusBadge, Badge, Notice } from '@/components/ui/index.jsx';
import { Button, Modal, Select, Textarea } from '@/components/ui/interactive.jsx';
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
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{subscription.productName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {Number(subscription.quantity)} {subscription.unit} ·{' '}
                {subscription.frequency.replace('_', ' ').toLowerCase()} ·{' '}
                {subscription.slot.toLowerCase()}
              </p>
              {/* The hours this customer was promised, snapshotted at
                  enrolment — not whatever the plan says today. */}
              <DeliveryWindows source={subscription} className="mt-1" />
            </div>
            <StatusBadge status={subscription.status} />
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tnum text-ink">
              ₹{Number(subscription.unitPrice).toFixed(2)}
            </span>
            <span className="text-sm text-ink-muted">per {subscription.unit}</span>
          </div>

          {/*
            * The rate agreed at enrolment, which is not always the plan's rate
            * today.
            *
            * Prices are snapshotted so a milkman raising a plan cannot silently
            * reprice people already on it. Correct, but it looked like a fault:
            * the same screen showed "₹30.00 per L" here and "Billed at ₹60.00
            * per L" on the plan below, with nothing to say why.
            */}
          <RateNote subscription={subscription} plans={availablePlans} />

          {/*
            * Say when the plan behind this subscription has been withdrawn.
            *
            * Nothing changes for the customer — that is the point of retiring
            * rather than cancelling — but "Change plan" disappears with it, and
            * a button vanishing without explanation reads as a fault.
            */}
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
            <div className="flex flex-wrap gap-2">
              {otherPlans.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setModal('change')}>
                  Change plan
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => run(pauseSubscription, { rootId: subscription.rootId }, 'Paused.')}
              >
                Pause
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setModal('cancel')}>
                Cancel
              </Button>
            </div>
          ) : null}

          {subscription.status === 'PAUSED' ? (
            <Button
              size="sm"
              loading={pending}
              onClick={() => run(resumeSubscription, { rootId: subscription.rootId }, 'Resumed.')}
            >
              Resume deliveries
            </Button>
          ) : null}
        </CardBody>
      </Card>

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
    <Card>
      <CardBody className="flex h-full flex-col gap-3">
        <div>
          <p className="font-medium text-ink">{plan.name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{plan.productName}</p>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tnum text-ink">
            {formatPaise(plan.quotedMonthlyPaise, { whole: true })}
          </span>
          <span className="text-sm text-ink-muted">/ month</span>
        </div>

        <ul className="space-y-1 text-sm text-ink-muted">
          <li>{Number(plan.quantity)} {plan.unit} per delivery</li>
          <li>{plan.frequency.replace('_', ' ').toLowerCase()}</li>
          <li>{plan.slot.toLowerCase()} delivery</li>
          <WindowItems source={plan} />
        </ul>

        <p className="text-xs text-ink-subtle">
          Billed at ₹{Number(plan.unitPrice).toFixed(2)} per {plan.unit} actually delivered.
        </p>

        <div className="mt-auto pt-2">
          {alreadySubscribed ? (
            <Badge tone="positive">
              {subscribedRate && Number(subscribedRate) !== Number(plan.unitPrice)
                ? `Subscribed at ₹${Number(subscribedRate).toFixed(2)}`
                : 'Subscribed'}
            </Badge>
          ) : blockedBy?.switchFrom ? (
            <>
              {/*
                * Stranded, not blocked.
                *
                * The plan in the way has been withdrawn by the milkman, so
                * every plan on offer read "already on this" and the only exits
                * were cancelling their milk or waiting on an approval. They did
                * not choose to be there, so they may step across on their own.
                */}
              <Button
                className="w-full"
                loading={pending}
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
                Switch to this
              </Button>
              <p className="mt-1.5 text-xs text-ink-muted">
                Your current plan is no longer offered. Switching starts this one
                tomorrow; today stays on your old plan.
              </p>
            </>
          ) : blockedBy ? (
            <>
              <Button className="w-full" disabled>
                Already on this
              </Button>
              <p className="mt-1.5 text-xs text-ink-muted">
                You already get {blockedBy.productName} in the {blockedBy.times}.
                Change or cancel that plan to order it differently.
              </p>
            </>
          ) : maxPlansReached ? (
            <>
              <Button className="w-full bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" disabled>
                Max 2 Plans Active
              </Button>
              <p className="mt-1.5 text-[11px] text-amber-700 font-medium">
                Limit of 2 plans reached. Cancel or change an existing plan to subscribe.
              </p>
            </>
          ) : (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await subscribe({ planId: plan.id });
                  if (result.ok) toast.success(`Subscribed to ${plan.name}.`);
                  else toast.error(result.message ?? 'Could not subscribe.');
                })
              }
            >
              Subscribe
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
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
