import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inventory, digest } from './public-inputs.mjs';
import { routes } from './check-static.mjs';
import { loadTrancyReview } from './trancy-review-release.mjs';
import { trancyReviewSelection as selected } from './trancy-review-identity.mjs';
import { auditRendered } from './rendered-audit.mjs';
export async function checkReviewOutput(base = process.cwd()) {
  const release = loadTrancyReview(base);
  const expected = [...routes,...release.flavors.map(f=>`flavors/${f.slug}/index.html`)];
  const files = inventory(base,'.review-build').map(p=>p.slice('.review-build/'.length));
  assert.deepEqual(files.filter(p=>p.endsWith('.html')).sort(),expected.sort());
  const media = [...release.deliveries.map(m=>m.path.split('/').at(-1)), selected.outputPath];
  assert.deepEqual(files.filter(p=>!p.endsWith('.html') && !/^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)).sort(), media.sort(), 'Exact review delivery inventory');
  assert(files.every(p=>expected.includes(p)||media.includes(p)||/^_astro\/[A-Za-z0-9_.-]+\.css$/.test(p)), 'Unexpected review output');
  for (const file of expected) {
    const html=readFileSync(resolve(base,'.review-build',file),'utf8');
    assert.match(html,/INTERNAL SYNTHETIC TEST ONLY/); assert.match(html,/noindex, nofollow/);
    assert.match(html,/LOCAL MASCOT REVIEW ONLY/);
    assert(!/<(?:script|iframe|form|astro-island)\b/i.test(html),'Client runtime forbidden');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const link=match[1].split('#')[0]; if (!link) continue;
      assert(link.startsWith('/') && !link.startsWith('//'),'External review resource');
      const path=link.slice(1)+(link.endsWith('/')?'index.html':''); assert(files.includes(path),'Broken review resource');
    }
  }
  for (const m of release.deliveries) assert.equal(digest(readFileSync(resolve(base,'.review-build',m.path.split('/').at(-1)))),m.asset.contentId);
  assert.equal(digest(readFileSync(resolve(base,'.review-build', selected.outputPath))), selected.contentId);
  for (const file of ['index.html', 'about/index.html']) {
    const html = readFileSync(resolve(base, '.review-build', file), 'utf8');
    assert.equal([...html.matchAll(/<img[^>]*src="\/review-media\/trancy-review-r1\.webp"/g)].length, 1, 'One shared Trancy delivery per page');
  }
  for (const file of expected.filter(p=>!['index.html','about/index.html'].includes(p))) assert(!readFileSync(resolve(base,'.review-build',file),'utf8').includes('/review-media/'), 'Mascot only on selected roles');
  const coral=readFileSync(resolve(base,'.review-build/flavors/fixture-coral/index.html'),'utf8');
  assert(!coral.includes('aria-label="Flavor story"'),'Absent optional editorial must be omitted');
  auditRendered(base, '.review-build');
}
