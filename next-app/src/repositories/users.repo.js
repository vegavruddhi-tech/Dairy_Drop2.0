/**
 * User and tenant data access.
 */

import 'server-only';
import { and, eq, ne, asc, desc, sql, inArray, ilike, or } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { users, milkmanProfiles, addresses, serviceAreas } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped, paginate } from './base.js';

const customerScope = { tenant: users.milkmanId, owner: users.id };

/** One customer, with their default address. Scoped. */
export async function findCustomer(actor, customerId) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      milkmanId: users.milkmanId,
      approvalStatus: users.approvalStatus,
      deliveryArea: users.deliveryArea,
      isActive: users.isActive,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt,
      rejectionReason: users.rejectionReason,
      addressLine1: addresses.line1,
      addressLine2: addresses.line2,
      addressArea: addresses.area,
      addressCity: addresses.city,
      addressState: addresses.state,
      addressPincode: addresses.pincode,
      addressLandmark: addresses.landmark,
      deliveryInstructions: addresses.deliveryInstructions,
    })
    .from(users)
    .leftJoin(addresses, and(eq(addresses.userId, users.id), eq(addresses.isDefault, true)))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.CUSTOMER_READ, columns: customerScope },
        eq(users.id, customerId),
        eq(users.role, 'CUSTOMER'),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** A milkman's customer book. */
