import assert from 'node:assert/strict';
import { loadRelease, rejectFixture, digest } from './public-inputs.mjs';
import { trancy, trancyMedia, validateTrancy } from './trancy-static.mjs';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRendered } from './rendered-audit.mjs';
import sharp from 'sharp';

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
export function checkInventory(paths, deliveries = [], flavors = []) {
  const expectedRoutes = [...routes,...flavors.map(f=>'flavors/'+f.slug+'/index.html')];
  const assets = [trancy.path.slice('public-astro/'.length), ...deliveries.map(m => m.path.slice('public-astro/'.length))];
  assert.deepEqual(paths.filter(p => p.endsWith('.html')).sort(), expectedRoutes.sort(), 'Unexpected static routes');
  assert.equal(paths.filter(p => /^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)).length, 1, 'Exactly one referenced stylesheet');
  assert(paths.every(p => expectedRoutes.includes(p) || assets.includes(p) || /^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)), 'Unexpected copied/generated file');
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
export function checkHtml(html, media = [], salesChannels = []) {
  assert.match(html, /<html[^>]*lang="en"/);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.equal((html.match(/<main(?:\s|>)/g) || []).length, 1);
  assert.match(html, /id="main"/);
  assert.match(html, /href="#main"/);
  assert.match(html, /aria-label="Primary"/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /name="description" content="[^"]+"/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /Development-only foundation/);
  assert(!/<(?:script|iframe|form|astro-island)\b/i.test(html), 'Unapproved media or client runtime');
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
  if (salesChannels.length) assert.match(html,/Where to Find Us/);
  else assert(!html.includes('Where to Find Us'),'Disabled channels must not render a placeholder section');
  const external = [...html.matchAll(/<a\b([^>]*)>/gi)].map(match=>htmlAttributes(match[1])).filter(attrs=>(attrs.get('href')||'').startsWith('https:'));
  assert.deepEqual(external.map(attrs=>attrs.get('href')),salesChannels.map(channel=>channel.destinationUrl),'External links must exactly match selected sales channels');
  for (const [index,attrs] of external.entries()) {
    const channel=salesChannels[index];
    assert.equal(attrs.get('target'),'_blank','External links open in a new tab');
    assert.deepEqual(new Set((attrs.get('rel')||'').split(/\s+/)),new Set(['noopener','noreferrer']),'External links require safe rel attributes');
    assert.equal(attrs.get('aria-label'),channel.accessibleLabel,'External link needs a descriptive accessible name');
  }
  assert(!/\b(?:srcset|imagesrcset|poster)\s*=/i.test(html),'Unapproved media variant');
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
}
export async function checkSource(base = root) {
  const config = await readFile(resolve(base, 'astro.config.mjs'), 'utf8');
  checkConfig(config);
  const source = await files(resolve(base, 'src'));
  const pages = source.map(p => relative(resolve(base, 'src/pages'), p)).filter(p => !p.startsWith('..'));
  assert.deepEqual(pages.sort(), ['404.astro','about.astro','contact.astro','flavors/[slug].astro','flavors/index.astro','index.astro'].sort());
  for (const path of source) {
    const text = await readFile(path, 'utf8');
    assert(!/fetch\s*\(|https?:|tropical-trance-studio|artwork-workspace|prerender\s*=\s*false|astro:actions|astro:content|<script/.test(text), `Forbidden source dependency: ${path}`);
  }
  assert.match(await readFile(resolve(base, 'src/pages/flavors/[slug].astro'), 'utf8'), /release\.flavors\.map/);
  const selected = loadRelease({base}).flavors;
  assert(selected.every(f=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug) && f.flavor.id===f.slug), 'Invalid normal Flavor selection');
  await checkFlavorMedia(base,{flavors:selected});
  const packageJson = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'));
  assert.deepEqual(packageJson.devDependencies, { astro: '7.3.8' });
  assert(!packageJson.dependencies);
  assert.equal(packageJson.engines.node, '24.21.0');
  assert.equal(packageJson.engines.npm, '11.19.0');
}
export async function checkOutput(base = root) {
  const dist = resolve(base, 'dist');
  const release = loadRelease({base});
  const output = await files(dist);
  checkInventory(output.map(p => relative(dist, p)), release.deliveries, release.flavors);
  for (const path of output) {
    const bytes = await readFile(path);
    const servedPath = 'public-astro/'+relative(dist,path);
    const delivery = release.deliveries.find(m => m.path===servedPath);
    if (servedPath === trancy.path) validateTrancy(bytes);
    else rejectFixture(bytes);
    if (delivery) assert.equal(digest(bytes),delivery.asset.contentId,'Output delivery digest mismatch');
    assert(!/tropical-trance-studio|artwork-workspace:|(?:\/Users\/|\/private\/)|authorityEvidence|reviewEvidenceContentId|candidateContentId|publication-decision|projection\.schema\.json/.test(bytes.toString('utf8')), 'Private schema/evidence/output leak');
  }
  for (const page of [...routes,...release.flavors.map(f=>'flavors/'+f.slug+'/index.html')]) {
    const path = resolve(dist, page);
    const html = await readFile(path, 'utf8');
    const role = page==='index.html'?'home-hero':page==='about/index.html'?'about-mascot':undefined;
    const detail = release.flavors.find(f=>page==='flavors/'+f.slug+'/index.html');
    const media = role ? [trancyMedia] : page==='flavors/index.html' ? release.flavors : detail ? [detail] : [];
    const salesChannels=detail?.salesChannels||[];
    checkHtml(html,media,salesChannels);
    if (!role) assert(!html.includes(trancyMedia.mediaUrl),'Trancy referenced outside Home/About');
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const [href, fragment] = decodeAttribute(match[1]).split('#');
      assert(href !== trancyMedia.mediaUrl && !release.deliveries.some(m => href==='/' + m.path.slice('public-astro/'.length)),'Unapproved media link');
      if (href.startsWith('https:')) {
        assert(salesChannels.some(channel=>channel.destinationUrl===href),'Unapproved external destination');
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
  auditRendered(base, 'dist');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkSource();
  if (!process.argv.includes('--source')) await checkOutput();
  console.log('Slice 3 bounded static foundation checks: PASS');
}
