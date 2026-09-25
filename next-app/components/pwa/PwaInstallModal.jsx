'use client';

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
 * Provides platform-accurate instructions for iOS iPhone/iPad, Android, and Desktop.
 */
export function PwaInstallModal({ open, onClose, isIos, isAndroid, isDesktop, onNativeInstall, hasNativePrompt }) {
  const { locale } = useT();
  const isHi = locale === 'hi';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-2xl shadow-blue-500/10 backdrop-blur-xl animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Close modal"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <img
            src="/image.png"
            alt="DairyDrop"
            className="h-12 w-12 rounded-2xl object-contain shadow-md shadow-blue-500/20"
          />
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              {isHi ? 'प्रोग्रेसिव वेब ऐप' : 'Official Progressive Web App'}
            </div>
            <h2 className="font-heading text-xl font-black tracking-tight text-slate-950 mt-0.5">
              {isHi ? 'DairyDrop ऐप इंस्टॉल करें' : 'Install DairyDrop App'}
            </h2>
          </div>
        </div>

        {/* Platform-Specific Step Guide */}
        {isIos ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <AppleIcon className="h-4 w-4 text-slate-900" />
              <span>{isHi ? 'iPhone / iPad (Safari) निर्देश:' : 'iPhone / iPad (Safari) Instructions:'}</span>
            </div>

            <div className="space-y-3 rounded-2xl bg-blue-50/60 border border-blue-100 p-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-sm">
                  1
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{isHi ? 'Safari में शेयर बटन' : 'Tap the Share Button'}</span>
                    <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 border border-slate-200 text-blue-600 shadow-2xs">
                      <IosShareIcon className="h-3.5 w-3.5" />
                    </span>
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {isHi
                      ? 'Safari ब्राउज़र के निचले बार (iPhone) या ऊपर (iPad) पर स्थित शेयर आइकॉन दबाएं।'
                      : 'Located at the bottom of Safari on iPhone, or top right on iPad.'}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-sm">
                  2
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{isHi ? '"Add to Home Screen" चुनें' : 'Select "Add to Home Screen"'}</span>
                    <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 border border-slate-200 text-blue-600 shadow-2xs">
                      <PlusSquareIcon className="h-3.5 w-3.5" />
                    </span>
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {isHi
                      ? 'शेयर मेनू में थोड़ा नीचे स्क्रॉल करके "Add to Home Screen" पर टैप करें।'
                      : 'Scroll down the share sheet and tap the "Add to Home Screen" option.'}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-sm">
                  3
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-slate-900">
                    {isHi ? 'ऊपर दाईं ओर "Add" पर टैप करें' : 'Tap "Add" in Top Right'}
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {isHi
                      ? 'DairyDrop तुरंत आपकी होम स्क्रीन पर एक नेटिव ऐप की तरह जुड़ जाएगा!'
                      : 'DairyDrop will be added to your home screen with instant 1-tap access!'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : isAndroid ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <AndroidIcon className="h-4 w-4 text-emerald-600" />
              <span>{isHi ? 'Android (Chrome / Browser) निर्देश:' : 'Android (Chrome / Browser) Instructions:'}</span>
            </div>

            {hasNativePrompt ? (
              <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-center space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {isHi
                    ? '1-क्लिक में DairyDrop ऐप इंस्टॉल करने के लिए नीचे दिए गए बटन पर टैप करें।'
                    : 'Tap the button below to install DairyDrop directly to your Android home screen in 1 click.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onNativeInstall?.();
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-[0.98]"
                >
                  <DownloadIcon className="h-4 w-4" />
                  <span>{isHi ? 'तुरंत इंस्टॉल करें (Install Now)' : 'Install Now (1-Tap)'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
                    1
                  </div>
                  <p className="pt-1 text-slate-700">
                    {isHi ? 'Chrome में ऊपर दाईं ओर 3 बिंदु (⋮) मेनू पर टैप करें।' : 'Tap the 3 dots menu (⋮) in the top-right corner of Chrome.'}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
                    2
                  </div>
                  <p className="pt-1 text-slate-700">
                    {isHi ? '"Install app" या "Add to Home screen" चुनें।' : 'Select "Install app" or "Add to Home screen".'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <DesktopIcon className="h-4 w-4 text-blue-600" />
              <span>{isHi ? 'डेस्कटॉप (Chrome / Edge / Safari) निर्देश:' : 'Desktop (Chrome / Edge / Safari) Instructions:'}</span>
            </div>

            {hasNativePrompt ? (
              <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-center space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {isHi
                    ? 'अपने कंप्यूटर पर सीधे ऐप विंडो के रूप में चलाने के लिए इंस्टॉल करें।'
                    : 'Install DairyDrop to your desktop for a dedicated fast window experience.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onNativeInstall?.();
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-[0.98]"
                >
                  <DownloadIcon className="h-4 w-4" />
                  <span>{isHi ? 'डेस्कटॉप ऐप इंस्टॉल करें' : 'Install Desktop App'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl bg-blue-50/60 border border-blue-100 p-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
                    1
                  </div>
                  <p className="pt-1 text-slate-700">
                    {isHi
                      ? 'ब्राउज़र एड्रेस बार में दाईं ओर स्थित Install आइकॉन (⊕ या कंप्यूटर आइकॉन) पर क्लिक करें।'
                      : 'Look for the Install icon (⊕ or computer icon) on the right side of your browser address bar.'}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
                    2
                  </div>
                  <p className="pt-1 text-slate-700">
                    {isHi ? '"Install" पर क्लिक करें और बिना ब्राउज़र टैब के तेज़ अनुभव पाएं।' : 'Click "Install" to create a standalone desktop app.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key Features List */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? '1-टैप त्वरित एक्सेस' : '1-Tap Fast Access'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? 'दैनिक डिलीवरी अलर्ट' : 'Delivery Push Alerts'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? 'ऑफलाइन डेटा सपोर्ट' : 'Offline Mode Support'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>{isHi ? 'शून्य ऐप स्टोर डाउनलोड' : 'No App Store Needed'}</span>
          </div>
        </div>

        {/* Done / Close Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
          >
            {isHi ? 'समझ गया (Got It)' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  );
}
