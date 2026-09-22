import { NextResponse } from 'next/server';

import { JOBS } from '@/jobs/index.js';

/**
 * HTTP trigger for scheduled jobs.
 *
 * Authenticated with a shared secret, not a user session — a cron service has
 * no session. Returns 404 rather than 401 for a bad secret, so probing cannot
 * enumerate which jobs exist.
 */
export const maxDuration = 300;

/**
 * Vercel Cron issues GET; a manual trigger or another scheduler may use POST.
 * Both take the same path.
 */
export async function GET(request, context) {
  return run(request, context);
}

export async function POST(request, context) {
  return run(request, context);
}

async function run(request, { params }) {
  const { job } = await params;

  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const handler = JOBS[job];
  if (!handler) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  try {
    const started = Date.now();
    const body =
      request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const result = await handler(body);
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (error) {
    console.error(`[cron:${job}]`, error);
    return NextResponse.json({ message: 'Job failed' }, { status: 500 });
  }
}
