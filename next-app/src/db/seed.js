/**
 * Seed a development database.
 *
 * Creates one platform admin, two milkmen (one trialing, one paying), a handful
 * of customers, plans, products, and a month of realistic delivery history so
 * every screen has something to show.
 *
 *   npm run db:seed
 *
 * Idempotent on email: re-running updates rather than duplicating.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';

import * as schema from './schema/index.js';
import { resolveUnitPrice, isDeliveryDay } from '../domain/pricing.js';
import { businessDate, businessMonth, addDays, monthStart, datesBetween } from '../domain/dates.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 1,
});
const db = drizzle(pool, { schema });

const {
  users, milkmanProfiles, adminAllowlist, serviceAreas, addresses,
  saasPlans, saasSubscriptions, platformSettings,
  milkPlans, milkSubscriptions, deliveries, products, purchases,
} = schema;

const today = businessDate();
const month = businessMonth();

async function upsertUser(values) {
  const [row] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.email, set: { ...values, updatedAt: new Date() } })
    .returning();
  return row;
}

console.log('Seeding…');

// ── Platform settings ────────────────────────────────────────────────────────
await db
  .insert(platformSettings)
  .values({
    id: 1,
    upiId: 'dairydrop@upi',
    supportPhone: '+91 90000 00000',
    supportEmail: 'support@dairydrop.example',
    trialDurationDays: 7,
    trialCustomerLimit: 5,
  })
  .onConflictDoNothing();

// ── SaaS plans ───────────────────────────────────────────────────────────────
const planSpecs = [
  { name: 'Starter', monthlyPrice: '499.00', maxCustomers: 25, sortOrder: 1,
    description: 'For a round you can walk in a morning.',
    features: ['Up to 25 customers', 'Daily round tracking', 'Monthly billing', 'UPI collection'] },
  { name: 'Growth', monthlyPrice: '999.00', maxCustomers: 75, sortOrder: 2,
    description: 'For a growing book across a few sectors.',
    features: ['Up to 75 customers', 'Everything in Starter', 'Extra products catalog', 'Route ordering'] },
  { name: 'Enterprise', monthlyPrice: '1499.00', maxCustomers: 200, sortOrder: 3,
    description: 'For a full dairy operation.',
    features: ['Up to 200 customers', 'Everything in Growth', 'Priority support'] },
];

const plans = [];
for (const spec of planSpecs) {
  const [existing] = await db.select().from(saasPlans).where(eq(saasPlans.name, spec.name)).limit(1);
  if (existing) {
    plans.push(existing);
  } else {
    const [created] = await db.insert(saasPlans).values(spec).returning();
    plans.push(created);
  }
}
console.log(`  ${plans.length} SaaS plans`);

// ── Admin ────────────────────────────────────────────────────────────────────
const adminEmail = (process.env.ADMIN_EMAILS ?? 'admin@dairydrop.example').split(',')[0].trim();
await upsertUser({ email: adminEmail, name: 'Platform Admin', role: 'ADMIN', isActive: true });
await db.insert(adminAllowlist).values({ email: adminEmail, note: 'Seeded' }).onConflictDoNothing();
console.log(`  admin: ${adminEmail}`);

// ── Milkmen ──────────────────────────────────────────────────────────────────
const milkmanSpecs = [
  {
    email: 'ramesh@dairydrop.example', name: 'Ramesh Kumar', phone: '9811100001',
    business: 'Ramesh Fresh Dairy', paid: true, plan: plans[1],
    areas: [
      { areaName: 'Sector 45', pincode: '122003', city: 'Gurugram', state: 'Haryana', routeSequence: 1 },
      { areaName: 'Sector 46', pincode: '122003', city: 'Gurugram', state: 'Haryana', routeSequence: 2 },
    ],
  },
  {
    email: 'suresh@dairydrop.example', name: 'Suresh Yadav', phone: '9811100002',
    business: 'Yadav Doodh Bhandar', paid: false, plan: null,
    areas: [
      { areaName: 'Palam Vihar', pincode: '122017', city: 'Gurugram', state: 'Haryana', routeSequence: 1 },
    ],
  },
];

const milkmen = [];
for (const spec of milkmanSpecs) {
  const user = await upsertUser({
    email: spec.email, name: spec.name, phone: spec.phone, role: 'MILKMAN', isActive: true,
  });

  await db
    .insert(milkmanProfiles)
    .values({
      milkmanId: user.id,
      businessName: spec.business,
      businessAddress: `${spec.areas[0].areaName}, ${spec.areas[0].city}`,
      upiId: `${spec.name.split(' ')[0].toLowerCase()}@upi`,
      isVerified: true,
      verifiedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: milkmanProfiles.milkmanId,
      set: { businessName: spec.business, isVerified: true },
    });

  for (const area of spec.areas) {
    await db.insert(serviceAreas).values({ milkmanId: user.id, ...area }).onConflictDoNothing();
  }

  // Subscription: one paying, one on trial.
  const startsAt = new Date();
  const endsAt = new Date();
  if (spec.paid) {
    endsAt.setDate(endsAt.getDate() + spec.plan.durationDays);
  } else {
    endsAt.setDate(endsAt.getDate() + 7);
  }

  await db.delete(saasSubscriptions).where(eq(saasSubscriptions.milkmanId, user.id));
  await db.insert(saasSubscriptions).values({
    milkmanId: user.id,
    planId: spec.paid ? spec.plan.id : null,
    status: spec.paid ? 'ACTIVE' : 'TRIAL',
    startsAt,
    endsAt,
    customerLimit: spec.paid ? spec.plan.maxCustomers : 5,
    pricePaid: spec.paid ? spec.plan.monthlyPrice : '0',
    paymentReference: spec.paid ? 'SEED000111222' : null,
  });

  milkmen.push({ ...spec, user });
  console.log(`  milkman: ${spec.business} (${spec.paid ? 'paying' : 'trial'})`);
}

const ramesh = milkmen[0];

// ── Milk plans ───────────────────────────────────────────────────────────────
const milkPlanSpecs = [
  { name: 'Half litre daily', productName: 'Cow Milk', quantity: '0.500', monthlyPrice: '900.00' },
  { name: 'One litre daily', productName: 'Cow Milk', quantity: '1.000', monthlyPrice: '1800.00' },
  { name: 'Two litre daily', productName: 'Buffalo Milk', quantity: '2.000', monthlyPrice: '4200.00' },
];

const createdPlans = [];
for (const spec of milkPlanSpecs) {
  const [plan] = await db
    .insert(milkPlans)
    .values({
      milkmanId: ramesh.user.id,
      name: spec.name,
      productName: spec.productName,
      quantity: spec.quantity,
      unit: 'L',
      frequency: 'DAILY',
      slot: 'MORNING',
      monthlyPrice: spec.monthlyPrice,
      pricePerDelivery: null,
      isActive: true,
    })
    .returning();
  createdPlans.push(plan);
}
console.log(`  ${createdPlans.length} milk plans`);

// ── Products ─────────────────────────────────────────────────────────────────
const productSpecs = [
  { name: 'Paneer', unit: 'kg', pricePerUnit: '400.00', availableQuantity: '5.000' },
  { name: 'Ghee', unit: 'kg', pricePerUnit: '900.00', availableQuantity: '3.000' },
  { name: 'Dahi', unit: 'kg', pricePerUnit: '120.00', availableQuantity: '10.000' },
  { name: 'Butter', unit: 'kg', pricePerUnit: '600.00', availableQuantity: '2.000' },
];

const createdProducts = [];
for (const spec of productSpecs) {
  const [product] = await db
    .insert(products)
    .values({ milkmanId: ramesh.user.id, ...spec, isActive: true, availableFrom: today })
    .returning();
  createdProducts.push(product);
}
console.log(`  ${createdProducts.length} products`);

// ── Customers, subscriptions and history ─────────────────────────────────────
const customerSpecs = [
  { email: 'priya@example.com', name: 'Priya Sharma', phone: '9811200001', plan: 1, area: 'Sector 45', status: 'APPROVED' },
  { email: 'anil@example.com', name: 'Anil Verma', phone: '9811200002', plan: 0, area: 'Sector 45', status: 'APPROVED' },
  { email: 'meera@example.com', name: 'Meera Nair', phone: '9811200003', plan: 2, area: 'Sector 46', status: 'APPROVED' },
  { email: 'vikram@example.com', name: 'Vikram Singh', phone: '9811200004', plan: 1, area: 'Sector 46', status: 'APPROVED' },
  { email: 'kavita@example.com', name: 'Kavita Joshi', phone: '9811200005', plan: null, area: 'Sector 45', status: 'PENDING' },
];

const monthDays = datesBetween(monthStart(month), today);
let deliveryCount = 0;

for (const spec of customerSpecs) {
  const customer = await upsertUser({
    email: spec.email,
    name: spec.name,
    phone: spec.phone,
    role: 'CUSTOMER',
    milkmanId: ramesh.user.id,
    approvalStatus: spec.status,
    approvedAt: spec.status === 'APPROVED' ? new Date() : null,
    deliveryArea: spec.area,
    isActive: true,
  });

  await db
    .insert(addresses)
    .values({
      userId: customer.id,
      recipientName: spec.name,
      recipientPhone: spec.phone,
      line1: `House ${Math.floor(Math.random() * 900) + 100}`,
      area: spec.area,
      city: 'Gurugram',
      state: 'Haryana',
      pincode: spec.area.startsWith('Sector') ? '122003' : '122017',
      landmark: 'Near the park',
      isDefault: true,
    })
    .onConflictDoNothing();

  // A customer awaiting approval has no plan yet — that is the point of them.
  if (spec.plan === null) {
    console.log(`  customer: ${spec.name} (${spec.status}, no plan yet)`);
    continue;
  }

  const plan = createdPlans[spec.plan];
  const { unitPrice } = resolveUnitPrice(plan, month);
  const rootId = randomUUID();
  const effectiveFrom = monthStart(month);

  const [subscription] = await db
    .insert(milkSubscriptions)
    .values({
      id: rootId,
      rootId,
      customerId: customer.id,
      milkmanId: ramesh.user.id,
      planId: plan.id,
      productName: plan.productName,
      quantity: plan.quantity,
      unit: plan.unit,
      frequency: plan.frequency,
      slot: plan.slot,
      unitPrice,
      quotedMonthlyPrice: plan.monthlyPrice,
      status: 'ACTIVE',
      effectiveFrom,
    })
    .returning();

  // A realistic month: mostly delivered, the odd skip, today still pending.
  const rows = [];
  for (const date of monthDays) {
    if (!isDeliveryDay(plan.frequency, effectiveFrom, date)) continue;

    const isToday = date === today;
    const roll = Math.random();

    let status = 'DELIVERED';
    let deliveredQuantity = plan.quantity;
    let skipReason = null;

    if (isToday) {
      status = 'PENDING';
      deliveredQuantity = null;
    } else if (roll < 0.08) {
      status = 'SKIPPED';
      deliveredQuantity = null;
      skipReason = 'CUSTOMER_REQUEST';
    } else if (roll < 0.11) {
      status = 'UNDELIVERED';
      deliveredQuantity = null;
      skipReason = 'CUSTOMER_ABSENT';
    } else if (roll < 0.18) {
      // A day where they asked for extra.
      deliveredQuantity = String(Number(plan.quantity) + 0.5);
    }

    rows.push({
      subscriptionRootId: rootId,
      subscriptionVersionId: subscription.id,
      customerId: customer.id,
      milkmanId: ramesh.user.id,
      deliveryDate: date,
      slot: plan.slot,
      productName: plan.productName,
      unit: plan.unit,
      plannedQuantity: plan.quantity,
      deliveredQuantity,
      unitPrice,
      status,
      skipReason,
      deliveredAt: status === 'DELIVERED' ? new Date(`${date}T06:30:00Z`) : null,
    });
  }

  if (rows.length > 0) {
    await db.insert(deliveries).values(rows).onConflictDoNothing();
    deliveryCount += rows.length;
  }

  // An extra order or two.
  if (Math.random() > 0.4) {
    const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
    await db.insert(purchases).values({
      productId: product.id,
      customerId: customer.id,
      milkmanId: ramesh.user.id,
      productName: product.name,
      unit: product.unit,
      quantity: '0.500',
      unitPrice: product.pricePerUnit,
      orderDate: monthDays[Math.floor(monthDays.length / 2)] ?? today,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    });
  }

  console.log(`  customer: ${spec.name} (${spec.status})`);
}

console.log(`  ${deliveryCount} deliveries`);
console.log('\nDone. Sign in with Google using one of the seeded emails,');
console.log('or add your own address to ADMIN_EMAILS for admin access.');

await pool.end();
