'use client';

import { useT } from '@/i18n/provider.jsx';
import { usePwaInstall } from './usePwaInstall.js';
import { PwaInstallModal } from './PwaInstallModal.jsx';
import { DownloadIcon, CloseIcon, AppleIcon, AndroidIcon } from '@/components/ui/Icons.jsx';

/**
 * Universal Floating PWA Install Prompt Banner
 * Appears smoothly for customers, milkmen, and visitors when the web app is opened in a browser.
 * Completely responsive, non-blocking, and dismissable.
 */
export function PwaInstallPrompt() {
  const {
    isStandalone,
    isInstalled,
    isIos,
    isAndroid,
    isDesktop,
    canInstall,
    deferredPrompt,
    isDismissed,
    isModalOpen,
    setIsModalOpen,
    dismissBanner,
    triggerInstall,
  } = usePwaInstall();

  const { locale } = useT();
  const isHi = locale === 'hi';

  // Do not show prompt banner if app is already running in standalone/installed mode or was snoozed
  const showBanner = !isStandalone && !isInstalled && !isDismissed && canInstall;

  return (
    <>
      {showBanner ? (
        <aside
          aria-label={isHi ? 'ऐप इंस्टॉल करें' : 'Install App'}
          className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-lg animate-slide-up sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-blue-200/90 bg-white/95 p-4 sm:p-4.5 shadow-[0_12px_40px_rgba(37,99,235,0.18)] backdrop-blur-xl ring-1 ring-blue-500/10">
            {/* Ambient blue aura gradient */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

            <div className="relative flex items-start gap-3.5">
              {/* App Icon */}
              <div className="relative shrink-0">
                <img
                  src="/image.png"
                  alt="DairyDrop"
                  className="h-11 w-11 rounded-2xl object-contain shadow-md shadow-blue-500/20"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white shadow-xs">
                  {isIos ? <AppleIcon className="h-2.5 w-2.5" /> : isAndroid ? <AndroidIcon className="h-2.5 w-2.5" /> : '↓'}
                </span>
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-sm font-extrabold text-slate-950">
                      DairyDrop App
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                      {isIos ? 'iOS / iPhone' : isAndroid ? 'Android PWA' : 'Fast App'}
                    </span>
                  </div>

                  {/* Close / Dismiss */}
                  <button
                    type="button"
                    onClick={dismissBanner}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors -mr-1 -mt-1"
                    aria-label={isHi ? 'खारिज करें' : 'Dismiss'}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-0.5 text-[11px] text-slate-600 leading-snug font-normal">
                  {isHi
                    ? '1-टैप में होम स्क्रीन पर जोड़ें। तेज़ डिलीवरी ट्रैकिंग और बिना देरी के उपयोग करें!'
                    : 'Install DairyDrop to your home screen for 1-tap access and daily delivery alerts.'}
                </p>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerInstall}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition-all active:scale-[0.98]"
                  >
                    <DownloadIcon className="h-3.5 w-3.5" />
                    <span>{isHi ? 'ऐप इंस्टॉल करें' : 'Install App'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={dismissBanner}
                    className="rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    {isHi ? 'बाद में' : 'Later'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Guide Modal (For iOS Safari or Desktop manual guide) */}
      <PwaInstallModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isIos={isIos}
        isAndroid={isAndroid}
        isDesktop={isDesktop}
        hasNativePrompt={Boolean(deferredPrompt)}
        onNativeInstall={triggerInstall}
      />
    </>
  );
}
