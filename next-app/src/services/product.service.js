/**
 * Catalog and extra-product orders.
 */

import 'server-only';

import { db, transaction } from '@/db/index.js';
import { businessDate, addDays } from '@/domain/dates.js';
import { toMilli, milliToDecimal, lineAmountPaise, formatPaise } from '@/domain/money.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InsufficientStockError,
} from '@/domain/errors.js';

import * as productsRepo from '@/repositories/products.repo.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';

import { TOP_CATALOG_PRODUCTS } from '@/domain/catalogPresets.js';

export const CATALOG_PRESETS = TOP_CATALOG_PRODUCTS.map((p) => ({
  name: p.name,
  unit: p.unit,
  pricePerUnit: p.defaultPrice,
  description: p.description,
  imageUrl: p.imageUrl,
  defaultStock: p.defaultStock,
}));

export async function listCatalog(actor) {
  return productsRepo.listProducts(actor);
}

export async function listForCustomer(actor) {
  return productsRepo.listAvailableForCustomer(actor);
}

export async function createProduct(actor, input) {
  return transaction(async (tx) =>
    productsRepo.createProduct(tx, {
      milkmanId: actor.userId,
      name: input.name,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit,
      availableQuantity: input.availableQuantity ?? '0',
      isActive: input.isActive ?? true,
      availableFrom: businessDate(),
    }),
  );
}

/** Add every preset the milkman does not already stock. */
export async function addPresets(actor) {
  const existing = await productsRepo.listProducts(actor);
  const have = new Set(existing.map((p) => p.name.toLowerCase()));
  const missing = CATALOG_PRESETS.filter((p) => !have.has(p.name.toLowerCase()));

  if (missing.length === 0) return { added: 0 };

  return transaction(async (tx) => {
    for (const preset of missing) {
      await productsRepo.createProduct(tx, {
        milkmanId: actor.userId,
        name: preset.name,
        description: preset.description,
        imageUrl: preset.imageUrl,
        unit: preset.unit,
        pricePerUnit: preset.pricePerUnit,
        availableQuantity: preset.defaultStock ?? '10',
        isActive: true,
        availableFrom: businessDate(),
      });
    }
    return { added: missing.length };
  });
}

export async function updateProduct(actor, { id, patch }) {
  return transaction(async (tx) => {
    const row = await productsRepo.updateProduct(tx, actor, { id, patch });
    if (!row) throw new NotFoundError('That product');
    return row;
  });
}

export async function deleteProduct(actor, { id }) {
  return transaction(async (tx) => {
    const row = await productsRepo.deleteProduct(tx, actor, id);
    if (!row) throw new NotFoundError('That product');
    return row;
  });
}

/**
 * Place an order.
 *
 * Stock is reserved with a single atomic conditional UPDATE — the decrement and
 * the availability check happen in one statement, so two concurrent orders for
 * the last unit cannot both succeed. The previous implementation read,
 * subtracted in JavaScript and wrote back.
 */
export async function order(actor, { productId, quantity }) {
  const milli = toMilli(quantity);
  if (milli <= 0) throw new ValidationError('Choose how much you would like.');

  const product = await productsRepo.findProduct(actor, productId);
  if (!product || !product.isActive) throw new NotFoundError('That product');

  const address = await usersRepo.findCustomer(actor, actor.userId);
  const tomorrowDate = addDays(businessDate(), 1);

  return transaction(async (tx) => {
    const reserved = await productsRepo.decrementStock(tx, {
      productId,
      quantity: milliToDecimal(milli),
    });

    if (!reserved) {
      throw new InsufficientStockError({
        productName: product.name,
        available: Number(product.availableQuantity),
        unit: product.unit,
        requested: Number(quantity),
      });
    }

    const purchase = await productsRepo.createPurchase(tx, {
      productId,
      customerId: actor.userId,
      milkmanId: actor.tenantId,
      productName: product.name,
      unit: product.unit,
      quantity: milliToDecimal(milli),
      unitPrice: product.pricePerUnit,
      deliveryAddress: formatAddress(address),
      orderDate: tomorrowDate,
      status: 'PENDING',
    });

    const amountPaise = lineAmountPaise(milli, product.pricePerUnit);

    await notificationsRepo.create(tx, {
      userId: actor.tenantId,
      type: 'ORDER',
      title: 'New Extra Item for Tomorrow',
      body: `${actor.name} ordered ${Number(quantity)} ${product.unit} of ${product.name} to deliver tomorrow with morning milk · ${formatPaise(amountPaise)}.`,
      href: '/milkman/orders',
      subjectType: 'purchase',
      subjectId: purchase.id,
    });

    return purchase;
  });
}

/** Move an order along: PENDING → ACCEPTED → DELIVERED. */
export async function updateOrderStatus(actor, { purchaseId, status }) {
  const purchase = await productsRepo.findPurchase(actor, purchaseId);
  if (!purchase) throw new NotFoundError('That order');

  const allowed = { PENDING: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['DELIVERED', 'CANCELLED'] };
  if (!allowed[purchase.status]?.includes(status)) {
    throw new ConflictError(`An order that is ${purchase.status.toLowerCase()} cannot become ${status.toLowerCase()}.`);
  }

  return transaction(async (tx) => {
    const patch = {};
    if (status === 'DELIVERED') patch.deliveredAt = new Date();
    if (status === 'CANCELLED') {
      patch.cancelledAt = new Date();
      // Put the stock back. The previous system never did, so a cancelled order
      // quietly destroyed inventory.
      if (purchase.productId) {
        await productsRepo.restoreStock(tx, {
          productId: purchase.productId,
          quantity: purchase.quantity,
        });
      }
    }

    const updated = await productsRepo.updatePurchaseStatus(tx, actor, {
      id: purchaseId,
      status,
      patch,
    });
    if (!updated) throw new NotFoundError('That order');

    await notificationsRepo.create(tx, {
      userId: updated.customerId,
      type: 'ORDER',
      title: status === 'DELIVERED' ? 'Order delivered' : `Order ${status.toLowerCase()}`,
      body: `${updated.productName} · ${Number(updated.quantity)} ${updated.unit}`,
      href: '/shop',
      subjectType: 'purchase',
      subjectId: updated.id,
    });

    return updated;
  });
}

export async function listOrders(actor, options) {
  return productsRepo.listOrders(actor, options);
}

export async function listMyOrders(actor, page) {
  return productsRepo.listMyOrders(actor, page);
}

function formatAddress(customer) {
  if (!customer) return null;
  return [
    customer.addressLine1,
    customer.addressLine2,
    customer.addressArea,
    customer.addressCity,
    customer.addressPincode,
    customer.addressLandmark ? `Near ${customer.addressLandmark}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}
