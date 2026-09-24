'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/index.jsx';
import { Button, Input } from '@/components/ui/interactive.jsx';
import { PaymentsIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { updatePaymentSettings } from '@/actions/milkman.actions.js';

export function PaymentSettings({ initialUpiId = '', initialQrCodeUrl = '' }) {
  const [upiId, setUpiId] = useState(initialUpiId || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(initialQrCodeUrl || '');
  const [pending, startTransition] = useTransition();

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image size must be under 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setQrCodeUrl(uploadEvent.target?.result);
      toast.success('QR Code image uploaded.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updatePaymentSettings({
        upiId: upiId.trim(),
        qrCodeUrl: qrCodeUrl.trim(),
      });

      if (res.ok) {
        toast.success('Payment & QR Code settings updated successfully!');
      } else {
        toast.error(res.message || 'Failed to update payment settings.');
      }
    });
  };

  return (
    <Card>
      <CardHeader
        title="Your UPI & QR Code Settings"
        description="Customers scan this QR code and pay to this UPI ID on their monthly bills"
      />
      <CardBody className="space-y-5">
        <div>
          <Input
            label="Your UPI ID"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. yourdairy@upi, 9876543210@paytm"
            helper="Your customers will see this UPI ID on their /billing checkout"
          />
        </div>

        {/* QR Code Upload / Preview Box */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
            Your UPI QR Code Image
          </label>

          {qrCodeUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border-2 border-dashed border-brand/30 bg-brand-soft/30 p-4">
              <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm">
                <img src={qrCodeUrl} alt="Your Payment QR Code" className="h-full w-full object-contain" />
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <p className="font-heading text-sm font-bold text-ink">QR Code Ready</p>
                <p className="text-xs text-ink-muted">
                  Customers scan this image directly in GooglePay / PhonePe / Paytm when paying monthly milk bills.
                </p>
                <button
                  type="button"
                  onClick={() => setQrCodeUrl('')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  Remove / Change QR
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-muted/60 p-6 text-center cursor-pointer transition-colors hover:border-brand hover:bg-brand-soft/20">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-brand shadow-sm border border-border mb-2">
                <PaymentsIcon className="h-5 w-5" />
              </span>
              <span className="font-heading text-xs font-bold text-ink">
                Click to Upload Your QR Code Image
              </span>
              <span className="text-[11px] font-medium text-ink-muted mt-0.5">
                Upload GooglePay, PhonePe, Paytm or BharatPe QR (PNG, JPG up to 3MB)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrUpload}
                className="sr-only"
              />
            </label>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={handleSave}
            loading={pending}
            className="w-full sm:w-auto"
          >
            <CheckIcon className="h-4 w-4" />
            Save Payment & QR Settings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
