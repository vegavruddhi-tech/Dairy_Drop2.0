'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader, Field, Badge } from '@/components/ui/index.jsx';
import { Button, Input, Select, Textarea } from '@/components/ui/interactive.jsx';
import { submitPayment } from '@/actions/customer.actions.js';
import { formatPaise } from '@/domain/money.js';
import { useT } from '@/i18n/provider.jsx';

/**
 * Record a payment the customer has already made offline.
 * Dual Language Support (English / Hindi).
 */
export function PayForm({ month, balancePaise, awaitingPaise = 0, milkman }) {
  const [method, setMethod] = useState('UPI');
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const { locale } = useT();
  const isHi = locale === 'hi';

  const stillDuePaise = Math.max(0, balancePaise - awaitingPaise);
  const totalDueRupees = stillDuePaise / 100;
  const halfDueRupees = (Math.round(stillDuePaise / 2) / 100).toFixed(2);

  const [amount, setAmount] = useState(String(totalDueRupees));

  const parsedAmount = Number(amount) || 0;
  const amountPaise = Math.round(parsedAmount * 100);
  const remainingPaise = Math.max(0, stillDuePaise - amountPaise);
  const isOverpaying = amountPaise > stillDuePaise;
  const isHalf = Math.abs(amountPaise - Math.round(stillDuePaise / 2)) <= 50 && stillDuePaise > 0;
  const isFull = amountPaise === stillDuePaise;

  function onSubmit(event) {
    event.preventDefault();
    if (parsedAmount <= 0) {
      toast.error(isHi ? 'कृपया शून्य से अधिक भुगतान राशि दर्ज करें।' : 'Please enter a payment amount greater than zero.');
      return;
    }
    if (isOverpaying) {
      toast.error(
        isHi
          ? `राशि कुल बकाया ${formatPaise(stillDuePaise)} से अधिक नहीं हो सकती।`
          : `Amount cannot exceed the remaining balance of ${formatPaise(stillDuePaise)}.`,
      );
      return;
    }

    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const result = await submitPayment({
        month,
        amount: String(parsedAmount),
        method: data.get('method'),
        reference: data.get('reference') || undefined,
        note: data.get('note') || undefined,
      });

      if (result.ok) {
        toast.success(
          isHi
            ? 'भुगतान दर्ज किया गया! आपका दूधवाला जल्द इसकी पुष्टि करेगा।'
            : isHalf
            ? 'Half payment recorded! Your milkman will confirm it shortly.'
            : isFull
            ? 'Full payment recorded! Your milkman will confirm it shortly.'
            : 'Payment recorded! Your milkman will confirm it shortly.',
        );
        form.reset();
        setErrors({});
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? (isHi ? 'भुगतान दर्ज नहीं हो सका।' : 'Could not record that payment.'));
      }
    });
  }

  return (
    <Card className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-white">
      <CardHeader title={isHi ? 'दूधवाले को भुगतान करें' : 'Pay your milkman'} description={milkman?.businessName ?? undefined} />
      <CardBody className="space-y-4">
        {milkman?.upiId ? (
          <div className="rounded-2xl bg-blue-50/50 border border-blue-100/80 p-3.5">
            <Field label={isHi ? 'दूधवाला UPI ID' : 'Milkman UPI ID'} value={<span className="select-all font-mono font-bold text-blue-900">{milkman.upiId}</span>} />
            {milkman.qrCodeUrl ? (
              <img
                src={milkman.qrCodeUrl}
                alt={`UPI QR code for ${milkman.businessName}`}
                className="mx-auto mt-3 h-44 w-44 rounded-xl bg-white border border-slate-200 object-contain p-2 shadow-xs"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {isHi
              ? 'आपके दूधवाले ने अभी UPI विवरण नहीं जोड़ा है। नकद भुगतान करें और नीचे दर्ज करें।'
              : 'Your milkman has not added UPI details yet. Pay in cash and record it below.'}
          </p>
        )}

        {stillDuePaise <= 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
            <p className="text-sm font-bold text-emerald-900">
              {awaitingPaise > 0
                ? (isHi ? 'भुगतान दर्ज हुआ और स्वीकृति लंबित है' : 'Payment recorded & awaiting confirmation')
                : (isHi ? 'बिल पूर्ण रूप से चुकता' : 'Bill fully settled')}
            </p>
            <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
              {awaitingPaise > 0
                ? isHi
                  ? `${formatPaise(awaitingPaise)} आपके दूधवाले के सत्यापन के लिए लंबित है।`
                  : `${formatPaise(awaitingPaise)} is with your milkman to confirm.`
                : isHi
                ? 'इस महीने का हिसाब पूरी तरह से चुकता है। अब जो भी दूध आएगा वह अगले महीने के बिल में जुड़ेगा।'
                : 'This month is completely settled. Anything delivered from here will appear on next month’s bill.'}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isHi ? 'भुगतान राशि' : 'Amount to Pay'}
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {isHi ? 'देय' : 'Due'}: <strong className="text-slate-900">{formatPaise(stillDuePaise)}</strong>
                </span>
              </div>

              {/* Quick Preset Buttons for Half / Full */}
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmount(String(totalDueRupees))}
                  className={`tap flex-1 rounded-xl py-1.5 px-2.5 text-xs font-bold border transition-all ${
                    isFull
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {isHi ? `पूरा भुगतान (${formatPaise(stillDuePaise)})` : `Pay Full (${formatPaise(stillDuePaise)})`}
                </button>

                <button
                  type="button"
                  onClick={() => setAmount(String(halfDueRupees))}
                  className={`tap flex-1 rounded-xl py-1.5 px-2.5 text-xs font-bold border transition-all ${
                    isHalf && !isFull
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {isHi ? `आधा भुगतान · 50% (₹${halfDueRupees})` : `Pay Half · 50% (₹${halfDueRupees})`}
                </button>
              </div>

              <Input
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isHi ? '₹ में राशि दर्ज करें' : 'Enter amount in ₹'}
                error={errors.amount || (isOverpaying ? (isHi ? `राशि कुल देय (${formatPaise(stillDuePaise)}) से अधिक है` : `Amount exceeds total due (${formatPaise(stillDuePaise)})`) : undefined)}
                required
              />

              {/* Live Remaining Balance Calculation */}
              {parsedAmount > 0 && !isOverpaying && (
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs flex items-center justify-between">
                  <span className="text-slate-600">
                    {isHi ? 'इस भुगतान के बाद शेष:' : 'Remaining after this payment:'}
                  </span>
                  <span className={`font-bold ${remainingPaise > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatPaise(remainingPaise)}
                  </span>
                </div>
              )}
            </div>

            <Select
              name="method"
              label={isHi ? 'भुगतान का तरीका' : 'Payment Method'}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              options={[
                { value: 'UPI', label: isHi ? 'UPI / QR कोड' : 'UPI / QR Code' },
                { value: 'CASH', label: isHi ? 'दूधवाले को नकद' : 'Cash to Milkman' },
                { value: 'BANK_TRANSFER', label: isHi ? 'बैंक ट्रांसफर (NEFT/IMPS)' : 'Bank Transfer (NEFT/IMPS)' },
              ]}
            />

            {method !== 'CASH' ? (
              <Input
                name="reference"
                label={isHi ? 'UPI संदर्भ / UTR नंबर' : 'UPI Reference / UTR Number'}
                hint={isHi ? 'GPay, PhonePe या Paytm से 12-अंकों का ट्रांजेक्शन ID' : '12-digit transaction ID from GPay, PhonePe, or Paytm'}
                placeholder="e.g. 426891028471"
                error={errors.reference}
              />
            ) : null}

            <Textarea
              name="note"
              label={isHi ? 'दूधवाले के लिए संदेश (वैकल्पिक)' : 'Note for milkman (optional)'}
              placeholder={
                isHi
                  ? 'जैसे: सुबह छोड़ते समय नकद दिया...'
                  : isHalf
                  ? 'Paid half amount, will pay remaining next week'
                  : 'e.g. Paid in morning drop...'
              }
              maxLength={300}
            />

            <Button
              type="submit"
              className="w-full font-bold shadow-sm"
              loading={pending}
              disabled={parsedAmount <= 0 || isOverpaying}
            >
              {isHi
                ? `भुगतान दर्ज करें · ${parsedAmount > 0 ? formatPaise(amountPaise) : 'राशि भरें'}`
                : `Record Payment · ${parsedAmount > 0 ? formatPaise(amountPaise) : 'Enter Amount'}`}
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              {isHi
                ? 'स्थायी रूप से जुड़ने से पहले आपका दूधवाला भुगतान की पुष्टि करता है।'
                : 'Your milkman confirms the payment before it is permanently credited.'}
            </p>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
