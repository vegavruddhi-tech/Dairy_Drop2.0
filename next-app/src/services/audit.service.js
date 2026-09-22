/**
 * Audit log.
 *
 * Append-only. Nothing in the application updates or deletes from this table —
 * that is the point. The previous admin console had no equivalent, so there was
 * no way to answer "who suspended this milkman, and when".
 */

import 'server-only';

import { auditLog } from '@/db/schema/index.js';

/**
 * Record a privileged action. Always called inside the same transaction as the
 * action itself, so an action can never commit without its audit entry.
 *
 * @param {object} tx
 * @param {import('@/auth/session.js').ActorContext} actor
 * @param {object} entry
 * @param {string} entry.action       a value from auditActionEnum
 * @param {string} [entry.subjectType]
 * @param {string} [entry.subjectId]
 * @param {object} [entry.metadata]
 * @param {string} [entry.ipAddress]
 */
export async function record(tx, actor, entry) {
  const [row] = await tx
    .insert(auditLog)
    .values({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: entry.action,
      subjectType: entry.subjectType ?? null,
      subjectId: entry.subjectId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
    })
    .returning({ id: auditLog.id });
  return row;
}
