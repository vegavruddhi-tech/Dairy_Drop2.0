import Link from 'next/link';

import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';

/**
 * A minimal bar for the pages reachable before signing in.
 *
 * The language toggle has to be here, not only inside the app: someone who
 * cannot read English needs to switch *before* they are asked to sign up. The
 * old apps put it on the login screen for exactly that reason.
 */
export function PublicBar({ showBrand = true }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 pt-safe">
      {showBrand ? (
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs text-white"
          >
            🥛
          </span>
          <span className="font-heading text-[15px] font-extrabold tracking-tight text-ink">
            DairyDrop
          </span>
        </Link>
      ) : <span />}

      <LanguageToggle variant="compact" className="h-9" />
    </header>
  );
}
