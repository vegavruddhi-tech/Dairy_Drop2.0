'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { saveMilkPlan, retireMilkPlan } from '@/actions/milkman.actions.js';
import { formatPaise } from '@/domain/money.js';

const UNITS = [
  { value: 'L', label: 'Litres' },
  { value: 'ml', label: 'Millilitres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'pcs', label: 'Pieces' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'ALTERNATE_DAYS', label: 'Alternate days' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const SLOTS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'BOTH', label: 'Morning & evening' },
];

export function PlanEditor({ plan, trigger }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const [basis, setBasis] = useState(plan?.monthlyPrice ? 'MONTHLY' : 'PER_DELIVERY');

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>{plan ? 'Edit' : 'New plan'}</Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={plan ? 'Edit plan' : 'New plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="plan-form" type="submit" loading={pending}>Save</Button>
          </>
        }
      >
        <form
          id="plan-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            startTransition(async () => {
              const result = await saveMilkPlan({
                ...data,
                id: plan?.id,
                isActive: true,
              });
              if (result.ok) {
                toast.success('Plan saved.');
                setOpen(false);
                setErrors({});
              } else {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save that plan.');
              }
            });
          }}
        >
          <Input name="name" label="Plan name" defaultValue={plan?.name} error={errors.name} required placeholder="1 litre daily" />
          <Input name="productName" label="What is delivered" defaultValue={plan?.productName} error={errors.productName} required placeholder="Cow milk" />

          <div className="grid grid-cols-2 gap-3">
            <Input name="quantity" label="Quantity per delivery" inputMode="decimal" defaultValue={plan?.quantity ? Number(plan.quantity) : '1'} error={errors.quantity} required />
            <Select name="unit" label="Unit" defaultValue={plan?.unit ?? 'L'} options={UNITS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select name="frequency" label="How often" defaultValue={plan?.frequency ?? 'DAILY'} options={FREQUENCIES} />
            <Select name="slot" label="When" defaultValue={plan?.slot ?? 'MORNING'} options={SLOTS} />
          </div>

          {/*
            Exactly one pricing basis — the database enforces the same rule.
            Allowing both is what made the old bills impossible to explain.
          */}
          <Select
            name="pricingBasis"
            label="How do you price it?"
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            options={[
              { value: 'MONTHLY', label: 'A monthly price' },
              { value: 'PER_DELIVERY', label: 'A price per delivery' },
            ]}
          />

          <Input
            name="price"
            label={basis === 'MONTHLY' ? 'Monthly price (₹)' : 'Price per delivery (₹)'}
            inputMode="decimal"
            defaultValue={plan ? Number(plan.monthlyPrice ?? plan.pricePerDelivery) : ''}
            error={errors.price}
            required
            hint={
              basis === 'MONTHLY'
                ? 'Divided by the true number of days in each month. Customers pay only for days delivered.'
                : 'Charged for each delivery that actually happens.'
            }
          />

          <Textarea name="description" label="Description (optional)" defaultValue={plan?.description ?? ''} maxLength={500} />
        </form>
      </Modal>
    </>
  );
}

export function PlanList({ plans }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className={plan.isActive ? undefined : 'opacity-60'}>
          <CardBody className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink">{plan.name}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{plan.productName}</p>
              </div>
              {plan.isActive ? null : <Badge tone="neutral">Retired</Badge>}
            </div>

            <div>
              <span className="text-xl font-semibold tnum text-ink">
                {plan.quotedMonthlyPaise != null
                  ? formatPaise(plan.quotedMonthlyPaise, { whole: true })
                  : '—'}
              </span>
              <span className="ml-1 text-sm text-ink-muted">/ month</span>
            </div>

            <ul className="space-y-0.5 text-sm text-ink-muted">
              <li>{Number(plan.quantity)} {plan.unit} per delivery</li>
              <li>{plan.frequency.replace('_', ' ').toLowerCase()}, {plan.slot.toLowerCase()}</li>
              {plan.unitPrice ? <li>₹{Number(plan.unitPrice).toFixed(2)} per {plan.unit}</li> : null}
            </ul>

            <div className="mt-auto flex gap-2 pt-2">
              <PlanEditor
                plan={plan}
                trigger={<Button size="sm" variant="outline">Edit</Button>}
              />
              {plan.isActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await retireMilkPlan({ id: plan.id });
                      if (result.ok) toast.success('Plan retired. Existing customers keep their terms.');
                      else toast.error(result.message ?? 'Could not retire that plan.');
                    })
                  }
                >
                  Retire
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
