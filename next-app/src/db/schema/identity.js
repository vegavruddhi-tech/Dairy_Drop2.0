/**
 * Identity: users, the milkman tenant record, the admin allowlist, and the audit log.
 */

import {
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';

import { roleEnum, approvalStatusEnum, auditActionEnum } from './enums.js';

/**
 * Every human on the platform, in one table.
 *
 * This is the *authorization* record. Clerk holds the *authentication* record —
 * credentials, sessions, verified email — and the two are joined by `clerkId`.
 * There is deliberately no password column: this table never authenticates
 * anyone.
 *
 * `milkmanId` is the tenant key: for a CUSTOMER it points at the MILKMAN who
 * serves them. For a MILKMAN it is null — they *are* the tenant.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity. Email is the natural key — always stored lowercased.
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: text('avatar_url'),

    /**
     * The Clerk user id (`user_…`).
     *
     * Clerk owns identity — credentials, sessions, MFA, the sign-in UI. This
     * column is the only join between Clerk and the application's own model.
     * Everything that decides *access* — role, tenant, approval state — stays in
     * this table, because tenancy is a foreign key the database enforces, not a
     * string that could drift in two places.
     *
     * Nullable so a row can be seeded or created by an admin before the person
     * has ever signed in; it is filled on their first request.
     */
    clerkId: varchar('clerk_id', { length: 64 }),

    role: roleEnum('role').notNull().default('CUSTOMER'),
    isActive: boolean('is_active').notNull().default(true),

    // ── Customer-only fields ─────────────────────────────────────────────────
    milkmanId: uuid('milkman_id'),
    approvalStatus: approvalStatusEnum('approval_status'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    /** Free-text area label chosen at signup; the authoritative address is in `addresses`. */
    deliveryArea: varchar('delivery_area', { length: 120 }),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailKey: uniqueIndex('users_email_key').on(t.email),
    clerkIdKey: uniqueIndex('users_clerk_id_key').on(t.clerkId),
    // The composite hit by every customer listing and every limit check.
    tenantIdx: index('users_tenant_idx').on(t.milkmanId, t.role, t.approvalStatus),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

/**
 * The milkman's business record. 1:1 with a MILKMAN user; this is the tenant.
 *
 * `isVerified` is admin-controlled and gates panel access independently of the
 * SaaS subscription — a milkman needs both.
 */
export const milkmanProfiles = pgTable(
  'milkman_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    businessName: varchar('business_name', { length: 200 }).notNull(),
    businessAddress: text('business_address'),
    logoUrl: text('logo_url'),

    // Where this milkman's customers send money.
    upiId: varchar('upi_id', { length: 120 }),
    qrCodeUrl: text('qr_code_url'),

    isVerified: boolean('is_verified').notNull().default(false),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanKey: uniqueIndex('milkman_profiles_milkman_key').on(t.milkmanId),
    verifiedIdx: index('milkman_profiles_verified_idx').on(t.isVerified),
  }),
);

/**
 * Admin allowlist, as data rather than only an env var.
 *
 * `ADMIN_EMAILS` still works as a bootstrap for the first operator; everyone
 * after that is added here, so grants are auditable and revocable without a deploy.
 */
export const adminAllowlist = pgTable(
  'admin_allowlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    note: text('note'),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ emailKey: uniqueIndex('admin_allowlist_email_key').on(t.email) }),
);

/**
 * Append-only record of privileged actions.
 *
 * The old admin console had none — there was no way to answer "who suspended
 * this milkman, and when". Nothing in the application ever updates or deletes
 * from this table.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: varchar('actor_email', { length: 255 }),
    action: auditActionEnum('action').notNull(),
    /** Which row was acted on. */
    subjectType: varchar('subject_type', { length: 60 }),
    subjectId: uuid('subject_id'),
    /** Before/after, reason, anything else worth keeping. */
    metadata: jsonb('metadata').$type().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_log_actor_idx').on(t.actorId, t.createdAt),
    subjectIdx: index('audit_log_subject_idx').on(t.subjectType, t.subjectId),
    createdIdx: index('audit_log_created_idx').on(t.createdAt),
  }),
);
