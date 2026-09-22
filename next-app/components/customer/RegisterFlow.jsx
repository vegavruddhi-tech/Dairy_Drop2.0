'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge, EmptyState } from '@/components/ui/index.jsx';
import { Button, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { registerWithMilkman } from '@/actions/customer.actions.js';

/**
 * Three steps: pincode → milkman → address.
 *
 * Serviceability is one exact pincode lookup, and the list only shows milkmen
 * who can actually take the customer on — verified, subscribed, and under their
 * plan's customer limit. The previous system let a customer register with a
 * milkman who was already full and only discovered it at approval time.
 */
export function RegisterFlow({ defaultName }) {
  const [step, setStep] = useState('pincode');
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState(null);
  const [milkman, setMilkman] = useState(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  async function lookup(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('pincode');

    startTransition(async () => {
      const response = await fetch(`/api/serviceability?pincode=${value}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message ?? 'Could not check that pincode.');
        return;
      }

      setPincode(String(value));
      setResult(data);
      setStep('milkman');
    });
  }

  function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));

    startTransition(async () => {
      const response = await registerWithMilkman({ ...data, milkmanId: milkman.id, pincode });
      if (response.ok) {
        toast.success('Sent. Your milkman will approve you shortly.');
        window.location.href = '/pending';
      } else {
        setErrors(response.fieldErrors ?? {});
        toast.error(response.message ?? 'Could not complete registration.');
      }
    });
  }

  // ── Step 1: pincode ────────────────────────────────────────────────────
  if (step === 'pincode') {
    return (
      <Card>
        <CardBody>
          <form onSubmit={lookup} className="space-y-4">
            <Input
              name="pincode"
              label="Your pincode"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              placeholder="122001"
              required
              autoFocus
            />
            <Button type="submit" className="w-full" size="lg" loading={pending}>
              Find milkmen near me
            </Button>
          </form>
        </CardBody>
      </Card>
    );
  }

  // ── Step 2: choose a milkman ───────────────────────────────────────────
  if (step === 'milkman') {
    if (!result?.serviceable) {
      return (
        <EmptyState
          icon="📍"
          title={`No milkman in ${pincode} yet`}
          description="We are adding new areas all the time. Try another pincode, or check back soon."
          action={
            <Button variant="outline" onClick={() => setStep('pincode')}>
              Try another pincode
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          {result.milkmen.length} milkman{result.milkmen.length === 1 ? '' : 'men'} deliver to {pincode}.
        </p>

        {result.milkmen.map((option) => (
          <Card key={option.id}>
            <CardBody className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{option.businessName}</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {option.areas.map((area) => area.areaName).slice(0, 3).join(', ')}
                  {option.areas.length > 3 ? ` +${option.areas.length - 3}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setMilkman(option);
                  setStep('details');
                }}
              >
                Choose
              </Button>
            </CardBody>
          </Card>
        ))}

        <Button variant="ghost" className="w-full" onClick={() => setStep('pincode')}>
          Change pincode
        </Button>
      </div>
    );
  }

  // ── Step 3: details ────────────────────────────────────────────────────
  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand">Your milkman</p>
            <p className="font-medium text-ink">{milkman.businessName}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setStep('milkman')}>
            Change
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input name="name" label="Your name" defaultValue={defaultName} error={errors.name} required />
          <Input
            name="phone"
            label="Mobile number"
            inputMode="tel"
            maxLength={10}
            error={errors.phone}
            hint="Your milkman will call this if they cannot find you."
            required
          />

          <Select
            name="area"
            label="Your area"
            options={milkman.areas
              .filter((area) => area.pincode === pincode)
              .map((area) => ({ value: area.areaName, label: area.areaName }))}
          />

          <Input name="line1" label="House / flat and street" error={errors.line1} required />
          <Input name="line2" label="Building or society (optional)" />
          <Input name="landmark" label="Landmark (optional)" placeholder="Opposite the temple" />

          <Textarea
            name="deliveryInstructions"
            label="Anything your milkman should know? (optional)"
            placeholder="Leave it with the guard if nobody answers."
            maxLength={500}
          />

          <Button type="submit" className="w-full" size="lg" loading={pending}>
            Send to {milkman.businessName}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
