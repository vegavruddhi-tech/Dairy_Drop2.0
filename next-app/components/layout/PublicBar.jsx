import Link from 'next/link';
import { SignOutButton, SignedIn } from '@clerk/nextjs';

import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton.jsx';

/**
 * High-precision Blue & White navigation bar for public & auth pages.
 * Responsive container alignment, subtle glassmorphic backdrop, language toggle,
 * PWA Install button, and top-level Sign Out action for authenticated users.
 */
export function PublicBar({ showBrand = true }) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        {showBrand ? (
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/image.png"
              alt="DairyDrop"
              className="h-9 w-9 rounded-xl object-contain shadow-md shadow-blue-500/20 transition-transform group-hover:scale-105 group-active:scale-95"
            />
            <div className="flex flex-col">
              <span className="font-heading text-lg font-extrabold tracking-tight text-slate-950">
                DairyDrop
              </span>
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider -mt-0.5">
                Fresh Milk Platform
              </span>
            </div>
          </Link>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <span>← Back to Home</span>
          </Link>

          <PwaInstallButton variant="compact" />

          <LanguageToggle variant="compact" className="h-9" />

          {/* Top Header Sign Out for Authenticated Users */}
          <SignedIn>
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-[0.98]"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3H9c-1.1 0-2 .9-2 2v4h2V5h11v14H9v-4H7v4c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </SignOutButton>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
