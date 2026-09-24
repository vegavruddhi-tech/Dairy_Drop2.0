'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { cn, Card, CardBody, CardHeader, Notice, Badge } from '@/components/ui/index.jsx';
import { Button, Input } from '@/components/ui/interactive.jsx';
import { startTrial, submitSaasPayment, quickVerifyMyDairy } from '@/actions/milkman.actions.js';
import { formatPaise, toPaise } from '@/domain/money.js';
import { CheckIcon, CopyIcon, PhoneIcon, UsersIcon, PaymentsIcon } from '@/components/ui/Icons.jsx';

export function QuickVerifyDairy() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="md"
      className="w-full font-semibold"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await quickVerifyMyDairy();
          if (result.ok) {
            toast.success('Your dairy is now verified! You can start your free trial.');
            window.location.reload();
          } else {
            toast.error(result.message ?? 'Could not verify dairy.');
          }
        })
      }
    >
      Instant Verify My Dairy (One-Click Activation)
    </Button>
  );
}

export function StartTrial() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startTrial();
          if (result.ok) {
            toast.success('Trial started. Your panel is open.');
            window.location.href = '/milkman';
          } else {
            toast.error(result.message ?? 'Could not start the trial.');
          }
        })
      }
    >
      Start my free trial
    </Button>
  );
}

/**
 * Pay for a plan.
 *
 * Money moves offline to the platform's UPI, and the milkman records the
 * reference here. An administrator checks it against the bank statement before
 * the panel opens — there is no automatic reconciliation.
 *
 * Changing plans: when `current` is a live plan, its card is marked and cannot
 * be picked again, plans with fewer seats than `customerCount` are greyed
 * out, and the copy says the new plan starts the day it is verified. While
 * a change is in the queue (`pendingChange`) the form is replaced by a note.
 *
 * @param {object} props
 * @param {Array}  props.plans
 * @param {object} props.settings   platform UPI / support details
 * @param {{planId: string, planName: string, status: string}|null} [props.current]
 * @param {number} [props.customerCount]
 * @param {{planName: string, createdAt: string}|null} [props.pendingChange]
 */
