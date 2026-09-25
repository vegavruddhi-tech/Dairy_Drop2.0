'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/index.jsx';
import { Button, Input } from '@/components/ui/interactive.jsx';
import { PaymentsIcon, CheckIcon } from '@/components/ui/Icons.jsx';
import { updatePaymentSettings } from '@/actions/milkman.actions.js';
import { useT } from '@/i18n/provider.jsx';

export function PaymentSettings({ initialUpiId = '', initialQrCodeUrl = '' }) {
  const { locale } = useT();
  const isHi = locale === 'hi';
  const [upiId, setUpiId] = useState(initialUpiId || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(initialQrCodeUrl || '');
  const [pending, startTransition] = useTransition();

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error(isHi ? 'इमेज साइज 3MB से कम होना चाहिए।' : 'Image size must be under 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setQrCodeUrl(uploadEvent.target?.result);
      toast.success(isHi ? 'QR कोड इमेज अपलोड हो गई।' : 'QR Code image uploaded.');
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
        toast.success(isHi ? 'पेमेंट और QR सेटिंग्स सुरक्षित कर ली गई हैं!' : 'Payment & QR Code settings updated successfully!');
      } else {
        toast.error(res.message || (isHi ? 'पेमेंट सेटिंग्स अपडेट करने में विफल।' : 'Failed to update payment settings.'));
      }
    });
  };

  return (
    <Card>
      <CardHeader
        title={isHi ? 'आपकी UPI और QR कोड सेटिंग्स' : 'Your UPI & QR Code Settings'}
        description={
          isHi
            ? 'ग्राहक अपने मासिक बिल का भुगतान करने के लिए इस QR कोड को स्कैन करते हैं और इस UPI ID पर पैसे भेजते हैं'
            : 'Customers scan this QR code and pay to this UPI ID on their monthly bills'
        }
      />
      <CardBody className="space-y-5">
        <div>
          <Input
            label={isHi ? 'आपकी UPI ID' : 'Your UPI ID'}
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. yourdairy@upi, 9876543210@paytm"
            helper={isHi ? 'ग्राहकों को यह UPI ID उनके बिल भुगतान पेज पर दिखेगी' : 'Your customers will see this UPI ID on their /billing checkout'}
          />
        </div>

        {/* QR Code Upload / Preview Box */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
            {isHi ? 'आपका UPI QR कोड फोटो' : 'Your UPI QR Code Image'}
          </label>

          {qrCodeUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border-2 border-dashed border-brand/30 bg-brand-soft/30 p-4">
              <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm">
                <img src={qrCodeUrl} alt="Your Payment QR Code" className="h-full w-full object-contain" />
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <p className="font-heading text-sm font-bold text-ink">
                  {isHi ? 'QR कोड तैयार है' : 'QR Code Ready'}
                </p>
                <p className="text-xs text-ink-muted">
                  {isHi
                    ? 'ग्राहक मासिक दूध के बिल का भुगतान करते समय सीधे GooglePay / PhonePe / Paytm से इस इमेज को स्कैन कर सकते हैं।'
                    : 'Customers scan this image directly in GooglePay / PhonePe / Paytm when paying monthly milk bills.'}
                </p>
                <button
                  type="button"
                  onClick={() => setQrCodeUrl('')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  {isHi ? 'QR हटाएं / बदलें' : 'Remove / Change QR'}
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-muted/60 p-6 text-center cursor-pointer transition-colors hover:border-brand hover:bg-brand-soft/20">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-brand shadow-sm border border-border mb-2">
                <PaymentsIcon className="h-5 w-5" />
              </span>
              <span className="font-heading text-xs font-bold text-ink">
                {isHi ? 'QR कोड फोटो अपलोड करने के लिए क्लिक करें' : 'Click to Upload Your QR Code Image'}
              </span>
              <span className="text-[11px] font-medium text-ink-muted mt-0.5">
                {isHi ? 'GooglePay, PhonePe, Paytm या BharatPe QR अपलोड करें (PNG, JPG अधिकतम 3MB)' : 'Upload GooglePay, PhonePe, Paytm or BharatPe QR (PNG, JPG up to 3MB)'}
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
            {isHi ? 'पेमेंट और QR सेटिंग्स सेव करें' : 'Save Payment & QR Settings'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
