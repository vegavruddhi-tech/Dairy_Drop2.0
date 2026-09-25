import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getActor, gateStatus } from '@/auth/session.js';
import { ROLES, ROLE_HOME } from '@/auth/roles.js';
import { GATE } from '@/auth/policy.js';
import { Card, CardBody } from '@/components/ui/index.jsx';
import { Button } from '@/components/ui/interactive.jsx';
import { PublicBar } from '@/components/layout/PublicBar.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';
import { VerificationStatusChecker } from '@/components/milkman/VerificationStatusChecker.jsx';
import { SignOutAction } from '@/components/auth/SignOutAction.jsx';
import * as usersRepo from '@/repositories/users.repo.js';

export const metadata = { title: 'Awaiting Approval • DairyDrop' };

export default async function PendingPage() {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== ROLES.CUSTOMER) redirect(ROLE_HOME[actor.role] ?? '/');

  const gate = await gateStatus();
  if (gate.ok) redirect('/dashboard');
  if (gate.gate === GATE.CUSTOMER_UNASSIGNED) redirect('/register');

    const rejected = gate.gate === GATE.CUSTOMER_REJECTED;
    const user = await usersRepo.findUserById(actor.userId);
    const milkman = actor.tenantId ? await usersRepo.findMilkmanProfile(actor.tenantId) : null;

    return (
      <div className="relative min-h-dvh bg-[#fafcff] text-slate-900 overflow-x-hidden flex flex-col">
        <BackgroundParticles count={24} />
        <PublicBar showBrand={true} />

        <main className="mx-auto w-full max-w-lg px-5 py-10 flex-1 flex flex-col justify-center animate-fade-in">
          <Card className="border border-slate-200/90 shadow-xl shadow-blue-500/5 bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden">
            <CardBody className="space-y-5 text-center p-7">
              {/* Status Header (Clean Vector SVG Icons) */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner ${
                    rejected ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {rejected ? (
                    <svg className="h-8 w-8 fill-current" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  ) : (
                    <svg className="h-8 w-8 fill-current animate-pulse" viewBox="0 0 24 24">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                  )}
                </div>

                <div
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold ${
                    rejected
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {rejected ? 'Application Not Accepted' : 'Awaiting Milkman Confirmation'}
                </div>

                <h1 className="mt-2 font-heading text-2xl font-black text-slate-900">
                  {rejected ? 'Registration Declined' : 'Request Sent Successfully'}
                </h1>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">{gate.message}</p>
              </div>

              {/* Rejection Note from Milkman */}
              {rejected && user?.rejectionReason && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                    Note from Milkman
                  </p>
                  <p className="mt-1 text-sm font-medium text-red-900">
                    "{user.rejectionReason}"
                  </p>
                </div>
              )}

              {/* Assigned Milkman Details Card */}
              {milkman && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    {rejected ? 'Previous Selected Dairy' : 'Assigned Local Dairy'}
                  </p>
                  <p className="mt-1 font-heading text-base font-bold text-slate-900">
                    {milkman.businessName}
                  </p>
                  {milkman.upiId && (
                    <p className="mt-0.5 text-xs text-slate-600">
                      Billing UPI:{' '}
                      <span className="font-mono text-slate-900 font-semibold">
                        {milkman.upiId}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {rejected ? (
                <div className="space-y-2.5 pt-1">
                  <Link href="/register" className="block w-full">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20" size="lg">
                      Re-Apply with Updated Address / Details →
                    </Button>
                  </Link>
                  <p className="text-xs text-slate-500">
                    You can adjust your delivery address/plans or choose any other milkman serving your pincode.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <VerificationStatusChecker
                    initialGate={gate.gate}
                    initialMessage={gate.message}
                    businessName={milkman?.businessName}
                    targetRedirect="/dashboard"
                  />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Your milkman usually confirms requests in 1 to 2 hours. As soon as they
                    accept, your daily deliveries and customer dashboard will activate
                    automatically.
                  </p>
                </div>
              )}

            <div className="border-t border-slate-100 pt-3">
              <SignOutAction redirectUrl="/" />
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
