import { NextResponse } from 'next/server';
import { getActor } from '@/auth/session.js';
import * as pushRepo from '@/repositories/push.repo.js';

export async function POST(request) {
  const actor = await getActor();
  if (!actor?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { endpoint, keys } = body.subscription || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const saved = await pushRepo.saveSubscription(actor.userId, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ ok: true, subscription: saved });
  } catch (err) {
    console.error('[push:subscribe] Error saving subscription:', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const actor = await getActor();
  if (!actor?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body.endpoint) {
      await pushRepo.removeSubscription(body.endpoint);
    } else {
      await pushRepo.removeSubscriptionsForUser(actor.userId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push:unsubscribe] Error:', err);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
