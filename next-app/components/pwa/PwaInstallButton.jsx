'use client';

import { useT } from '@/i18n/provider.jsx';
import { usePwaInstall } from './usePwaInstall.js';
import { PwaInstallModal } from './PwaInstallModal.jsx';
import { DownloadIcon, CheckCircleIcon } from '@/components/ui/Icons.jsx';
import { cn } from '@/components/ui/index.jsx';

/**
 * PWA Install Button trigger
 * Supports compact (icon + text), icon-only, or badge variants for headers, navigation, and settings.
 */
export function PwaInstallButton({ variant = 'default', className = '' }) {
  const {
    isStandalone,
    isInstalled,
    isIos,
    isAndroid,
    isDesktop,
    deferredPrompt,
    isModalOpen,
    setIsModalOpen,
    triggerInstall,
  } = usePwaInstall();

  const { locale } = useT();
  const isHi = locale === 'hi';

  if (isStandalone || isInstalled) {
    if (variant === 'status') {
      return (
        <div className={cn('inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200', className)}>
          <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
          <span>{isHi ? 'ऐप इंस्टॉल है' : 'App Installed'}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={triggerInstall}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all active:scale-[0.98]',
          variant === 'compact'
            ? 'h-8 px-2.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 shadow-2xs'
            : variant === 'sidebar'
            ? 'w-full py-2.5 px-3 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20'
            : variant === 'menu-item'
            ? 'w-full py-3 px-3.5 text-sm text-slate-800 hover:bg-slate-100 rounded-xl justify-start'
            : 'h-9 px-3.5 text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20',
          className,
        )}
        aria-label={isHi ? 'ऐप इंस्टॉल करें' : 'Install App'}
      >
        <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{isHi ? 'ऐप इंस्टॉल करें' : 'Install App'}</span>
      </button>

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
