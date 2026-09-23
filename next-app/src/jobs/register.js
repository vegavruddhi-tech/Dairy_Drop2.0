/**
 * Register the alias resolver, then hand control back to Node.
 *
 * Used as `node --import ./src/jobs/register.js …` so the hook is installed
 * before the entry module is loaded — a hook registered from inside the entry
 * module would be too late for that module's own imports.
 *
 * The `jobs:*` scripts also pass `--conditions=react-server`, which is what
 * makes `import 'server-only'` resolve to that package's empty module instead
 * of the one that throws. The guard is there to stop server code reaching a
 * client bundle; a CLI job is a legitimate server consumer.
 */

import module from 'node:module';
import { pathToFileURL } from 'node:url';

import { resolve } from './alias-hook.js';

/*
 * `registerHooks` is the current API and runs the hook in-thread; `register`
 * is deprecated and warns on every job run. `registerHooks` only exists from
 * Node 22.15, and package.json still allows Node 20, so prefer it and fall
 * back rather than dropping a supported runtime.
 */
if (typeof module.registerHooks === 'function') {
  module.registerHooks({ resolve });
} else {
  module.register('./alias-hook.js', pathToFileURL(import.meta.filename));
}
