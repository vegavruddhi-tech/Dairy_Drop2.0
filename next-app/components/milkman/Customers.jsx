'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge, StatusBadge } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { approveCustomer, rejectCustomer } from '@/actions/milkman.actions.js';
import { formatPaise } from '@/domain/money.js';

/** A customer waiting for a decision. */
export function ApprovalCard({ customer, atLimit }) {
  const [modal, setModal] = useState(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveCustomer({ customerId: customer.id });
      if (result.ok) {
        toast.success(`${customer.name} approved.`);
      } else if (result.code === 'CUSTOMER_LIMIT_REACHED') {
        // A dedicated path, not a generic toast: the milkman needs to know
        // exactly what to do about it.
        toast.error(
          `You are at ${result.limit} customers on ${result.planName}. Upgrade to add more.`,
          { action: { label: 'Upgrade', onClick: () => (window.location.href = '/milkman/membership') } },
        );
      } else {
        toast.error(result.message ?? 'Could not approve.');
      }
    });
  }

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{customer.name}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {[customer.addressLine1, customer.addressArea, customer.addressPincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {customer.addressLandmark ? (
                <p className="text-xs text-ink-subtle">Near {customer.addressLandmark}</p>
              ) : null}
            </div>
            <StatusBadge status="PENDING" />
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm text-ink-muted">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="text-brand">{customer.phone}</a>
            ) : null}
            <span>{customer.email}</span>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" loading={pending} disabled={atLimit} onClick={approve}>
              {atLimit ? 'Plan limit reached' : 'Approve'}
            </Button>
            <Button variant="ghost" onClick={() => setModal('reject')}>
              Decline
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        title={`Decline ${customer.name}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button form="reject-form" type="submit" variant="danger" loading={pending}>
              Decline
            </Button>
          </>
        }
      >
        <form
          id="reject-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get('reason');
            startTransition(async () => {
              const result = await rejectCustomer({ customerId: customer.id, reason });
              if (result.ok) {
                toast.success('Declined.');
                setModal(null);
              } else {
                toast.error(result.message ?? 'Could not decline.');
              }
            });
          }}
        >
          <p className="text-sm text-ink-muted">They will see this reason.</p>
          <Textarea
            name="reason"
            label="Reason"
            required
            maxLength={500}
            placeholder="Sorry, I do not cover your street yet."
          />
        </form>
      </Modal>
    </>
  );
}

/** A row in the active customer book. */
export function CustomerRow({ customer, summary }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{customer.name}</p>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {[customer.addressArea, customer.addressPincode].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {summary?.count ? (
          <>
            <p className="text-sm font-medium text-ink">
              {summary.count === 1 ? summary.productNames : `${summary.count} plans`}
            </p>
            <p className="text-xs tnum text-ink-muted">
              {Number(summary.totalQuantity)} L/day
            </p>
          </>
        ) : (
          <Badge tone="neutral">No plan</Badge>
        )}
      </div>

      {customer.phone ? (
        <a
          href={`tel:${customer.phone}`}
          className="tap shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-ink-muted"
        >
          Call
        </a>
      ) : null}
    </li>
  );
}
