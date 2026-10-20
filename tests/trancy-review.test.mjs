import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { trancy, trancyMedia } from '../scripts/trancy-static.mjs';
import { trancyReviewSelection as selected } from '../scripts/trancy-review-identity.mjs';
import { loadTrancyReview } from '../scripts/trancy-review-release.mjs';
import { loadRelease, digest, rejectFixture } from '../scripts/public-inputs.mjs';
const root = process.cwd();

function sandbox(fn) {
  const base = mkdtempSync(join(tmpdir(), 'tt-trancy-'));
  try {
    for (const path of ['schemas', 'content', 'tests/fixtures', 'review-assets', 'public-astro']) cpSync(resolve(root, path), resolve(base, path), { recursive: true });
    mkdirSync(resolve(base, 'public-astro/assets'), { recursive: true });
    return fn(base);
  } finally { rmSync(base, { recursive: true, force: true }); }
}

test('exact master and existing derivative identity are preserved without regeneration', async () => {
  const original = readFileSync(resolve(root, selected.masterPath));
  const bytes = readFileSync(resolve(root, selected.path));
  assert.equal(digest(original), selected.masterContentId);
  assert.equal(digest(bytes), selected.contentId);
  const master = await sharp(original).metadata(), output = await sharp(bytes).metadata();
  assert.equal(master.width, 5386); assert.equal(master.height, 4795);
  assert.equal(output.width, selected.width); assert.equal(output.height, selected.height);
  assert.equal(output.hasAlpha, true); assert.equal(output.format, 'webp');
  assert.deepEqual(readFileSync(resolve(root, selected.masterPath)), original);
});
test('one explicitly selected immutable delivery is shared across exactly Home and About; Flavor rules unchanged', () => {
  const preview = loadTrancyReview();
  assert.deepEqual(Object.keys(preview.brandMedia), ['home-hero', 'about-mascot']);
  assert.equal(preview.brandMedia['home-hero'], preview.brandMedia['about-mascot']);
  assert.equal(preview.brandMedia['home-hero'].mediaUrl, '/' + selected.outputPath);
  assert.match(preview.brandMedia['home-hero'].alt, /Trancy.*green.*chameleon.*sunglasses/);
  const flavors = loadRelease({ review: true });
  assert.deepEqual(preview.flavors, flavors.flavors); assert.deepEqual(preview.deliveries, flavors.deliveries);
  assert.deepEqual(loadRelease().flavors.map(f=>f.slug), ['grape']); assert.equal(loadRelease().deliveries.length, 1);
});
test('missing, changed, stray or symlinked local review media fails closed', () => {
  sandbox(base => { rmSync(resolve(base, selected.path)); assert.throws(() => loadTrancyReview(base)); });
  sandbox(base => { writeFileSync(resolve(base, selected.path), 'changed'); assert.throws(() => loadTrancyReview(base), /digest mismatch/); });
  sandbox(base => { writeFileSync(resolve(base, 'review-assets/extra.webp'), 'stray'); assert.throws(() => loadTrancyReview(base), /Unlisted/); });
  sandbox(base => { rmSync(resolve(base, selected.path)); symlinkSync(resolve(root, selected.path), resolve(base, selected.path)); assert.throws(() => loadTrancyReview(base), /Symlink/); });
});
test('review derivative cannot enter normal publicDir or synthetic Flavor assets, even renamed', () => {
  const bytes = readFileSync(resolve(root, selected.path));
  assert.throws(() => rejectFixture(bytes));
  assert.throws(() => rejectFixture(Buffer.from(selected.contentId)));
  sandbox(base => { writeFileSync(resolve(base, 'public-astro/assets/renamed.webp'), bytes); assert.throws(() => loadRelease({ base })); });
  sandbox(base => { writeFileSync(resolve(base, 'tests/fixtures/public-inputs/assets/renamed.webp'), bytes); assert.throws(() => loadRelease({ base, review: true }), /Unlisted/); });
  sandbox(base => { writeFileSync(resolve(base, 'content/brand-media.json'), '{}'); assert.throws(() => loadRelease({ base }), /Unexpected input/); });
});
test('intact responsive presentation uses the approved static image without transformations', () => {
  const css = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');
  assert.match(css, /\.trancy-media \{[^}]*inline-size: 100%;[^}]*max-inline-size: 42rem;[^}]*min-inline-size: 0/);
  const rule = css.match(/\.trancy-media img \{([^}]+)\}/)[1];
  assert.match(rule, /block-size: auto/); assert.match(rule, /object-fit: contain/);
  assert(!/transform|filter|mask|clip|overflow/.test(rule));
  assert.match(css, /\.hero-grid--mascot \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  const component = readFileSync(resolve(root, 'src/components/TrancyMedia.astro'), 'utf8');
  assert.match(component, /alt=\{media.alt\}/); assert.match(component, /width=\{media.width\} height=\{media.height\}/);
  assert(!/astro:assets|srcset|fetch|readFile|fixture|selected\.path/.test(component));
  const normal = readFileSync(resolve(root, 'src/lib/normal-release.mjs'), 'utf8');
  assert.match(normal, /trancyMedia/);
  assert.equal(trancyMedia.alt, selected.alt); assert.equal(trancyMedia.width, selected.width);
  assert.equal(trancy.contentId, selected.contentId); assert(!/review-assets|loadTrancyReview|process\.env/.test(normal));
});
