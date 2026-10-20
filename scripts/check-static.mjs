import assert from 'node:assert/strict';
import { loadRelease, rejectFixture } from './public-inputs.mjs';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRendered } from './rendered-audit.mjs';

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
export function checkInventory(paths) {
  assert.deepEqual(paths.filter(p => p.endsWith('.html')).sort(), [...routes].sort(), 'Unexpected static routes');
  assert(paths.every(p => routes.includes(p) || /^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)), 'Unexpected copied/generated file');
}
export function checkHtml(html) {
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
  assert(!/<(?:img|script|iframe|form|astro-island)\b/i.test(html), 'Unapproved media or client runtime');
  assert(!/THC|lab.test|handcrafted|all.natural|tropical mango|paradise pineapple|sunset strawberry|hello@/i.test(html), 'Legacy claim/content leak');
}
export function checkConfig(config) {
  assert.match(config, /output: 'static'/);
  assert.match(config, /publicDir: '\.\/public-astro'/);
  assert(!/adapter|integrations|output: 'server'/.test(config), 'Forbidden runtime config');
  assert(!/tropical-trance-studio|artwork-workspace|fetch\s*\(|https?:/.test(config), 'Forbidden external/private config dependency');
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
  assert.equal(loadRelease({ base }).flavors.length, 0, 'Change 007 normal release must be empty');
  const packageJson = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'));
  assert.deepEqual(packageJson.devDependencies, { astro: '7.3.8' });
  assert(!packageJson.dependencies);
  assert.equal(packageJson.engines.node, '24.21.0');
  assert.equal(packageJson.engines.npm, '11.19.0');
}
export async function checkOutput(base = root) {
  const dist = resolve(base, 'dist');
  const output = await files(dist);
  checkInventory(output.map(p => relative(dist, p)));
  for (const path of output) {
    const bytes = await readFile(path);
    rejectFixture(bytes);
    assert(!/tropical-trance-studio|artwork-workspace:|(?:\/Users\/|\/private\/)|authorityEvidence|reviewEvidenceContentId|candidateContentId|publication-decision|projection\.schema\.json/.test(bytes.toString('utf8')), 'Private schema/evidence/output leak');
  }
  for (const page of routes) {
    const path = resolve(dist, page);
    const html = await readFile(path, 'utf8');
    checkHtml(html);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const [href, fragment] = match[1].split('#');
      assert(!/^(?:https?:|mailto:|javascript:)/.test(href), 'Unexpected external destination');
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
