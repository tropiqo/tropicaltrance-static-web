// Derive presentation types from the validated mapper; no second content schema.
import type { loadRelease } from '../../scripts/public-inputs.mjs';
export type PublicFlavor = ReturnType<typeof loadRelease>['flavors'][number];
type EditorialContent<T> = T extends { translations: { en: infer English } } ? English : T;
export type PublicEditorial = EditorialContent<NonNullable<PublicFlavor['editorial']>>;
export type LocalizedFlavor = Omit<PublicFlavor, 'editorial'> & { editorial?: PublicEditorial };
// Presentation shape only; the isolated review loader validates the fixed selection.
export interface BrandMediaView { mediaUrl: string; alt: string; width: number; height: number; }