export function SubmitSaasPayment({ plans, settings, current = null, customerCount = 0, pendingChange = null }) {
  const [pending, startTransition] = useTransition();
  const onPlan = current?.status === 'ACTIVE' ? current.planId : null;
  const selectable = (p) => p.id !== onPlan && p.maxCustomers >= customerCount;
  const [planId, setPlanId] = useState(() => {
    // Default to the next plan up from the current one, else the first that fits.
    const bigger = plans.filter((p) => selectable(p) && (!current || p.maxCustomers > (current.customerLimit ?? 0)));
    return (bigger[0] ?? plans.find(selectable) ?? plans[0])?.id ?? '';
  });
  const [errors, setErrors] = useState({});

  const plan = plans.find((p) => p.id === planId);
  const changing = Boolean(current && (current.status === 'ACTIVE' || current.status === 'TRIAL'));

  if (plans.length === 0) {
    return (
      <Notice tone="caution" title="No plans on sale">
        Please contact support — there are no subscription plans available right now.
      </Notice>
    );
  }

  if (pendingChange) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-caution-soft text-caution">
            <PaymentsIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-extrabold text-ink">
              Switching to {pendingChange.planName} — awaiting verification
            </p>
            <p className="mt-1 text-sm font-medium text-ink-muted">
              We are checking your payment. {current?.planName ? `Your ${current.planName} plan stays open until it is confirmed;` : 'Your panel opens'}{' '}
              {pendingChange.planName} then starts that day.
            </p>
            {pendingChange.paymentReference ? (
              <p className="mt-1.5 text-xs font-semibold text-ink-subtle">
                Reference <span className="font-numeric text-ink">{pendingChange.paymentReference}</span>
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Pick a plan ────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={changing ? 'Change plan' : 'Choose a plan'}
          description={
            changing
              ? `You are on ${current.planName ?? 'the free trial'}. Pick another and pay for it; it takes over the day we verify the payment.`
              : 'Every plan opens the full panel; they differ in how many customers you can serve.'
          }
        />
        <CardBody className="pt-4">
          <PlanPicker
            plans={plans}
            value={planId}
            onChange={setPlanId}
            onPlan={onPlan}
            customerCount={customerCount}
          />
        </CardBody>
      </Card>

      {/* ── 2. Pay, then record the reference ─────────────────────────── */}
      <Card>
        <CardHeader
          title="Pay and activate"
          description="Send the amount by UPI, then enter the reference from your banking app."
        />
        <CardBody className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="space-y-3">
              {/* The amount, large — the one number to type into the UPI app. */}
              <div className="rounded-2xl bg-hero-blue p-4 text-white shadow-hero">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/80">Amount to send</p>
                <p className="stat-number mt-0.5 text-3xl leading-none">
                  {plan ? formatPaise(toPaise(plan.monthlyPrice), { whole: true }) : '—'}
                </p>
                {plan ? (
                  <p className="mt-1.5 text-xs font-semibold text-white/85">
                    {plan.name} · {plan.durationDays ?? 30} days · up to {plan.maxCustomers} customers
                  </p>
                ) : null}
                {changing && plan ? (
                  <p className="mt-1 text-[11px] font-medium text-white/75">
                    Starts the day it is verified. Days left on {current.planName ?? 'the trial'} are not carried over.
                  </p>
                ) : null}
              </div>

              <CopyField label="Pay to (UPI ID)" value={settings.upiId} placeholder="Not configured yet" />

              {settings.bankDetails ? (
                <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">Bank transfer</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs font-medium text-ink">{settings.bankDetails}</p>
                </div>
              ) : null}

              {settings.supportPhone ? (
                <a
                  href={`tel:${settings.supportPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                >
                  <PhoneIcon className="h-3.5 w-3.5" />
                  Need help? Call {settings.supportPhone}
                </a>
              ) : null}
            </div>

            {settings.qrCodeUrl ? (
              <figure className="mx-auto w-fit rounded-2xl border border-border bg-surface p-2 shadow-card">
                <img
                  src={settings.qrCodeUrl}
                  alt="UPI QR code for DairyDrop"
                  className="h-44 w-44 rounded-xl bg-white object-contain"
                />
                <figcaption className="mt-1.5 text-center text-[11px] font-semibold text-ink-subtle">Scan to pay</figcaption>
              </figure>
            ) : null}
          </div>

          <form
            className="space-y-4 border-t border-border pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(async () => {
                const result = await submitSaasPayment({
                  planId,
                  reference: data.get('reference'),
                });
                if (result.ok) {
                  toast.success('Submitted. We will confirm shortly.');
                  window.location.reload();
                } else {
                  setErrors(result.fieldErrors ?? {});
                  toast.error(result.message ?? 'Could not submit that.');
                }
              });
            }}
          >
            <Input
              name="reference"
              label="Transaction reference / UTR"
              inputMode="numeric"
              autoComplete="off"
              placeholder="12-digit UTR"
              hint="From your UPI or banking app, once the payment shows as successful."
              error={errors.reference}
              required
            />

            <Button type="submit" size="lg" className="w-full" loading={pending}>
              {pending ? null : <PaymentsIcon className="h-5 w-5" />}
              Submit for verification
            </Button>

            <p className="text-xs font-medium text-ink-subtle">
              Only send money to the UPI ID shown above. We will never ask for it by phone.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Plan cards that behave as radio buttons.
 *
 * The plan already held (`onPlan`) and any plan too small for the current
 * book are shown but cannot be picked, with the reason on the card — a greyed
 * button with no explanation is the kind of thing that gets a support call.
 */
function PlanPicker({ plans, value, onChange, onPlan = null, customerCount = 0 }) {
  const biggest = plans.reduce((max, p) => (p.maxCustomers > (max?.maxCustomers ?? -1) ? p : max), null);

  return (
    <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => {
        const selected = p.id === value;
        const isCurrent = p.id === onPlan;
        const tooSmall = p.maxCustomers < customerCount;
        const disabled = isCurrent || tooSmall;
        const features = Array.isArray(p.features) ? p.features : [];
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={cn(
              'tap relative flex flex-col rounded-2xl border p-4 text-left transition-all',
              selected
                ? 'border-brand bg-brand-soft/60 shadow-card-hover ring-2 ring-brand/20'
                : disabled
                  ? 'cursor-not-allowed border-border bg-surface-muted/50 opacity-80'
                  : 'border-border bg-surface hover:border-brand/40 hover:shadow-card',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-heading text-base font-extrabold tracking-tight text-ink">{p.name}</p>
                {p.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs font-medium text-ink-muted">{p.description}</p>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selected ? 'border-brand bg-brand text-brand-ink' : 'border-border bg-surface',
                )}
              >
                {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
              </span>
            </div>

            <p className="mt-3">
              <span className="stat-number text-2xl leading-none text-ink">
                {formatPaise(toPaise(p.monthlyPrice), { whole: true })}
              </span>
              <span className="ml-1 text-xs font-bold text-ink-muted">/ {p.durationDays === 30 || !p.durationDays ? 'month' : `${p.durationDays} days`}</span>
            </p>

            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              <UsersIcon className="h-4 w-4 text-brand" />
              Up to {p.maxCustomers} customers
            </p>

            {features.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs font-medium text-ink-muted">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {isCurrent ? <Badge tone="positive" dot>Your plan</Badge> : null}
              {tooSmall ? (
                <Badge tone="critical">Too small for your {customerCount} customers</Badge>
              ) : null}
              {!disabled && biggest && p.id === biggest.id && plans.length > 1 ? <Badge tone="brand">Most room</Badge> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** A value with a copy button — for the UPI ID, which nobody wants to retype. */
function CopyField({ label, value, placeholder }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('UPI ID copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press to select it instead.');
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">{label}</p>
        <p className={cn('truncate font-numeric text-sm font-extrabold', value ? 'select-all text-ink' : 'text-ink-subtle')}>
          {value ?? placeholder}
        </p>
      </div>
      {value ? (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
          className={cn(
            'tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-colors',
            copied ? 'border-positive/30 bg-positive-soft text-positive' : 'border-border bg-surface text-brand hover:bg-brand-soft',
          )}
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
