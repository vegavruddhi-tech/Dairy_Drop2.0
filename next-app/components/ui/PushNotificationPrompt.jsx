'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  isPushNotificationSupported,
  getPushPermissionState,
  subscribeUserToPush,
} from '@/lib/pushClient.js';
import { BellIcon } from '@/components/ui/Icons.jsx';

export function PushNotificationPrompt({
  role = 'customer',
  title,
  description,
  compact = false,
}) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isSupp = isPushNotificationSupported();
    setSupported(isSupp);
    if (isSupp) {
      setPermission(getPushPermissionState());
      const wasDismissed = localStorage.getItem('dairydrop_push_dismissed');
      if (wasDismissed === 'true') {
        setDismissed(true);
      }
    }
  }, []);

  if (!supported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const defaultTitle =
    title ||
    (role === 'milkman'
      ? 'Enable Morning Round & Order Alerts'
      : 'Get Real-Time Delivery & Bill Alerts');

  const defaultDesc =
    description ||
    (role === 'milkman'
      ? 'Receive instant mobile alerts for new customer signups, quantity changes, and daily extra orders.'
      : 'Know immediately when your milk is delivered at your doorstep, when delivery windows open, or when monthly bills arrive.');

  async function handleEnable() {
    setLoading(true);
    try {
      await subscribeUserToPush();
      setPermission('granted');
      toast.success('Push notifications enabled! You will receive timely delivery alerts.');
    } catch (err) {
      console.error(err);
      if (err.message?.includes('permission')) {
        setPermission('denied');
        toast.error('Notification permission was denied. You can re-enable it in your browser settings.');
      } else {
        toast.info(err.message || 'Push notifications could not be enabled.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('dairydrop_push_dismissed', 'true');
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/60 p-3 text-xs">
        <div className="flex items-center gap-2 text-blue-900 font-semibold">
          <BellIcon className="h-4 w-4 text-blue-600 shrink-0" />
          <span>Enable live push notifications</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Enabling…' : 'Turn On'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-blue-300/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-blue-50/90 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <BellIcon className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <h3 className="font-heading text-sm sm:text-base font-black text-slate-900">
              {defaultTitle}
            </h3>
            <p className="text-xs font-semibold text-slate-600 max-w-xl leading-relaxed">
              {defaultDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-xl px-3 py-2 font-heading text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition-colors"
          >
            Maybe Later
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="tap rounded-xl bg-blue-600 px-4 py-2 font-heading text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-60"
          >
            {loading ? 'Enabling…' : 'Enable Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
}
