export function localizeFlavor(flavor, locale, review = false) {
  if (locale === 'en') return flavor;
  const translation = flavor.translations?.['es-MX'];
  if (!translation && review) return flavor;
  if (!translation) throw new Error(`Missing es-MX flavor translation: ${flavor.slug}`);
  return { ...flavor, shortDescription: translation.shortDescription, alt: translation.alt };
}
