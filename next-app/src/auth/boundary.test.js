/**
 * Server→client boundary tests.
 *
 * React cannot serialize a function across the server→client boundary. The
 * `ActorContext` carries `can()` and `scope()`, so handing one to a
 * `'use client'` component throws at runtime — a failure that neither
 * `next build` nor an HTTP route check can see, because it only happens while
 * rendering a signed-in page.
 *
 * These tests encode the contract instead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { toViewer } from './session.js';
import { ROLES, roleHas, scopeFor } from './roles.js';

/** A representative actor, shaped exactly as `buildActor` produces one. */
function makeActor(role = ROLES.MILKMAN) {
  return {
    userId: 'aaaaaaaa-0000-0000-0000-000000000001',
    clerkId: 'user_abc123',
    email: 'someone@example.com',
    name: 'Someone',
    role,
    tenantId: 'aaaaaaaa-0000-0000-0000-000000000001',
    approvalStatus: null,
    isVerified: true,
    isActive: true,
    can: (p) => roleHas(role, p),
    scope: (p) => scopeFor(role, p),
  };
}

/** Everything React would try to serialize, recursively. */
function findFunctions(value, path = '') {
  if (typeof value === 'function') return [path || '<root>'];
  if (value === null || typeof value !== 'object') return [];
  if (value instanceof Date) return [];
  return Object.entries(value).flatMap(([key, v]) =>
    findFunctions(v, path ? `${path}.${key}` : key),
  );
}

describe('server → client boundary', () => {
  it('a raw actor is NOT serializable — this is why toViewer exists', () => {
    const actor = makeActor();
    // If this ever becomes empty, the actor has stopped carrying its methods
    // and the permission checks are broken.
    expect(findFunctions(actor).sort()).toEqual(['can', 'scope']);
  });

  it('toViewer produces something React can serialize', () => {
    const viewer = toViewer(makeActor());
    expect(findFunctions(viewer)).toEqual([]);
    expect(() => structuredClone(viewer)).not.toThrow();
    expect(JSON.parse(JSON.stringify(viewer))).toEqual(viewer);
  });

  it('toViewer exposes display fields only — no ids, no permission surface', () => {
    const viewer = toViewer(makeActor());
    expect(Object.keys(viewer).sort()).toEqual(['email', 'name', 'role']);
    // A client component must not be able to make authorization decisions.
    expect(viewer).not.toHaveProperty('userId');
    expect(viewer).not.toHaveProperty('tenantId');
    expect(viewer).not.toHaveProperty('clerkId');
    expect(viewer).not.toHaveProperty('can');
  });

  it('toViewer handles a signed-out actor', () => {
    expect(toViewer(null)).toBeNull();
  });

  it('no layout hands a raw actor to AppShell', () => {
    // AppShell forwards `user` to <MoreMenu>, which is a client component.
    const root = new URL('../../app', import.meta.url).pathname;

    const walk = (dir) =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });

    const offenders = walk(root)
      .filter((f) => f.endsWith('layout.js'))
      .filter((f) => /user=\{actor\}/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length + 1));

    expect(offenders).toEqual([]);
  });
});
