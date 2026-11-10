export function localizeFlavor(flavor, locale, review = false) {
  if (review) {
    if (locale === 'en') return flavor;
    const translation = flavor.translations?.['es-MX'];
    if (!translation) return flavor;
    return { ...flavor, shortDescription: translation.shortDescription, alt: translation.alt };
  }

  if (locale !== 'en' && locale !== 'es-MX') throw new Error(`Unsupported Flavor locale: ${locale}`);
  const editorial = flavor.editorial?.translations?.[locale];
  if (locale === 'en') return editorial ? { ...flavor, editorial } : flavor;

  const translation = flavor.translations?.['es-MX'];
  if (!translation) throw new Error(`Missing es-MX flavor translation: ${flavor.slug}`);
  return {
    ...flavor,
    shortDescription: translation.shortDescription,
    alt: translation.alt,
    ...(editorial ? { editorial } : {}),
  };
}
