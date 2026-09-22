import { SignUp } from '@clerk/nextjs';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Create an account' };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <PublicBar showBrand={true} />

      <div className="mb-8 text-center">
        <p className="text-sm font-medium text-brand">DairyDrop</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Get milk delivered
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Create an account, then choose a milkman near you.
        </p>
      </div>

      <div className="flex justify-center">
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-card border border-border rounded-2xl',
            },
          }}
        />
      </div>
    </main>
  );
}
