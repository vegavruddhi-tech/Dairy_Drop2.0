import { NextResponse } from 'next/server';
import { getActor, gateStatus } from '@/auth/session.js';
import * as usersRepo from '@/repositories/users.repo.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    const gate = await gateStatus();
    const user = await usersRepo.findUserById(actor.userId);
    const profile = actor.tenantId ? await usersRepo.findMilkmanProfile(actor.tenantId) : null;

    return NextResponse.json({
      ok: gate.ok,
      authenticated: true,
      role: actor.role,
      isVerified: actor.isVerified,
      gate: gate.gate,
      message: gate.message,
      redirect: gate.redirect,
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        phone: user?.phone,
        approvalStatus: user?.approvalStatus,
        rejectionReason: user?.rejectionReason,
      },
      profile: profile ? {
        businessName: profile.businessName,
        isVerified: profile.isVerified,
        upiId: profile.upiId,
      } : null,
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
