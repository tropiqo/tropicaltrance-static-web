import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRelease } from './public-inputs.mjs';
import { renderRobots, renderSitemap, seoBuildSettings, sitemapEntries } from './seo-metadata.mjs';

const release = loadRelease();
const settings = seoBuildSettings({ production: true, productionSite: release.site.kind === 'production-site', review: false });
const output = resolve('dist');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'robots.txt'), renderRobots(settings));
const sitemap = resolve(output, 'sitemap.xml');
if (settings.indexingAuthorized) {
  await writeFile(sitemap, renderSitemap(sitemapEntries({ origin: settings.origin, flavors: release.flavors })));
} else {
  await rm(sitemap, { force: true });
}
console.log(settings.indexingAuthorized ? 'SEO output: authorized robots and sitemap generated' : 'SEO output: disallow-all robots; sitemap omitted');
