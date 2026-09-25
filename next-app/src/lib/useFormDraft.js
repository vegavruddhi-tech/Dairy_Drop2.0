'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Universal Hook for form draft persistence and rehydration.
 * Safely persists form states to localStorage so users don't lose filled data
 * across login/signup redirects, page refreshes, or accidental navigations.
 *
 * @param {string} storageKey - Unique localStorage key
 * @param {object} initialValues - Default values for the form state
 * @returns {{ draft: object, saveDraft: Function, clearDraft: Function, isRestored: boolean, setDraft: Function }}
 */
export function useFormDraft(storageKey, initialValues) {
  const [draft, setDraft] = useState(initialValues);
  const [isRestored, setIsRestored] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Rehydrate on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Merge with initialValues so new fields get defaults
          setDraft((prev) => ({ ...prev, ...parsed }));
          setIsRestored(true);
        }
      }
    } catch (e) {
      console.warn(`[useFormDraft] Failed to load draft for key "${storageKey}":`, e);
    } finally {
      setIsInitialized(true);
    }
  }, [storageKey]);

  // Persist draft updates to localStorage
  const saveDraft = useCallback(
    (updates) => {
      setDraft((prev) => {
        const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(next));
          }
        } catch (e) {
          console.warn(`[useFormDraft] Failed to save draft for key "${storageKey}":`, e);
        }
        return next;
      });
    },
    [storageKey],
  );

  // Clear draft from localStorage & reset state
  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn(`[useFormDraft] Failed to clear draft for key "${storageKey}":`, e);
    }
    setDraft(initialValues);
    setIsRestored(false);
  }, [storageKey, initialValues]);

  return { draft, saveDraft, clearDraft, isRestored, isInitialized, setDraft };
}
