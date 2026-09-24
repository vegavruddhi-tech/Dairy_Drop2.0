/**
 * When a plan change starts.
 *
 * It used to always be tomorrow, so that a customer could not rewrite a round
 * the milkman was already out delivering. Right for the milkman, wrong for
 * anyone changing before dawn — they waited a whole extra day for milk that had
 * not been loaded yet.
 *
 * It now turns on the delivery window: a slot whose round has not set off gets
 * the new terms today; one that has been and gone waits until tomorrow.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { slotsStillAheadToday } from '@/domain/pricing.js';
import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

describe('which slots are still ahead', () => {
  const both = {
    slot: 'BOTH',
    morningStart: '06:00:00', morningEnd: '07:30:00',
    eveningStart: '17:30:00', eveningEnd: '19:00:00',
  };
  const morning = { slot: 'MORNING', morningStart: '06:00:00', morningEnd: '07:30:00' };

  it.each([
    ['05:00', ['MORNING', 'EVENING']],
    ['06:30', ['EVENING']],
    ['17:00', ['EVENING']],
    ['20:00', []],
  ])('at %s, a both-slot plan still has %j ahead', (now, expected) => {
    expect(slotsStillAheadToday(both, now)).toEqual(expected);
  });

  it('a morning plan is done for the day once its round sets off', () => {
    expect(slotsStillAheadToday(morning, '05:59')).toEqual(['MORNING']);
    expect(slotsStillAheadToday(morning, '06:00')).toEqual([]);
  });

  it('waits for tomorrow when the plan has no window at all', () => {
    // Without a time there is no way to know whether the round has passed, and
    // tomorrow is the answer that cannot be wrong.
    expect(slotsStillAheadToday({ slot: 'BOTH' }, '00:01')).toEqual([]);
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('a change made before the round', () => {
  let db, sql, roles, subs, repo, transaction, milkmanId, fixture, customer, rootId;
  const planIds = [];

  async function makePlan(name, quantity) {
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery)
      values (${milkmanId}, ${name}, 'cutoff milk', ${quantity}, 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', '50.00')
      returning id`);
    const id = (created.rows ?? created)[0].id;
    planIds.push(id);
    return id;
  }

  beforeAll(async () => {
    ({ db, transaction } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subs = await import('@/services/subscription.service.js');
    repo = await import('@/repositories/subscriptions.repo.js');

    const rows = await db.execute(sql`
      select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;

    fixture = await createTestCustomer(db, sql, milkmanId, 'cutoff');
    customer = customerActor(fixture, milkmanId, roles);

    const first = await makePlan('Cutoff From', '1.000');
    const created = await subs.subscribe(customer, { planId: first });
    rootId = created.rootId;

    // Backdate the enrolment so there is a yesterday to close it at.
    const { addDays, businessDate } = await import('@/domain/dates.js');
    await db.execute(sql`
      update "app".milk_subscriptions
         set effective_from = ${addDays(businessDate(), -3)}
       where root_id = ${rootId}`);
  });

  afterAll(async () => {
    vi.useRealTimers();
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) {
      await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
    }
  });

  it('starts today, and lays down today\'s delivery itself', async () => {
    if (!milkmanId) return;
    const { businessDate } = await import('@/domain/dates.js');
    const today = businessDate();

    // 04:00 local — well before the 06:00 round.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${today}T04:00:00+05:30`));

    const target = await makePlan('Cutoff To', '4.000');
    const plan = await repo.findPlan(customer, target);
    const next = await transaction((tx) =>
      subs.applyPlanChange(tx, customer, { rootId, plan }),
    );
    vi.useRealTimers();

    expect(next.effectiveFrom).toBe(today);

    // The nightly generator will not run again until tomorrow, so the change
    // has to lay down its own row or the customer's day goes blank.
    const rows = await db.execute(sql`
      select planned_quantity, status from "app".deliveries
       where subscription_root_id = ${rootId} and delivery_date = ${today}
         and status <> 'CANCELLED'`);
    const live = rows.rows ?? rows;
    expect(live).toHaveLength(1);
    expect(Number(live[0].planned_quantity)).toBe(4);
  });

  it('waits for tomorrow once the round has set off', async () => {
    if (!milkmanId) return;
    const { businessDate, addDays } = await import('@/domain/dates.js');
    const today = businessDate();

    // 11:00 local — the morning round has been and gone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${today}T11:00:00+05:30`));

    const target = await makePlan('Cutoff Later', '7.000');
    const plan = await repo.findPlan(customer, target);
    const next = await transaction((tx) =>
      subs.applyPlanChange(tx, customer, { rootId, plan }),
    );
    vi.useRealTimers();

    expect(next.effectiveFrom).toBe(addDays(today, 1));
  });
});
