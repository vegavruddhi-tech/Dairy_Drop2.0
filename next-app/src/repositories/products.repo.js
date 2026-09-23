/**
 * Catalog and purchases.
 *
 * The important routine here is `decrementStock`, which is a single atomic
 * conditional UPDATE. The previous system read the stock, subtracted in
 * JavaScript and wrote it back, so two concurrent orders for the last unit both
 * succeeded.
 */

import 'server-only';
import { and, eq, gte, lt, desc, asc, sql, inArray } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { products, purchases, users } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped, paginate } from './base.js';
import { monthStart, nextMonthStart } from '@/domain/dates.js';

const productScope = { tenant: products.milkmanId };
const purchaseScope = { tenant: purchases.milkmanId, owner: purchases.customerId };

// ── Catalog ──────────────────────────────────────────────────────────────────

export async function listProducts(actor, { activeOnly = false } = {}) {
  return db
    .select()
    .from(products)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PRODUCT_MANAGE, columns: productScope },
        activeOnly ? eq(products.isActive, true) : undefined,
      ),
    )
    .orderBy(desc(products.isActive), asc(products.name));
}

/** What a customer can buy — their own milkman's in-stock catalog. */
export async function listAvailableForCustomer(actor) {
  if (!actor.tenantId) return [];
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.milkmanId, actor.tenantId),
        eq(products.isActive, true),
        sql`${products.availableQuantity} > 0`,
      ),
    )
    .orderBy(asc(products.name));
}

export async function findProduct(actor, productId) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.milkmanId, actor.tenantId ?? actor.userId)))
    .limit(1);
  return row ?? null;
}

export async function createProduct(tx, values) {
  const [row] = await tx.insert(products).values(values).returning();
  return row;
}

export async function updateProduct(tx, actor, { id, patch }) {
  const [row] = await tx
    .update(products)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PRODUCT_MANAGE, columns: productScope },
        eq(products.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteProduct(tx, actor, productId) {
  const [row] = await tx
    .delete(products)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PRODUCT_MANAGE, columns: productScope },
        eq(products.id, productId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Reserve stock atomically.
 *
 * The `availableQuantity >= quantity` predicate is inside the UPDATE, so the
 * decrement and the check happen in one statement under one row lock. Zero rows
 * returned means someone else took the last of it — there is no window between
 * reading and writing for a second order to slip through.
 *
 * @returns {Promise<object|null>} the updated product, or null if insufficient
 */
export async function decrementStock(tx, { productId, quantity }) {
  const [row] = await tx
    .update(products)
    .set({
      availableQuantity: sql`${products.availableQuantity} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, productId),
        eq(products.isActive, true),
        gte(products.availableQuantity, quantity),
      ),
    )
    .returning();
  return row ?? null;
}

/** Return stock when an order is cancelled. The old system never did this. */
export async function restoreStock(tx, { productId, quantity }) {
  const [row] = await tx
    .update(products)
    .set({
      availableQuantity: sql`${products.availableQuantity} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();
  return row ?? null;
}

// ── Purchases ────────────────────────────────────────────────────────────────

export async function createPurchase(tx, values) {
  const [row] = await tx.insert(purchases).values(values).returning();
  return row;
}

/** A customer's purchases within a month — billing input. */
export async function listForMonth(actor, { customerId, month }) {
  return db
    .select({
      id: purchases.id,
      productName: purchases.productName,
      unit: purchases.unit,
      quantity: purchases.quantity,
      unitPrice: purchases.unitPrice,
      amount: purchases.amount,
      orderDate: purchases.orderDate,
      status: purchases.status,
      deliveredAt: purchases.deliveredAt,
    })
    .from(purchases)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        eq(purchases.customerId, customerId),
        gte(purchases.orderDate, monthStart(month)),
        lt(purchases.orderDate, nextMonthStart(month)),
      ),
    )
    .orderBy(asc(purchases.orderDate));
}

/** Every purchase for a milkman in a month — earnings input. */
export async function listTenantMonth(actor, month) {
  return db
    .select({
      id: purchases.id,
      customerId: purchases.customerId,
      productName: purchases.productName,
      unit: purchases.unit,
      quantity: purchases.quantity,
      unitPrice: purchases.unitPrice,
      amount: purchases.amount,
      orderDate: purchases.orderDate,
      status: purchases.status,
    })
    .from(purchases)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        gte(purchases.orderDate, monthStart(month)),
        lt(purchases.orderDate, nextMonthStart(month)),
      ),
    );
}

/** The milkman's order queue. */
export async function listOrders(actor, { status, ...page } = {}) {
  const { limit, offset } = paginate(page);

  return db
    .select({
      id: purchases.id,
      customerId: purchases.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      productName: purchases.productName,
      unit: purchases.unit,
      quantity: purchases.quantity,
      unitPrice: purchases.unitPrice,
      amount: purchases.amount,
      deliveryAddress: purchases.deliveryAddress,
      orderDate: purchases.orderDate,
      status: purchases.status,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.customerId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        status ? eq(purchases.status, status) : undefined,
      ),
    )
    .orderBy(desc(purchases.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * The extras a milkman has to carry on one day's round.
 *
 * Purchases live on their own screen, so nothing put them in front of the
 * person actually doing the round: a customer could order paneer and the
 * milkman would cycle past without it. The customer app already promises
 * "extras your milkman can bring with tomorrow's milk", so the round is where
 * they belong.
 *
 * Cancelled orders are excluded — they are not to be carried and are not
 * billed. Everything else for the date is returned, whatever its status.
 */
export async function listRoundExtras(actor, date) {
  return db
    .select({
      id: purchases.id,
      customerId: purchases.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      productName: purchases.productName,
      unit: purchases.unit,
      quantity: purchases.quantity,
      unitPrice: purchases.unitPrice,
      amount: purchases.amount,
      deliveryAddress: purchases.deliveryAddress,
      orderDate: purchases.orderDate,
      status: purchases.status,
    })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.customerId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        eq(purchases.orderDate, date),
        sql`${purchases.status} <> 'CANCELLED'`,
      ),
    )
    .orderBy(asc(users.name));
}

/** A customer's own order history. */
export async function listMyOrders(actor, page = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select()
    .from(purchases)
    .where(
      scoped({ actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope }),
    )
    .orderBy(desc(purchases.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function findPurchase(actor, id) {
  const [row] = await db
    .select()
    .from(purchases)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        eq(purchases.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updatePurchaseStatus(tx, actor, { id, status, patch = {} }) {
  const [row] = await tx
    .update(purchases)
    .set({ status, ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_FULFIL, columns: purchaseScope },
        eq(purchases.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

/** Pending order count — drives the nav badge. */
export async function countPendingOrders(actor) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(purchases)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PURCHASE_READ, columns: purchaseScope },
        eq(purchases.status, 'PENDING'),
      ),
    );
  return row?.count ?? 0;
}
