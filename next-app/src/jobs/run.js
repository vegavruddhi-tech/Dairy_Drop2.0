/**
 * Run a job from the command line.
 *
 *   node src/jobs/run.js generate-deliveries
 *   node src/jobs/run.js backfill-deliveries --from 2026-09-01 --to 2026-09-05
 *   node src/jobs/run.js close-month --month 2026-08
 */

import 'dotenv/config';

const [, , jobName, ...rest] = process.argv;

const args = {};
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i]?.startsWith('--')) args[rest[i].slice(2)] = rest[i + 1];
}

const { JOBS } = await import('./index.js');

if (!jobName || !JOBS[jobName]) {
  console.error(`Unknown job: ${jobName ?? '(none)'}`);
  console.error(`Available: ${Object.keys(JOBS).join(', ')}`);
  process.exit(1);
}

try {
  const started = Date.now();
  const result = await JOBS[jobName](args);
  console.log(JSON.stringify({ ...result, ms: Date.now() - started }, null, 2));
  process.exit(0);
} catch (error) {
  console.error(`[${jobName}] failed:`, error);
  process.exit(1);
}
