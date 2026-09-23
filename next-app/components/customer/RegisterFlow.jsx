'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Card, CardBody, Badge, EmptyState } from '@/components/ui/index.jsx';
import { Button, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { registerWithMilkman } from '@/actions/customer.actions.js';

/**
 * Onboarding Flow:
 * 1. Role Selection: Choose between Customer (Buy Milk) and Milkman (Sell Milk)
 * 2. Pincode Lookup (for customers)
 * 3. Choose Milkman
 * 4. Customer Address & Details
 */
export function RegisterFlow({ defaultName }) {
  const [step, setStep] = useState('role');
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

  // ── Step 0: Role Selection ─────────────────────────────────────────────
  if (step === 'role') {
    return (
      <div className="space-y-6">
        <header className="text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Welcome to DairyDrop
          </span>
          <h1 className="mt-2.5 font-heading text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            How do you want to use DairyDrop?
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-muted">
            Choose your account role to continue with the right setup.
          </p>
        </header>

        <div className="grid gap-4">
          {/* Customer Option */}
          <div
            onClick={() => setStep('pincode')}
            className="group relative cursor-pointer rounded-2xl border-2 border-border bg-surface p-5 shadow-sm transition-all hover:border-brand hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl shadow-inner transition-transform group-hover:scale-105">
                🥛
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold text-ink group-hover:text-brand">
                    I want to buy milk
                  </h2>
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                    Customer
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Get fresh, pure milk delivered to your door every morning. Pause delivery, adjust quantity, and pay monthly bills with UPI.
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-brand">
                  <span>Continue as Customer</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </div>
          </div>

          {/* Milkman Option */}
          <Link
            href="/become-a-milkman"
            className="group relative block rounded-2xl border-2 border-border bg-surface p-5 shadow-sm transition-all hover:border-accent hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl shadow-inner transition-transform group-hover:scale-105">
                🚲
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold text-ink group-hover:text-accent">
                    I want to sell milk
                  </h2>
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                    Milkman / Dairy
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Manage your delivery rounds, track customer subscriptions, automate monthly billing, and grow your local dairy business.
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-accent">
                  <span>Apply as Milkman</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ── Step 1: Pincode Lookup ─────────────────────────────────────────────
  if (step === 'pincode') {
    return (
      <div className="space-y-6">
        <header className="text-left">
          <button
            type="button"
            onClick={() => setStep('role')}
            className="mb-2.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <span>←</span> Back to role selection
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Step 1 of 2
          </span>
          <h1 className="mt-2.5 font-heading text-2xl font-extrabold tracking-tight text-ink">
            Find your local milkman
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-muted">
            Enter your 6-digit delivery pincode to see milkmen serving your area.
          </p>
        </header>

        <Card>
          <CardBody>
            <form onSubmit={lookup} className="space-y-4">
              <Input
                name="pincode"
                label="Your delivery pincode"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                placeholder="e.g. 122001"
                required
                autoFocus
              />
              <Button type="submit" className="w-full" size="lg" loading={pending}>
                Find milkmen near me
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="text-center">
          <Link
            href="/become-a-milkman"
            className="text-xs font-semibold text-ink-muted underline hover:text-brand"
          >
            Are you a milkman looking to sell milk? Apply here
          </Link>
        </div>
      </div>
    );
  }

  // ── Step 2: Choose a milkman ───────────────────────────────────────────
  if (step === 'milkman') {
    if (!result?.serviceable) {
      return (
        <div className="space-y-6">
          <EmptyState
            icon="📍"
            title={`No milkman in ${pincode} yet`}
            description="We are expanding to new areas every week. You can try a neighbouring pincode or apply as a milkman to serve this area!"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setStep('pincode')}>
                  Try another pincode
                </Button>
                <Link href="/become-a-milkman">
                  <Button variant="ghost">Sell milk in {pincode}</Button>
                </Link>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <header className="text-left">
          <button
            type="button"
            onClick={() => setStep('pincode')}
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <span>←</span> Change pincode ({pincode})
          </button>
          <h1 className="font-heading text-xl font-bold tracking-tight text-ink">
            Available milkmen in {pincode}
          </h1>
          <p className="text-xs text-ink-muted">
            {result.milkmen.length} verified {result.milkmen.length === 1 ? 'milkman delivers' : 'milkmen deliver'} to your pincode. Choose one to start.
          </p>
        </header>

        {result.milkmen.map((option) => (
          <Card key={option.id}>
            <CardBody className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading font-bold text-ink">{option.businessName}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {option.areas.map((area) => area.areaName).slice(0, 3).join(', ')}
                  {option.areas.length > 3 ? ` +${option.areas.length - 3} more` : ''}
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

  // ── Step 3: Address & Details ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      <header className="text-left">
        <button
          type="button"
          onClick={() => setStep('milkman')}
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
        >
          <span>←</span> Choose different milkman
        </button>
        <h1 className="font-heading text-xl font-bold tracking-tight text-ink">
          Delivery address & details
        </h1>
        <p className="text-xs text-ink-muted">
          Your chosen milkman will use these details to deliver to your doorstep.
        </p>
      </header>

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Your Milkman</p>
              <p className="font-heading font-bold text-ink">{milkman.businessName}</p>
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
              hint="Your milkman will call this if they need assistance finding your flat."
              required
            />

            <Select
              name="area"
              label="Delivery area / sector"
              options={milkman.areas
                .filter((area) => area.pincode === pincode)
                .map((area) => ({ value: area.areaName, label: area.areaName }))}
            />

            <Input name="line1" label="House / flat number and building" error={errors.line1} placeholder="Flat 402, Tower B, Green Valley" required />
            <Input name="line2" label="Street or landmark (optional)" placeholder="Near Central Park" />
            <Input name="landmark" label="Landmark (optional)" placeholder="Opposite the temple" />

            <Textarea
              name="deliveryInstructions"
              label="Delivery instructions for milkman (optional)"
              placeholder="e.g. Ring the bell twice or leave milk in the basket outside."
              maxLength={500}
            />

            <Button type="submit" className="w-full" size="lg" loading={pending}>
              Send Request to {milkman.businessName}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
