'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/provider.jsx';
import {
  AppleIcon,
  AndroidIcon,
  DesktopIcon,
  IosShareIcon,
  PlusSquareIcon,
  CheckCircleIcon,
  CloseIcon,
  DownloadIcon,
} from '@/components/ui/Icons.jsx';

/**
 * High-Aesthetic Blue & White PWA Installation Modal
 * Portaled to document.body to avoid CSS stacking context traps (backdrop-filter/sticky).
 * Perfectly centered and responsive across all mobile & desktop viewports.
 */
export function PwaInstallModal({
  open,
  onClose,
  isIos,
  isAndroid,
  isDesktop,
  onNativeInstall,
  hasNativePrompt,
}) {
  const [mounted, setMounted] = useState(false);
  const { locale } = useT();
  const isHi = locale === 'hi';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md my-auto max-h-[88dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl shadow-blue-500/10 animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors z-10"
          aria-label="Close modal"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-4">
          <img
            src="/icon-512.png"
            alt="DairyDrop"
            className="h-11 w-11 rounded-2xl object-contain bg-white p-0.5 shadow-md shadow-blue-500/20"
          />
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              {isHi ? 'प्रोग्रेसिव वेब ऐप' : 'Official Web App'}
            </div>
            <h2 className="font-heading text-lg sm:text-xl font-black tracking-tight text-slate-950 mt-0.5">
              {isHi ? 'DairyDrop इंस्टॉल करें' : 'Install DairyDrop App'}
            </h2>
          </div>
        </div>

        {/* Platform View */}
        {isIos ? (
          /* ── iOS Safari 3-Step Guide ───────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <AppleIcon className="h-4 w-4 text-slate-900" />
              <span>{isHi ? 'iPhone / iPad निर्देश:' : 'iPhone / iPad (Safari) Steps:'}</span>
            </div>

            <div className="space-y-2.5 rounded-2xl bg-blue-50/60 border border-blue-100 p-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                  1
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <span>{isHi ? 'Safari में Share बटन दबाएं' : 'Tap Share Button'}</span>
                    <span className="inline-flex items-center rounded bg-white px-1 py-0.5 border border-slate-200 text-blue-600">
                      <IosShareIcon className="h-3 w-3" />
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                  2
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <span>{isHi ? '"Add to Home Screen" चुनें' : 'Select "Add to Home Screen"'}</span>
                    <span className="inline-flex items-center rounded bg-white px-1 py-0.5 border border-slate-200 text-blue-600">
                      <PlusSquareIcon className="h-3 w-3" />
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                  3
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900">
                    {isHi ? 'ऊपर "Add" पर टैप करें' : 'Tap "Add" in Top Right'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : isAndroid ? (
          /* ── Android Direct 1-Tap or 2-Step Chrome Guide ───────── */
          <div className="space-y-3">
            {hasNativePrompt ? (
              <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-center space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  {isHi
                    ? 'DairyDrop को तुरंत अपने Android फ़ोन में ऐप की तरह इंस्टॉल करें।'
                    : 'Install DairyDrop to your Android device for instant 1-tap access.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onNativeInstall?.();
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all active:scale-[0.98]"
                >
                  <DownloadIcon className="h-4 w-4" />
                  <span>{isHi ? 'तुरंत इंस्टॉल करें (Install Now)' : 'Install Now (1-Tap)'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 rounded-2xl bg-blue-50/60 border border-blue-100 p-3.5 text-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                  <AndroidIcon className="h-4 w-4 text-emerald-600" />
                  <span>{isHi ? 'Chrome से 2 आसान चरणों में इंस्टॉल करें:' : 'Install via Chrome in 2 Easy Steps:'}</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                    1
                  </div>
                  <div className="pt-0.5">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{isHi ? 'Chrome मेनू पर टैप करें' : 'Tap Chrome Menu'}</span>
                      <span className="inline-flex items-center rounded bg-white px-1.5 py-0.5 border border-slate-200 text-slate-800 font-extrabold text-xs">
                        ⋮
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isHi ? 'स्क्रीन के ऊपर दाईं ओर 3 डॉट्स' : 'Top right corner of browser'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                    2
                  </div>
                  <div className="pt-0.5">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{isHi ? '"Install app" या "Add to Home screen" चुनें' : 'Select "Install app" or "Add to Home screen"'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isHi ? 'DairyDrop तुरंत आपके फ़ोन में ऐप बन जाएगा' : 'Instantly adds DairyDrop as a native app'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Desktop View ────────────────────────────────────── */
          <div className="space-y-3">
            <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-center space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                {isHi
                  ? 'डेस्कटॉप पर तेज़ विंडो ऐप के रूप में चलाने के लिए इंस्टॉल करें।'
                  : 'Install DairyDrop to your desktop for a dedicated app experience.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  onNativeInstall?.();
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all active:scale-[0.98]"
              >
                <DownloadIcon className="h-4 w-4" />
                <span>{isHi ? 'डेस्कटॉप ऐप इंस्टॉल करें' : 'Install Desktop App'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? '1-टैप फास्ट एक्सेस' : '1-Tap Fast Access'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? 'लाइव डिलीवरी अलर्ट' : 'Live Delivery Alerts'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? 'ऑफलाइन सपोर्ट' : 'Offline Support'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? '0% ऐप स्टोर झंझट' : 'No App Store Needed'}</span>
          </div>
        </div>

        {/* Dismiss Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors"
          >
            {isHi ? 'बंद करें' : 'Got It'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
