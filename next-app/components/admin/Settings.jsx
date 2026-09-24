'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader } from '@/components/ui/index.jsx';
import { Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { savePlatformSettings } from '@/actions/admin.actions.js';

export function SettingsForm({ settings }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});
  const [qrCodeUrl, setQrCodeUrl] = useState(settings.qrCodeUrl ?? '');

  function handleQrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('File size must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setQrCodeUrl(event.target.result);
      toast.success('Platform QR Code loaded!');
    };
    reader.readAsDataURL(file);
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        data.qrCodeUrl = qrCodeUrl;
        startTransition(async () => {
          const result = await savePlatformSettings(data);
          if (result.ok) {
            toast.success('Settings saved.');
            setErrors({});
          } else {
            setErrors(result.fieldErrors ?? {});
            toast.error(result.message ?? 'Could not save.');
          }
        });
      }}
    >
      <Card>
        <CardHeader title="Collecting payment" description="Where milkmen send their SaaS subscription fees" />
        <CardBody className="space-y-4">
          <Input name="upiId" label="Platform UPI ID" defaultValue={settings.upiId ?? ''} error={errors.upiId} placeholder="dairydrop@upi" />
          
          {/* Custom QR Code Image Upload Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Platform UPI QR Code Image
            </label>

            {qrCodeUrl ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
                <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <img src={qrCodeUrl} alt="Platform QR Code" className="h-full w-full object-contain" />
                </div>
                <div className="space-y-2 text-center sm:text-left">
                  <p className="font-heading text-sm font-bold text-slate-900">QR Code Active</p>
                  <p className="text-xs text-slate-500">Milkmen will scan this QR image on PhonePe / GooglePay to pay SaaS plans.</p>
                  <button
                    type="button"
                    onClick={() => setQrCodeUrl('')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                  >
                    Remove / Replace QR
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm border border-slate-200 mb-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="font-heading text-xs font-bold text-slate-900">
                  Click to Upload Platform QR Code Image
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Upload GPay / PhonePe / Paytm QR image (PNG, JPG up to 3MB)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="sr-only"
                />
              </label>
            )}
            <input type="hidden" name="qrCodeUrl" value={qrCodeUrl} />
          </div>

          <Textarea name="bankDetails" label="Bank Details (Alternative to UPI)" defaultValue={settings.bankDetails ?? ''} maxLength={1000} placeholder="Account No, IFSC code, Bank name..." />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Free trial" description="Terms offered to a new milkman" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input
            name="trialDurationDays"
            label="Trial length (days)"
            inputMode="numeric"
            defaultValue={settings.trialDurationDays}
            error={errors.trialDurationDays}
            required
          />
          <Input
            name="trialCustomerLimit"
            label="Customers during trial"
            inputMode="numeric"
            defaultValue={settings.trialCustomerLimit}
            error={errors.trialCustomerLimit}
            required
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Support" description="Shown to milkmen who need help" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input name="supportPhone" label="Phone" defaultValue={settings.supportPhone ?? ''} error={errors.supportPhone} />
          <Input name="supportEmail" label="Email" type="email" defaultValue={settings.supportEmail ?? ''} error={errors.supportEmail} />
        </CardBody>
      </Card>

      <Button type="submit" size="lg" loading={pending}>
        Save settings
      </Button>
    </form>
  );
}
