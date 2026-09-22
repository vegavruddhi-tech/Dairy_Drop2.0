/**
 * Renders the real app shell and inspects what actually crosses the
 * server→client boundary.
 *
 * The serializability unit tests assert the *contract*; this asserts the
 * *call site*. It invokes `AppShell` exactly as a layout does and walks the
 * returned element tree looking for props React would refuse to serialize.
 *
 * This is the test that would have caught "Functions cannot be passed directly
 * to Client Components" before it reached a browser.
 */

import { describe, it, expect } from 'vitest';

import { AppShell } from './AppShell.jsx';
import { MoreMenu, NavLink } from './Nav.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { toViewer } from '@/auth/session.js';
import { ROLES, roleHas, scopeFor } from '@/auth/roles.js';

/** An actor shaped exactly as `buildActor` produces one. */
function makeActor(role = ROLES.ADMIN) {
  return {
    userId: 'aaaaaaaa-0000-0000-0000-000000000001',
    clerkId: 'user_abc',
    email: 'admin@example.com',
    name: 'Admin Person',
    role,
    tenantId: null,
    approvalStatus: null,
    isVerified: true,
    isActive: true,
    can: (p) => roleHas(role, p),
    scope: (p) => scopeFor(role, p),
  };
}

/** Depth-first walk of a React element tree. */
function* walk(node) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (node.type !== undefined) {
    yield node;
    yield* walk(node.props?.children);
  }
}

/** Prop paths holding a function — what React cannot serialize. */
function functionProps(props, path = '') {
  if (typeof props === 'function') return [path];
  if (props === null || typeof props !== 'object') return [];
  if (props.$$typeof || props instanceof Date) return []; // nested elements are fine
  return Object.entries(props).flatMap(([key, value]) =>
    key === 'children' ? [] : functionProps(value, path ? `${path}.${key}` : key),
  );
}

const NAV = [{ href: '/admin', label: 'Overview', icon: '📊', exact: true }];
const MORE = [{ href: '/admin/settings', label: 'Settings', icon: '⚙️' }];

describe('AppShell boundary', () => {
  it('renders without throwing', () => {
    const actor = makeActor();
    expect(() =>
      AppShell({ nav: NAV, more: MORE, user: toViewer(actor), title: 'Admin', children: null }),
    ).not.toThrow();
  });

  it('passes MoreMenu nothing React would refuse to serialize', () => {
    const tree = AppShell({
      nav: NAV,
      more: MORE,
      user: toViewer(makeActor()),
      title: 'Admin',
      children: null,
    });

    const menus = [...walk(tree)].filter((n) => n.type === MoreMenu);
    expect(menus.length).toBeGreaterThan(0);

    for (const menu of menus) {
      expect(functionProps(menu.props)).toEqual([]);
      expect(() => structuredClone({ ...menu.props, children: undefined })).not.toThrow();
    }
  });

  it('would have caught the original bug', () => {
    // Passing the raw actor is exactly what threw in the browser.
    const tree = AppShell({
      nav: NAV,
      more: MORE,
      user: makeActor(), // ← the mistake
      title: 'Admin',
      children: null,
    });

    const menu = [...walk(tree)].find((n) => n.type === MoreMenu);
    expect(functionProps(menu.props).sort()).toEqual(['user.can', 'user.scope']);
  });

  it('offers the language toggle in the chrome', () => {
    // Someone who cannot read the current language needs to find this without
    // reading anything — so it must be present, not buried behind a setting.
    const tree = AppShell({
      nav: NAV, more: MORE, user: toViewer(makeActor()), title: 'Admin', children: null,
    });

    const toggles = [...walk(tree)].filter((n) => n.type === LanguageToggle);
    // One in the desktop sidebar, one in the mobile header.
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    for (const toggle of toggles) expect(functionProps(toggle.props)).toEqual([]);
  });

  it('every NavLink prop is serializable', () => {
    const tree = AppShell({
      nav: NAV,
      more: MORE,
      user: toViewer(makeActor()),
      title: 'Admin',
      children: null,
    });

    const links = [...walk(tree)].filter((n) => n.type === NavLink);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(functionProps(link.props)).toEqual([]);
  });
});
