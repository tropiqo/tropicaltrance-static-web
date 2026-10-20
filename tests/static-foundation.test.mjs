import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSource, checkOutput, checkInventory, checkHtml, checkConfig, routes } from '../scripts/check-static.mjs';

test('static source/config and empty validated release', async () => { await checkSource(); });
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
