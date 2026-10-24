const previewEntries = Object.freeze([
  Object.freeze({ name: 'Cannaland' }),
  Object.freeze({ name: 'Splift' }),
]);

export function developmentSalesChannelPreviews({ isDevelopment, optIn }) {
  if (isDevelopment !== true || optIn !== '1') return [];
  return previewEntries.map(({ name }) => ({ name }));
}
