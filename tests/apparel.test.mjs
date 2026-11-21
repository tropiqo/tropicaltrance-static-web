import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apparelProducts, apparelMedia, validateApparelProducts } from '../src/data/apparel-products.mjs';

test('hoodie concept images are owner-approved local assets pinned to a closed bilingual inventory', () => {
  assert.equal(validateApparelProducts(), true);
  assert.deepEqual(apparelProducts.map(product => product.id), ['hoodie', 'tshirt']);
  assert.equal(apparelProducts[0].artwork.kind, 'owner-approved-concept-images');
  assert.equal(apparelProducts[0].artwork.ownerApproved, true);
  assert.equal(apparelMedia.length, 5);
  for (const image of apparelMedia) {
    assert.match(image.path, /^assets\/apparel\/hoodie\/[a-z0-9-]+\.png$/);
    assert.match(image.contentId, /^sha256:[a-f0-9]{64}$/);
    assert(image.alt.en && image.alt['es-MX']);
  }
  const unexpectedAsset = structuredClone(apparelProducts);
  unexpectedAsset[0].artwork.images[0].path = 'assets/apparel/hoodie/unreviewed.png';
  assert.throws(() => validateApparelProducts(unexpectedAsset), /exact local asset inventory/);
  assert.equal(apparelProducts[1].artwork.ownerApproved, false);
});

test('bilingual apparel routes show the hoodie gallery and T-shirt outline without commerce UI', () => {
  for (const [path, heading, conceptLabel] of [
    ['dist/apparel/index.html', 'Apparel Concepts', 'Concept preview'],
    ['dist/es/apparel/index.html', 'Conceptos de ropa', 'Vista previa conceptual'],
  ]) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, new RegExp(`<h1\\b[^>]*>${heading}<\\/h1>`));
    assert.equal((html.match(/<svg\b/g) || []).length, 1);
    assert.equal((html.match(/<img\b/g) || []).length, apparelMedia.length);
    for (const image of apparelMedia) assert(html.includes(`src="/${image.path}"`));
    assert.equal((html.match(new RegExp(conceptLabel, 'g')) || []).length, 2);
    assert(!/<(?:button|form|input)\b/i.test(html));
    assert(!/add to cart|price|pricing|size picker|stock|inventory|wa\.me|whatsapp\.com|<script[^>]*apparel/i.test(html));
  }
});
