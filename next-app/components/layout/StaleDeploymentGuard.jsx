'use client';

import { useEffect } from 'react';

import { isStaleActionError, reloadForNewDeployment } from '@/lib/staleDeployment.js';

/**
 * Catches a Server Action call from a tab older than the current deployment —
 * wherever it was made — and reloads to pick up the new build.
 * See `src/lib/staleDeployment.js`.
 */
export function StaleDeploymentGuard() {
  useEffect(() => {
    const onRejection = (event) => {
      if (isStaleActionError(event.reason)) {
        event.preventDefault();
        reloadForNewDeployment();
      }
    };
    const onError = (event) => {
      if (isStaleActionError(event.error ?? event.message)) reloadForNewDeployment();
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
