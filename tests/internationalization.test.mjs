import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages, localizePath, validateMessages } from '../src/i18n/messages.mjs';
import { localizeFlavor } from '../src/i18n/localize.mjs';
import { loadRelease } from '../scripts/public-inputs.mjs';

test('English and Mexican Spanish dictionaries have the same complete, non-empty key set', () => {
  const keys = validateMessages();
  assert(keys.includes('about.playVideo'));
  assert(keys.includes('contact.whatsappLabel'));
  assert.equal(getMessages('en').language, 'en');
  assert.equal(getMessages('es-MX').language, 'es-MX');
  assert.throws(() => getMessages('es'), /Unsupported locale/);
});

test('locale URL mapping keeps page and flavor slug and falls back home for unsupported routes', () => {
  for (const path of ['/', '/about/', '/flavors/', '/flavors/cherry/', '/flavors/grape/', '/flavors/lime/', '/contact/', '/404.html']) {
    assert.equal(localizePath(path, 'es-MX'), path === '/' ? '/es/' : path === '/404.html' ? '/es/404/' : `/es${path}`);
  }
  for (const path of ['/es/', '/es/about/', '/es/flavors/cherry/', '/es/flavors/grape/', '/es/flavors/lime/', '/es/contact/', '/es/404/']) {
    assert.equal(localizePath(path, 'en'), path === '/es/' ? '/' : path === '/es/404/' ? '/404.html' : path.slice(3));
  }
  assert.equal(localizePath('/unsupported/', 'es-MX'), '/es/');
});

test('all local flavors have complete bilingual metadata and expected identities', () => {
  const release = loadRelease();
  assert.deepEqual(release.flavors.map(flavor => flavor.slug).sort(), ['cherry', 'grape', 'lime']);
  assert.deepEqual(release.flavors.filter(flavor => ['grape', 'lime'].includes(flavor.slug)).map(flavor => flavor.slug), ['grape', 'lime']);
  for (const flavor of release.flavors) {
    assert.match(flavor.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const value of [flavor.name, flavor.shortDescription, flavor.alt, flavor.translations['es-MX'].shortDescription, flavor.translations['es-MX'].alt]) {
      assert.equal(typeof value, 'string');
      assert(value.trim().length > 0);
    }
    const localized = localizeFlavor(flavor, 'es-MX');
    assert.equal(localized.name, flavor.name);
    assert.equal(localized.mediaUrl, flavor.mediaUrl);
    assert.equal(localized.shortDescription, flavor.translations['es-MX'].shortDescription);
    assert.equal(localized.alt, flavor.translations['es-MX'].alt);
  }
});
