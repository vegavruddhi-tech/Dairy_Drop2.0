'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LOCALE_COOKIE, isLocale } from '@/i18n/config.js';

/**
 * Switch the interface language.
 *
 * Deliberately *not* a `defineAction`: language is a display preference, not a
 * privileged operation. It needs no session, so a signed-out visitor on the
 * pricing page can switch too — which the old apps allowed and is right.
 *
 * The cookie is the source of truth so the server renders the correct language
 * on the very first paint. The old apps kept it in `localStorage`, which meant
 * every page flashed English before React hydrated and corrected it.
 */
export async function setLocale(locale) {
  if (!isLocale(locale)) {
    return { ok: false, message: 'Unsupported language.' };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Readable by the server on every request; nothing secret in it.
    httpOnly: false,
  });

  // Every rendered page holds translated strings, so all of it is now stale.
  revalidatePath('/', 'layout');

  return { ok: true, locale };
}
