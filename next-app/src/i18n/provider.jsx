'use client';

/**
 * Client-side locale access.
 *
 * Client components cannot read cookies during render, so the layout hands the
 * active dictionary down once and this context serves it. Only the active
 * locale is sent — roughly 21 KB for English, not all three.
 */

import { createContext, useContext, useMemo } from 'react';

import { createTranslator, DEFAULT_LOCALE } from './config.js';

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  messages: {},
  t: (path, params, fallback) => fallback ?? path,
});

export function LocaleProvider({ locale, messages, children }) {
  const value = useMemo(
    () => ({
      locale,
      messages,
      // Rebuilt from the dictionary handed down, not re-imported — so the
      // client bundle carries one locale rather than all three.
      t: createTranslatorFrom(locale, messages),
    }),
    [locale, messages],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Translate inside a client component.
 *
 *   const { t, locale } = useT();
 *   <button>{t('common.cancel')}</button>
 */
export function useT() {
  return useContext(LocaleContext);
}

/**
 * A translator over a dictionary that was passed in rather than imported.
 *
 * Mirrors `createTranslator` in config.js; the difference is that it cannot
 * fall back to the English catalog, because the client only ever holds one.
 * A miss degrades to the caller's default, then to the key.
 */
function createTranslatorFrom(locale, messages) {
  return function t(path, params, fallback) {
    let node = messages;
    for (const segment of path.split('.')) {
      if (node == null || typeof node !== 'object') {
        node = undefined;
        break;
      }
      node = node[segment];
    }

    const template = typeof node === 'string' ? node : (fallback ?? path);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, key) =>
      params[key] === undefined ? match : String(params[key]),
    );
  };
}
