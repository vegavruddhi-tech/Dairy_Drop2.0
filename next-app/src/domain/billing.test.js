/**
 * Billing engine tests.
 *
 * These are the acceptance criteria for the rebuild. Every scenario here is one
 * the previous implementation got wrong; if any of them regress, customers are
 * charged the wrong amount.
 */

import { describe, it, expect } from 'vitest';

import { computeBill, computeEarnings, computeVariance } from './billing.js';
import { resolveUnitPrice, isDeliveryDay, countDeliveryDays } from './pricing.js';
import { toPaise, paiseToDecimal, lineAmountPaise, toMilli } from './money.js';
import { daysInMonth, nextMonthStart, addMonths, datesBetween } from './dates.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SUB_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SUB_B = 'bbbbbbbb-0000-0000-0000-000000000002';

/** A delivery row as the repository would return it. */
function delivery(overrides = {}) {
  return {
    subscriptionRootId: SUB_A,
    deliveryDate: '2026-09-01',
    status: 'DELIVERED',
    productName: 'Cow Milk',
    unit: 'L',
    plannedQuantity: '1.000',
    adjustedQuantity: null,
    deliveredQuantity: '1.000',
    unitPrice: '60.0000',
    ...overrides,
  };
}

/** `count` identical delivered days starting at day 1 of September. */
function deliveredDays(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    delivery({ deliveryDate: `2026-09-${String(i + 1).padStart(2, '0')}`, ...overrides }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Money primitives
// ─────────────────────────────────────────────────────────────────────────────

describe('money', () => {
  it('parses decimal strings without float error', () => {
    expect(toPaise('1800.00')).toBe(180_000);
    expect(toPaise('0.1')).toBe(10);
    expect(toPaise('58.06')).toBe(5806);
    expect(toPaise(null)).toBe(0);
  });

  it('does not accumulate float drift across a long month', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. In paise it is exact.
    const total = Array.from({ length: 31 }, () => toPaise('0.1')).reduce((a, b) => a + b, 0);
    expect(total).toBe(310);
    expect(paiseToDecimal(total)).toBe('3.10');
  });

  it('rounds line amounts half away from zero', () => {
    // 1.5 L at ₹58.0645 = ₹87.09675 → ₹87.10
    expect(lineAmountPaise(toMilli('1.5'), '58.0645')).toBe(8710);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveUnitPrice', () => {
  it('divides a monthly price by the true length of the month', () => {
    const plan = { monthlyPrice: '1800.00', pricePerDelivery: null, quantity: '1.000' };

    // September has 30 days → ₹60.00/day
    expect(resolveUnitPrice(plan, '2026-09').unitPrice).toBe('60.0000');
    // October has 31 → ₹58.0645/day. The old code divided by a hardcoded 30.
    expect(resolveUnitPrice(plan, '2026-10').unitPrice).toBe('58.0645');
    // February 2028 is a leap year → 29 days
    expect(resolveUnitPrice(plan, '2028-02').unitPrice).toBe('62.0690');
  });

  it('uses an explicit per-delivery price as-is', () => {
    const plan = { pricePerDelivery: '65.00', monthlyPrice: null, quantity: '1.000' };
    expect(resolveUnitPrice(plan, '2026-10').unitPrice).toBe('65.0000');
  });

  it('divides by quantity to reach a per-unit price', () => {
    // ₹1800/month for 2 L/day in September = ₹60/day = ₹30/L
    const plan = { monthlyPrice: '1800.00', pricePerDelivery: null, quantity: '2.000' };
    expect(resolveUnitPrice(plan, '2026-09').unitPrice).toBe('30.0000');
  });

  it('refuses ambiguous or absent pricing', () => {
    const both = { pricePerDelivery: '60', monthlyPrice: '1800', quantity: '1' };
    const neither = { pricePerDelivery: null, monthlyPrice: null, quantity: '1' };
    expect(() => resolveUnitPrice(both, '2026-09')).toThrow(/exactly one/);
    expect(() => resolveUnitPrice(neither, '2026-09')).toThrow(/exactly one/);
  });

  it('refuses a zero quantity rather than dividing by it', () => {
    const plan = { monthlyPrice: '1800', pricePerDelivery: null, quantity: '0' };
    expect(() => resolveUnitPrice(plan, '2026-09')).toThrow(/greater than zero/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The bill
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBill', () => {
  it('bills only what was delivered', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: [
        ...deliveredDays(26),
        delivery({ deliveryDate: '2026-09-27', status: 'SKIPPED', deliveredQuantity: null }),
        delivery({ deliveryDate: '2026-09-28', status: 'SKIPPED', deliveredQuantity: null }),
        delivery({ deliveryDate: '2026-09-29', status: 'UNDELIVERED', deliveredQuantity: null }),
        delivery({ deliveryDate: '2026-09-30', status: 'CANCELLED', deliveredQuantity: null }),
      ],
    });

    expect(bill.deliveredDays).toBe(26);
    expect(bill.skippedDays).toBe(2);
    expect(bill.undeliveredDays).toBe(1);
    // 26 L × ₹60 = ₹1560 — not the ₹1800 list price
    expect(bill.milkAmountPaise).toBe(156_000);
    expect(bill.totalPaise).toBe(156_000);
  });

  it('charges more for a day that ran over the plan', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: [
        ...deliveredDays(24),
        delivery({ deliveryDate: '2026-09-25', deliveredQuantity: '1.500' }),
        delivery({ deliveryDate: '2026-09-26', deliveredQuantity: '0.500' }),
      ],
    });

    // 24 + 1.5 + 0.5 = 26 L × ₹60 = ₹1560
    expect(bill.deliveredMilli).toBe(26_000);
    expect(bill.milkAmountPaise).toBe(156_000);
  });

  it('bills EVERY subscription, not just the most recent', () => {
    // The old implementation resolved the subscription with LIMIT 1 and
    // under-charged every multi-plan customer.
    const bill = computeBill({
      month: '2026-09',
      deliveries: [
        ...deliveredDays(30),
        ...deliveredDays(30).map((d) => ({
          ...d,
          subscriptionRootId: SUB_B,
          productName: 'Buffalo Milk',
          plannedQuantity: '0.500',
          deliveredQuantity: '0.500',
          unitPrice: '80.0000',
        })),
      ],
    });

    expect(bill.milkLines).toHaveLength(2);
    // 30 L × ₹60 = ₹1800, plus 15 L × ₹80 = ₹1200
    expect(bill.milkAmountPaise).toBe(180_000 + 120_000);
    // the sum of the lines equals the total, by construction
    const lineSum = bill.milkLines.reduce((t, l) => t + l.amountPaise, 0);
    expect(lineSum).toBe(bill.milkAmountPaise);
  });

  it('honours a one-day adjustment without touching the plan', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: [
        delivery({ deliveryDate: '2026-09-01' }),
        delivery({
          deliveryDate: '2026-09-02',
          adjustedQuantity: '2.000',
          deliveredQuantity: '2.000',
        }),
        delivery({ deliveryDate: '2026-09-03' }),
      ],
    });

    // 1 + 2 + 1 = 4 L × ₹60
    expect(bill.milkAmountPaise).toBe(24_000);
    // The adjusted day matched its adjustment, so variance is zero — the
    // customer asked for 2 L and got 2 L.
    expect(bill.milkLines[0].varianceMilli).toBe(0);
  });

  it('adds product purchases and excludes cancelled ones', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: deliveredDays(26),
      purchases: [
        {
          id: 'p1',
          productName: 'Ghee',
          unit: 'kg',
          quantity: '0.500',
          unitPrice: '500.00',
          orderDate: '2026-09-15',
          status: 'DELIVERED',
        },
        {
          id: 'p2',
          productName: 'Paneer',
          unit: 'kg',
          quantity: '1.000',
          unitPrice: '400.00',
          orderDate: '2026-09-30', // last day of the month — must be counted
          status: 'ACCEPTED',
        },
        {
          id: 'p3',
          productName: 'Butter',
          unit: 'kg',
          quantity: '1.000',
          unitPrice: '600.00',
          orderDate: '2026-09-20',
          status: 'CANCELLED', // must NOT be counted
        },
      ],
    });

    // ₹250 + ₹400 = ₹650
    expect(bill.productsAmountPaise).toBe(65_000);
    expect(bill.productLines).toHaveLength(2);
    expect(bill.totalPaise).toBe(156_000 + 65_000);
  });

  it('scopes payments to this bill only', () => {
    // The old implementation summed the customer's entire payment history
    // against a single month, so every month after the first read "paid".
    const bill = computeBill({
      month: '2026-09',
      deliveries: deliveredDays(26),
      payments: [
        { id: 'x1', amount: '1000.00', status: 'VERIFIED', createdAt: '2026-09-20' },
        { id: 'x2', amount: '200.00', status: 'SUBMITTED', createdAt: '2026-09-28' },
        { id: 'x3', amount: '999.00', status: 'REJECTED', createdAt: '2026-09-29' },
      ],
    });

    expect(bill.paidPaise).toBe(100_000);      // only VERIFIED
    expect(bill.awaitingPaise).toBe(20_000);   // SUBMITTED, awaiting the milkman
    expect(bill.balancePaise).toBe(56_000);    // ₹1560 − ₹1000
    expect(bill.creditPaise).toBe(0);
    expect(bill.status).toBe('PARTIALLY_PAID');
  });

  it('reports credit when the customer overpays', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: deliveredDays(26),
      payments: [{ id: 'x', amount: '2000.00', status: 'VERIFIED', createdAt: '2026-09-20' }],
    });

    expect(bill.balancePaise).toBe(0);
    expect(bill.creditPaise).toBe(44_000); // ₹2000 − ₹1560
    expect(bill.status).toBe('PAID');
  });

  it('stays OPEN while days are still unactioned', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: [
        ...deliveredDays(20),
        delivery({ deliveryDate: '2026-09-21', status: 'PENDING', deliveredQuantity: null }),
      ],
      payments: [{ id: 'x', amount: '5000.00', status: 'VERIFIED', createdAt: '2026-09-21' }],
    });

    // Overpaid, but the month can still move — so it is not PAID yet.
    expect(bill.pendingDays).toBe(1);
    expect(bill.status).toBe('OPEN');
  });

  it('prorates a mid-month start by having fewer delivery rows', () => {
    // A customer who joins on the 20th simply has 11 delivery rows.
    const bill = computeBill({
      month: '2026-09',
      deliveries: Array.from({ length: 11 }, (_, i) =>
        delivery({ deliveryDate: `2026-09-${20 + i}` }),
      ),
    });

    expect(bill.deliveredDays).toBe(11);
    expect(bill.milkAmountPaise).toBe(66_000); // 11 × ₹60
  });

  it('applies a milkman adjustment and never goes negative', () => {
    const bill = computeBill({
      month: '2026-09',
      deliveries: deliveredDays(2), // ₹120
      adjustmentAmount: '500.00',
      adjustmentReason: 'Goodwill credit for a missed week',
    });

    expect(bill.totalPaise).toBe(0);
    expect(bill.adjustmentReason).toMatch(/Goodwill/);
  });

  it('handles an empty month without inventing a full month of charges', () => {
    // The old code billed a whole month when no delivery rows existed, which
    // double-charged whenever generation was merely late.
    const bill = computeBill({ month: '2026-09', deliveries: [], purchases: [] });

    expect(bill.totalPaise).toBe(0);
    expect(bill.milkLines).toHaveLength(0);
    expect(bill.status).toBe('PAID'); // nothing owed
  });

  it('rejects a malformed month rather than guessing', () => {
    expect(() => computeBill({ month: '2026-9' })).toThrow(/business month/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variance
// ─────────────────────────────────────────────────────────────────────────────

describe('computeVariance', () => {
  it('reports gross extra and reduced separately', () => {
    // The old system showed a net figure on the invoice and a gross figure in
    // history, so the same customer saw two different numbers for one month.
    const variance = computeVariance([
      delivery({ deliveryDate: '2026-09-03', deliveredQuantity: '1.500' }), // +0.5
      delivery({ deliveryDate: '2026-09-09', deliveredQuantity: '0.500' }), // −0.5
      delivery({ deliveryDate: '2026-09-10', deliveredQuantity: '1.000' }), //  0
    ]);

    expect(variance.extraMilli).toBe(500);
    expect(variance.reducedMilli).toBe(500);
    expect(variance.netMilli).toBe(0);
  });

  it('ignores days that were not delivered', () => {
    const variance = computeVariance([
      delivery({ status: 'SKIPPED', deliveredQuantity: null }),
      delivery({ status: 'PENDING', deliveredQuantity: null }),
    ]);
    expect(variance.extraMilli).toBe(0);
    expect(variance.reducedMilli).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation — the acceptance criterion
// ─────────────────────────────────────────────────────────────────────────────

describe('reconciliation', () => {
  it('milkman earnings equal the sum of customer bills, to the paisa', () => {
    // This is the property the previous system could never satisfy: it used
    // /30 and ₹60 on the milkman side, the true month length and ₹65 on the
    // customer side, and ₹75 when writing the delivery row.
    const customers = [
      { root: SUB_A, days: 26, qty: '1.000', price: '60.0000' },
      { root: SUB_B, days: 30, qty: '2.000', price: '29.0323' },
      { root: 'cccccccc-0000-0000-0000-000000000003', days: 15, qty: '0.500', price: '80.0000' },
    ];

    const allDeliveries = customers.flatMap((c) =>
      Array.from({ length: c.days }, (_, i) =>
        delivery({
          subscriptionRootId: c.root,
          deliveryDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
          plannedQuantity: c.qty,
          deliveredQuantity: c.qty,
          unitPrice: c.price,
        }),
      ),
    );

    const purchases = [
      {
        id: 'p1',
        productName: 'Ghee',
        unit: 'kg',
        quantity: '0.500',
        unitPrice: '500.00',
        orderDate: '2026-09-15',
        status: 'DELIVERED',
      },
    ];

    const billTotal = customers.reduce((total, c) => {
      const bill = computeBill({
        month: '2026-09',
        deliveries: allDeliveries.filter((d) => d.subscriptionRootId === c.root),
        purchases: c.root === SUB_A ? purchases : [],
      });
      return total + bill.totalPaise;
    }, 0);

    const earnings = computeEarnings({ deliveries: allDeliveries, purchases });

    expect(earnings.billedPaise).toBe(billTotal);
  });

  it('reports outstanding as billed minus collected', () => {
    const earnings = computeEarnings({
      deliveries: deliveredDays(10), // ₹600
      purchases: [],
      payments: [
        { id: 'a', amount: '400.00', status: 'VERIFIED', createdAt: '2026-09-11' },
        { id: 'b', amount: '100.00', status: 'SUBMITTED', createdAt: '2026-09-12' },
      ],
    });

    expect(earnings.billedPaise).toBe(60_000);
    expect(earnings.collectedPaise).toBe(40_000); // SUBMITTED does not count
    expect(earnings.outstandingPaise).toBe(20_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────────────────────────────────────────

describe('delivery schedule', () => {
  it('generates every day for a daily plan', () => {
    const days = datesBetween('2026-09-01', '2026-09-07');
    expect(days.filter((d) => isDeliveryDay('DAILY', '2026-09-01', d))).toHaveLength(7);
  });

  it('alternates without doubling up across a month boundary', () => {
    // frequency was stored and then ignored by the old generator — every plan
    // delivered daily regardless.
    const days = datesBetween('2026-09-28', '2026-10-04');
    const hits = days.filter((d) => isDeliveryDay('ALTERNATE_DAYS', '2026-09-01', d));
    expect(hits).toEqual(['2026-09-29', '2026-10-01', '2026-10-03']);
  });

  it('keeps a weekly plan on its anchor weekday', () => {
    // 2026-09-01 is a Tuesday.
    const days = datesBetween('2026-09-01', '2026-09-30');
    const hits = days.filter((d) => isDeliveryDay('WEEKLY', '2026-09-01', d));
    expect(hits).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
  });

  it('never schedules before the subscription starts', () => {
    expect(isDeliveryDay('DAILY', '2026-09-10', '2026-09-09')).toBe(false);
    expect(isDeliveryDay('DAILY', '2026-09-10', '2026-09-10')).toBe(true);
  });

  it('counts delivery days for a monthly quote', () => {
    expect(countDeliveryDays('DAILY', '2026-09')).toBe(30);
    expect(countDeliveryDays('DAILY', '2026-10')).toBe(31);
    expect(countDeliveryDays('ALTERNATE_DAYS', '2026-09')).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

describe('dates', () => {
  it('knows the true length of every month', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29); // leap
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-10')).toBe(31);
  });

  it('gives a half-open month range that includes the last day', () => {
    // A closed `<= '2026-09-30'` against a timestamptz column dropped every
    // order placed on the 30th. The exclusive upper bound cannot.
    expect(nextMonthStart('2026-09')).toBe('2026-10-01');
    expect(nextMonthStart('2026-12')).toBe('2027-01-01');
  });

  it('shifts months across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });
});
