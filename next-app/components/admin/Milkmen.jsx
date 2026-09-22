'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { verifyMilkman, suspendMilkman } from '@/actions/admin.actions.js';

/**
 * Verify or suspend a business.
 *
 * Suspension is destructive — it closes the milkman's panel and stops their
 * customers' deliveries — so it requires a reason and an explicit confirmation
 * that spells out the consequence. Unlike the previous system it does not
 * cancel the subscription, so verifying again fully restores access.
 */
export function MilkmanActions({ milkman }) {
  const [modal, setModal] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex justify-end gap-2">
        {milkman.isVerified ? (
          <Button size="sm" variant="ghost" onClick={() => setModal(true)}>
            Suspend
          </Button>
        ) : (
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await verifyMilkman({ milkmanId: milkman.id });
                if (result.ok) toast.success(`${milkman.businessName ?? milkman.name} verified.`);
                else toast.error(result.message ?? 'Could not verify.');
              })
            }
          >
            Verify
          </Button>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={`Suspend ${milkman.businessName ?? milkman.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button form="suspend-form" type="submit" variant="danger" loading={pending}>
              Suspend
            </Button>
          </>
        }
      >
        <form
          id="suspend-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get('reason');
            startTransition(async () => {
              const result = await suspendMilkman({ milkmanId: milkman.id, reason });
              if (result.ok) {
                toast.success('Suspended.');
                setModal(false);
              } else {
                toast.error(result.message ?? 'Could not suspend.');
              }
            });
          }}
        >
          <div className="rounded-xl bg-critical-soft px-4 py-3 text-sm text-critical">
            <p className="font-medium">This closes their panel immediately.</p>
            <p className="mt-1">
              {milkman.customerCount} customer{milkman.customerCount === 1 ? '' : 's'} will stop
              receiving deliveries. Their subscription is kept, so verifying again
              restores everything.
            </p>
          </div>

          <Textarea
            name="reason"
            label="Reason"
            required
            maxLength={500}
            placeholder="Repeated complaints about undelivered milk."
            hint="The milkman will see this."
          />
        </form>
      </Modal>
    </>
  );
}
