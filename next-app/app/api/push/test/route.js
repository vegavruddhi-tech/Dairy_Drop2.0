import { NextResponse } from 'next/server';

import { getActor } from '@/auth/session.js';
import { sendPushNotification } from '@/services/push.service.js';

/**
 * Send a test push to the caller's own devices — never anyone else's.
 *
 * Throttled per user so it cannot be used to buzz a phone repeatedly. The
 * limit is in memory, which is enough for a convenience button: at worst a
 * cold start lets one extra test through.
 */
const lastSent = new Map();
const COOLDOWN_MS = 30_000;

export async function POST() {
  const actor = await getActor();
  if (!actor?.userId) return NextResponse.json({ message: 'Sign in first.' }, { status: 401 });

  const now = Date.now();
  if (now - (lastSent.get(actor.userId) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ message: 'Just sent one — try again in a few seconds.' }, { status: 429 });
  }
  lastSent.set(actor.userId, now);

  const outcome = await sendPushNotification(actor.userId, {
    title: 'DairyDrop test',
    body: 'Notifications are working on this device.',
    href: '/',
    tag: 'dairydrop-test',
  });

  return NextResponse.json({ ok: true, ...outcome });
}
