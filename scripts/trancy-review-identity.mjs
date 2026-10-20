// Explicit LOCAL review selection; no Studio Asset, eligibility or publication decision.
export const trancyReviewSelection = Object.freeze({
  kind: 'local-trancy-review-only',
  id: 'trancy-review-r1',
  roles: ['home-hero', 'about-mascot'],
  masterPath: 'assets/images/TRANCY-01.png',
  masterContentId: 'sha256:61088b9e5e4b1ec9f80c2b17e8ab79d3443b5af63347cb141684de5cc02dab5d',
  path: 'review-assets/trancy-review-r1.webp',
  outputPath: 'review-media/trancy-review-r1.webp',
  contentId: 'sha256:93fdea06b6b6c7bc496f56a8f0df331213b0ef1fdfeb6b8cfbfd865f657bb658',
  width: 1440,
  height: 1282,
  size: 542380,
  alt: 'Trancy, the green Tropical Trance chameleon, with sunglasses and a tropical drink.',
  tools: { sharp: '0.35.5', vips: '8.18.7', webp: '1.6.0' },
  resize: { width: 1440, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3', fastShrinkOnLoad: false },
  webp: { lossless: true, effort: 6 },
});
