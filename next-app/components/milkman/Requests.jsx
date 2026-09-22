'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Badge, Notice } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { resolveQuantityRequest, resolvePlanChangeRequest } from '@/actions/milkman.actions.js';

function useResolver(action, labels) {
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState(false);

  function resolve(requestId, approve, note) {
    startTransition(async () => {
      const result = await action({ requestId, approve, note });
      if (result.ok) {
        toast.success(approve ? labels.approved : labels.rejected);
        setModal(false);
      } else {
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  return { pending, modal, setModal, resolve };
}

/** A one-day quantity change. Approving touches only that delivery. */
export function QuantityRequest({ request }) {
  const { pending, modal, setModal, resolve } = useResolver(resolveQuantityRequest, {
    approved: 'Approved for that day.',
    rejected: 'Declined.',
  });

  const from = Number(request.currentQuantity);
  const to = Number(request.requestedQuantity);
  const more = to > from;

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{request.customerName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {request.productName} · {new Date(request.deliveryDate).toDateString()}
              </p>
            </div>
            <Badge tone={more ? 'info' : 'caution'}>{more ? 'More' : 'Less'}</Badge>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
            <span className="text-lg tnum text-ink-muted line-through">{from}</span>
            <span aria-hidden="true" className="text-ink-subtle">→</span>
            <span className="text-2xl font-semibold tnum text-ink">{to}</span>
            <span className="text-sm text-ink-muted">{request.unit ?? 'L'}</span>
          </div>

          {request.customerNote ? (
            <p className="text-sm italic text-ink-muted">"{request.customerNote}"</p>
          ) : null}

          <p className="text-xs text-ink-subtle">
            Affects this one day only — their plan is unchanged.
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={pending}
              onClick={() => resolve(request.id, true)}
            >
              Approve
            </Button>
            <Button variant="ghost" onClick={() => setModal(true)}>
              Decline
            </Button>
          </div>
        </CardBody>
      </Card>

      <DeclineModal
        open={modal}
        onClose={() => setModal(false)}
        pending={pending}
        title={`Decline ${request.customerName}'s request?`}
        onSubmit={(note) => resolve(request.id, false, note)}
      />
    </>
  );
}

/** A permanent plan change. Approving versions the subscription from tomorrow. */
export function PlanChangeRequest({ request }) {
  const { pending, modal, setModal, resolve } = useResolver(resolvePlanChangeRequest, {
    approved: 'Plan changed from tomorrow.',
    rejected: 'Declined.',
  });

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div>
            <p className="font-medium text-ink">{request.customerName}</p>
            <p className="mt-0.5 text-sm text-ink-muted">Wants to change plan</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-ink-subtle">Now</p>
              <p className="mt-1 text-sm font-medium text-ink">{request.currentPlanName}</p>
              <p className="text-sm tnum text-ink-muted">
                {Number(request.currentQuantity)} {request.currentUnit}
              </p>
            </div>
            <div className="rounded-xl border border-brand bg-brand-soft/40 p-3">
              <p className="text-xs uppercase tracking-wide text-brand">Wants</p>
              <p className="mt-1 text-sm font-medium text-ink">{request.requestedPlanName}</p>
              <p className="text-sm tnum text-ink-muted">
                {Number(request.requestedQuantity)} {request.requestedUnit}
              </p>
            </div>
          </div>

          {request.customerNote ? (
            <p className="text-sm italic text-ink-muted">"{request.customerNote}"</p>
          ) : null}

          {request.planIsActive === false ? (
            <Notice tone="critical" title="That plan is retired">
              You cannot approve a change onto a plan you have retired.
            </Notice>
          ) : null}

          <p className="text-xs text-ink-subtle">
            Takes effect tomorrow. Days already delivered this month keep today's price.
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={pending}
              disabled={request.planIsActive === false}
              onClick={() => resolve(request.id, true)}
            >
              Approve
            </Button>
            <Button variant="ghost" onClick={() => setModal(true)}>
              Decline
            </Button>
          </div>
        </CardBody>
      </Card>

      <DeclineModal
        open={modal}
        onClose={() => setModal(false)}
        pending={pending}
        title={`Decline ${request.customerName}'s plan change?`}
        onSubmit={(note) => resolve(request.id, false, note)}
      />
    </>
  );
}

function DeclineModal({ open, onClose, pending, title, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="decline-form" type="submit" variant="danger" loading={pending}>
            Decline
          </Button>
        </>
      }
    >
      <form
        id="decline-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget).get('note') || undefined);
        }}
      >
        <p className="text-sm text-ink-muted">Your customer will see this.</p>
        <Textarea name="note" label="Reason (optional)" maxLength={500} />
      </form>
    </Modal>
  );
}
