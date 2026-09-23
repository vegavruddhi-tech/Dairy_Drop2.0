import { SignUp } from '@clerk/nextjs';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';
import { AuthCardSkeleton } from '@/components/ui/AuthCardSkeleton.jsx';

export const metadata = { title: 'Create Account • DairyDrop' };

export default async function SignUpPage({ searchParams }) {
  const params = await searchParams;
  const redirectTarget = params?.next || params?.redirect_url || '/dashboard';
  const isVendorFlow = redirectTarget.includes('become-a-milkman');

  return (
    <div className="relative min-h-dvh bg-[#fafcff] text-slate-900 overflow-x-hidden flex flex-col">
      <BackgroundParticles count={24} />
      
      <PublicBar showBrand={true} />

      <main className="mx-auto w-full max-w-md px-5 py-10 sm:py-14 flex-1 flex flex-col justify-center">
        <div className="mb-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            {isVendorFlow ? 'Milkman & Vendor Registration' : 'Get Started with DairyDrop'}
          </div>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {isVendorFlow ? 'Create Vendor Account' : 'Create Your Account'}
          </h1>
          <p className="mt-1.5 text-xs text-slate-600 sm:text-sm">
            {isVendorFlow
              ? 'Sign up with Google to fill your dairy business details.'
              : 'Sign up with Google in 1-click to set your delivery pincode.'}
          </p>
        </div>

        <div className="flex justify-center min-h-[420px] items-start animate-scale-in">
          <SignUp
            fallback={<AuthCardSkeleton isSignUp />}
            fallbackRedirectUrl={redirectTarget}
            signInFallbackRedirectUrl={redirectTarget}
            forceRedirectUrl={redirectTarget}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-xl shadow-blue-500/5 border border-slate-200/90 rounded-3xl bg-white/95 backdrop-blur-md p-6 sm:p-7',
                headerTitle: 'font-heading font-bold text-slate-900',
                headerSubtitle: 'text-xs text-slate-500',
                socialButtonsBlockButton: 'rounded-xl font-semibold border-slate-200 shadow-sm hover:bg-slate-50 transition-all',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl shadow-md shadow-blue-600/20',
              },
            }}
          />
        </div>
      </main>
    </div>
  );
}
