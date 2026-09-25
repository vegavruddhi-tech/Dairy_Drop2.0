'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n/provider.jsx';

import { Badge } from '@/components/ui/index.jsx';
import { Button, Modal, Textarea } from '@/components/ui/interactive.jsx';
import { formatPaise, toPaise } from '@/domain/money.js';
import { formatMonth, formatInstant } from '@/domain/dates.js';
import { PaymentsIcon, PhoneIcon, CheckIcon, CalendarIcon } from '@/components/ui/Icons.jsx';
import { verifyPayment } from '@/actions/milkman.actions.js';

/**
 * Confirm a payment a customer says they made.
 *
 * Verification is idempotent server-side, so a double-tap on a bad connection
 * cannot credit the bill twice.
 */
export function VerifyPayment({ payment }) {
  const { t } = useT();
  const [modal, setModal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  function resolve(approve, rejectionReason) {
    startTransition(async () => {
      setRemoved(true);
      setModal(false);
      const result = await verifyPayment({ paymentId: payment.id, approve, rejectionReason });
      if (result.ok) {
        toast.success(approve ? t('common.saved', {}, 'Payment confirmed.') : t('common.rejected', {}, 'Marked as not received.'));
      } else {
        setRemoved(false);
        toast.error(result.message ?? t('common.tryAgain', {}, 'Could not save that.'));
      }
    });
  }

  if (removed) return null;

  return (
    <>
      <article className="card-surface relative overflow-hidden p-4 sm:p-5">
        {/* Amber strip: money that is claimed but not yet counted. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-caution" />

        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-caution-soft text-caution">
            <PaymentsIcon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-base font-extrabold tracking-tight text-ink">{payment.customerName}</h3>
              <Badge tone="caution" dot>{t('common.pending', {}, 'Awaiting you')}</Badge>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-muted">
              <CalendarIcon className="h-4 w-4 text-ink-subtle" />
              {t('billing.month', {}, 'For')} {formatMonth(payment.month)}
              <span className="text-ink-subtle">·</span>
              <span className="font-medium text-ink-subtle">{t('planRequests.requestedBy', {}, 'recorded')} {formatInstant(payment.createdAt)}</span>
            </p>
          </div>

          {payment.customerPhone ? (
            <a
              href={`tel:${payment.customerPhone}`}
              aria-label={`Call ${payment.customerName}`}
              title={`Call ${payment.customerName}`}
              className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-brand shadow-xs transition-colors hover:bg-brand-soft"
            >
              <PhoneIcon className="h-4 w-4" />
            </a>
          ) : null}
        </div>

        {/* The claim: amount large, then the two things to look up in the UPI app. */}
        <div className="mt-4 rounded-2xl bg-surface-muted/70 px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-subtle">{t('billing.totalPayable', {}, 'They say they sent')}</p>
              <p className="stat-number text-3xl leading-none text-ink">{formatPaise(toPaise(payment.amount))}</p>
            </div>
            <Badge tone="brand" className="shrink-0">{payment.method}</Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
            <div className="min-w-0">
              <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">{t('billing.transactionId', {}, 'Reference')}</dt>
              <dd className="tnum truncate font-numeric text-sm font-bold text-ink">{payment.reference ?? '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10.5px] font-bold uppercase tracking-wide text-ink-subtle">{t('billing.paymentMode', {}, 'Method')}</dt>
              <dd className="truncate text-sm font-bold text-ink">{payment.method}</dd>
            </div>
          </dl>
        </div>

        {payment.customerNote ? (
          <blockquote className="mt-3 rounded-xl border border-info/15 bg-info-soft px-3 py-2 text-sm font-medium text-info">
            “{payment.customerNote}”
          </blockquote>
        ) : null}

        <p className="mt-3 text-xs font-medium text-ink-subtle">
          {t('billing.scanQrToPay', {}, 'Find this reference in your bank or UPI app before confirming.')}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" loading={pending} onClick={() => resolve(true)}>
            {pending ? null : <CheckIcon className="h-5 w-5" />}
            {t('common.confirm', {}, 'I received this')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setModal(true)}
            className="text-critical hover:border-critical/40 hover:bg-critical-soft"
          >
            {t('common.reject', {}, 'Not received')}
          </Button>
        </div>
      </article>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={t('billing.paymentStatus', {}, 'Payment not received?')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>{t('common.cancel', {}, 'Cancel')}</Button>
            <Button form="reject-payment" type="submit" variant="danger" loading={pending}>
              {t('common.reject', {}, 'Mark as not received')}
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
            {t('billing.enterUtr', {}, 'The customer will be asked to check the reference and try again.')}
          </p>
          <Textarea
            name="rejectionReason"
            label={t('planRequests.reason', {}, 'What should they check?')}
            maxLength={500}
            placeholder={t('billing.enterUtr', {}, 'I could not find this reference in my UPI history.')}
          />
        </form>
      </Modal>
    </>
  );
}
