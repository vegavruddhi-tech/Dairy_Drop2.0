import Link from 'next/link';
import { MilkDropIcon } from '@/components/ui/Icons.jsx';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm border border-slate-200">
          <img src="/icon-512.png" alt="DairyDrop" className="h-full w-full object-contain" />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink">Page not found</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          That page does not exist, or you may not have access to it.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
