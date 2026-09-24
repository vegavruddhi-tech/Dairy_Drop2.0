/**
 * Zod schemas — the single definition of what valid input looks like.
 *
 * Shared by Server Actions, Route Handlers and client forms, so the rules cannot
 * drift between where they are shown and where they are enforced. The previous
 * system hand-rolled roughly 200 `if (!x) return res.status(400)` checks with
 * inconsistent messages and no client counterpart.
 */

import { z } from 'zod';

// ── Primitives ───────────────────────────────────────────────────────────────

export const uuid = z.string().uuid('That does not look like a valid id.');

export const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-22.');

export const businessMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Use a month like 2026-09.');

export const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter a valid 6-digit pincode.');

export const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 10, 'Enter a 10-digit mobile number.');

/** A rupee amount as a decimal string — never a float. */
export const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), 'Enter an amount like 1800 or 1800.50');

/** A quantity in litres or kilograms, up to 3 decimal places. */
export const quantity = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,3})?$/.test(value), 'Enter a quantity like 1 or 1.5')
  .refine((value) => Number(value) > 0, 'Enter a quantity greater than zero.')
  .refine((value) => Number(value) <= 100, 'That quantity is too large.');

const nonEmpty = (max, message) => z.string().trim().min(1, message).max(max);

// ── Onboarding ───────────────────────────────────────────────────────────────

export const findMilkmenSchema = z.object({ pincode });

export const registerCustomerSchema = z.object({
  milkmanId: uuid,
  name: nonEmpty(160, 'Enter your name.'),
  phone,
  area: nonEmpty(120, 'Choose your area.'),
  pincode,
  line1: nonEmpty(300, 'Enter your house or flat and street.'),
  line2: z.string().trim().max(300).optional().or(z.literal('')),
  landmark: z.string().trim().max(200).optional().or(z.literal('')),
  deliveryInstructions: z.string().trim().max(500).optional().or(z.literal('')),
  planIds: z.array(z.string()).max(2, 'A customer cannot select more than 2 plans.').optional(),
});

export const approveCustomerSchema = z.object({ customerId: uuid });

/** An id-only payload, for retire/delete style actions. */
export const idSchema = z.object({ id: uuid });

export const rejectCustomerSchema = z.object({
  customerId: uuid,
  reason: nonEmpty(500, 'Give a reason — the customer will see it.'),
});

export const updateCustomerAddressSchema = z.object({
  customerId: uuid,
  line1: nonEmpty(300, 'Enter house or flat number and street.'),
  line2: z.string().trim().max(300).optional().or(z.literal('')),
  area: nonEmpty(120, 'Enter sector or area name.'),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().max(120).optional().or(z.literal('')),
  pincode: pincode,
  landmark: z.string().trim().max(200).optional().or(z.literal('')),
  deliveryInstructions: z.string().trim().max(500).optional().or(z.literal('')),
});

/**
 * Applying to trade on the platform as a milkman.
 *
 * At least one service area is required — a milkman who delivers nowhere cannot
 * be found by any customer, and the admin reviewing the application needs to
 * know where they operate.
 */
