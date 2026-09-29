/**
 * Administrator-only services refuse everyone else.
 *
 * Two "quick" Server Actions once let a pending customer approve themselves
 * and an unverified milkman call `verifyMilkman` on their own account. The
 * actions are gone; these tests pin the part that stops it happening again —
 * the services check the caller's role themselves, so a wrongly wired action
 * cannot reach the write.
 *
 * The guard runs before any query, so nothing here touches a row. The modules
 * still import the database client, hence the DATABASE_URL gate.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const NIL = '00000000-0000-0000-0000-000000000000';
const milkman = { userId: NIL, role: 'MILKMAN', tenantId: NIL, name: 'Test milkman' };
const customer = { userId: NIL, role: 'CUSTOMER', tenantId: NIL, name: 'Test customer' };

suite('administrator-only services', () => {
  let admin, saas, customerActions, milkmanActions, ForbiddenError;

  beforeAll(async () => {
    admin = await import('@/services/admin.service.js');
    saas = await import('@/services/saas.service.js');
    customerActions = await import('@/actions/customer.actions.js');
    milkmanActions = await import('@/actions/milkman.actions.js');
    ({ ForbiddenError } = await import('@/domain/errors.js'));
  });

  it.each([
    ['verifyMilkman', (a) => admin.verifyMilkman(a, { milkmanId: a.userId })],
    ['suspendMilkman', (a) => admin.suspendMilkman(a, { milkmanId: NIL, reason: 'x' })],
    ['savePlan', (a) => admin.savePlan(a, { values: {} })],
    ['retirePlan', (a) => admin.retirePlan(a, { id: NIL })],
    ['saveSettings', (a) => admin.saveSettings(a, {})],
    ['saas.verifyPayment', (a) => saas.verifyPayment(a, { subscriptionId: NIL, approve: true })],
  ])('%s refuses a milkman and a customer', async (_name, call) => {
    await expect(call(milkman)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(call(customer)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('a milkman cannot verify their own dairy', async () => {
    await expect(admin.verifyMilkman(milkman, { milkmanId: milkman.userId })).rejects.toThrow(
      /administrator/i,
    );
  });

  it('the self-approval shortcuts no longer exist', () => {
    expect(customerActions.quickApproveCustomer).toBeUndefined();
    expect(milkmanActions.quickVerifyMyDairy).toBeUndefined();
  });
});
