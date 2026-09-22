'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader } from '@/components/ui/index.jsx';
import { Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { savePlatformSettings } from '@/actions/admin.actions.js';

export function SettingsForm({ settings }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        startTransition(async () => {
          const result = await savePlatformSettings(data);
          if (result.ok) {
            toast.success('Settings saved.');
            setErrors({});
          } else {
            setErrors(result.fieldErrors ?? {});
            toast.error(result.message ?? 'Could not save.');
          }
        });
      }}
    >
      <Card>
        <CardHeader title="Collecting payment" description="Where milkmen send their subscription fee" />
        <CardBody className="space-y-4">
          <Input name="upiId" label="UPI ID" defaultValue={settings.upiId ?? ''} error={errors.upiId} placeholder="dairydrop@upi" />
          <Input name="qrCodeUrl" label="QR code image URL" defaultValue={settings.qrCodeUrl ?? ''} error={errors.qrCodeUrl} />
          <Textarea name="bankDetails" label="Bank details" defaultValue={settings.bankDetails ?? ''} maxLength={1000} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Free trial" description="Terms offered to a new milkman" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input
            name="trialDurationDays"
            label="Trial length (days)"
            inputMode="numeric"
            defaultValue={settings.trialDurationDays}
            error={errors.trialDurationDays}
            required
          />
          <Input
            name="trialCustomerLimit"
            label="Customers during trial"
            inputMode="numeric"
            defaultValue={settings.trialCustomerLimit}
            error={errors.trialCustomerLimit}
            required
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Support" description="Shown to milkmen who need help" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input name="supportPhone" label="Phone" defaultValue={settings.supportPhone ?? ''} error={errors.supportPhone} />
          <Input name="supportEmail" label="Email" type="email" defaultValue={settings.supportEmail ?? ''} error={errors.supportEmail} />
        </CardBody>
      </Card>

      <Button type="submit" size="lg" loading={pending}>
        Save settings
      </Button>
    </form>
  );
}