export const milkmanApplicationSchema = z.object({
  businessName: nonEmpty(200, 'What is your dairy called?'),
  phone,
  businessAddress: z.string().trim().max(500).optional().or(z.literal('')),
  upiId: z.string().trim().max(120).optional().or(z.literal('')),
  qrCodeUrl: z.string().trim().optional().or(z.literal('')),
  areaName: nonEmpty(120, 'Name the area you deliver to.'),
  pincode,
  city: nonEmpty(120, 'Enter the city.'),
  state: nonEmpty(120, 'Enter the state.'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

// ── Subscriptions ────────────────────────────────────────────────────────────

export const subscribeSchema = z.object({
  planId: uuid,
  startDate: businessDate.optional(),
  slot: z.enum(['MORNING', 'EVENING', 'BOTH']).optional(),
});

export const subscriptionActionSchema = z.object({
  rootId: uuid,
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});

/** 'HH:MM' from a native <input type="time">, or blank. */
const clockTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use a time like 06:00.')
  .optional()
  .or(z.literal(''));

/** '' → null, so a cleared field clears the column rather than storing ''. */
const blankToNull = (value) => (value === '' || value === undefined ? null : value);

export const milkPlanSchema = z
  .object({
    id: uuid.optional(),
    name: nonEmpty(120, 'Give the plan a name.'),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    productName: nonEmpty(120, 'What is being delivered?'),
    quantity,
    unit: z.enum(['L', 'ml', 'kg', 'g', 'pcs']).default('L'),
    frequency: z.enum(['DAILY', 'ALTERNATE_DAYS', 'WEEKLY', 'MONTHLY']).default('DAILY'),
    slot: z.enum(['MORNING', 'EVENING', 'BOTH']).default('MORNING'),
    morningStart: clockTime,
    morningEnd: clockTime,
    eveningStart: clockTime,
    eveningEnd: clockTime,
    pricingBasis: z.enum(['MONTHLY', 'PER_DELIVERY', 'PER_UNIT']),
    price: money,
    isActive: z.boolean().default(true),
  })
  /*
   * A window is required for each slot the plan actually runs, and only those.
   *
   * Checked here as well as by the database CHECK because a field error can say
   * which box to fill in; a constraint violation can only say the row was bad.
   */
  .superRefine((value, ctx) => {
    const needs = {
      morning: value.slot === 'MORNING' || value.slot === 'BOTH',
      evening: value.slot === 'EVENING' || value.slot === 'BOTH',
    };

    for (const [prefix, required] of Object.entries(needs)) {
      const startKey = `${prefix}Start`;
      const endKey = `${prefix}End`;
      const start = value[startKey] || '';
      const end = value[endKey] || '';

      if (required) {
        if (!start) {
          ctx.addIssue({ code: 'custom', path: [startKey], message: 'When does the round start?' });
        }
        if (!end) {
          ctx.addIssue({ code: 'custom', path: [endKey], message: 'And when does it finish?' });
        }
        if (start && end && end <= start) {
          // 'HH:MM' compares correctly as a string, which is why it is stored
          // zero-padded. A round that ends before it starts cannot be met.
          ctx.addIssue({ code: 'custom', path: [endKey], message: 'The end must be after the start.' });
        }
      }
    }

    /*
     * On a two-slot plan the morning must finish before the evening begins.
     *
     * Each window can be individually sensible and the pair still nonsense —
     * morning 02:00–17:30 beside evening 17:30–19:00 passes every check above,
     * and tells the customer their morning delivery arrives at half past five
     * in the afternoon. Overlapping rounds also leave no answer to which one a
     * given delivery belongs in.
     */
    if (needs.morning && needs.evening) {
      const morningEnd = value.morningEnd || '';
      const eveningStart = value.eveningStart || '';
      // `>=`, not `>`: touching windows leave a delivery on the boundary
      // belonging to neither round.
      if (morningEnd && eveningStart && morningEnd >= eveningStart) {
        ctx.addIssue({
          code: 'custom',
          path: ['eveningStart'],
          message: 'The evening round has to start after the morning one ends.',
        });
      }
    }
  })
  // Exactly one pricing basis reaches the database, matching the CHECK constraint.
  .transform(({ pricingBasis, price, slot, ...rest }) => ({
    ...rest,
    slot,
    // Drop the window for a slot this plan does not run, so switching from
    // "both" to "morning" does not leave a stale evening time behind.
    morningStart: slot === 'EVENING' ? null : blankToNull(rest.morningStart),
    morningEnd: slot === 'EVENING' ? null : blankToNull(rest.morningEnd),
    eveningStart: slot === 'MORNING' ? null : blankToNull(rest.eveningStart),
    eveningEnd: slot === 'MORNING' ? null : blankToNull(rest.eveningEnd),
    monthlyPrice: pricingBasis === 'MONTHLY' ? price : null,
    /*
     * A per-unit rate is a per-delivery price in disguise.
     *
     * ₹30 a litre on a 2 L plan is ₹60 a drop, and the database still holds
     * exactly one basis — the CHECK constraint and the whole "no ambiguous
     * pricing" rule survive. Converting here rather than adding a third column
     * keeps one definition of what a plan costs.
     */
    pricePerDelivery:
      pricingBasis === 'PER_DELIVERY'
        ? price
        : pricingBasis === 'PER_UNIT'
          ? perUnitToPerDelivery(price, rest.quantity)
          : null,
  }));

/** '30' a litre × 2 L → '60.00'. Paise-exact, rounded once. */
function perUnitToPerDelivery(price, quantity) {
  const paisePerUnit = Math.round(Number(price) * 100);
  const milli = Math.round(Number(quantity) * 1000);
  return (Math.round((paisePerUnit * milli) / 1000) / 100).toFixed(2);
}

// ── Deliveries ───────────────────────────────────────────────────────────────

export const markDeliverySchema = z.object({
  deliveryId: uuid,
  status: z.enum(['DELIVERED', 'UNDELIVERED', 'SKIPPED', 'PENDING']),
  quantity: quantity.optional(),
  note: z.string().trim().max(300).optional().or(z.literal('')),
  skipReason: z
    .enum(['CUSTOMER_REQUEST', 'MILKMAN_DAY_OFF', 'CUSTOMER_ABSENT', 'OUT_OF_STOCK', 'OTHER'])
    .optional(),
});

export const dayOffSchema = z.object({
  date: businessDate.optional(),
  startDate: businessDate.optional(),
  endDate: businessDate.optional(),
  reason: z.enum(['MILKMAN_DAY_OFF', 'OTHER']).default('MILKMAN_DAY_OFF'),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const cancelHolidaySchema = z.object({
  date: businessDate.optional(),
  startDate: businessDate.optional(),
  endDate: businessDate.optional(),
});

export const adjustQuantitySchema = z.object({
  deliveryId: uuid,
  quantity,
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const skipDaySchema = z.object({
  deliveryId: uuid,
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const vacationSchema = z.object({
  startDate: businessDate,
  endDate: businessDate,
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const cancelVacationSchema = z.object({
  startDate: businessDate,
  endDate: businessDate,
});

// ── Products ─────────────────────────────────────────────────────────────────

export const productSchema = z.object({
  id: uuid.optional(),
  name: nonEmpty(120, 'Give the product a name.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(1000).optional().or(z.literal('')),
  unit: z.enum(['L', 'ml', 'kg', 'g', 'pcs']),
  pricePerUnit: money,
  availableQuantity: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), 'Enter a stock quantity.'),
  isActive: z.boolean().default(true),
});

export const orderSchema = z.object({ productId: uuid, quantity });

export const orderStatusSchema = z.object({
  purchaseId: uuid,
  status: z.enum(['ACCEPTED', 'DELIVERED', 'CANCELLED']),
});

// ── Requests ─────────────────────────────────────────────────────────────────

export const quantityRequestSchema = z.object({
  deliveryId: uuid,
  quantity,
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

/** Stepping off a plan the milkman has withdrawn. */
export const switchRetiredSchema = z.object({
  rootId: uuid,
  planId: uuid,
});

export const planChangeRequestSchema = z.object({
  rootId: uuid,
  planId: uuid,
  // Required: a milkman deciding needs to know why.
  note: nonEmpty(500, 'Tell your milkman why you would like to change.'),
});

export const resolveRequestSchema = z.object({
  requestId: uuid,
  approve: z.boolean(),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

// ── Payments ─────────────────────────────────────────────────────────────────

export const submitPaymentSchema = z
  .object({
    month: businessMonth.optional(),
    amount: money,
    method: z.enum(['UPI', 'CASH', 'BANK_TRANSFER']).default('UPI'),
    reference: z.string().trim().max(120).optional().or(z.literal('')),
    note: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .refine((data) => data.method === 'CASH' || Boolean(data.reference), {
    message: 'Enter the UPI reference or UTR from your payment app.',
    path: ['reference'],
  });

export const verifyPaymentSchema = z.object({
  paymentId: uuid,
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional().or(z.literal('')),
});

// ── SaaS ─────────────────────────────────────────────────────────────────────

export const submitSaasPaymentSchema = z.object({
  planId: uuid,
  reference: z
    .string()
    .trim()
    .min(6, 'Enter the full transaction reference from your bank or UPI app.')
    .max(120),
});

export const verifySaasPaymentSchema = z.object({
  subscriptionId: uuid,
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional().or(z.literal('')),
});

export const saasPlanSchema = z.object({
  id: uuid.optional(),
  name: nonEmpty(100, 'Give the plan a name.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  monthlyPrice: money,
  maxCustomers: z.coerce.number().int().min(1, 'A plan must allow at least one customer.'),
  durationDays: z.coerce.number().int().min(1).max(366).default(30),
  features: z.array(z.string().trim().max(120)).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

// ── Admin ────────────────────────────────────────────────────────────────────

export const verifyMilkmanSchema = z.object({ milkmanId: uuid });

export const suspendMilkmanSchema = z.object({
  milkmanId: uuid,
  reason: nonEmpty(500, 'Give a reason — the milkman will see it.'),
});

export const platformSettingsSchema = z.object({
  upiId: z.string().trim().max(120).optional().or(z.literal('')),
  qrCodeUrl: z.string().url('That is not a valid link.').optional().or(z.literal('')),
  bankDetails: z.string().trim().max(1000).optional().or(z.literal('')),
  supportPhone: z.string().trim().max(20).optional().or(z.literal('')),
  supportEmail: z.string().email('That is not a valid email.').optional().or(z.literal('')),
  trialDurationDays: z.coerce.number().int().min(1).max(90),
  trialCustomerLimit: z.coerce.number().int().min(1).max(100),
});

// ── Profile ──────────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  name: nonEmpty(160, 'Enter your name.'),
  phone,
});

export const milkmanProfileSchema = z.object({
  name: nonEmpty(160, 'Enter your name.'),
  phone,
  businessName: nonEmpty(200, 'Enter your dairy or business name.'),
  businessAddress: z.string().trim().max(500).optional().or(z.literal('')),
  upiId: z.string().trim().max(120).optional().or(z.literal('')),
  qrCodeUrl: z.string().url('That is not a valid link.').optional().or(z.literal('')),
});

export const serviceAreaSchema = z.object({
  id: uuid.optional(),
  areaName: nonEmpty(120, 'Name the area.'),
  pincode,
  city: nonEmpty(120, 'Enter the city.'),
  state: nonEmpty(120, 'Enter the state.'),
  routeSequence: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
