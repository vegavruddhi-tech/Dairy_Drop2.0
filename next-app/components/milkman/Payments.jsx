'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, Field } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { verifyPayment } from '@/actions/milkman.actions.js';

/**
 * Confirm a payment a customer says they made.
 *
 * Verification is idempotent server-side, so a double-tap on a bad connection
 * cannot credit the bill twice.
 */
export function VerifyPayment({ payment }) {
  const [modal, setModal] = useState(false);
  const [pending, startTransition] = useTransition();

  function resolve(approve, rejectionReason) {
    startTransition(async () => {
      const result = await verifyPayment({ paymentId: payment.id, approve, rejectionReason });
      if (result.ok) {
        toast.success(approve ? 'Payment confirmed.' : 'Marked as not received.');
        setModal(false);
      } else {
        toast.error(result.message ?? 'Could not save that.');
      }
    });
  }

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{payment.customerName}</p>
              {payment.customerPhone ? (
                <a href={`tel:${payment.customerPhone}`} className="text-sm text-brand">
                  {payment.customerPhone}
                </a>
              ) : null}
            </div>
            <p className="text-2xl font-semibold tnum text-ink">
              ₹{Number(payment.amount).toFixed(2)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <Field label="Method" value={payment.method} />
            <Field label="Reference" value={payment.reference ?? '—'} />
            <Field label="For" value={payment.month} />
          </dl>

          {payment.customerNote ? (
            <p className="text-sm italic text-ink-muted">"{payment.customerNote}"</p>
          ) : null}

          <p className="text-xs text-ink-subtle">
            Check this against your bank or UPI app before confirming.
          </p>

          <div className="flex gap-2">
            <Button className="flex-1" loading={pending} onClick={() => resolve(true)}>
              I received this
            </Button>
            <Button variant="ghost" onClick={() => setModal(true)}>
              Not received
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Payment not received?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button form="reject-payment" type="submit" variant="danger" loading={pending}>
              Mark as not received
            </Button>
          </>
        }
      >
        <form
          id="reject-payment"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            resolve(false, new FormData(event.currentTarget).get('rejectionReason') || undefined);
          }}
        >
          <p className="text-sm text-ink-muted">
            The customer will be asked to check the reference and try again.
          </p>
          <Textarea
            name="rejectionReason"
            label="What should they check?"
            maxLength={500}
            placeholder="I could not find this reference in my UPI history."
          />
        </form>
      </Modal>
    </>
  );
}
