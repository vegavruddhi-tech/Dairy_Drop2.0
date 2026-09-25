'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useT } from '@/i18n/provider.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { useRealtimeTable } from '@/lib/useRealtime.js';

const AUTO_CHECK_INTERVAL_SECONDS = 10;

/**
 * Real-time Auto Verification Status Poller & Manual Checker
 * Automatically checks verification status every 10 seconds, displays a live countdown timer,
 * provides a manual "Check Status Now" button, and auto-redirects upon admin approval.
 */
export function VerificationStatusChecker({
  initialGate,
  initialMessage,
  businessName,
  phone,
  targetRedirect = '/milkman',
}) {
  const router = useRouter();
  const { locale } = useT();
  const isHi = locale === 'hi';

  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_CHECK_INTERVAL_SECONDS);
  const [checkCount, setCheckCount] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [statusMessage, setStatusMessage] = useState(initialMessage);

  const checkStatus = useCallback(
    async (isManual = false) => {
      if (loading) return;
      setLoading(true);

      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' });
        const data = await res.json();

        setLastCheckedAt(new Date());
        setCheckCount((prev) => prev + 1);
        setCountdown(AUTO_CHECK_INTERVAL_SECONDS);

        if (data.ok) {
          toast.success(
            isHi
              ? 'बधाई हो! आपकी डेयरी सत्यापित हो चुकी है। रीडायरेक्ट कर रहे हैं...'
              : 'Congratulations! Your dairy is verified. Redirecting to your panel...',
          );
          window.location.href = data.redirect || targetRedirect;
          return;
        }

        if (data.message) {
          setStatusMessage(data.message);
        }

        if (isManual) {
          toast.info(
            isHi
              ? 'सत्यापन अभी प्रगति पर है। हम आपकी डेयरी विवरण की जांच कर रहे हैं।'
              : 'Verification is currently in progress. We are reviewing your dairy details.',
          );
        }
      } catch (err) {
        console.error('Failed to check status:', err);
        if (isManual) {
          toast.error(
            isHi
              ? 'स्टेटस चेक करने में विफल। कृपया पुनः प्रयास करें।'
              : 'Could not refresh status. Please try again.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, isHi, targetRedirect],
  );

  // 1. Supabase Realtime WebSocket Listeners (Instant DB Push Event)
  useRealtimeTable({
    table: 'milkman_profiles',
    onUpdate: () => {
      checkStatus(false);
    },
  });

  useRealtimeTable({
    table: 'users',
    onUpdate: () => {
      checkStatus(false);
    },
  });

  // 2. 10-second interval countdown timer (Active Heartbeat Fallback)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          checkStatus(false);
          return AUTO_CHECK_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [checkStatus]);

  return (
    <div className="space-y-4">
      {/* Live Polling Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue-50/70 border border-blue-200/80 px-4 py-2.5 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
          </span>
          <span className="font-semibold">
            {isHi
              ? `अगला ऑटो-चेक: ${countdown}s में`
              : `Auto-checking in: ${countdown}s`}
          </span>
          {checkCount > 0 && (
            <span className="text-[10px] text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full font-bold">
              {checkCount} {isHi ? 'बार चेक किया गया' : 'checks'}
            </span>
          )}
        </div>

        {lastCheckedAt && (
          <span className="text-[11px] text-slate-500 font-medium">
            {isHi ? 'अंतिम जांच:' : 'Last checked:'}{' '}
            {lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Manual Check Button */}
      <div className="pt-1">
        <Button
          onClick={() => checkStatus(true)}
          loading={loading}
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/25 py-3.5 flex items-center justify-center gap-2"
        >
          <svg className={`h-4 w-4 fill-none stroke-current ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{isHi ? 'अभी स्टेटस चेक करें (Check Status Now)' : 'Check Status Now'}</span>
        </Button>
      </div>

      {/* Application Snapshot Card */}
      {(businessName || phone) && (
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 text-left text-xs space-y-2">
          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            {isHi ? 'दर्ज किया गया विवरण' : 'Submitted Application Details'}
          </p>
          <div className="grid grid-cols-2 gap-2 text-slate-800">
            {businessName && (
              <div>
                <span className="text-slate-500 block text-[11px]">{isHi ? 'डेयरी का नाम' : 'Dairy Name'}:</span>
                <span className="font-bold">{businessName}</span>
              </div>
            )}
            {phone && (
              <div>
                <span className="text-slate-500 block text-[11px]">{isHi ? 'मोबाइल नंबर' : 'Phone'}:</span>
                <span className="font-bold font-mono">{phone}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
