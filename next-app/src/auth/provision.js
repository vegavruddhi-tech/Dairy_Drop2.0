/**
 * The join between a Clerk identity and this application's authorization record.
 *
 * Clerk owns **authentication**: credentials, sessions, MFA, the sign-in UI,
 * email verification. It has no idea what a milkman is.
 *
 * This application owns **authorization**: role, tenant, approval state. Those
 * live in the `users` table because they are relational — a customer's tenant is
 * a foreign key the database enforces, not a string in a metadata blob that
 * could silently drift out of step.
 *
 * `clerkId` is the only thing tying the two together.
 *
 * ## Why provision lazily as well as by webhook
 *
 * Webhooks are eventually consistent: Clerk sends `user.created` moments after
 * signup, but the person may land on their first page before it arrives. A
 * missing row at that moment would look like "not signed in", which is a
 * confusing first impression.
 *
 * So `resolveAccount` creates the row on demand if it is not there yet, and the
 * webhook keeps it in sync afterwards. Both paths funnel through the same
 * `upsertFromClerk`, so there is one definition of what a new account looks like.
 */

import 'server-only';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { users, adminAllowlist, milkmanProfiles } from '@/db/schema/index.js';
import { ROLES } from './roles.js';

/** Emails granted ADMIN on sight. The bootstrap for the first operator. */
function bootstrapAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function isAllowlistedAdmin(email) {
  if (bootstrapAdminEmails().has(email)) return true;
  const [row] = await db
    .select({ id: adminAllowlist.id })
    .from(adminAllowlist)
    .where(eq(adminAllowlist.email, email))
    .limit(1);
  return Boolean(row);
}

/**
 * Read the authorization record for a Clerk user id.
 *
 * One query, including the milkman verification flag the access gates need.
 * Returns null when no row exists yet.
 */
export async function findAccountByClerkId(clerkId) {
  const [row] = await db
    .select({
      id: users.id,
      clerkId: users.clerkId,
      email: users.email,
      name: users.name,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      role: users.role,
      milkmanId: users.milkmanId,
      approvalStatus: users.approvalStatus,
      isActive: users.isActive,
      isVerified: sql`coalesce(${milkmanProfiles.isVerified}, false)`.as('is_verified'),
    })
    .from(users)
    .leftJoin(milkmanProfiles, eq(milkmanProfiles.milkmanId, users.id))
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return row ?? null;
}

/**
 * Find or create the authorization record behind a Clerk identity.
 *
 * Role assignment:
 *   · An allowlisted email becomes ADMIN.
 *   · An existing row keeps whatever role it already has — this function never
 *     demotes or re-tenants anyone. Role changes are deliberate admin actions.
 *   · Anyone else starts as a CUSTOMER with PENDING approval, and picks a
 *     milkman on the registration screen.
 *
 * A MILKMAN is never self-provisioned. Becoming a tenant is a commercial
 * decision the platform makes, not a sign-up form.
 *
 * @param {object} identity
 * @param {string} identity.clerkId
 * @param {string} identity.email
 * @param {string} [identity.name]
 * @param {string} [identity.imageUrl]
 * @param {string} [identity.phone]
 */
export async function upsertFromClerk({ clerkId, email, name, imageUrl, phone }) {
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Cannot provision an account without an email address.');

  const existing = await findAccountByClerkId(clerkId);

  if (existing) {
    // Refresh only what Clerk is authoritative for. Never touch role, tenant or
    // approval state here — those belong to the application.
    const changes = {};
    if (cleanEmail !== existing.email) changes.email = cleanEmail;
    if (name && name !== existing.name) changes.name = name;
    if (imageUrl && imageUrl !== existing.avatarUrl) changes.avatarUrl = imageUrl;
    if (phone && phone !== existing.phone) changes.phone = phone;
    if (!existing.isActive) changes.isActive = true;

    if (Object.keys(changes).length > 0) {
      await db
        .update(users)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      return { ...existing, ...changes, isActive: true };
    }
    return existing;
  }

  // A row may already exist for this email — seeded, created by an admin,
  // or re-created after an account was reset in Clerk dashboard.
  const [byEmail] = await db
    .select({ id: users.id, clerkId: users.clerkId, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, cleanEmail))
    .limit(1);

  if (byEmail) {
    // Rebind to the newly verified Clerk identity and ensure the account is active.
    await db
      .update(users)
      .set({
        clerkId,
        isActive: true,
        name: name || undefined,
        avatarUrl: imageUrl || undefined,
        phone: phone || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id));

    return findAccountByClerkId(clerkId);
  }

  const admin = await isAllowlistedAdmin(cleanEmail);

  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      avatarUrl: imageUrl ?? null,
      phone: phone ?? null,
      role: admin ? ROLES.ADMIN : ROLES.CUSTOMER,
      // Admins are not subject to the customer approval gate.
      approvalStatus: admin ? null : 'PENDING',
      isActive: true,
    })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();

  // `onConflictDoNothing` returns nothing if a concurrent request won the race —
  // read the winner instead of failing.
  if (!created) return findAccountByClerkId(clerkId);

  return { ...created, isVerified: false };
}

/** Record a sign-in. Fire-and-forget; never block a request on it. */
export async function touchLastLogin(userId) {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Deactivate an account whose Clerk identity was deleted.
 *
 * Deliberately a soft delete. A milkman's deliveries, bills and payments are
 * financial records that must survive the person's account, and a customer's
 * delivery history is what their last invoice is built from.
 */
export async function deactivateByClerkId(clerkId) {
  const [row] = await db
    .update(users)
    .set({ isActive: false, clerkId: null, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId))
    .returning({ id: users.id, email: users.email });
  return row ?? null;
}
