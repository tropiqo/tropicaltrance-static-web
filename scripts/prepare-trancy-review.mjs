import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { digest, safePath } from './public-inputs.mjs';
import { trancyReviewSelection as selected } from './trancy-review-identity.mjs';

export async function transformTrancyReview(master) {
  assert.equal(digest(master), selected.masterContentId, 'Canonical Trancy master SHA-256 mismatch');
  for (const [tool, version] of Object.entries(selected.tools)) assert.equal(sharp.versions[tool], version, 'Review image toolchain drift');
  const source = await sharp(master).metadata();
  assert.equal(source.width, 5386); assert.equal(source.height, 4795); assert.equal(source.format, 'png');
  // Full-frame resize only: no crop, recolor, flatten, rotate or generative processing.
  const output = await sharp(master).resize(selected.resize).webp(selected.webp).toBuffer();
  assert.equal(digest(output), selected.contentId, 'Review derivative identity drift');
  assert.equal(output.length, selected.size);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, selected.width); assert.equal(metadata.height, selected.height);
  assert.equal(metadata.hasAlpha, source.hasAlpha); assert.equal(metadata.format, 'webp');
  return output;
}

export async function prepareTrancyReview(base = process.cwd()) {
  const source = safePath(base, selected.masterPath);
  const master = readFileSync(source);
  assert.equal(digest(master), selected.masterContentId, 'Canonical Trancy master SHA-256 mismatch');
  if (existsSync(resolve(base, selected.path))) {
    const bytes = readFileSync(safePath(base, selected.path));
    assert.equal(digest(bytes), selected.contentId, 'Existing review asset drift; refusing overwrite');
    assert.equal(bytes.length, selected.size);
    return selected;
  }
  const output = await transformTrancyReview(master);
  mkdirSync(resolve(base, 'review-assets'), { recursive: true });
  safePath(base, 'review-assets');
  if (existsSync(resolve(base, selected.path))) {
    assert.equal(digest(readFileSync(safePath(base, selected.path))), selected.contentId, 'Existing review asset drift; refusing overwrite');
  } else writeFileSync(resolve(base, selected.path), output, { flag: 'wx' });
  assert.equal(digest(readFileSync(source)), selected.masterContentId, 'Original changed during preparation');
  return selected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareTrancyReview();
  console.log(`LOCAL MASCOT REVIEW ONLY: ${selected.path}, ${selected.width}x${selected.height}, ${selected.size} bytes, ${selected.contentId}`);
}
