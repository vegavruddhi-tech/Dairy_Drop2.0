/**
 * Server-side locale access.
 *
 * Reads the locale from a cookie, so a server component can translate without
 * any client round-trip and the very first paint is already in the right
 * language — no flash of English.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';

import {
  LOCALE_COOKIE,
  DEFAULT_LOCALE,
  createTranslator,
  getDictionary,
  normaliseLocale,
  greetingFor,
  INDIC_LOCALES,
} from './config.js';

/**
 * The active locale for this request, memoised.
 *
 * `cache()` dedupes across the render tree, so a layout and its pages share one
 * cookie read.
 */
export const getLocale = cache(async () => {
  const store = await cookies();
  return normaliseLocale(store.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
});

/**
 * A translator bound to this request's locale.
 *
 *   const t = await getT();
 *   <h1>{t('dashboard.todaysDelivery')}</h1>
 */
export const getT = cache(async () => createTranslator(await getLocale()));

/** The full dictionary, for handing to the client provider once per layout. */
export const getMessages = cache(async () => getDictionary(await getLocale()));

/** Time-of-day greeting in the active language. */
export async function getGreeting(hour) {
  return greetingFor(await getLocale(), hour);
}

/** `true` when the active locale needs the Indic font stack. */
export async function isIndic() {
  return INDIC_LOCALES.includes(await getLocale());
}
