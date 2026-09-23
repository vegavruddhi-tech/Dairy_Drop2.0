'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader, Field, Notice } from '@/components/ui/index.jsx';
import { Button, Input, Select } from '@/components/ui/interactive.jsx';
import { startTrial, submitSaasPayment, quickVerifyMyDairy } from '@/actions/milkman.actions.js';
import { formatPaise, toPaise } from '@/domain/money.js';

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
      ⚡ Instant Verify My Dairy (One-Click Activation)
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
 */
export function SubmitSaasPayment({ plans, settings }) {
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [errors, setErrors] = useState({});

  const plan = plans.find((p) => p.id === planId);

  if (plans.length === 0) {
    return (
      <Notice tone="caution" title="No plans on sale">
        Please contact support — there are no subscription plans available right now.
      </Notice>
    );
  }

  return (
    <Card>
      <CardHeader title="Pay and activate" description="Pay by UPI, then enter the reference." />
      <CardBody className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label="Pay to" value={<span className="select-all">{settings.upiId ?? 'Not configured'}</span>} />
            {plan ? (
              <Field label="Amount" value={formatPaise(toPaise(plan.monthlyPrice))} />
            ) : null}
            {settings.supportPhone ? (
              <Field
                label="Need help?"
                value={<a href={`tel:${settings.supportPhone}`} className="text-brand">{settings.supportPhone}</a>}
              />
            ) : null}
          </div>

          {settings.qrCodeUrl ? (
            <img
              src={settings.qrCodeUrl}
              alt="UPI QR code for DairyDrop"
              className="mx-auto h-44 w-44 rounded-xl bg-white object-contain p-2"
            />
          ) : null}
        </div>

        <form
          className="space-y-4 border-t border-border pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await submitSaasPayment({
                planId: data.get('planId'),
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
          <Select
            name="planId"
            label="Plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.name} · ${formatPaise(toPaise(p.monthlyPrice), { whole: true })}/mo · ${p.maxCustomers} customers`,
            }))}
          />

          <Input
            name="reference"
            label="Transaction reference / UTR"
            hint="The 12-digit reference from your UPI or banking app."
            error={errors.reference}
            required
          />

          <Button type="submit" size="lg" className="w-full" loading={pending}>
            Submit for verification
          </Button>

          <p className="text-xs text-ink-muted">
            Only send money to the UPI ID shown above. We will never ask for it by phone.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
