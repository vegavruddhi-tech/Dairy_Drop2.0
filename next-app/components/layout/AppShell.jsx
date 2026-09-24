/**
 * The shared application shell, ported from the original apps' layout.
 *
 * The mobile chrome is the part that mattered: a floating pill-shaped bottom
 * bar rather than a full-width strip, so it reads as an object sitting on the
 * page. Four primary destinations plus a menu, which is what fits on a phone
 * held one-handed.
 *
 * One shell serves all three panels; only the navigation items differ. The
 * previous system had three separate copies of the layout, header and sidebar
 * that had drifted apart.
 */

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

import { cn, Badge } from '@/components/ui/index.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { NavLink, MoreMenu } from './Nav.jsx';
import { MilkDropIcon } from '@/components/ui/Icons.jsx';

/**
 * @param {object} props
 * @param {Array}  props.nav   primary destinations (first four get the bottom bar)
 * @param {Array}  [props.more] overflow destinations
 * @param {{name: string, email: string, role: string}|null} [props.user]
 *   **Must be serializable** — this reaches `<MoreMenu>`, a client component.
 *   Use `toViewer(actor)` from `@/auth/session.js`; a raw `ActorContext`
 *   carries functions and will throw at the boundary.
 */
export function AppShell({ nav, more = [], user, title, badge, children }) {
  const primary = nav.slice(0, 4);

  return (
    <div className="min-h-dvh bg-[#fafcff] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200/80 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] lg:block z-30">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200/80 px-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25 transition-transform group-hover:scale-105"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </span>
            <div className="flex flex-col">
              <span className="font-heading text-base font-extrabold tracking-tight text-slate-950">
                DairyDrop
              </span>
            </div>
          </Link>
          {badge ? (
            <span className="ml-auto rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
              {badge}
            </span>
          ) : null}
        </div>

        <nav className="space-y-1.5 p-3.5 overflow-y-auto max-h-[calc(100vh-8.5rem)]" aria-label="Main">
          {[...nav, ...more].map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* User Account & Language footer */}
        <div className="absolute inset-x-0 bottom-0 space-y-2.5 border-t border-slate-200/80 bg-slate-50/70 p-3.5 backdrop-blur-sm">
          <LanguageToggle />
          <div className="flex items-center gap-3 pt-1">
            <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-xl shadow-xs' } }} showName />
          </div>
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 pt-safe backdrop-blur-xl lg:hidden shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </span>
          <span className="truncate font-heading text-base font-extrabold tracking-tight text-slate-950">
            {title ?? 'DairyDrop'}
          </span>
          {badge ? (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <LanguageToggle variant="compact" className="h-8" />
          <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-xl' } }} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="pb-nav lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-5xl px-3.5 py-4 sm:px-6 sm:py-6 lg:py-8">{children}</div>
      </main>

      {/* ── Mobile bottom floating pill bar ─────────────────────────────── */}
      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3.5 pt-1 lg:hidden"
        style={{ paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 8px))' }}
      >
        <div className="pointer-events-auto mx-auto max-w-md rounded-3xl border border-slate-200/90 bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <ul className="flex items-center justify-around gap-1 px-2.5 py-1.5">
            {primary.map((item) => (
              <li key={item.href} className="flex min-w-0 flex-1">
                <NavLink {...item} compact />
              </li>
            ))}
            {more.length > 0 ? (
              <li className="flex min-w-0 flex-1">
                <MoreMenu items={more} user={user} variant="bar" />
              </li>
            ) : null}
          </ul>
        </div>
      </nav>
    </div>
  );
}
