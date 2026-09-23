'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Notice } from '@/components/ui/index.jsx';
import { Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { applyToBecomeMilkman } from '@/actions/customer.actions.js';

import Link from 'next/link';

export function MilkmanApplicationForm({ defaultName }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  function onSubmit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));

    startTransition(async () => {
      const result = await applyToBecomeMilkman(data);
      if (result.ok) {
        toast.success('Application sent. We will be in touch shortly.');
        window.location.href = '/milkman/activate';
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? 'Could not send that application.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              name="businessName"
              label="Dairy or business name"
              defaultValue={defaultName ? `${defaultName}'s Dairy` : ''}
              error={errors.businessName}
              placeholder="Ramesh Fresh Dairy"
              required
            />

            <Input
              name="phone"
              label="Mobile number"
              inputMode="tel"
              maxLength={10}
              error={errors.phone}
              hint="Customers will call this number."
              required
            />

            <Textarea
              name="businessAddress"
              label="Where do you operate from? (optional)"
              maxLength={500}
            />

            <div className="rounded-2xl border border-border bg-surface-muted/50 p-3.5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                Your first delivery area
              </p>
              <p className="mb-3 text-xs font-medium text-ink-muted">
                Customers find you by pincode, so we need at least one area to start.
                You can add more once you are live.
              </p>

              <div className="space-y-3">
                <Input name="areaName" label="Area or sector" error={errors.areaName} placeholder="Sector 45" required />
                <div className="grid grid-cols-2 gap-3">
                  <Input name="pincode" label="Pincode" inputMode="numeric" maxLength={6} error={errors.pincode} placeholder="122003" required />
                  <Input name="city" label="City" error={errors.city} placeholder="Gurugram" required />
                </div>
                <Input name="state" label="State" error={errors.state} placeholder="Haryana" required />
              </div>
            </div>

            <Input
              name="upiId"
              label="UPI ID (optional)"
              error={errors.upiId}
              hint="Where your customers will pay you. You can add it later."
              placeholder="ramesh@upi"
            />

            <Notice tone="info" title="What happens next">
              We verify your details, then you start a 7-day free trial — no card,
              no payment. Choose a plan whenever you are ready.
            </Notice>

            <Button type="submit" size="lg" className="w-full" loading={pending}>
              Send application
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="text-center">
        <Link
          href="/register"
          className="text-xs font-semibold text-ink-muted underline hover:text-brand"
        >
          Want to buy milk instead? Find your milkman
        </Link>
      </div>
    </div>
  );
}
