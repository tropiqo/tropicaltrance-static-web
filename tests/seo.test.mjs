import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { seoBuildSettings, sitemapEntries, validateCanonicalOrigin } from '../scripts/seo-metadata.mjs';

const root = process.cwd();
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'tt-seo-'));
  for (const path of ['src','scripts','schemas','content','public-astro','astro.config.mjs','package.json','package-lock.json']) cpSync(join(root,path),join(base,path),{recursive:true});
  const config = join(base,'astro.config.mjs');
  writeFileSync(config,readFileSync(config,'utf8').replace('vite: { resolve:',`vite: { cacheDir: '${join(base,'.vite-cache')}', resolve:`));
  symlinkSync(join(root,'node_modules'),join(base,'node_modules'),'dir');
  return base;
}
function build(base, variables = {}) {
  const env = { ...process.env, TROPICAL_SEO_ORIGIN:'', TROPICAL_INDEXING_AUTHORIZATION:'', TROPICAL_CHANNEL_PREVIEW:'', ...variables };
  const result = spawnSync('npm',['run','build'],{cwd:base,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
}
function html(base,path) { return readFileSync(join(base,'dist',path),'utf8'); }

test('canonical origin and indexing authorization fail closed',()=>{
  assert.equal(validateCanonicalOrigin('https://tropicaltrance.example/'),'https://tropicaltrance.example');
  for (const invalid of ['http://tropicaltrance.example','https://localhost','https://user:pass@example.com','https://example.com/path','https://example.com?x=1','not a URL']) assert.equal(validateCanonicalOrigin(invalid),null);
  assert.equal(seoBuildSettings({env:{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED'},production:true,productionSite:true}).indexingAuthorized,true);
  assert.equal(seoBuildSettings({env:{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example'},production:true}).indexingAuthorized,false);
  assert.equal(seoBuildSettings({env:{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED'},production:true,productionSite:false}).indexingAuthorized,false);
  assert.equal(seoBuildSettings({env:{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED'},production:false,productionSite:true}).indexingAuthorized,false);
  assert.equal(seoBuildSettings({env:{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED'},production:true,productionSite:true,review:true}).indexingAuthorized,false);
});

test('sitemap contains only existing localized page pairs and no default alias',()=>{
  const flavors=[{slug:'cherry',translations:{'es-MX':{shortDescription:'Explora Cherry.'}}},{slug:'mango'}];
  const entries=sitemapEntries({origin:'https://tropicaltrance.example',flavors});
  assert(entries.some(entry=>entry.location==='https://tropicaltrance.example/'));
  assert(entries.some(entry=>entry.location==='https://tropicaltrance.example/es/'));
  assert(entries.some(entry=>entry.location==='https://tropicaltrance.example/flavors/cherry/'));
  assert(entries.some(entry=>entry.location==='https://tropicaltrance.example/es/flavors/cherry/'));
  assert(entries.some(entry=>entry.location==='https://tropicaltrance.example/flavors/mango/' && entry.alternates.length===1));
  assert(!entries.some(entry=>entry.location.includes('x-default')));
});

test('current development site stays noindex with origin and auth flags and omits sitemap',async()=>{
  const base=fixture();
  try {
    build(base,{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED'});
    const home=html(base,'index.html');
    assert.match(home,/<title>Escape the Ordinary \| Tropical Trance<\/title>/);
    assert.match(home,/<meta name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(home,/<link rel="canonical"|hreflang=/);
    assert.match(readFileSync(join(base,'dist/robots.txt'),'utf8'),/Disallow: \/\n/);
    assert(!existsSync(join(base,'dist/sitemap.xml')));
    assert.match(html(base,'es/index.html'),/<meta name="description" content="Entra en un mundo/);
  } finally { rmSync(base,{recursive:true,force:true}); }
});

test('explicitly authorized production output has bilingual metadata, reciprocal alternates, sitemap, and no preview leakage',async()=>{
  const base=fixture();
  try {
    const sitePath=join(base,'content/site.json');
    const site=JSON.parse(readFileSync(sitePath,'utf8'));site.kind='production-site';writeFileSync(sitePath,JSON.stringify(site,null,2)+'\n');
    build(base,{TROPICAL_SEO_ORIGIN:'https://tropicaltrance.example',TROPICAL_INDEXING_AUTHORIZATION:'OWNER_APPROVED',TROPICAL_CHANNEL_PREVIEW:'1'});
    const pairs=[
      ['index.html','es/index.html','https://tropicaltrance.example/','https://tropicaltrance.example/es/','Escape the Ordinary','Escapa de lo Ordinario','Step into a world','Entra en un mundo'],
      ['about/index.html','es/about/index.html','https://tropicaltrance.example/about/','https://tropicaltrance.example/es/about/','Beyond the Ordinary','Más allá de lo ordinario','Tropical Trance is a creative universe','Tropical Trance es un universo creativo'],
      ['flavors/cherry/index.html','es/flavors/cherry/index.html','https://tropicaltrance.example/flavors/cherry/','https://tropicaltrance.example/es/flavors/cherry/','Cherry','Cherry','Explore the Cherry flavor','Explora el sabor Cherry'],
    ];
    for (const [englishPath,spanishPath,canonical,alternate,englishTitle,spanishTitle,englishDescription,spanishDescription] of pairs) {
      for (const [route,expectedCanonical,expectedAlternate,title,description] of [[englishPath,canonical,alternate,englishTitle,englishDescription],[spanishPath,alternate,canonical,spanishTitle,spanishDescription]]) {
        const page=html(base,route);
        assert.match(page,new RegExp(`<title>${title} \\| Tropical Trance<\\/title>`));
        assert.match(page,/<meta name="robots" content="index, follow"/);
        assert.doesNotMatch(page,/Development-only foundation|Sitio exclusivo de desarrollo|class="development-note"/);
        assert(page.includes(`rel="canonical" href="${expectedCanonical}"`));
        assert(page.includes(`hreflang="${route.startsWith('es/')?'en':'es-MX'}" href="${expectedAlternate}"`));
        assert(page.includes(`name="description" content="${description}`));
        assert.doesNotMatch(page,/(?:THC|CBD|cannabinoid|medical|therapeutic|potency)/i);
      }
    }
    const sitemap=readFileSync(join(base,'dist/sitemap.xml'),'utf8');
    assert(sitemap.includes('<loc>https://tropicaltrance.example/flavors/cherry/</loc>'));
    assert(sitemap.includes('hreflang="es-MX" href="https://tropicaltrance.example/es/flavors/cherry/"'));
    assert(!sitemap.includes('x-default'));
    assert.match(readFileSync(join(base,'dist/robots.txt'),'utf8'),/Allow: \/\nSitemap: https:\/\/tropicaltrance\.example\/sitemap\.xml/);
    for(const route of ['flavors/cherry/index.html','es/flavors/cherry/index.html']) assert.doesNotMatch(html(base,route),/Cannaland|Splift|Preview only|Solo vista previa/);
  } finally { rmSync(base,{recursive:true,force:true}); }
});
