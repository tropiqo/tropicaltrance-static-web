import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  publicDir: './public-astro',
  vite: { resolve: { alias: { '#public-release': fileURLToPath(new URL('./src/lib/normal-release.mjs', import.meta.url)) } } },
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4321 },
});
