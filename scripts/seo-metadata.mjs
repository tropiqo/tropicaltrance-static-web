const LOCALES = Object.freeze(['en', 'es-MX']);
const FIXED_PATHS = Object.freeze({ home: '/', about: '/about/', flavors: '/flavors/', contact: '/contact/' });

export function validateCanonicalOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.hostname === 'localhost' || !url.hostname.includes('.')) return null;
    return url.origin;
  } catch { return null; }
}

export function seoBuildSettings({ env = process.env, production = false, productionSite = false, review = false } = {}) {
  const origin = validateCanonicalOrigin(env.TROPICAL_SEO_ORIGIN);
  const indexingAuthorized = production === true && productionSite === true && review !== true && Boolean(origin) && env.TROPICAL_INDEXING_AUTHORIZATION === 'OWNER_APPROVED';
  return Object.freeze({ origin, indexingAuthorized, robots: indexingAuthorized ? 'index, follow' : 'noindex, nofollow' });
}

export function pagePath(page, locale = 'en', flavor = null) {
  let path;
  if (page === 'notFound') path = '/404/';
  else if (page === 'detail') {
    if (!flavor || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flavor.slug)) throw new Error('SEO flavor metadata requires a valid existing flavor slug');
    path = `/flavors/${flavor.slug}/`;
  } else if (Object.hasOwn(FIXED_PATHS, page)) path = FIXED_PATHS[page];
  else return null;
  return locale === 'es-MX' ? (path === '/' ? '/es/' : `/es${path}`) : path;
}

export function pageMetadata({ page, locale = 'en', title, description, flavor = null, settings }) {
  const path = pagePath(page, locale, flavor);
  if (!path || typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) throw new Error('SEO page metadata requires a supported route, title, and description');
  const isDetail = page === 'detail';
  const hasSpanish = !isDetail || Boolean(flavor?.translations?.['es-MX']);
  const canPublishLinks = settings.indexingAuthorized && page !== 'notFound';
  const alternates = canPublishLinks && hasSpanish
    ? LOCALES.map(language => ({ language, path: pagePath(page, language, flavor) }))
    : [];
  return Object.freeze({
    title: `${title} | Tropical Trance`,
    description,
    robots: canPublishLinks ? 'index, follow' : 'noindex, nofollow',
    canonical: canPublishLinks ? new URL(path, settings.origin).href : null,
    alternates,
  });
}

export function sitemapEntries({ origin, flavors = [] }) {
  if (!validateCanonicalOrigin(origin)) throw new Error('Sitemap requires a valid HTTPS canonical origin');
  const pages = ['home', 'about', 'flavors', 'contact'];
  const entries = [];
  for (const page of pages) {
    const pair = LOCALES.map(locale => ({ locale, path: pagePath(page, locale) }));
    for (const current of pair) entries.push({ path: current.path, alternates: pair });
  }
  for (const flavor of flavors) {
    const locales = flavor.translations?.['es-MX'] ? LOCALES : ['en'];
    const pair = locales.map(locale => ({ locale, path: pagePath('detail', locale, flavor) }));
    for (const current of pair) entries.push({ path: current.path, alternates: pair });
  }
  return entries.map(entry => ({
    location: new URL(entry.path, origin).href,
    alternates: entry.alternates.map(alternate => ({ language: alternate.locale, location: new URL(alternate.path, origin).href })),
  }));
}

export function renderRobots(settings) {
  if (!settings.indexingAuthorized) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nSitemap: ${settings.origin}/sitemap.xml\n`;
}

export function renderSitemap(entries) {
  const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const urls = entries.map(entry => `  <url>\n    <loc>${escapeXml(entry.location)}</loc>\n${entry.alternates.map(alternate => `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.language)}" href="${escapeXml(alternate.location)}" />`).join('\n')}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}
