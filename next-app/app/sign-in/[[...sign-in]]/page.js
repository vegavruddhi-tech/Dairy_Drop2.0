import { SignIn } from '@clerk/nextjs';
import { PublicBar } from '@/components/layout/PublicBar.jsx';

export const metadata = { title: 'Sign in' };

/**
 * Clerk's hosted sign-in, rendered inside our own layout.
 *
 * The catch-all segment lets Clerk own its sub-routes (factor-two, SSO
 * callback, reset password) without us enumerating them.
 */
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <PublicBar showBrand={true} />

      <div className="mb-8 text-center">
        <p className="text-sm font-medium text-brand">DairyDrop</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
      </div>

      <div className="flex justify-center">
        <SignIn
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
