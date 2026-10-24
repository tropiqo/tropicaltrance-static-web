import release from '#public-release';
import { renderRobots, seoBuildSettings } from '../../scripts/seo-metadata.mjs';

export function GET() {
  const settings = seoBuildSettings({ production: import.meta.env.PROD, productionSite: release.site.kind === 'production-site', review: release.review === true });
  return new Response(renderRobots(settings), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
