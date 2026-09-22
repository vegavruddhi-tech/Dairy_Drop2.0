/**
 * The Server Action boundary.
 *
 * Every mutation in the app goes through `defineAction`, which does four things
 * in a fixed order and cannot be persuaded to skip any of them:
 *
 *   1. **Authorize** — run a guard from `src/auth/session.js`.
 *   2. **Validate** — parse input with a Zod schema.
 *   3. **Execute** — call the service with the actor and the parsed input.
 *   4. **Translate** — turn domain errors into a serialisable result, and
 *      revalidate the affected paths.
 *
 * Server Actions are public HTTP endpoints. Anything that skips step 1 is
 * unprotected no matter what the middleware or the UI does — which is exactly
 * how the previous system ended up with a client-only paywall.
 */

import 'server-only';
import { revalidatePath } from 'next/cache';

import { toErrorResponse, ValidationError } from '@/domain/errors.js';

/**
 * `redirect()` and `notFound()` signal control flow by throwing. Next
 * identifies them by a `digest` marker, and they must reach the framework — a
 * catch-all that swallows them turns a redirect into a silent failure.
 */
function isControlFlow(error) {
  const digest = error?.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  );
}

/**
 * @typedef {object} ActionResult
 * @property {boolean} ok
 * @property {*} [data]
 * @property {string} [code]        machine-readable error code
 * @property {string} [message]     safe to show the user
 * @property {object} [fieldErrors] per-field messages, keyed by field name
 */

/**
 * Wrap a service call as a Server Action.
 *
 * @param {object} config
 * @param {() => Promise<object>} config.authorize  a guard; returns the actor
 * @param {import('zod').ZodSchema} [config.schema]
 * @param {(ctx: { actor: object, input: object }) => Promise<*>} config.handler
 * @param {string[]|((result: *, input: object) => string[])} [config.revalidate]
 * @returns {(input: *) => Promise<ActionResult>}
 */
export function defineAction({ authorize, schema, handler, revalidate = [] }) {
  return async function action(rawInput) {
    try {
      // 1 — Authorize. Always first: never validate input for a caller who is
      // not allowed to make the call at all.
      //
      // 'action' mode makes the guards throw rather than redirect: in a
      // mutation, a refusal is a real error the caller must see, not a
      // navigation.
      const actor = await authorize({ mode: 'action' });

      // 2 — Validate.
      let input = rawInput ?? {};
      if (schema) {
        const parsed = schema.safeParse(normalise(rawInput));
        if (!parsed.success) {
          return {
            ok: false,
            code: 'VALIDATION_FAILED',
            message: 'Please check the highlighted fields.',
            fieldErrors: flattenIssues(parsed.error),
          };
        }
        input = parsed.data;
      }

      // 3 — Execute.
      const data = await handler({ actor, input });

      // 4 — Refresh the affected screens.
      const paths = typeof revalidate === 'function' ? revalidate(data, input) : revalidate;
      for (const path of paths) revalidatePath(path);

      return { ok: true, data: serialise(data) };
    } catch (error) {
      // Let Next's redirect/notFound through untouched.
      if (isControlFlow(error)) throw error;

      const { body } = toErrorResponse(error);

      // Unexpected failures are logged with their stack but never returned.
      if (body.code === 'INTERNAL_ERROR') {
        console.error('[action] unhandled error', error);
      }

      return { ok: false, ...body };
    }
  };
}

/**
 * Accept a `FormData` or a plain object.
 *
 * Progressive-enhancement forms post `FormData`; client components usually call
 * with an object. Handling both here means no action needs to care.
 */
function normalise(input) {
  if (!(input instanceof FormData)) return input ?? {};

  const result = {};
  for (const [key, value] of input.entries()) {
    if (value === '') continue;
    // Checkboxes arrive as 'on'.
    if (value === 'on') {
      result[key] = true;
      continue;
    }
    if (key.endsWith('[]')) {
      const name = key.slice(0, -2);
      (result[name] ??= []).push(value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

/** Zod issues → `{ fieldName: 'message' }`, first message per field. */
function flattenIssues(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Make a result safe to cross the server→client boundary.
 *
 * Dates become ISO strings and `undefined` is dropped, so React does not throw
 * on a non-serialisable payload.
 */
function serialise(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = serialise(item);
    }
    return result;
  }
  return value;
}

/** Throw a field-level error from inside a handler. */
export function fieldError(field, message) {
  throw new ValidationError(message, { fieldErrors: { [field]: message } });
}
