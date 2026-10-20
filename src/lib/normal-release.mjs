import { loadRelease } from '../../scripts/public-inputs.mjs';
import { trancyMedia } from '../../scripts/trancy-static.mjs';
// Flavor release validation is unchanged; both existing placements share one static image.
export default { ...loadRelease(), brandMedia: { 'home-hero': trancyMedia, 'about-mascot': trancyMedia } };
