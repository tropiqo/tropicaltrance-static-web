import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRelease } from '../scripts/public-inputs.mjs';

const root = process.cwd();
const validDestination = 'https://wa.me/5215555555555';
const validEmail = 'contact+tropical@example.com';

function websiteCopy() {
  const base = mkdtempSync(join(tmpdir(), 'tt-contact-'));
  for (const path of ['src', 'scripts', 'schemas', 'content', 'public-astro', 'tests', 'review-assets', 'astro.config.mjs', 'package.json', 'package-lock.json']) {
    cpSync(resolve(root, path), join(base, path), { recursive: true });
  }
  const configPath = join(base, 'astro.config.mjs');
  writeFileSync(configPath, readFileSync(configPath, 'utf8').replace('vite: { resolve:', `vite: { cacheDir: '${join(base, '.vite-cache')}', resolve:`));
  symlinkSync(join(root, 'node_modules'), join(base, 'node_modules'), 'dir');
  return base;
}

function build(base) {
  const result = spawnSync('npm', ['run', 'build'], { cwd: base, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
}

function setDestination(base, destination, omit = false, email = null) {
  const path = join(base, 'content/site.json');
  const site = JSON.parse(readFileSync(path, 'utf8'));
  if (omit) delete site.contact;
  else site.contact = { businessEmail: email, whatsappBusinessUrl: destination };
  writeFileSync(path, JSON.stringify(site, null, 2) + '\n');
}

test('Contact and footer show the placeholder without a destination and retain safe site notices', () => {
  const base = websiteCopy();
  try {
    const release = loadRelease({ base });
    assert.equal(release.site.contact.whatsappBusinessUrl, null);
    assert.equal(release.site.contact.businessEmail, null);
    assert.deepEqual(release.flavors.flatMap(flavor => flavor.salesChannels), []);
    const contact = readFileSync(join(root, 'dist/contact/index.html'), 'utf8').replaceAll('&#39;', "'");
    const spanish = readFileSync(join(root, 'dist/es/contact/index.html'), 'utf8');
    const home = readFileSync(join(root, 'dist/index.html'), 'utf8');
    assert.match(contact, /<h1[^>]*>Let's Connect<\/h1>/);
    assert.match(contact, /Have a question or want to connect with Tropical Trance\? We'd love to hear from you\./);
    assert.match(contact, /<h2[^>]*>Choose how to reach us<\/h2>/);
    assert.match(contact, /Contact destinations are not configured in this development build/);
    assert.match(spanish, /Los destinos de contacto no están configurados en esta versión de desarrollo/);
    assert(!contact.includes('Message us on WhatsApp'));
    assert(!contact.includes('href="https://wa.me/'));
    for (const html of [contact, home]) {
      assert.match(html, /Tropical Trance/);
      assert.match(html, /Stay Curious\. Stay Tropical\./);
      assert.match(html, /Follow your curiosity into a world where imagination takes the lead\./);
      assert.match(html, /aria-label="Footer"/);
      for (const href of ['/', '/flavors/', '/about/', '/contact/']) assert(html.includes(`href="${href}"`));
      assert.match(html, /Local development preview — not a public release\./);
      assert.match(html, /name="robots" content="noindex, nofollow"/);
    }
    assert(!contact.includes('Where to Find Us'));
    assert(!readFileSync(join(root, 'dist/flavors/grape/index.html'), 'utf8').includes('Where to Find Us'));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('optional exact HTTPS wa.me destination renders only as a safe Contact action', () => {
  const base = websiteCopy();
  try {
    setDestination(base, validDestination, false, null);
    assert.equal(loadRelease({ base }).site.contact.whatsappBusinessUrl, validDestination);
    const channels = JSON.parse(readFileSync(join(base, 'content/sales-channels.json'), 'utf8'));
    assert(channels.channels.every(channel => !channel.enabled && channel.destinationUrl === null));
    build(base);
    const contact = readFileSync(join(base, 'dist/contact/index.html'), 'utf8');
    const home = readFileSync(join(base, 'dist/index.html'), 'utf8');
    assert.match(contact, /href="https:\/\/wa\.me\/5215555555555" target="_blank" rel="noopener noreferrer" aria-label="Message Tropical Trance on WhatsApp \(opens in a new tab\)"/);
    assert.match(contact, /Message us on WhatsApp/);
    assert(!home.includes('https://wa.me/'));
    assert(!readFileSync(join(base, 'dist/flavors/grape/index.html'), 'utf8').includes('https://wa.me/'));
    assert(!contact.includes('Where to Find Us'));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('business email only renders a safe localized mailto link', () => {
  const base = websiteCopy();
  try {
    setDestination(base, null, false, validEmail);
    assert.equal(loadRelease({ base }).site.contact.businessEmail, validEmail);
    build(base);
    const contact = readFileSync(join(base, 'dist/contact/index.html'), 'utf8');
    const spanish = readFileSync(join(base, 'dist/es/contact/index.html'), 'utf8');
    assert.match(contact, /href="mailto:contact%2Btropical@example\.com" aria-label="Email Tropical Trance at contact\+tropical@example\.com"/);
    assert.match(contact, /Business email/);
    assert.match(spanish, /href="mailto:contact%2Btropical@example\.com" aria-label="Enviar correo a Tropical Trance a contact\+tropical@example\.com"/);
    assert.match(spanish, /Correo de negocios/);
    assert(!contact.includes('https://wa.me/'));
    assert(!readFileSync(join(base, 'dist/flavors/grape/index.html'), 'utf8').includes(validEmail));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('both independently configured customer contact methods render together', () => {
  const base = websiteCopy();
  try {
    setDestination(base, validDestination, false, validEmail);
    build(base);
    const contact = readFileSync(join(base, 'dist/contact/index.html'), 'utf8');
    const spanish = readFileSync(join(base, 'dist/es/contact/index.html'), 'utf8');
    assert(contact.includes('mailto:contact%2Btropical@example.com'));
    assert(contact.includes(validDestination));
    assert(spanish.includes('Escribir a Tropical Trance'));
    assert(spanish.includes('Escríbenos por WhatsApp'));
    assert(!contact.includes('development build'));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('site contact destination may be absent and malformed or unsafe WhatsApp URLs fail closed', () => {
  const base = websiteCopy();
  try {
    setDestination(base, undefined, true);
    assert.equal(loadRelease({ base }).site.contact, undefined);
    for (const destination of [
      'http://wa.me/5215555555555',
      'javascript:alert(1)',
      'https://wa.me/not-a-number',
      'https://wa.me/5215555555555?text=hello',
      'https://wa.me.evil.example/5215555555555',
      'https://user@wa.me/5215555555555',
      'https://wa.me:443/5215555555555',
      'https://wa.me/5215555555555\n',
    ]) {
      setDestination(base, destination);
      assert.throws(() => loadRelease({ base }), /schema|WhatsApp Business destination/i, destination);
    }
    for (const email of ['not-an-email', 'name@localhost', 'name..dots@example.com', 'name@example..com', 'name@example.com\n', 'name@example.com?subject=x', 'a'.repeat(65)+'@example.com']) {
      setDestination(base, null, false, email);
      assert.throws(() => loadRelease({ base }), /schema|business email destination/i, email);
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('review build contact remains isolated from normal contact configuration', () => {
  const base = websiteCopy();
  try {
    setDestination(base, validDestination, false, validEmail);
    const result = spawnSync('node', ['scripts/build-review.mjs'], { cwd: base, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    for (const path of ['contact/index.html', 'es/contact/index.html']) {
      const html = readFileSync(join(base, '.review-build', path), 'utf8');
      assert(!html.includes('mailto:'));
      assert(!html.includes('https://wa.me/'));
      assert.match(html, /INTERNAL SYNTHETIC TEST ONLY/);
      assert.match(html, /noindex, nofollow/);
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
});
