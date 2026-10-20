import { test, before } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { trancyMedia } from '../scripts/trancy-static.mjs';
import { loadRelease, inventory, digest } from '../scripts/public-inputs.mjs';
import { checkOutput, routes, checkSource } from '../scripts/check-static.mjs';
import { checkReviewOutput } from '../scripts/check-review.mjs';
const root = process.cwd();
const text = path => readFileSync(resolve(root,path),'utf8');
const normal = path => text('dist/'+path);
const fixture = path => text('.review-build/'+path);
const navs = html => [...html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)].map(m=>m[0]);
before(() => {
  const result = spawnSync(process.execPath, ['scripts/build-review.mjs'], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
});
const headings = (html,level) => [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`,'g'))].map(m=>m[1]);

test('shared shell, semantic heading and working static primary/footer navigation on all five normal routes', async () => {
  await checkOutput(); await checkSource();
  for (const route of routes) {
    const html = normal(route);
    assert.equal(headings(html,1).length,1);
    assert.equal((html.match(/<header\b/g)||[]).length,1);
    assert.equal((html.match(/<footer\b/g)||[]).length,1);
    assert.equal((html.match(/<main\b/g)||[]).length,1);
    const nav = navs(html); assert.equal(nav.length,2);
    const expected = route === 'index.html' ? '/' : route === '404.html' ? undefined : '/' + route.replace('index.html', '');
    assert.equal((nav[0].match(/aria-current="page"/g)||[]).length, expected ? 1 : 0);
    if (expected) assert.match(nav[0], new RegExp('href="' + expected + '" aria-current="page"'));
    assert.match(nav[0],/aria-label="Primary"/); assert.match(nav[1],/aria-label="Footer"/);
    for (const part of nav) { assert.deepEqual([...part.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['/','/flavors/','/about/','/contact/']); assert(!/world|Trancy/i.test(part)); }
    assert.match(html,/<a[^>]*class="skip-link"[^>]*href="#main"/);assert.match(html,/<main id="main" tabindex="-1"/);
    assert(!/<(?:script|iframe|form|input|astro-island)\b/i.test(html));
  }
});
test('three reusable editorial variants compose Home without fabricated claims or product cards',()=>{
  const html = normal('index.html');
  for(const variant of ['text','split','band'])assert.match(html,new RegExp('editorial--'+variant));
  assert.match(html,/Tropical.*<em>Trance<\/em>/);
  assert.match(html,/href="\/flavors\/"/);
  assert.match(html,/Escape the ordinary\. Explore a world of tropical flavor\./);
  const hero = trancyMedia;
  assert.equal((html.match(/<img\b/g)||[]).length, hero ? 1 : 0);
  assert(!/class="flavor-card"|Trancy is the constant|The adventure changes|testimonial|award|ingredients|manufactur|sustainab|founder|coming soon|launch date/i.test(html));
});
test('normal collection/detail derive from all selected flavors and preserve approved Grape copy',()=>{
 const release=loadRelease();assert(release.flavors.some(f=>f.slug==='grape'));
 const html=normal('flavors/index.html');
 assert.equal((html.match(/class="flavor-card"/g)||[]).length,release.flavors.length);assert(!html.includes('class="empty-collection"'));
 for(const f of release.flavors){
  const detail=normal(`flavors/${f.slug}/index.html`);
  for(const page of [html,detail]){assert(page.includes(f.shortDescription));assert(page.includes(`src="${f.mediaUrl}" alt="${f.alt}"`));assert(!/fixture-|review-media|Flavor story|Worlds/.test(page));}
  assert.equal(headings(detail,1)[0],f.name);assert(detail.includes('Return to Flavors'));assert(detail.includes('loading="eager"'));assert(html.includes('loading="lazy"'));
 }
 const grape=release.flavors.find(f=>f.slug==='grape');assert(grape.name && grape.shortDescription && grape.alt);
 assert.equal((normal('flavors/grape/index.html').match(/<img\b/g)||[]).length,1);
 assert(!normal('index.html').includes('No flavors are included'));assert(!normal('about/index.html').includes('No flavors are included'));
});
test('review fixtures render reusable cards and detail media from the validated model, preserving bytes and alt',async()=>{
  await checkReviewOutput();const release=loadRelease({review:true});
  assert(!fixture('index.html').includes('No flavors are included in this development build'));
  assert(!fixture('about/index.html').includes('No flavors are included in this development build'));
  const collection=fixture('flavors/index.html');assert.equal((collection.match(/class="flavor-card"/g)||[]).length,2);assert(!collection.includes('class="empty-collection"'));
  for(const flavor of release.flavors) {
    const html=fixture(`flavors/${flavor.slug}/index.html`);
    assert.match(html,/class="detail-grid"/);assert.equal(headings(html,1)[0],flavor.name);assert(html.includes(flavor.shortDescription));
    for(const rendered of [html,collection])assert(rendered.includes(`src="${flavor.mediaUrl}" alt="${flavor.alt}"`));
    assert(html.includes('loading="eager"'));assert(collection.includes('loading="lazy"'));
    assert(html.includes('Return to Flavors'));assert(html.includes('INTERNAL SYNTHETIC TEST ONLY'));assert(html.includes('noindex, nofollow'));
    const delivery=release.deliveries.find(m=>m.path.endsWith(flavor.mediaUrl.slice(1)));assert.equal(digest(readFileSync(resolve(root,'.review-build',flavor.mediaUrl.slice(1)))),delivery.asset.contentId);
    for(const nav of navs(html))assert(!/world|Trancy/i.test(nav));
    assert.match(navs(html)[0], /href="\/flavors\/" aria-current="location"/);
  }
});
test('story omission is explicit; Worlds stays within optional Flavor storytelling',()=>{
  const orchid=fixture('flavors/fixture-orchid/index.html'),coral=fixture('flavors/fixture-coral/index.html');
  assert.match(orchid,/aria-label="Flavor story"/);assert.match(orchid,/Trancy’s Worlds/);assert.match(orchid,/A fictional story exercises optional editorial rendering/);
  assert(!/aria-label="Flavor story"|class="flavor-story"|Trancy|Flavor story/.test(coral.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1]));
  for(const route of routes) { assert(!/Worlds/.test(normal(route))); if (!['index.html','about/index.html'].includes(route)) assert(!normal(route).includes(trancyMedia.mediaUrl)); }
});
test('Contact and About contain restrained development copy without invented contact endpoints',()=>{
  const contact=normal('contact/index.html');assert.match(contact,/class="contact-panel"/);assert.match(contact,/The approved contact channel is pending/);
  assert.match(normal('about/index.html'),/A tropical state of mind\. A character all its own\./);
  for(const route of routes)assert(!/mailto:|tel:|https?:|\b[\w.-]+@[\w.-]+\.[a-z]+|<form\b|<input\b|<script\b|social profile|founder|manufacturing|certified/i.test(normal(route)));
});
test('decoration is hidden, static and separate from approved media; no remote CSS/font/image dependencies',()=>{
  for(const route of routes) {
    const html=normal(route);for(const block of html.matchAll(/<div class="decorative-background[^>]*>/g))assert.match(block[0],/aria-hidden="true"/);
    assert(!/<(?:svg|canvas|video|audio|script|iframe)\b/i.test(html));
    assert.equal((html.match(/<img\b/g)||[]).length, ['index.html','about/index.html','flavors/index.html'].includes(route) ? 1 : 0);
  }
  const css=text('src/styles/global.css');assert.match(css,/object-fit: contain/);assert(!/object-fit:\s*cover|@font-face|https?:|url\(|@keyframes/.test(css));
  assert.match(text('src/components/DecorativeBackground.astro'),/aria-hidden="true"/);assert.match(css,/pointer-events: none/);
  assert(!/transform:|filter:/.test(css.match(/\.media-frame img\s*\{([^}]+)\}/)[1]));
  const release=loadRelease();
  for (const [route,flavors] of [['flavors/index.html',release.flavors],['flavors/grape/index.html',[release.flavors.find(f=>f.slug==='grape')]]]) {
    const html = normal(route);assert.match(html, /class="media-frame"/);
    for(const flavor of flavors)assert(html.includes(`src="${flavor.mediaUrl}" alt="${flavor.alt}"`));
    assert.equal((html.match(/<img\b/g)||[]).length,flavors.length);
  }
  const frame = css.match(/\.media-frame\s*\{([^}]+)\}/)?.[1] ?? '';
  const image = css.match(/\.media-frame img\s*\{([^}]+)\}/)?.[1] ?? '';
  assert(!/padding:|background:|min-block-size:|border-radius:/.test(frame));
  assert.match(image, /inline-size:\s*100%/); assert.match(image, /block-size:\s*auto/);
  assert.match(image, /max-block-size:\s*none/); assert(!/object-fit:\s*cover|transform:|filter:/.test(frame + image));
});
test('CSS protects reflow, keyboard focus, touch targets and reduced motion without hiding page overflow',()=>{
  const css=text('src/styles/global.css');assert.match(css,/:focus-visible\s*\{[^}]*outline: 3px/);assert.match(css,/\.skip-link:focus/);
  assert.match(css,/min-block-size: 2\.75rem/);assert.match(css,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);assert.match(css,/overflow-wrap: anywhere/);
  for(const width of ['48','72','96'])assert.match(css,new RegExp('@media \\(min-width: '+width+'rem\\)'));
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important; transition: none !important; scroll-behavior: auto !important/);
  assert(!/overflow-x:\s*hidden|position:\s*(fixed|sticky)|\border\s*:|grid-auto-flow:\s*dense/.test(css));
});
function luminance(hex) {
  const rgb=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
test('actual token text pairs exceed 4.5:1 and focus pairs exceed 3:1',()=>{
  const tokens=Object.fromEntries([...text('src/styles/tokens.css').matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map(m=>[m[1],m[2]]));
  const textPairs=[['color-text','color-canvas'],['color-muted','color-canvas'],['color-text','color-surface'],['color-muted','color-surface'],['color-ink','color-paper'],['color-ink-muted','color-paper'],['color-ink','accent-coral'],['color-ink','accent-citrus'],['accent-citrus','color-canvas'],['accent-citrus','color-surface']];
  for(const [a,b] of textPairs){const ratio=contrast(tokens[a],tokens[b]);assert(ratio>=4.5,`${a}/${b}: ${ratio}`);console.log(`Token contrast ${a}/${b}: ${ratio.toFixed(2)}:1`);}
  for(const [a,b] of [['accent-citrus','color-canvas'],['accent-citrus','color-surface'],['color-ink','color-paper'],['color-ink','accent-coral']])assert(contrast(tokens[a],tokens[b])>=3);
});
test('presentation reads validated props only; contracts, fixture roots and public assets stay separate',()=>{
  for(const name of ['FlavorCard','FlavorCollection','FlavorDetail','FlavorStory','MediaFrame']) {
    const source=text(`src/components/${name}.astro`);assert(!/readFile|loadRelease|fetch\s*\(|fixture-|grape|cherry|lime|JSON\.parse|content\//.test(source));
  }
  const release=loadRelease();
  assert.deepEqual(inventory(root,'public-astro',true).sort(), [...release.deliveries.map(d=>d.path),'public-astro/assets/trancy-web-r1.webp'].sort());
  assert.deepEqual(inventory(root,'dist').filter(p=>p.endsWith('.html')).map(p=>p.slice(5)).sort(),[...routes,...release.flavors.map(f=>`flavors/${f.slug}/index.html`)].sort());
});

test('local Trancy candidate anchors Home and About with one intact delivery and no other-page image', async () => {
  await checkReviewOutput();
  const home = fixture('index.html'), about = fixture('about/index.html');
  for (const html of [home, about]) {
    assert.equal((html.match(/src="\/review-media\/trancy-review-r1\.webp"/g) || []).length, 1);
    assert.match(html, /alt="Trancy, the green Tropical Trance chameleon, with sunglasses and a tropical drink\."/);
    assert.match(html, /width="1440" height="1282"/);
    assert.match(html, /LOCAL MASCOT REVIEW ONLY/);
  }
  assert.match(home, /hero-grid--mascot/); assert.match(home, /loading="eager"/);
  assert.match(about, /Meet Trancy/); assert.match(about, /Trancy is the Tropical Trance mascot/);
  for (const route of routes) { assert(!normal(route).includes('/review-media/')); assert.equal((normal(route).match(/<img\b/g)||[]).length, ['index.html','about/index.html','flavors/index.html'].includes(route) ? 1 : 0); }
  for (const route of ['contact/index.html', '404.html', 'flavors/index.html', 'flavors/fixture-coral/index.html', 'flavors/fixture-orchid/index.html']) assert(!fixture(route).includes('/review-media/'));
});

test('tropical refinement keeps decorative depth behind content and a single compact review disclosure', () => {
  for (const html of [fixture('index.html'), fixture('about/index.html')]) {
    assert.equal((html.match(/class="review-note"/g) || []).length, 1);
    assert(!html.includes('class="development-note"'));
    assert.match(html, /<details class="review-indicator"><summary>Local review · synthetic Flavors · real Trancy · publication pending<\/summary>/);
    assert.match(html, /INTERNAL SYNTHETIC TEST ONLY/); assert.match(html, /LOCAL MASCOT REVIEW ONLY/);
    assert.match(html, /not approved for public publication/); assert.match(html, /noindex, nofollow/);
    for (const layer of html.matchAll(/<div class="tropical-atmosphere"[^>]*>/g)) assert.match(layer[0], /aria-hidden="true"/);
    assert.match(html, /editorial-hero--tropical/);
  }
  assert.match(fixture('about/index.html'), /editorial--tropical/);
  for (const route of routes) assert(!/review-indicator|LOCAL MASCOT REVIEW ONLY|review-media/.test(normal(route)));
  const css = text('src/styles/global.css');
  assert.match(css, /\.tropical-atmosphere \{[^}]*position: absolute;[^}]*inset: 0;[^}]*overflow: hidden;[^}]*pointer-events: none/);
  assert.match(css, /\.editorial-hero--tropical > \.container[^}]*z-index: 1/);
  assert(!/@keyframes|animation: (?!none)/.test(css));
  assert.match(css, /\.review-indicator summary \{[^}]*min-block-size: 2\.75rem/);
});

test('approved static placements never activate the existing review URLs', () => {
  assert.equal(trancyMedia.mediaUrl, '/assets/trancy-web-r1.webp');
  for (const route of ['index.html','about/index.html']) assert(!normal(route).includes('/review-media/'));
});
