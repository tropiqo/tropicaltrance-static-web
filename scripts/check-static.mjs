import assert from 'node:assert/strict';
import { loadRelease, rejectFixture, digest } from './public-inputs.mjs';
import { trancy, trancyMedia, validateTrancy } from './trancy-static.mjs';
import { emeraldGatewayAssets, localizationAssets } from './emerald-gateway-static.mjs';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRendered } from './rendered-audit.mjs';
import sharp from 'sharp';
import { getMessages } from '../src/i18n/messages.mjs';
import { pageMetadata, seoBuildSettings, renderRobots, renderSitemap, sitemapEntries } from './seo-metadata.mjs';

export const routes = ['index.html', 'about/index.html', 'contact/index.html', 'flavors/index.html', '404.html'];
const root = fileURLToPath(new URL('../', import.meta.url));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    assert(!(await lstat(path)).isSymbolicLink(), `Symlink forbidden: ${entry.name}`);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
export function checkInventory(paths, deliveries = [], flavors = [], seoSettings = seoBuildSettings()) {
  const expectedRoutes = [...routes,...flavors.map(f=>'flavors/'+f.slug+'/index.html')];
  const spanishRoutes = ['es/index.html','es/about/index.html','es/contact/index.html','es/404/index.html','es/flavors/index.html',...flavors.map(f=>`es/flavors/${f.slug}/index.html`)];
  const allRoutes = [...expectedRoutes,...spanishRoutes];
  const assets = [trancy.path.slice('public-astro/'.length), ...deliveries.map(m => m.path.slice('public-astro/'.length)), ...emeraldGatewayAssets.map(asset => asset.path.slice('public-astro/'.length)), ...localizationAssets.map(asset => asset.path.slice('public-astro/'.length))];
  assert.deepEqual(paths.filter(p => p.endsWith('.html')).sort(), allRoutes.sort(), 'Unexpected static routes');
  assert.equal(paths.filter(p => /^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)).length, 1, 'Exactly one referenced stylesheet');
  const seoFiles = ['robots.txt', ...(seoSettings.indexingAuthorized ? ['sitemap.xml'] : [])];
  assert(paths.every(p => allRoutes.includes(p) || assets.includes(p) || seoFiles.includes(p) || /^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p) || /^_astro\/[A-Za-z0-9_.-]+\.js$/.test(p)), 'Unexpected copied/generated file');
  assert(paths.filter(p => /^_astro\/[A-Za-z0-9_.-]+\.js$/.test(p)).length <= 1, 'Unexpected client script count');
  assert.deepEqual(paths.filter(p => assets.includes(p)).sort(), assets.sort(), 'Selected output media inventory mismatch');
}
function decodeAttribute(text) {
  const named = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (_,entity) => entity[0] === '#' ?
    String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1), entity[1].toLowerCase()==='x'?16:10)) : named[entity.toLowerCase()]);
}
function htmlAttributes(source) {
  return new Map([...source.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(),decodeAttribute(match[2]??match[3])]));
}
export function checkHtml(html, media = [], salesChannels = [], whatsappBusinessUrl = null, aboutHeroMedia = null, locale = 'en', seo = null, productionAuthorized = false) {
  const isSpanish = locale === 'es-MX';
  assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.equal((html.match(/<main(?:\s|>)/g) || []).length, 1);
  assert.match(html, /id="main"/);
  assert.match(html, /href="#main"/);
  assert.match(html, new RegExp(`aria-label="${isSpanish?'Principal':'Primary'}"`));
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /name="description" content="[^"]+"/);
  const robots = html.match(/<meta name="robots" content="([^"]+)"/);
  assert(robots);
  if (seo) {
    const title = decodeAttribute(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.equal(title, seo.title);
    assert.equal(decodeAttribute(description), seo.description);
    assert.equal(robots[1], seo.robots);
    const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)"\s*\/?\s*>/g)].map(match => decodeAttribute(match[1]));
    assert.deepEqual(canonical, seo.canonical ? [seo.canonical] : []);
    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?\s*>/g)].map(match => ({ language: match[1], href: decodeAttribute(match[2]) }));
    assert.deepEqual(alternates, seo.alternates.map(alternate => ({ language: alternate.language, href: new URL(alternate.path, seo.canonical).href })));
  } else assert.match(html, /noindex, nofollow/);
  if (productionAuthorized) assert(!html.includes('development-note') && !html.includes('Development-only foundation') && !html.includes('Sitio exclusivo de desarrollo'));
  else assert.match(html, isSpanish ? /Sitio exclusivo de desarrollo/ : /Development-only foundation/);
  assert(!/<(?:iframe|form|input|object|embed|audio|canvas|astro-island)\b/i.test(html), 'Unapproved media or client runtime');
  const videoTags = [...html.matchAll(/<video\b([^>]*)><\/video>/gi)];
  const scriptTags = [...html.matchAll(/<script\b([^>]*)><\/script>/gi)];
  assert.equal(videoTags.length, aboutHeroMedia ? 1 : 0, 'Cinematic video belongs only to the About hero');
  assert.equal(scriptTags.length, aboutHeroMedia ? 2 : 1, 'Expected language script and optional About video controls');
  const scriptSources=scriptTags.map(tag=>htmlAttributes(tag[1]).get('src')).sort();
  assert(scriptSources.includes('/assets/language-preference.js'),'Language preference script missing');
  assert.deepEqual(scriptSources.filter(src=>src==='/assets/cinematic-hero-video.js').length,aboutHeroMedia?1:0);
  if (aboutHeroMedia) {
    const attrs = htmlAttributes(videoTags[0][1]);
    assert.equal(attrs.get('src'), aboutHeroMedia.src);
    assert.equal(attrs.get('poster'), aboutHeroMedia.poster);
    for (const name of ['muted','loop','playsinline']) assert(new RegExp(`(?:^|\\s)${name}(?:\\s|$)`).test(videoTags[0][1]), `Video missing ${name}`);
    assert.equal(attrs.get('preload'), 'none');
    assert.equal(attrs.get('aria-describedby'), 'emerald-gateway-description');
    assert(!attrs.has('autoplay'), 'Autoplay must be gated by reduced-motion preference');
    assert.match(html, new RegExp(`<button\\b[^>]*aria-label="${isSpanish?'Reproducir video de la Puerta Esmeralda':'Play Emerald Gateway video'}"[^>]*aria-pressed="false"[^>]*aria-controls="emerald-gateway-video"`));
    assert.match(html, new RegExp(`id="emerald-gateway-description"[^>]*>${isSpanish?'Una cámara se acerca':'A camera approaches'}`));
  }
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  assert.equal(images.length, media.length, 'Unapproved or missing role image');
  for (const [index,image] of images.entries()) {
    const attrs = new Map();
    for (const match of image[1].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const name=match[1].toLowerCase(); assert(!attrs.has(name),'Duplicate image attribute');
      assert(['src','alt','width','height','loading','decoding'].includes(name),'Unapproved image attribute');
      attrs.set(name,decodeAttribute(match[2]??match[3]));
    }
    assert(!image[1].replace(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,'').trim().replace(/^\/$/,''),'Unapproved image syntax');
    const expected = media[index];
    const wanted = {src:expected.mediaUrl,alt:expected.alt};
    if (expected.width!==undefined) { wanted.width=String(expected.width); wanted.height=String(expected.height); }
    else assert(!attrs.has('width') && !attrs.has('height'),'Unexpected Flavor image dimensions');
    for (const [name,value] of Object.entries(wanted)) assert.equal(attrs.get(name),value,'Role image '+name+' mismatch');
    assert(['eager','lazy'].includes(attrs.get('loading')) && attrs.get('decoding')==='async','Unexpected image loading behavior');
  }
  const salesSection = (html.match(/class="sales-channels"/g) || []).length;
  assert.equal(salesSection,salesChannels.length?1:0,'Sales-channel section presence must match validated enabled links');
  if (salesChannels.length) assert.match(html,isSpanish?/Dónde encontrarnos/:/Where to Find Us/);
  else assert(!html.includes('Where to Find Us'),'Disabled channels must not render a placeholder section');
  const external = [...html.matchAll(/<a\b([^>]*)>/gi)].map(match=>htmlAttributes(match[1])).filter(attrs=>(attrs.get('href')||'').startsWith('https:'));
  const expectedExternal = [...salesChannels.map(channel=>channel.destinationUrl), ...(whatsappBusinessUrl ? [whatsappBusinessUrl] : [])];
  assert.deepEqual(external.map(attrs=>attrs.get('href')),expectedExternal,'External links must exactly match selected sales channels and optional site contact');
  for (const [index,attrs] of external.entries()) {
    const channel=salesChannels[index];
    assert.equal(attrs.get('target'),'_blank','External links open in a new tab');
    assert.deepEqual(new Set((attrs.get('rel')||'').split(/\s+/)),new Set(['noopener','noreferrer']),'External links require safe rel attributes');
    const channelFlavor = channel?.accessibleLabel?.match(/^Find (.+) at /)?.[1] || '';
    const expectedLabel = channel ? (isSpanish ? `Encontrar ${channelFlavor} en ${channel.name} (se abre en una pestaña nueva)` : channel.accessibleLabel) : isSpanish ? getMessages('es-MX').contact.whatsappLabel : 'Message Tropical Trance on WhatsApp (opens in a new tab)';
    assert.equal(attrs.get('aria-label'),expectedLabel,'External link needs a descriptive accessible name');
  }
  assert(!/\b(?:srcset|imagesrcset)\s*=/i.test(html),'Unapproved media variant');
  assert(!/THC|lab.test|handcrafted|all.natural|tropical mango|paradise pineapple|sunset strawberry|hello@/i.test(html), 'Legacy claim/content leak');
}
export function checkConfig(config) {
  assert.match(config, /output: 'static'/);
  assert.match(config, /publicDir: '\.\/public-astro'/);
  assert(!/adapter|integrations|output: 'server'/.test(config), 'Forbidden runtime config');
  assert(!/tropical-trance-studio|artwork-workspace|fetch\s*\(|https?:/.test(config), 'Forbidden external/private config dependency');
}
export async function checkFlavorMedia(base,release=loadRelease({base})) {
  for (const flavor of release.flavors) {
    const metadata=await sharp(resolve(base,'public-astro',flavor.mediaUrl.slice(1))).metadata();
    assert.equal(metadata.format,'webp','Flavor media must decode as WebP');
    assert(metadata.width>0 && metadata.height>0 && metadata.width<=1024 && metadata.height<=1536,'Flavor media dimensions exceed the web profile');
    assert(!metadata.pages || metadata.pages===1,'Animated Flavor media is not supported');
  }
  const poster=emeraldGatewayAssets.find(asset=>asset.format==='webp');
  const posterMetadata=await sharp(resolve(base,poster.path)).metadata();
  assert.equal(posterMetadata.format,'webp','Emerald Gateway poster must be WebP');
  assert.equal(posterMetadata.width,poster.width);
  assert.equal(posterMetadata.height,poster.height);
}
export async function checkSource(base = root) {
  const config = await readFile(resolve(base, 'astro.config.mjs'), 'utf8');
  checkConfig(config);
  const source = await files(resolve(base, 'src'));
  const pages = source.map(p => relative(resolve(base, 'src/pages'), p)).filter(p => !p.startsWith('..'));
  assert.deepEqual(pages.sort(), ['404.astro','about.astro','contact.astro','flavors/[slug].astro','flavors/index.astro','index.astro','robots.txt.ts','es/index.astro','es/about.astro','es/contact.astro','es/404.astro','es/flavors/index.astro','es/flavors/[slug].astro'].sort());
  for (const path of source) {
    const text = await readFile(path, 'utf8');
    assert(!/fetch\s*\(|https?:|tropical-trance-studio|artwork-workspace|prerender\s*=\s*false|astro:actions|astro:content/.test(text), `Forbidden source dependency: ${path}`);
    if (/<script\b/i.test(text)) assert(path.endsWith('/components/LocalizedPage.astro') || path.endsWith('/layouts/SiteLayout.astro'), `Unexpected script source: ${path}`);
  }
  assert.match(await readFile(resolve(base, 'src/pages/flavors/[slug].astro'), 'utf8'), /release\.flavors\.map/);
  assert.match(await readFile(resolve(base, 'src/pages/es/flavors/[slug].astro'), 'utf8'), /release\.flavors\.(?:filter\([^\n]+\)\.)?map/);
  const selected = loadRelease({base}).flavors;
  assert(selected.every(f=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug) && f.flavor.id===f.slug), 'Invalid normal Flavor selection');
  await checkFlavorMedia(base,{flavors:selected});
  const packageJson = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'));
  assert.deepEqual(packageJson.devDependencies, { '@playwright/test': '^1.64.0', astro: '7.3.8' });
  assert(!packageJson.dependencies);
  assert.equal(packageJson.engines.node, '24.21.0');
  assert.equal(packageJson.engines.npm, '11.19.0');
}
export async function checkOutput(base = root) {
  const dist = resolve(base, 'dist');
  const release = loadRelease({base});
  const seoSettings = seoBuildSettings({ production: true, productionSite: release.site.kind === 'production-site', review: release.review === true });
  const output = await files(dist);
  checkInventory(output.map(p => relative(dist, p)), release.deliveries, release.flavors, seoSettings);
  assert.equal(await readFile(resolve(dist,'robots.txt'),'utf8'),renderRobots(seoSettings),'Robots output must match build authorization');
  if (seoSettings.indexingAuthorized) assert.equal(await readFile(resolve(dist,'sitemap.xml'),'utf8'),renderSitemap(sitemapEntries({origin:seoSettings.origin,flavors:release.flavors})),'Sitemap must contain only declared localized routes');
  else assert(!output.some(path => path === resolve(dist,'sitemap.xml')),'Unauthorized builds must not contain a sitemap');
  for (const path of output) {
    const bytes = await readFile(path);
    const servedPath = 'public-astro/'+relative(dist,path);
    const delivery = release.deliveries.find(m => m.path===servedPath);
    if (servedPath === trancy.path) validateTrancy(bytes);
    else rejectFixture(bytes);
    if (delivery) assert.equal(digest(bytes),delivery.asset.contentId,'Output delivery digest mismatch');
    const aboutAsset=[...emeraldGatewayAssets,...localizationAssets].find(asset=>asset.path===servedPath);
    if (aboutAsset) {
      assert.equal(bytes.length,aboutAsset.size,'Emerald Gateway output byte size mismatch');
      assert.equal(digest(bytes),aboutAsset.contentId,'Emerald Gateway output digest mismatch');
    }
    assert(!/tropical-trance-studio|artwork-workspace:|(?:\/Users\/|\/private\/)|authorityEvidence|reviewEvidenceContentId|candidateContentId|publication-decision|projection\.schema\.json/.test(bytes.toString('utf8')), 'Private schema/evidence/output leak');
  }
  const spanishRoutes=['es/index.html','es/about/index.html','es/contact/index.html','es/404/index.html','es/flavors/index.html',...release.flavors.map(f=>`es/flavors/${f.slug}/index.html`)];
  for (const page of [...routes,...release.flavors.map(f=>'flavors/'+f.slug+'/index.html'),...spanishRoutes]) {
    const path = resolve(dist, page);
    const html = await readFile(path, 'utf8');
    const isSpanish=page.startsWith('es/');
    const basePage=isSpanish?page.slice(3):page;
    const locale=isSpanish?'es-MX':'en';
    const role = basePage==='index.html'?'home-hero':basePage==='about/index.html'?'about-mascot':undefined;
    const pageFlavors=isSpanish?release.flavors.map(f=>({...f,...(f.translations?.['es-MX']||{})})):release.flavors;
    const pageTrancy=isSpanish?{...trancyMedia,alt:getMessages('es-MX').home.trancyAlt}:trancyMedia;
    const detail = pageFlavors.find(f=>basePage==='flavors/'+f.slug+'/index.html');
    const media = basePage==='index.html' ? [pageTrancy,...pageFlavors] : role ? [pageTrancy] : basePage==='flavors/index.html' ? pageFlavors : detail ? [detail] : [];
    const salesChannels=detail?.salesChannels||[];
    const whatsappBusinessUrl=basePage==='contact/index.html' ? release.site.contact?.whatsappBusinessUrl ?? null : null;
    const messages=getMessages(locale);
    const pageKind=basePage==='index.html'?'home':basePage==='about/index.html'?'about':basePage==='flavors/index.html'?'flavors':basePage==='contact/index.html'?'contact':basePage==='404.html'||basePage==='404/index.html'?'notFound':detail?'detail':'notFound';
    const metadataTitle=pageKind==='home'?messages.home.metaTitle:pageKind==='about'?messages.about.title:pageKind==='flavors'?messages.flavors.title:pageKind==='contact'?messages.contact.title:pageKind==='detail'?detail.name:messages.notFound.title;
    const metadataDescription=pageKind==='home'?messages.home.description:pageKind==='about'?(locale==='en'?messages.about.description1:`${messages.about.description1} ${messages.about.description2}`):pageKind==='flavors'?(pageFlavors.length===1?pageFlavors[0].shortDescription:messages.flavors.description):pageKind==='contact'?messages.contact.description:pageKind==='detail'?detail.shortDescription:messages.notFound.description;
    const seo=pageMetadata({page:pageKind,locale,title:metadataTitle,description:metadataDescription,flavor:detail,settings:seoSettings});
    checkHtml(html,media,salesChannels,whatsappBusinessUrl,basePage==='about/index.html'?release.aboutHeroMedia:null,locale,seo,seoSettings.indexingAuthorized);
    if (!role) assert(!html.includes(trancyMedia.mediaUrl),'Trancy referenced outside Home/About');
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const [href, fragment] = decodeAttribute(match[1]).split('#');
      assert(href !== trancyMedia.mediaUrl && !release.deliveries.some(m => href==='/' + m.path.slice('public-astro/'.length)),'Unapproved media link');
      if (href.startsWith('https:')) {
        if (href === seo.canonical || seo.alternates.some(alternate => new URL(alternate.path,seo.canonical).href === href)) continue;
        assert(salesChannels.some(channel=>channel.destinationUrl===href) || (basePage==='contact/index.html' && href===release.site.contact?.whatsappBusinessUrl),'Unapproved external destination');
        continue;
      }
      assert(!/^(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(href), 'Unexpected external destination');
      let target = href ? resolve(dist, href.startsWith('/') ? '.' + href : relative(dist, dirname(path)) + '/' + href) : path;
      if (href.endsWith('/')) target = resolve(target, 'index.html');
      assert(target.startsWith(dist + '/') || target === dist, 'Link escapes output');
      const targetText = await readFile(target, 'utf8');
      if (fragment) assert(targetText.includes(`id="${fragment}"`), 'Broken fragment');
    }
  }
  auditRendered(base, 'dist', {indexingAuthorized:seoSettings.indexingAuthorized});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkSource();
  if (!process.argv.includes('--source')) await checkOutput();
  console.log('Slice 3 bounded static foundation checks: PASS');
}
