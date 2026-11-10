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
  const stories = {
    grapeEn: { title: 'A sample English story.', paragraphs: ['First English sample paragraph.', 'Second English sample paragraph.'] },
    grapeEs: { title: 'Un relato de ejemplo.', paragraphs: ['Primer párrafo de ejemplo.', 'Segundo párrafo de ejemplo.'] },
    cherryEn: {
      title: 'Crimson Rush',
      paragraphs: [
        'Beyond the last bend of the tropical jungle, a crimson road appears. Twisting cherry stems rise above the canopy, forming impossible curves beneath a sky glowing deep red.',
        'Trancy takes the wheel and races through the night, passing luminous cherries and sweeping around gravity-defying turns as the jungle unfolds in a blur of color.',
        'This is Cherry at full speed. Bold, electric, and always one turn away from the unexpected.',
      ],
    },
    cherryEs: {
      title: 'Impulso Carmesí',
      paragraphs: [
        'Más allá de la última curva de la selva tropical, aparece un camino carmesí. Tallos de cereza se elevan sobre las copas de los árboles, formando curvas imposibles bajo un cielo teñido de rojo intenso.',
        'Trancy toma el volante y acelera por la noche, pasando junto a cerezas luminosas y recorriendo curvas que desafían la gravedad, mientras la selva se convierte en un torbellino de color.',
        'Así es Cherry a toda velocidad. Audaz, electrizante y siempre a una curva de lo inesperado.',
      ],
    },
    limeEn: {
      title: 'Citrus Labyrinth',
      paragraphs: [
        'Hidden beneath the tropical canopy lies a labyrinth unlike any other. Towering lime slices form luminous walls, while winding vines and shifting pathways lead deeper into an emerald world.',
        'Trancy follows a trail of glowing citrus light, discovering secret passages and impossible patterns as the maze transforms with every step.',
        'This is Lime beyond the familiar. Bright, intriguing, and full of unexpected discoveries.',
      ],
    },
    limeEs: {
      title: 'Laberinto Cítrico',
      paragraphs: [
        'Oculto bajo el follaje tropical se encuentra un laberinto como ningún otro. Enormes rodajas de limón forman muros luminosos, mientras enredaderas y senderos cambiantes conducen hacia un mundo esmeralda.',
        'Trancy sigue un rastro de luz cítrica y descubre pasadizos secretos y patrones imposibles, mientras el laberinto se transforma a cada paso.',
        'Así es Lime más allá de lo conocido. Brillante, intrigante y lleno de descubrimientos inesperados.',
      ],
    },
  };
  const allStoryText = Object.values(stories).flatMap(story => [story.title, ...story.paragraphs]);
  const routes = [
    { path: '/flavors/grape/', locale: 'en', story: stories.grapeEn },
    { path: '/es/flavors/grape/', locale: 'es-MX', story: stories.grapeEs },
    { path: '/flavors/cherry/', locale: 'en', story: stories.cherryEn },
    { path: '/es/flavors/cherry/', locale: 'es-MX', story: stories.cherryEs },
    { path: '/flavors/lime/', locale: 'en', story: stories.limeEn },
    { path: '/es/flavors/lime/', locale: 'es-MX', story: stories.limeEs },
  ];

  for (const route of routes) {
    await page.goto(`${origin}${route.path}`);
    await expect(page.locator('html')).toHaveAttribute('lang', route.locale);
    const story = page.locator('.flavor-story');
    await expect(story).toHaveCount(1);
    await expect(story.getByRole('heading', { level: 3, name: route.story.title })).toBeVisible();
    await expect(story.locator('.story-copy p')).toHaveText(route.story.paragraphs);
    for (const otherStoryText of allStoryText.filter(text => ![route.story.title, ...route.story.paragraphs].includes(text))) {
      await expect(page.getByText(otherStoryText, { exact: true })).toHaveCount(0);
    }
  }

  for (const path of ['/', '/es/', '/flavors/', '/es/flavors/']) {
    await page.goto(`${origin}${path}`);
    await expect(page.locator('.flavor-story')).toHaveCount(0);
    for (const storyText of allStoryText) await expect(page.getByText(storyText, { exact: true })).toHaveCount(0);
  }
});
