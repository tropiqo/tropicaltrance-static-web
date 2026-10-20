import { build } from 'astro';
import { fileURLToPath } from 'node:url';
import { loadRelease } from './public-inputs.mjs';
import { checkReviewOutput } from './check-review.mjs';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareTrancyReview } from './prepare-trancy-review.mjs';
import { loadTrancyReview } from './trancy-review-release.mjs';
import { trancyReviewSelection as selected } from './trancy-review-identity.mjs';
const root = new URL('../', import.meta.url);
loadRelease({ review: true });
// The explicit local review command may prepare missing preview bytes; never repair drift.
if (!existsSync(selected.path)) await prepareTrancyReview();
loadTrancyReview();
process.env.ASTRO_TELEMETRY_DISABLED = '1';
await build({ root: fileURLToPath(root), configFile: false, output: 'static', trailingSlash: 'always', build: { format: 'directory' }, publicDir: './tests/fixtures/public-inputs/assets', outDir: './.review-build', cacheDir: './.review-cache', devToolbar: { enabled: false }, vite: { resolve: { alias: { '#public-release': fileURLToPath(new URL('./fixture-release.mjs', import.meta.url)) } } } });
// This file never enters publicDir. Emit only the separately selected, digest-checked review delivery.
loadTrancyReview();
mkdirSync(resolve('.review-build', 'review-media'), { recursive: true });
copyFileSync(selected.path, resolve('.review-build', selected.outputPath));
mkdirSync(resolve('.review-build', 'assets'), { recursive: true });
copyFileSync(resolve('public-astro/assets/language-preference.js'), resolve('.review-build/assets/language-preference.js'));
await checkReviewOutput();
console.log('LOCAL MASCOT REVIEW ONLY + INTERNAL SYNTHETIC Flavor examples: isolated review build PASS');
