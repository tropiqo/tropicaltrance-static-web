import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apparelProducts, apparelMedia, validateApparelProducts } from '../src/data/apparel-products.mjs';

test('hoodie and T-shirt concept images are owner-approved local assets pinned to a closed bilingual inventory', () => {
  assert.equal(validateApparelProducts(), true);
  assert.deepEqual(apparelProducts.map(product => product.id), ['hoodie', 'tshirt']);
  assert.equal(apparelProducts[0].artwork.kind, 'owner-approved-concept-images');
  assert.equal(apparelProducts[0].artwork.ownerApproved, true);
  assert.equal(apparelProducts[1].artwork.kind, 'owner-approved-concept-images');
  assert.equal(apparelProducts[1].artwork.ownerApproved, true);
  assert.equal(apparelMedia.length, 9);
  for (const image of apparelMedia) {
    assert.match(image.path, /^assets\/apparel\/(hoodie\/[a-z0-9-]+|tshirt\/[A-Za-z0-9-]+)\.png$/);
    assert.match(image.contentId, /^sha256:[a-f0-9]{64}$/);
    assert(image.alt.en && image.alt['es-MX']);
  }
  const unexpectedAsset = structuredClone(apparelProducts);
  unexpectedAsset[0].artwork.images[0].path = 'assets/apparel/hoodie/unreviewed.png';
  assert.throws(() => validateApparelProducts(unexpectedAsset), /exact local asset inventory/);
  assert.equal(apparelProducts[1].artwork.images.length, 4);
});

test('bilingual apparel routes show both concept galleries without commerce UI', () => {
  for (const [path, heading, conceptLabel] of [
    ['dist/apparel/index.html', 'Apparel Concepts', 'Concept preview'],
    ['dist/es/apparel/index.html', 'Conceptos de ropa', 'Vista previa conceptual'],
  ]) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, new RegExp(`<h1\\b[^>]*>${heading}<\\/h1>`));
    assert.equal((html.match(/<svg\b/g) || []).length, 0);
    assert.equal((html.match(/<img\b/g) || []).length, apparelMedia.length * 2);
    for (const image of apparelMedia) assert(html.includes(`src="/${image.path}"`));
    assert.equal((html.match(new RegExp(conceptLabel, 'g')) || []).length, 2);
    assert(!/<a\b[^>]*href="\/assets\/apparel\/hoodie\//i.test(html));
    assert(!/<(?:form|input)\b/i.test(html));
    assert.equal((html.match(/<dialog\b/g)||[]).length,apparelMedia.length);
    assert.equal((html.match(/command="show-modal"/g)||[]).length,apparelMedia.length);
    assert.equal((html.match(/data-carousel-step=/g)||[]).length,apparelMedia.length*2);
    assert.equal((html.match(/<script type="module" src="\/assets\/scripts\/apparel-image-carousel\.js"><\/script>/g)||[]).length,1);
    assert(!/add to cart|price|pricing|size picker|stock|inventory|wa\.me|whatsapp\.com|<script>(?!\s*<\/script>)/i.test(html));
  }
});
