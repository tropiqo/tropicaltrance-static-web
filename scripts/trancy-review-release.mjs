import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import { loadRelease, inventory, digest, safePath } from './public-inputs.mjs';
import { trancyReviewSelection as selected } from './trancy-review-identity.mjs';

export function loadTrancyReview(base = process.cwd()) {
  // Keep real mascot review separate from the unchanged synthetic Flavor assumptions.
  const release = loadRelease({ base, review: true });
  assert.deepEqual(inventory(base, 'review-assets'), [selected.path], 'Unlisted local review media');
  const path = safePath(base, selected.path);
  assert(lstatSync(path).isFile(), 'Expected regular review asset');
  const bytes = readFileSync(path);
  assert.equal(digest(bytes), selected.contentId, 'Local review media digest mismatch');
  assert.equal(bytes.length, selected.size);
  assert(!release.deliveries.some(m => m.asset.contentId === selected.contentId), 'Mascot must not enter Flavor fixtures');
  const view = Object.freeze({ mediaUrl: '/' + selected.outputPath, alt: selected.alt, width: selected.width, height: selected.height });
  return { ...release, brandMedia: Object.fromEntries(selected.roles.map(role => [role, view])) };
}
