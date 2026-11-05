import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';

const root = process.cwd();
let isolatedRoot: string;
let origin: string;
let server: ReturnType<typeof createServer>;

test.beforeAll(async () => {
  isolatedRoot = mkdtempSync(join(tmpdir(), 'tt-website-editorial-e2e-'));
  for (const path of ['src', 'scripts', 'schemas', 'content', 'public-astro', 'astro.config.mjs', 'package.json', 'package-lock.json', '.npmrc']) {
    cpSync(join(root, path), join(isolatedRoot, path), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(isolatedRoot, 'node_modules'));
  const config = join(isolatedRoot, 'astro.config.mjs');
  writeFileSync(config, readFileSync(config, 'utf8').replace('vite: { resolve:', `vite: { cacheDir: '${join(isolatedRoot, '.vite-cache')}', resolve:`));

  const grape = JSON.parse(readFileSync(join(isolatedRoot, 'content/flavors/grape.json'), 'utf8'));
  const editorial = {
    contractVersion: '1',
    kind: 'website-editorial',
    flavor: { id: grape.slug, revision: grape.revision },
    story: { translations: {
      en: { title: 'A sample English story.', paragraphs: ['First English sample paragraph.', 'Second English sample paragraph.'] },
      'es-MX': { title: 'Un relato de ejemplo.', paragraphs: ['Primer párrafo de ejemplo.', 'Segundo párrafo de ejemplo.'] },
    } },
  };
  mkdirSync(join(isolatedRoot, 'content/editorial'), { recursive: true });
  writeFileSync(join(isolatedRoot, 'content/editorial/grape.json'), JSON.stringify(editorial, null, 2) + '\n');

  const build = spawnSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: isolatedRoot,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (build.status !== 0) throw new Error(`${build.stdout}\n${build.stderr}`);

  const dist = join(isolatedRoot, 'dist');
  const mime = new Map([['.html', 'text/html; charset=utf-8'], ['.css', 'text/css'], ['.js', 'text/javascript'], ['.webp', 'image/webp'], ['.mp4', 'video/mp4'], ['.txt', 'text/plain']]);
  server = createServer((request, response) => {
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    let file = resolve(dist, `.${pathname}`);
    if (file === dist) file = join(dist, 'index.html');
    if (!file.startsWith(`${dist}/`)) { response.writeHead(400).end(); return; }
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); }
    catch { file = join(dist, '404.html'); }
    try {
      const bytes = readFileSync(file);
      response.writeHead(file.endsWith('404.html') && pathname !== '/404.html' ? 404 : 200, { 'content-type': mime.get(extname(file)) ?? 'application/octet-stream' });
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Isolated editorial test server did not bind a TCP port');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise<void>(resolveClose => server.close(() => resolveClose()));
  if (isolatedRoot) rmSync(isolatedRoot, { recursive: true, force: true });
});

test('bilingual Website editorial renders only on the associated Flavor detail in each locale', async ({ page }) => {
  await page.goto(`${origin}/flavors/grape/`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const englishStory = page.locator('.flavor-story');
  await expect(englishStory.getByRole('heading', { level: 3, name: 'A sample English story.' })).toBeVisible();
  await expect(englishStory.locator('.story-copy p')).toHaveText(['First English sample paragraph.', 'Second English sample paragraph.']);
  await expect(page.getByText('Un relato de ejemplo.')).toHaveCount(0);

  await page.goto(`${origin}/es/flavors/grape/`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  const spanishStory = page.locator('.flavor-story');
  await expect(spanishStory.getByRole('heading', { level: 3, name: 'Un relato de ejemplo.' })).toBeVisible();
  await expect(spanishStory.locator('.story-copy p')).toHaveText(['Primer párrafo de ejemplo.', 'Segundo párrafo de ejemplo.']);
  await expect(page.getByText('A sample English story.')).toHaveCount(0);

  for (const path of ['/flavors/cherry/', '/flavors/lime/', '/es/flavors/cherry/', '/es/flavors/lime/']) {
    await page.goto(`${origin}${path}`);
    await expect(page.locator('.flavor-story')).toHaveCount(0);
    await expect(page.getByText('A sample English story.')).toHaveCount(0);
    await expect(page.getByText('Un relato de ejemplo.')).toHaveCount(0);
  }
});
