const conceptArtwork = Object.freeze({
  kind: 'inline-svg-concept',
  sourcePath: null,
  contentId: null,
  alt: Object.freeze({ en: null, 'es-MX': null }),
  ownerApproved: false,
});

export const apparelProducts = Object.freeze([
  Object.freeze({ id: 'hoodie', visual: 'hoodie-outline', artwork: conceptArtwork }),
  Object.freeze({ id: 'tshirt', visual: 'tshirt-outline', artwork: conceptArtwork }),
]);

const expectedProducts = Object.freeze(['hoodie', 'tshirt']);
const expectedArtwork = JSON.stringify(conceptArtwork);

export function validateApparelProducts(products = apparelProducts) {
  if (!Array.isArray(products) || JSON.stringify(products.map(product => product.id)) !== JSON.stringify(expectedProducts)) {
    throw new Error('Apparel concept set must contain exactly one hoodie and one T-shirt');
  }
  for (const product of products) {
    if (!['hoodie-outline', 'tshirt-outline'].includes(product.visual) || JSON.stringify(product.artwork) !== expectedArtwork) {
      throw new Error('Apparel media is concept-only until owner approval and an explicit local asset inventory are added');
    }
  }
  return true;
}

// Product artwork is intentionally locked to inline concept outlines. A future approved asset
// must add its local path, SHA-256, and bilingual alt text to a closed inventory before rendering.
validateApparelProducts();
