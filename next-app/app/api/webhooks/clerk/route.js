import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { clerkClient } from '@clerk/nextjs/server';

import { upsertFromClerk, deactivateByClerkId } from '@/auth/provision.js';

/**
 * Clerk → database sync.
 *
 * Webhooks are eventually consistent, so nothing *depends* on this handler:
 * `getActor()` provisions lazily if a row is missing. This keeps the two in
 * step afterwards, and handles the two things a request path cannot — a profile
 * edited in Clerk's UI, and an identity deleted.
 *
 * It also mirrors the user's role into Clerk's `publicMetadata`. That copy is a
 * routing hint for the edge middleware and **never** an authorization input;
 * the database remains the source of truth. See `roleHint` in `middleware.js`.
 *
 * The route is public in `middleware.js` — Clerk signs the request rather than
 * carrying a session, so `auth.protect()` would reject it.
 */
export async function POST(request) {
  let event;
  try {
    // Reads CLERK_WEBHOOK_SIGNING_SECRET and throws on a bad signature.
    // Never skip this: the endpoint is public and otherwise spoofable.
    event = await verifyWebhook(request);
  } catch (error) {
    console.error('[clerk-webhook] verification failed', error);
    return new Response('Verification failed', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const account = await syncUser(event.data);
        if (account) await mirrorRoleHint(event.data.id, account.role);
        break;
      }

      case 'user.deleted': {
        // Soft delete. Deliveries, bills and payments are financial records
        // that must outlive the account they belong to.
        await deactivateByClerkId(event.data.id);
        break;
      }

      default:
        // Unhandled event types are acknowledged, not retried.
        break;
    }
  } catch (error) {
    // A 5xx makes Svix retry, which is what we want for a transient failure.
    console.error(`[clerk-webhook] ${event.type} failed`, error);
    return new Response('Handler failed', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

/** Map a Clerk user payload onto the application's authorization record. */
async function syncUser(data) {
  const primary =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses?.[0];

  if (!primary?.email_address) {
    console.warn(`[clerk-webhook] user ${data.id} has no email address; skipping`);
    return null;
  }

  return upsertFromClerk({
    clerkId: data.id,
    email: primary.email_address,
    name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username,
    imageUrl: data.image_url,
    phone: data.phone_numbers?.[0]?.phone_number,
  });
}

/**
 * Copy the role into Clerk `publicMetadata` so the edge can route on it.
 *
 * Best-effort: a failure here costs a slightly slower redirect, never access.
 * The layout resolves the real role from the database either way.
 */
async function mirrorRoleHint(clerkId, role) {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role } });
  } catch (error) {
    console.warn('[clerk-webhook] could not mirror role hint', error?.message);
  }
}