export async function listCustomers(actor, { status = 'APPROVED', search, ...page } = {}) {
  const { limit, offset } = paginate(page);

  const filters = [eq(users.role, 'CUSTOMER')];
  if (status) filters.push(eq(users.approvalStatus, status));
  if (search) {
    filters.push(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`),
      ),
    );
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      approvalStatus: users.approvalStatus,
      deliveryArea: users.deliveryArea,
      createdAt: users.createdAt,
      addressLine1: addresses.line1,
      addressArea: addresses.area,
      addressPincode: addresses.pincode,
      addressLandmark: addresses.landmark,
    })
    .from(users)
    .leftJoin(addresses, and(eq(addresses.userId, users.id), eq(addresses.isDefault, true)))
    .where(scoped({ actor, permission: PERMISSIONS.CUSTOMER_READ, columns: customerScope }, ...filters))
    .orderBy(asc(users.name))
    .limit(limit)
    .offset(offset);
}

/** How many customers are waiting for a decision — drives the nav badge. */
export async function countPendingCustomers(actor) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(users)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.CUSTOMER_READ, columns: customerScope },
        eq(users.role, 'CUSTOMER'),
        eq(users.approvalStatus, 'PENDING'),
      ),
    );
  return row?.count ?? 0;
}

export async function updateCustomer(tx, actor, { customerId, patch }) {
  const [row] = await tx
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.CUSTOMER_UPDATE, columns: customerScope },
        eq(users.id, customerId),
        eq(users.role, 'CUSTOMER'),
      ),
    )
    .returning();
  return row ?? null;
}

/** Update your own record. No scope needed — the id is the actor's. */
export async function updateSelf(tx, actor, patch) {
  const [row] = await tx
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, actor.userId))
    .returning();
  return row ?? null;
}

// ── Tenant profile ───────────────────────────────────────────────────────────

export async function findMilkmanProfile(milkmanId) {
  const [row] = await db
    .select({
      id: milkmanProfiles.id,
      milkmanId: milkmanProfiles.milkmanId,
      businessName: milkmanProfiles.businessName,
      businessAddress: milkmanProfiles.businessAddress,
      logoUrl: milkmanProfiles.logoUrl,
      upiId: milkmanProfiles.upiId,
      qrCodeUrl: milkmanProfiles.qrCodeUrl,
      isVerified: milkmanProfiles.isVerified,
      verifiedAt: milkmanProfiles.verifiedAt,
      suspendedAt: milkmanProfiles.suspendedAt,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(milkmanProfiles)
    .innerJoin(users, eq(users.id, milkmanProfiles.milkmanId))
    .where(eq(milkmanProfiles.milkmanId, milkmanId))
    .limit(1);
  return row ?? null;
}

export async function upsertMilkmanProfile(tx, milkmanId, values) {
  const [row] = await tx
    .insert(milkmanProfiles)
    .values({ milkmanId, ...values })
    .onConflictDoUpdate({
      target: milkmanProfiles.milkmanId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** The payment details a customer needs in order to pay their milkman. */
export async function findMilkmanPaymentInfo(milkmanId) {
  const [row] = await db
    .select({
      milkmanId: milkmanProfiles.milkmanId,
      businessName: milkmanProfiles.businessName,
      upiId: milkmanProfiles.upiId,
      qrCodeUrl: milkmanProfiles.qrCodeUrl,
      name: users.name,
      phone: users.phone,
    })
    .from(milkmanProfiles)
    .innerJoin(users, eq(users.id, milkmanProfiles.milkmanId))
    .where(eq(milkmanProfiles.milkmanId, milkmanId))
    .limit(1);
  return row ?? null;
}

// ── Signup discovery (public) ────────────────────────────────────────────────

/**
 * Milkmen who deliver to a pincode and are open for business.
 *
 * One exact-match join, replacing the previous system's five-fallback cascade
 * with bidirectional substring matching across three different tables.
 */
export async function findMilkmenServingPincode(pincode) {
  return db
    .selectDistinctOn([users.id], {
      id: users.id,
      name: users.name,
      businessName: milkmanProfiles.businessName,
      logoUrl: milkmanProfiles.logoUrl,
      phone: users.phone,
      areaName: serviceAreas.areaName,
      city: serviceAreas.city,
    })
    .from(serviceAreas)
    .innerJoin(users, eq(users.id, serviceAreas.milkmanId))
    .innerJoin(milkmanProfiles, eq(milkmanProfiles.milkmanId, users.id))
    .where(
      and(
        eq(serviceAreas.pincode, pincode),
        eq(serviceAreas.isActive, true),
        eq(milkmanProfiles.isVerified, true),
        eq(users.isActive, true),
      ),
    )
    .orderBy(users.id, asc(users.name));
}

/** The areas a milkman covers — the signup area picker. */
export async function listServiceAreas(milkmanId) {
  return db
    .select()
    .from(serviceAreas)
    .where(and(eq(serviceAreas.milkmanId, milkmanId), eq(serviceAreas.isActive, true)))
    .orderBy(asc(serviceAreas.routeSequence), asc(serviceAreas.areaName));
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Every milkman, with tenancy and commercial state. Admin only. */
export async function listMilkmen({ search, verified, ...page } = {}) {
  const { limit, offset } = paginate(page);

  const filters = [eq(users.role, 'MILKMAN')];
  if (verified === true) filters.push(eq(milkmanProfiles.isVerified, true));
  if (verified === false) filters.push(eq(milkmanProfiles.isVerified, false));
  if (search) {
    filters.push(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(milkmanProfiles.businessName, `%${search}%`),
      ),
    );
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      isActive: users.isActive,
      businessName: milkmanProfiles.businessName,
      isVerified: milkmanProfiles.isVerified,
      verifiedAt: milkmanProfiles.verifiedAt,
      suspendedAt: milkmanProfiles.suspendedAt,
      customerCount: sql`(
        select count(*) from ${users} c
        where c.milkman_id = ${users.id}
          and c.role = 'CUSTOMER'
          and c.approval_status = 'APPROVED'
      )::int`.as('customer_count'),
    })
    .from(users)
    .leftJoin(milkmanProfiles, eq(milkmanProfiles.milkmanId, users.id))
    .where(and(...filters))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Platform-wide counters for the admin dashboard, computed in SQL. */
export async function platformCounts() {
  const [row] = await db
    .select({
      milkmen: sql`count(*) filter (where ${users.role} = 'MILKMAN')::int`,
      customers: sql`count(*) filter (where ${users.role} = 'CUSTOMER')::int`,
      approvedCustomers: sql`count(*) filter (where ${users.role} = 'CUSTOMER' and ${users.approvalStatus} = 'APPROVED')::int`,
      pendingCustomers: sql`count(*) filter (where ${users.role} = 'CUSTOMER' and ${users.approvalStatus} = 'PENDING')::int`,
    })
    .from(users);
  return row;
}
