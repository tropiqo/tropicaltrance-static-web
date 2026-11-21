import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apparelProducts, validateApparelProducts } from '../src/data/apparel-products.mjs';

test('apparel artwork stays in the explicit owner-approval concept state', () => {
  assert.equal(validateApparelProducts(), true);
  assert.deepEqual(apparelProducts.map(product => product.id), ['hoodie', 'tshirt']);
  for (const product of apparelProducts) {
    assert.deepEqual(product.artwork, {
      kind: 'inline-svg-concept', sourcePath: null, contentId: null,
      alt: { en: null, 'es-MX': null }, ownerApproved: false,
    });
  }
  const unapprovedAsset = structuredClone(apparelProducts);
  unapprovedAsset[0].artwork.ownerApproved = true;
  assert.throws(() => validateApparelProducts(unapprovedAsset), /owner approval and an explicit local asset inventory/);
});

test('bilingual apparel routes render only two labeled SVG concepts with no commerce UI', () => {
  for (const [path, heading, conceptLabel] of [
    ['dist/apparel/index.html', 'Apparel Concepts', 'Concept preview'],
    ['dist/es/apparel/index.html', 'Conceptos de ropa', 'Vista previa conceptual'],
  ]) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, new RegExp(`<h1\\b[^>]*>${heading}<\\/h1>`));
    assert.equal((html.match(/<svg\b/g) || []).length, 2);
    assert.equal((html.match(/<img\b/g) || []).length, 0);
    assert.equal((html.match(new RegExp(conceptLabel, 'g')) || []).length, 2);
    assert(!/<(?:button|form|input)\b/i.test(html));
    assert(!/add to cart|price|pricing|size picker|stock|inventory|wa\.me|whatsapp\.com|<script[^>]*apparel/i.test(html));
  }
});
