const hoodieConceptImages = Object.freeze([
  Object.freeze({
    path: 'assets/apparel/hoodie/hoodie-back-hood-wordmark.png',
    contentId: 'sha256:100f18d0de110b645454baa3b715eff8fc0bb3081c48ec62e15cc80300fb284a',
    width: 1312, height: 1199,
    alt: Object.freeze({
      en: 'Back of a black hoodie with white Gothic Tropical Trance lettering across the hood.',
      'es-MX': 'Parte trasera de una sudadera negra con letras góticas blancas de Tropical Trance en la capucha.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/hoodie/hoodie-front-small-tt-mark.png',
    contentId: 'sha256:1e0fb22ef0e4b13851384fc91d143629ca7779f2cf486f4176aef72d5f1bcc42',
    width: 1312, height: 1199,
    alt: Object.freeze({
      en: 'Front of a black hoodie with a small white TT mark.',
      'es-MX': 'Frente de una sudadera negra con una pequeña marca TT blanca.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/hoodie/hoodie-hood-detail-angle.png',
    contentId: 'sha256:29c3b20e8ddac634b2daa686b162cba5748862ccd5d5f4323923511dd8d96203',
    width: 1312, height: 1199,
    alt: Object.freeze({
      en: 'Angled close-up of white Gothic Tropical Trance lettering on a black hoodie hood.',
      'es-MX': 'Acercamiento en ángulo de las letras góticas blancas de Tropical Trance en una capucha negra.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/hoodie/hoodie-hood-detail-closeup.png',
    contentId: 'sha256:0a26f525a6eb6f73a246e5d5816eeb7fd53972d362505c84d37b8b2bc2436137',
    width: 1536, height: 1024,
    alt: Object.freeze({
      en: 'Close-up of white Gothic Tropical Trance lettering across a black hoodie hood.',
      'es-MX': 'Acercamiento a las letras góticas blancas de Tropical Trance sobre una capucha negra.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/hoodie/hoodie-front-hood-wordmark.png',
    contentId: 'sha256:522cfc1024a5d3f49818abf7709bd913572410b2aad5ad6b0aa860d2ec08e980',
    width: 1003, height: 1568,
    alt: Object.freeze({
      en: 'Front view of a black hoodie with upside-down white Tropical Trance lettering on the hood and a white TT chest mark.',
      'es-MX': 'Frente de una sudadera negra con letras blancas invertidas de Tropical Trance en la capucha y una marca TT blanca en el pecho.',
    }),
  }),
]);

const conceptArtwork = Object.freeze({
  kind: 'inline-svg-concept',
  sourcePath: null,
  contentId: null,
  alt: Object.freeze({ en: null, 'es-MX': null }),
  ownerApproved: false,
});

// Owner approval here covers display of these user-provided mockups as concepts only,
// not production, sale, publication, or approval of garment specifications.
const hoodieArtwork = Object.freeze({
  kind: 'owner-approved-concept-images',
  ownerApproved: true,
  images: hoodieConceptImages,
});

export const apparelProducts = Object.freeze([
  Object.freeze({ id: 'hoodie', visual: 'hoodie-concept-gallery', artwork: hoodieArtwork }),
  Object.freeze({ id: 'tshirt', visual: 'tshirt-outline', artwork: conceptArtwork }),
]);

export const apparelMedia = Object.freeze(hoodieConceptImages);

const expectedProducts = Object.freeze(['hoodie', 'tshirt']);
const expectedArtwork = new Map([
  ['hoodie', JSON.stringify(hoodieArtwork)],
  ['tshirt', JSON.stringify(conceptArtwork)],
]);

export function validateApparelProducts(products = apparelProducts) {
  if (!Array.isArray(products) || JSON.stringify(products.map(product => product.id)) !== JSON.stringify(expectedProducts)) {
    throw new Error('Apparel concept set must contain exactly one hoodie and one T-shirt');
  }
  for (const product of products) {
    const visualAllowed = product.id === 'hoodie'
      ? product.visual === 'hoodie-concept-gallery'
      : product.visual === 'tshirt-outline';
    if (!visualAllowed || JSON.stringify(product.artwork) !== expectedArtwork.get(product.id)) {
      throw new Error('Apparel media requires an exact local asset inventory and owner-approved concept state');
    }
  }
  return true;
}

validateApparelProducts();
