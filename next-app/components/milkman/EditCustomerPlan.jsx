'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Select } from '@/components/ui/interactive.jsx';
import { PlansIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { changeCustomerPlan } from '@/actions/milkman.actions.js';

const SLOT_LABEL = { MORNING: 'Morning', EVENING: 'Evening', BOTH: 'Morning & evening' };

/**
 * "Edit plan" on a customer: move one of their running subscriptions onto
 * another of this milkman's plans, optionally at a different quantity.
 *
 * The server does the real work — the same versioned change a customer's
 * approved request goes through — and tells the customer. This sheet only
 * picks the subscription, the plan and the amount.
 *
 * @param {object} props
 * @param {{id: string, name: string}} props.customer
 * @param {Array} props.subscriptions  their running versions (ACTIVE/PAUSED)
 * @param {Array} props.plans          this milkman's plans on offer
 * @param {'icon'|'button'} [props.variant]
 */
export function EditPlanButton({ customer, subscriptions = [], plans = [], variant = 'icon' }) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === 'icon' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit plan for ${customer.name}`}
        title="Edit plan"
        className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-ink-muted shadow-xs transition-colors hover:bg-brand-soft hover:text-brand active:scale-95"
      >
        <PlansIcon className="h-4 w-4" />
      </button>
    ) : (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlansIcon className="h-4 w-4" />
        Edit plan
      </Button>
    );

  return (
    <>
      {trigger}
      {open ? (
        <EditPlanSheet customer={customer} subscriptions={subscriptions} plans={plans} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function EditPlanSheet({ customer, subscriptions, plans, onClose }) {
  const [pending, startTransition] = useTransition();
  const [rootId, setRootId] = useState(subscriptions[0]?.rootId ?? '');
  const current = subscriptions.find((s) => s.rootId === rootId) ?? null;

  const [planId, setPlanId] = useState(() => {
    const first = subscriptions[0];
    return plans.find((p) => p.id === first?.planId)?.id ?? plans[0]?.id ?? '';
  });
  const plan = plans.find((p) => p.id === planId) ?? null;
  const [quantity, setQuantity] = useState(() => String(Number(current?.quantity ?? plan?.quantity ?? 1)));

  // Picking a different plan resets the amount to that plan's own.
  function choosePlan(id) {
    setPlanId(id);
    const next = plans.find((p) => p.id === id);
    if (next) setQuantity(String(Number(next.quantity)));
  }

  function chooseSubscription(id) {
    setRootId(id);
    const sub = subscriptions.find((s) => s.rootId === id);
    const match = plans.find((p) => p.id === sub?.planId);
    if (match) setPlanId(match.id);
    if (sub) setQuantity(String(Number(sub.quantity)));
  }

  const unchanged =
    current && plan && current.planId === plan.id && Number(current.quantity) === Number(quantity);
  const qty = Number(quantity);
  const validQty = Number.isFinite(qty) && qty > 0 && qty <= 100;

  const planOptions = useMemo(
    () =>
      plans.map((p) => ({
        value: p.id,
        label: `${p.name} · ${Number(p.quantity)} ${p.unit} · ${SLOT_LABEL[p.slot] ?? p.slot}`,
      })),
    [plans],
  );

  function save() {
    if (!current || !plan || !validQty || unchanged) return;
    startTransition(async () => {
      const result = await changeCustomerPlan({
        rootId: current.rootId,
        planId: plan.id,
        // Only send a quantity when it differs from the plan's own.
        ...(qty !== Number(plan.quantity) ? { quantity: String(qty) } : {}),
      });
      if (result.ok) {
        const from = result.data?.effectiveFrom;
        toast.success(`${customer.name} is now on ${plan.name}${from ? ` from ${from}` : ''}. They have been told.`);
        onClose();
      } else {
        toast.error(result.message ?? 'Could not change that plan.');
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit plan · ${customer.name}`}
      footer={
        subscriptions.length && plans.length ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button loading={pending} disabled={!validQty || unchanged} onClick={save}>
              {pending ? null : <CheckIcon className="h-4 w-4" />}
              Change plan
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        )
      }
    >
      {subscriptions.length === 0 ? (
        <p className="text-sm font-medium text-ink-muted">
          {customer.name} has no running plan. They choose one from their app; once they have,
          you can change it here.
        </p>
      ) : plans.length === 0 ? (
        <p className="text-sm font-medium text-ink-muted">
          You have no plans on offer. Create one under Milk plans first.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Which subscription, when they have more than one. */}
          {subscriptions.length > 1 ? (
            <div role="radiogroup" aria-label="Subscription" className="grid gap-2">
              {subscriptions.map((s) => (
                <button
                  key={s.rootId}
                  type="button"
                  role="radio"
                  aria-checked={s.rootId === rootId}
                  onClick={() => chooseSubscription(s.rootId)}
                  className={cn(
                    'tap flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    s.rootId === rootId ? 'border-brand bg-brand-soft/60' : 'border-border bg-surface hover:border-brand/40',
                  )}
                >
                  <span className="text-sm font-bold text-ink">
                    {s.productName} · {Number(s.quantity)} {s.unit}
                  </span>
                  <span className="text-xs font-semibold text-ink-muted">{SLOT_LABEL[s.slot] ?? s.slot}</span>
                </button>
              ))}
            </div>
          ) : null}

          {current ? (
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Now</p>
              <p className="text-sm font-bold text-ink">
                {current.productName} · {Number(current.quantity)} {current.unit} · {SLOT_LABEL[current.slot] ?? current.slot}
              </p>
              {current.status === 'PAUSED' ? <Badge tone="caution" className="mt-1">Paused</Badge> : null}
              {current.status === 'PENDING' ? (
                <Badge tone="info" className="mt-1">Waiting for your approval — edits the request</Badge>
              ) : null}
            </div>
          ) : null}

          <Select
            name="planId"
            label="Move to plan"
            value={planId}
            onChange={(event) => choosePlan(event.target.value)}
            options={planOptions}
          />

          <div className="space-y-1.5">
            <label htmlFor="edit-plan-qty" className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Quantity per delivery ({plan?.unit ?? 'L'})
            </label>
            <input
              id="edit-plan-qty"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/[^\d.]/g, ''))}
              className={cn(
                'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm font-semibold text-ink shadow-xs focus:outline-none focus:ring-2',
                validQty ? 'border-border focus:border-brand focus:ring-brand/20' : 'border-critical focus:ring-critical/20',
              )}
            />
            <p className="text-xs text-ink-subtle">
              {plan && qty !== Number(plan.quantity)
                ? `The plan's own is ${Number(plan.quantity)} ${plan.unit}; the price follows the amount.`
                : 'Leave as it is to use the plan’s own amount.'}
            </p>
          </div>

          <p className="rounded-xl border border-info/15 bg-info-soft px-3 py-2 text-xs font-semibold text-info">
            {current?.status === 'PENDING'
              ? 'This is a request you have not approved yet: it is corrected in place and starts when you approve. '
              : ''}
            Starts today if that round has not set off yet, otherwise tomorrow. Days already delivered
            keep their price. {customer.name} gets a notification and sees the new plan in their app.
          </p>

          {unchanged ? (
            <p className="text-xs font-semibold text-caution">That is the plan and amount they already have.</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
