/**
 * Locale catalog tests.
 *
 * The old apps shipped three catalogs that had drifted apart, plus 1,033 inline
 * `language === 'hi' ? … : …` ternaries that bypassed them entirely. Because
 * those ternaries only ever tested for Hindi, Gujarati speakers silently got
 * English across most of the interface — a failure nobody could see without
 * reading Gujarati.
 *
 * These tests make that failure mode visible instead.
 */

import { describe, it, expect } from 'vitest';

import { en } from './locales/en.js';
import { hi } from './locales/hi.js';
import { gu } from './locales/gu.js';
import {
  LOCALES,
  LOCALE_NAMES,
  createTranslator,
  getDictionary,
  greetingFor,
  normaliseLocale,
} from './config.js';

/** Every leaf path in a nested catalog. */
function paths(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? paths(value, path) : [path];
  });
}

const CATALOGS = { en, hi, gu };

describe('locale catalogs', () => {
  it('ships all three languages', () => {
    expect(LOCALES).toEqual(['en', 'hi', 'gu']);
  });

  it('every catalog has exactly the same keys', () => {
    const reference = paths(en).sort();
    for (const locale of ['hi', 'gu']) {
      const actual = paths(CATALOGS[locale]).sort();
      const missing = reference.filter((k) => !actual.includes(k));
      const extra = actual.filter((k) => !reference.includes(k));
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it('carries a substantial catalog, not a stub', () => {
    expect(paths(en).length).toBeGreaterThan(400);
  });

  it('no value is an empty string', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const blank = paths(catalog).filter((p) => {
        const value = p.split('.').reduce((n, k) => n?.[k], catalog);
        return typeof value === 'string' && value.trim() === '';
      });
      expect({ locale, blank }).toEqual({ locale, blank: [] });
    }
  });

  it('Hindi and Gujarati are actually translated, not copied English', () => {
    // Navigation is the most visible surface; if it is still Latin the catalog
    // was never translated.
    const devanagari = /[ऀ-ॿ]/;
    const gujarati = /[઀-૿]/;

    expect(hi.nav.home).toMatch(devanagari);
    expect(hi.common.save).toMatch(devanagari);
    expect(gu.nav.home).toMatch(gujarati);
    expect(gu.common.save).toMatch(gujarati);
  });

  it('names each language in its own script', () => {
    expect(LOCALE_NAMES.en).toBe('English');
    expect(LOCALE_NAMES.hi).toMatch(/[ऀ-ॿ]/);
    expect(LOCALE_NAMES.gu).toMatch(/[઀-૿]/);
  });
});

describe('translator', () => {
  it('resolves a dotted path', () => {
    expect(createTranslator('en')('nav.home')).toBe('Home');
    expect(createTranslator('hi')('nav.home')).toBe(hi.nav.home);
    expect(createTranslator('gu')('nav.home')).toBe(gu.nav.home);
  });

  it('interpolates named parameters', () => {
    const t = createTranslator('en');
    const result = t('nonexistent.key', { count: 3 }, '{count} active plans');
    expect(result).toBe('3 active plans');
  });

  it('leaves an unmatched placeholder alone rather than printing undefined', () => {
    const t = createTranslator('en');
    expect(t('nope', {}, 'Hello {name}')).toBe('Hello {name}');
  });

  it('falls back to English before falling back to the key', () => {
    const t = createTranslator('hi');
    // Present in every catalog, so it resolves in Hindi.
    expect(t('nav.home')).toBe(hi.nav.home);
    // Absent everywhere → the supplied default.
    expect(t('totally.made.up', {}, 'Fallback')).toBe('Fallback');
    // Absent with no default → the key, which is at least diagnosable.
    expect(t('totally.made.up')).toBe('totally.made.up');
  });

  it('treats an unknown locale as English rather than throwing', () => {
    expect(normaliseLocale('fr')).toBe('en');
    expect(getDictionary('fr')).toBe(en);
    expect(createTranslator('fr')('nav.home')).toBe('Home');
  });

  it('never returns an object for a group path', () => {
    // `t('nav')` would otherwise render "[object Object]".
    expect(createTranslator('en')('nav')).toBe('nav');
  });
});

describe('greetings', () => {
  it('varies by time of day, in every language', () => {
    for (const locale of LOCALES) {
      const morning = greetingFor(locale, 8);
      const afternoon = greetingFor(locale, 14);
      const evening = greetingFor(locale, 20);
      expect(new Set([morning, afternoon, evening]).size).toBe(3);
    }
  });

  it('is written in the right script', () => {
    expect(greetingFor('hi', 8)).toMatch(/[ऀ-ॿ]/);
    expect(greetingFor('gu', 8)).toMatch(/[઀-૿]/);
    expect(greetingFor('en', 8)).toBe('Good morning');
  });
});
