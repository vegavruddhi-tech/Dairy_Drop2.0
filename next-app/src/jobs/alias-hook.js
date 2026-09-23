/**
 * Resolve the `@/` import aliases for plain Node.
 *
 * The aliases in `jsconfig.json` are understood by the bundler and the editor,
 * and by Vitest because `vitest.config.js` repeats them. Nothing repeated them
 * for `node`, so every `npm run jobs:*` script failed on the first import:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/domain'
 *
 * This is the third place the same map has to exist. Keep it in step with
 * `jsconfig.json` and `vitest.config.js`.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/**
 * Longest prefix first: '@/components' must be tried before '@/', or the bare
 * alias would swallow it and look for `src/components`.
 */
const ALIASES = [
  ['@/components/', path.join(root, 'components/')],
  ['@/app/', path.join(root, 'app/')],
  ['@/', path.join(root, 'src/')],
];

export function resolve(specifier, context, nextResolve) {
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      const resolved = pathToFileURL(path.join(target, specifier.slice(prefix.length))).href;
      return nextResolve(resolved, context);
    }
  }
  return nextResolve(specifier, context);
}
