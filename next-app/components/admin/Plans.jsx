'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button, Modal, Input, Textarea } from '@/components/ui/interactive.jsx';
import { saveSaasPlan } from '@/actions/admin.actions.js';

export function SaasPlanEditor({ plan }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  return (
    <>
      <Button size={plan ? 'sm' : 'md'} variant={plan ? 'outline' : 'primary'} onClick={() => setOpen(true)}>
        {plan ? 'Edit' : 'New plan'}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={plan ? 'Edit plan' : 'New plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="saas-plan-form" type="submit" loading={pending}>Save</Button>
          </>
        }
      >
        <form
          id="saas-plan-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            startTransition(async () => {
              const result = await saveSaasPlan({
                ...data,
                id: plan?.id,
                isActive: data.isActive === 'on',
                features: String(data.features ?? '')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              });
              if (result.ok) {
                toast.success('Plan saved.');
                setOpen(false);
                setErrors({});
              } else {
                setErrors(result.fieldErrors ?? {});
                toast.error(result.message ?? 'Could not save.');
              }
            });
          }}
        >
          <Input name="name" label="Name" defaultValue={plan?.name} error={errors.name} required placeholder="Growth" />

          <div className="grid grid-cols-2 gap-3">
            <Input name="monthlyPrice" label="Price (₹)" inputMode="decimal" defaultValue={plan ? Number(plan.monthlyPrice) : ''} error={errors.monthlyPrice} required />
            <Input name="durationDays" label="Days" inputMode="numeric" defaultValue={plan?.durationDays ?? 30} error={errors.durationDays} required />
          </div>

          <Input
            name="maxCustomers"
            label="Customer limit"
            inputMode="numeric"
            defaultValue={plan?.maxCustomers ?? ''}
            error={errors.maxCustomers}
            required
            hint="The ceiling enforced when a milkman approves a customer."
          />

          <Textarea name="description" label="Description" defaultValue={plan?.description ?? ''} maxLength={500} />

          <Textarea
            name="features"
            label="Features"
            defaultValue={(plan?.features ?? []).join('\n')}
            placeholder={'One per line\nDaily round tracking\nMonthly billing'}
            rows={4}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input name="sortOrder" label="Sort order" inputMode="numeric" defaultValue={plan?.sortOrder ?? 0} />
            <label className="flex items-end gap-2 pb-3 text-sm text-ink">
              <input type="checkbox" name="isActive" defaultChecked={plan ? plan.isActive : true} className="h-4 w-4 rounded border-border" />
              On sale
            </label>
          </div>
        </form>
      </Modal>
    </>
  );
}
