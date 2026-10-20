import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRelease, inventory } from '../scripts/public-inputs.mjs';
import { checkSource, checkOutput, checkInventory, checkHtml, checkConfig, routes } from '../scripts/check-static.mjs';

test('static source/config and genuine validated Grape release', async () => { await checkSource(); });
test('built routes, no-JS navigation and neutral content', async () => { await checkOutput(); });
test('extra Flavor detail route fails', () => { assert.throws(() => checkInventory([...routes, 'flavors/unapproved/index.html'])); });
test('legacy/private/copied files fail', () => { for (const file of ['assets/images/TRANCY-01.png', 'staticman.yml', '.envrc', '_site/index.html', '_astro/runtime.js']) assert.throws(() => checkInventory([...routes, file])); });
test('media, scripts and old claims fail', () => { for (const content of ['<img src="legacy.png">', '<script>fetch()</script>', 'THC handcrafted gummies']) assert.throws(() => checkHtml(readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8') + content)); });
test('server adapters and private/remote config fail', () => {
  const valid = "output: 'static', publicDir: './public-astro'";
  checkConfig(valid);
  for (const extra of [", adapter: node()", ", integrations: [react()]", ", fetch('https://example.invalid')", ", import 'tropical-trance-studio'", ", import 'artwork-workspace:source'"]) assert.throws(() => checkConfig(valid + extra));
  assert.throws(() => checkConfig("output: 'server', publicDir: './public-astro'"));
});

test('normal HTML cannot gain an image merely through a recognized public destination', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.throws(() => checkHtml(html.replace('</main>', '<img src="/assets/trancy-web-r1.webp" alt="Trancy" width="1440" height="1282" loading="eager" decoding="async"></main>')), /role image/);
});

test('actual selected Grape route/media inventory is exact; omitted or extra detail is rejected',()=>{
 const release=loadRelease(),paths=inventory(process.cwd(),'dist').map(p=>p.slice(5));
 checkInventory(paths,release.deliveries,release.flavors);
 assert.throws(()=>checkInventory(paths.filter(p=>p!=='flavors/grape/index.html'),release.deliveries,release.flavors));
 assert.throws(()=>checkInventory([...paths,'flavors/unapproved/index.html'],release.deliveries,release.flavors));
});
