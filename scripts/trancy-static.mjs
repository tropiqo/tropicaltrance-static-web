import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Owner-approved static artwork. This pin grants no Flavor permission or deployment authority.
export const trancy = Object.freeze({
  path: 'public-astro/assets/trancy-web-r1.webp',
  contentId: 'sha256:93fdea06b6b6c7bc496f56a8f0df331213b0ef1fdfeb6b8cfbfd865f657bb658',
  size: 542380, width: 1440, height: 1282,
  alt: 'Trancy, the green Tropical Trance chameleon, with sunglasses and a tropical drink.',
});
export const trancyMedia = Object.freeze({
  mediaUrl: '/assets/trancy-web-r1.webp', alt: trancy.alt, width: trancy.width, height: trancy.height,
});
export function validateTrancy(bytes) {
  assert.equal(bytes.length, trancy.size, 'Static Trancy byte size mismatch');
  assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), trancy.contentId, 'Static Trancy digest mismatch');
}
