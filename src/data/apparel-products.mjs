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

const tshirtConceptImages = Object.freeze([
  Object.freeze({
    path: 'assets/apparel/tshirt/Front-Side-T-Shirt.png',
    contentId: 'sha256:838107076c06a48d5d968ef127c0e405790f7630efb4bb3245659e8ddd32f49b',
    width: 1122, height: 1402,
    alt: Object.freeze({
      en: 'Front of a black T-shirt with a small Tropical Trance chest mark, pink flower, and green leaf.',
      'es-MX': 'Frente de una playera negra con una pequeña marca de Tropical Trance, una flor rosa y una hoja verde en el pecho.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/tshirt/Front-Side-2-T-Shirt.png',
    contentId: 'sha256:6772b398ad6da84a4af280e16fcf3f06630479b71806393f8f671ab2ab566ff7',
    width: 1122, height: 1402,
    alt: Object.freeze({
      en: 'Angled front view of a black T-shirt with a small Tropical Trance chest mark, pink flower, and green leaf.',
      'es-MX': 'Vista frontal en ángulo de una playera negra con una pequeña marca de Tropical Trance, una flor rosa y una hoja verde en el pecho.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/tshirt/Back-Side-T-Shirt.png',
    contentId: 'sha256:77954eaa3f61dc97264797a6d13b9c7ae0e58701ad22ab9673308b2bc5bdeb76',
    width: 1122, height: 1402,
    alt: Object.freeze({
      en: 'Back of a black T-shirt with large warm-white Gothic Tropical Trance lettering.',
      'es-MX': 'Parte trasera de una playera negra con letras góticas grandes en color crema de Tropical Trance.',
    }),
  }),
  Object.freeze({
    path: 'assets/apparel/tshirt/Back-Side-2-T-Shirt.png',
    contentId: 'sha256:dc18fae37e578de0a11c700070a9f66f462c60092f3568066f9825acaeb77d86',
    width: 1122, height: 1402,
    alt: Object.freeze({
      en: 'Angled back view of a black T-shirt with large warm-white Gothic Tropical Trance lettering.',
      'es-MX': 'Vista trasera en ángulo de una playera negra con letras góticas grandes en color crema de Tropical Trance.',
    }),
  }),
]);

// Owner approval here covers display of these user-provided mockups as concepts only,
// not production, sale, publication, or approval of garment specifications.
const hoodieArtwork = Object.freeze({
  kind: 'owner-approved-concept-images',
  ownerApproved: true,
  images: hoodieConceptImages,
});
const tshirtArtwork = Object.freeze({
  kind: 'owner-approved-concept-images',
  ownerApproved: true,
  images: tshirtConceptImages,
});

export const apparelProducts = Object.freeze([
  Object.freeze({ id: 'hoodie', visual: 'hoodie-concept-gallery', artwork: hoodieArtwork }),
  Object.freeze({ id: 'tshirt', visual: 'tshirt-concept-gallery', artwork: tshirtArtwork }),
]);

export const apparelMedia = Object.freeze([...hoodieConceptImages, ...tshirtConceptImages]);

const expectedProducts = Object.freeze(['hoodie', 'tshirt']);
const expectedArtwork = new Map([
  ['hoodie', JSON.stringify(hoodieArtwork)],
  ['tshirt', JSON.stringify(tshirtArtwork)],
]);

export function validateApparelProducts(products = apparelProducts) {
  if (!Array.isArray(products) || JSON.stringify(products.map(product => product.id)) !== JSON.stringify(expectedProducts)) {
    throw new Error('Apparel concept set must contain exactly one hoodie and one T-shirt');
  }
  for (const product of products) {
    const visualAllowed = product.id === 'hoodie'
      ? product.visual === 'hoodie-concept-gallery'
      : product.visual === 'tshirt-concept-gallery';
    if (!visualAllowed || JSON.stringify(product.artwork) !== expectedArtwork.get(product.id)) {
      throw new Error('Apparel media requires an exact local asset inventory and owner-approved concept state');
    }
  }
  return true;
}

validateApparelProducts();
