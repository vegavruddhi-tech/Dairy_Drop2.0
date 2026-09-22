/**
 * Locale configuration and the translation lookup.
 *
 * Pure — no cookies, no React, no Next. Both the server helper and the client
 * provider build on this, so there is one definition of what `t()` means.
 *
 * ## Why not i18next
 *
 * The catalogs are 482 strings in a flat nested object, resolved server-side in
 * the overwhelming majority of cases. i18next would add a runtime, a plugin
 * chain and a hydration story for a lookup that is four lines of code. The part
 * worth borrowing from a library — interpolation and a missing-key policy — is
 * here.
 *
 * ## The rule the old apps broke
 *
 * Those apps had ~350 keys per locale *and* 1,033 inline
 * `language === 'hi' ? … : …` ternaries scattered through the components. The
 * ternaries tested only for Hindi, so Gujarati speakers silently got English
 * for most of the interface. Every user-facing string goes through `t()` here.
 */

import { en } from './locales/en.js';
import { hi } from './locales/hi.js';
import { gu } from './locales/gu.js';

export const LOCALES = Object.freeze(['en', 'hi', 'gu']);
export const DEFAULT_LOCALE = 'en';

/** Shown in the toggle — each language named in its own script. */
export const LOCALE_NAMES = Object.freeze({
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
});

/** Two-letter chip label for the compact toggle. */
export const LOCALE_SHORT = Object.freeze({ en: 'EN', hi: 'हि', gu: 'ગુ' });

/** Locales that need the Devanagari/Gujarati face rather than the Latin one. */
export const INDIC_LOCALES = Object.freeze(['hi', 'gu']);

const DICTIONARIES = Object.freeze({ en, hi, gu });

/** The cookie the locale lives in. Readable by the server on every request. */
export const LOCALE_COOKIE = 'dairydrop_locale';

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function normaliseLocale(value) {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale) {
  return DICTIONARIES[normaliseLocale(locale)];
}

/**
 * Resolve a dotted path against a dictionary.
 * @returns {string|undefined}
 */
function resolve(dictionary, path) {
  let node = dictionary;
  for (const segment of path.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replace `{name}` placeholders. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined ? match : String(params[key]),
  );
}

/**
 * Build a translator bound to one locale.
 *
 * Missing keys fall back to English, then to an explicit default, then to the
 * key itself — so a gap degrades to readable English rather than a blank space.
 * In development the miss is logged, which is how a missing translation gets
 * noticed before a user finds it.
 *
 * @param {string} locale
 * @returns {(path: string, params?: object, fallback?: string) => string}
 */
export function createTranslator(locale) {
  const active = normaliseLocale(locale);
  const dictionary = DICTIONARIES[active];

  return function t(path, params, fallback) {
    const hit = resolve(dictionary, path);
    if (hit !== undefined) return interpolate(hit, params);

    const english = active === DEFAULT_LOCALE ? undefined : resolve(en, path);
    if (english !== undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] missing "${path}" for ${active}; using English`);
      }
      return interpolate(english, params);
    }

    if (fallback !== undefined) return interpolate(fallback, params);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] unknown key "${path}"`);
    }
    return path;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Locale-aware formatting
//
// Ported from the old `i18n/formatters.ts`.
// ─────────────────────────────────────────────────────────────────────────────

const GREETINGS = {
  morning: { en: 'Good morning', hi: 'शुभ प्रभात', gu: 'સુપ્રભાત' },
  afternoon: { en: 'Good afternoon', hi: 'शुभ दोपहर', gu: 'શુભ બપોર' },
  evening: { en: 'Good evening', hi: 'शुभ संध्या', gu: 'શુભ સાંજ' },
};

/** Time-of-day greeting in the active language. */
export function greetingFor(locale, hour) {
  const key = hour >= 4 && hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return GREETINGS[key][normaliseLocale(locale)];
}

/** BCP-47 tag for `Intl`. All three use Indian regional conventions. */
export function intlLocale(locale) {
  return { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' }[normaliseLocale(locale)];
}
