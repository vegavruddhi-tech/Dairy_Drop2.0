/**
 * Recovering from a deploy that happened while the page was open.
 *
 * Server Actions are called by an id that is baked into the page's JavaScript
 * and changes with every build. A tab loaded before a deploy still holds the
 * old ids; when it calls one, the new deployment has no such action and
 * answers `POST /… 404` ("Server Action … was not found on the server"). The
 * button just seems dead.
 *
 * The only cure is fresh JavaScript, so reload once. A timestamp in
 * sessionStorage stops a genuinely missing action from reload-looping.
 */

const KEY = 'dairydrop:stale-reload';

export function isStaleActionError(error) {
  const text = String(error?.message ?? error ?? '');
  return /Server Action .* (was )?not found|Failed to find Server Action|UnrecognizedActionError/i.test(text);
}

export function reloadForNewDeployment() {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload, the 30s guard is a nicety.
  }
  window.location.reload();
  return true;
}
