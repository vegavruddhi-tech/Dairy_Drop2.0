/**
 * Domain errors.
 *
 * Services throw these; the HTTP and Server Action boundaries translate them
 * into status codes and user-facing messages. Nothing below the boundary knows
 * what an HTTP response is — that is what keeps the domain testable.
 *
 * Every error carries a stable machine-readable `code` so the client can branch
 * on it (for example, showing the upgrade prompt on CUSTOMER_LIMIT_REACHED
 * rather than a generic toast).
 */

export class DomainError extends Error {
  /**
   * @param {string} code    stable identifier, SCREAMING_SNAKE
   * @param {string} message safe to show a user
   * @param {object} [details] extra structured context for the UI
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON() {
    return { code: this.code, message: this.message, ...this.details };
  }
}

/** 400 — the request is malformed or violates a business rule. */
export class ValidationError extends DomainError {
  constructor(message, details = {}) {
    super('VALIDATION_FAILED', message, details);
    this.status = 400;
  }
}

/** 401 — not signed in. */
export class UnauthenticatedError extends DomainError {
  constructor(message = 'Please sign in to continue.') {
    super('UNAUTHENTICATED', message);
    this.status = 401;
  }
}

/** 403 — signed in, but not allowed. Covers both RBAC and scope violations. */
export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to do that.', details = {}) {
    super('FORBIDDEN', message, details);
    this.status = 403;
  }
}

/** 402 — the milkman's SaaS subscription does not permit this. */
export class SubscriptionRequiredError extends DomainError {
  constructor(gate, message) {
    super('SUBSCRIPTION_REQUIRED', message, { gate });
    this.status = 402;
  }
}

/** 404 — the row does not exist, or is outside the caller's scope. */
export class NotFoundError extends DomainError {
  constructor(what = 'That record') {
    super('NOT_FOUND', `${what} could not be found.`);
    this.status = 404;
  }
}

/** 409 — the request conflicts with current state. */
export class ConflictError extends DomainError {
  constructor(message, details = {}) {
    super('CONFLICT', message, details);
    this.status = 409;
  }
}

/** 409 — the milkman is at their plan's customer ceiling. */
export class CustomerLimitReachedError extends DomainError {
  constructor({ current, limit, planName }) {
    super(
      'CUSTOMER_LIMIT_REACHED',
      `You have reached your plan limit of ${limit} customers. Upgrade to add more.`,
      { current, limit, planName },
    );
    this.status = 409;
  }
}

/** 409 — someone else ordered the last of it first. */
export class InsufficientStockError extends DomainError {
  constructor({ productName, available, unit, requested }) {
    super(
      'INSUFFICIENT_STOCK',
      available > 0
        ? `Only ${available} ${unit} of ${productName} left.`
        : `${productName} is out of stock.`,
      { productName, available, unit, requested },
    );
    this.status = 409;
  }
}

/** 429 — too many requests. */
export class RateLimitedError extends DomainError {
  constructor(retryAfterSeconds = 60) {
    super('RATE_LIMITED', 'Too many attempts. Please try again shortly.', {
      retryAfterSeconds,
    });
    this.status = 429;
  }
}

/** True for errors that are safe to surface verbatim to a user. */
export function isDomainError(error) {
  return error instanceof DomainError;
}

/**
 * Normalise anything thrown into a safe, serialisable shape.
 * Unknown errors are deliberately opaque — never leak internals to a client.
 */
export function toErrorResponse(error) {
  if (isDomainError(error)) {
    return { status: error.status ?? 400, body: error.toJSON() };
  }
  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  };
}
