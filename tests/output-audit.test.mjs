import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditRendered } from '../scripts/rendered-audit.mjs';
import { checkOutput } from '../scripts/check-static.mjs';

function specimen(change, verify = auditRendered) {
  const base = mkdtempSync(join(tmpdir(), 'tt-html-audit-'));
  cpSync('dist', join(base, 'dist'), { recursive: true });
  const page = join(base, 'dist/index.html');
  try {
    change(page, base);
    return verify(base, 'dist');
  } finally { rmSync(base, { recursive: true, force: true }); }
}
const edit = change => page => writeFileSync(page, change(readFileSync(page, 'utf8')));
const insert = text => edit(html => html.replace('</main>', text + '</main>'));

test('parsed generated pages pass; entity-aware names and single-quoted valid URLs are understood', () => {
  specimen(edit(html => html.replace('href="/flavors/"', "href='/flavors/'")));
  specimen(insert('<a href="/about/">About &amp; more</a>'));
});
for (const [name, mutation, reason] of [
  ['single-quoted broken link', insert("<a href='/missing/'>Missing</a>"), /Broken resource/],
  ['broken fragment', insert('<a href="/#absent">Missing</a>'), /Broken fragment/],
  ['comment pretending to be an anchor', insert('<!-- id="absent" --><a href="/#absent">Missing</a>'), /Broken fragment/],
  ['missing srcset asset', insert('<link rel="preload" imagesrcset="/absent.webp 1x, /absent2.webp 2x">'), /Broken resource/],
  ['unreviewed canonical', edit(html => html.replace('</head>', '<link rel="canonical" href="/about/"></head>')), /Unexpected canonical/],
  ['missing description', edit(html => html.replace(/<meta name="description"[^>]*>/, '')), /metadata: description/],
  ['missing language', edit(html => html.replace('lang="en"', '')), /lang/],
  ['missing charset', edit(html => html.replace(/<meta charset="utf-8"[^>]*>/, '')), /charset/],
  ['missing title', edit(html => html.replace(/<title>[\s\S]*?<\/title>/, '')), /one title/],
  ['missing noindex', edit(html => html.replace('noindex, nofollow', 'nofollow')), /noindex/],
  ['duplicate id', insert('<div id="main"></div>'), /Duplicate/],
  ['skipped heading', insert('<h4>Skipped</h4>'), /heading level/],
  ['nameless link', insert('<a href="/about/"><span aria-hidden="true">↗</span></a>'), /Unnamed a/],
  ['missing meaningful alt', insert('<img src="/missing.webp">'), /meaningful alt/],
  ['exposed decoration', edit(html => html.replace('class="tropical-atmosphere" aria-hidden="true"', 'class="tropical-atmosphere"')), /Decoration exposed/],
  ['broken labelledby', insert('<section aria-labelledby="absent"></section>'), /Broken aria-labelledby/],
  ['zoom-disabled viewport', edit(html => html.replace('width=device-width, initial-scale=1', 'width=device-width, user-scalable=no')), /restricts zoom/],
  ['external URL', insert('<a href="https://example.invalid/">External</a>'), /External/],
  ['positive tabindex', insert('<a href="/" tabindex="2">Home</a>'), /Positive tabindex/],
  ['inline handler', insert('<a href="/" onclick="void(0)">Home</a>'), /Inline event/],
  ['private evidence leakage', insert('<p>authorityEvidence</p>'), /Private evidence/],
]) test(`rendered audit rejects ${name}`, () => assert.throws(() => specimen(mutation), reason));

test('normal full output check rejects previously missed broken quoted link', async () => {
  // Keep the temporary tree alive while the asynchronous full check runs.
  const base = mkdtempSync(join(tmpdir(), 'tt-full-audit-'));
  try {
    for (const path of ['dist','schemas','content','public-astro']) cpSync(path, join(base,path), {recursive:true});
    insert("<a href='/missing/'>Missing</a>")(join(base, 'dist/index.html'));
    await assert.rejects(() => checkOutput(base), /Broken resource/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
test('unreferenced CSS and CSS-dependent resources/maps fail rather than extending inventory', () => {
  assert.throws(() => specimen((page, base) => writeFileSync(join(base, 'dist/_astro/unreferenced.css'), 'body {}')), /Unreferenced/);
  for (const content of ['body { background: url(/missing.png); }', '@import "/other.css";', '/*# sourceMappingURL=other.css.map */']) {
    assert.throws(() => specimen((page, base) => {
      const html = readFileSync(page, 'utf8'), css = html.match(/href="(\/_astro\/[^"]+\.css)"/)[1];
      writeFileSync(join(base, 'dist', css.slice(1)), content);
    }), /Unreviewed CSS/);
  }
});
