'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader, Field } from '@/components/ui/index.jsx';
import { Button, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { submitPayment } from '@/actions/customer.actions.js';
import { formatPaise } from '@/domain/money.js';

/**
 * Record a payment the customer has already made offline.
 *
 * The money moves by UPI or cash directly between customer and milkman; the
 * platform only records the claim and waits for the milkman to confirm it.
 */
export function PayForm({ month, balancePaise, awaitingPaise = 0, milkman }) {
  const [method, setMethod] = useState('UPI');
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  /*
   * What is genuinely still payable. A payment already recorded and waiting on
   * the milkman has not reduced `balancePaise` yet — it only counts once
   * confirmed — so offering the form again would invite a duplicate the server
   * now refuses anyway.
   */
  const stillDuePaise = Math.max(0, balancePaise - awaitingPaise);

  function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const result = await submitPayment({
        month,
        amount: data.get('amount'),
        method: data.get('method'),
        reference: data.get('reference') || undefined,
        note: data.get('note') || undefined,
      });

      if (result.ok) {
        toast.success('Recorded. Your milkman will confirm it shortly.');
        form.reset();
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? 'Could not record that payment.');
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Pay your milkman" description={milkman?.businessName ?? undefined} />
      <CardBody className="space-y-4">
        {milkman?.upiId ? (
          <div className="rounded-xl bg-surface-muted p-3">
            <Field label="UPI ID" value={<span className="select-all">{milkman.upiId}</span>} />
            {milkman.qrCodeUrl ? (
              <img
                src={milkman.qrCodeUrl}
                alt={`UPI QR code for ${milkman.businessName}`}
                className="mx-auto mt-3 h-40 w-40 rounded-lg bg-white object-contain p-2"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            Your milkman has not added UPI details yet. Pay in cash and record it below.
          </p>
        )}

        {stillDuePaise <= 0 ? (
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-center">
            <p className="text-sm font-medium text-ink">
              {awaitingPaise > 0 ? 'Payment recorded' : 'Nothing to pay'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {awaitingPaise > 0
                ? `${formatPaise(awaitingPaise)} is with your milkman to confirm.`
                : 'This month is settled. Anything delivered from here will appear on next month\u2019s bill.'}
            </p>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            name="amount"
            label="Amount paid"
            inputMode="decimal"
            placeholder={String(stillDuePaise / 100)}
            defaultValue={String(stillDuePaise / 100)}
            error={errors.amount}
            required
          />

          <Select
            name="method"
            label="How did you pay?"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={[
              { value: 'UPI', label: 'UPI' },
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank transfer' },
            ]}
          />

          {method !== 'CASH' ? (
            <Input
              name="reference"
              label="Reference / UTR"
              hint="The transaction id from your payment app"
              error={errors.reference}
            />
          ) : null}

          <Textarea name="note" label="Note (optional)" maxLength={300} />

          <Button type="submit" className="w-full" loading={pending}>
            Record {formatPaise(stillDuePaise)}
          </Button>

          <p className="text-xs text-ink-muted">
            Your milkman confirms the payment before it is credited.
          </p>
        </form>
        )}
      </CardBody>
    </Card>
  );
}
