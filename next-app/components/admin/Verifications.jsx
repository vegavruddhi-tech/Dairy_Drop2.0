'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Field } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { verifySaasPayment } from '@/actions/admin.actions.js';
import { formatPaise, toPaise } from '@/domain/money.js';

export function VerificationCard({ item }) {
  const [modal, setModal] = useState(false);
  const [pending, startTransition] = useTransition();

  function resolve(approve, rejectionReason) {
    startTransition(async () => {
      const result = await verifySaasPayment({
        subscriptionId: item.id,
        approve,
        rejectionReason,
      });
      if (result.ok) {
        toast.success(approve ? 'Approved — their panel is open.' : 'Rejected.');
        setModal(false);
      } else {
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  return (
    <>
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{item.businessName ?? item.milkmanName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{item.milkmanName} · {item.milkmanEmail}</p>
              {item.milkmanPhone ? (
                <a href={`tel:${item.milkmanPhone}`} className="text-sm text-brand">{item.milkmanPhone}</a>
              ) : null}
            </div>
            <p className="text-2xl font-semibold tnum text-ink">
              {item.amount ? formatPaise(toPaise(item.amount)) : '—'}
            </p>
          </div>

          <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <Field label="Plan" value={item.planName} />
            <Field
              label="Reference"
              value={<span className="select-all font-medium">{item.reference}</span>}
            />
            <Field label="Submitted" value={formatInstantSafe(item.submittedAt)} />
          </dl>

          <div className="flex gap-2">
            <Button className="flex-1" loading={pending} onClick={() => resolve(true)}>
              Approve
            </Button>
            <Button variant="ghost" onClick={() => setModal(true)}>
              Reject
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Reject this payment?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button form="reject-saas" type="submit" variant="danger" loading={pending}>
              Reject
            </Button>
          </>
        }
      >
        <form
          id="reject-saas"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            resolve(false, new FormData(event.currentTarget).get('rejectionReason') || undefined);
          }}
        >
          <p className="text-sm text-ink-muted">
            The milkman sees this and can submit again.
          </p>
          <Textarea
            name="rejectionReason"
            label="Reason"
            required
            maxLength={500}
            placeholder="We could not find this reference on our statement."
          />
        </form>
      </Modal>
    </>
  );
}

function formatInstantSafe(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
