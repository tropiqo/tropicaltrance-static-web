import { isIP } from 'node:net';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseJson, validateSchema } from './closed-json.mjs';

const fail = message => { throw Error(`Sales channel validation failed: ${message}`); };
const phone = value => /^[1-9][0-9]{7,14}$/.test(value);

export function validateDestination(channel) {
  const value = channel.destinationUrl;
  if (value === null) {
    if (channel.enabled) fail(`enabled channel ${channel.id} requires a destination URL`);
    return;
  }
  if (typeof value !== 'string' || value !== value.trim() || /[\\\u0000-\u0020]/.test(value)) fail(`malformed destination for ${channel.id}`);
  let url;
  try { url = new URL(value); } catch { fail(`malformed destination for ${channel.id}`); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port || url.hash) fail(`unsafe destination for ${channel.id}`);
  if (channel.kind === 'whatsapp') {
    const waMe = url.hostname === 'wa.me' && phone(url.pathname.slice(1)) && !url.search;
    const api = url.hostname === 'api.whatsapp.com' && url.pathname === '/send' && [...url.searchParams.keys()].join(',') === 'phone' && phone(url.searchParams.get('phone'));
    if (!waMe && !api) fail(`invalid WhatsApp destination for ${channel.id}`);
  } else if (channel.id === 'whatsapp') {
    fail('the whatsapp channel ID must use WhatsApp destination validation');
  } else {
    if (url.hostname === 'localhost' || !url.hostname.includes('.') || isIP(url.hostname)) fail(`invalid external website destination for ${channel.id}`);
  }
}

export function loadSalesChannels({ base = process.cwd(), flavors = [] } = {}) {
  const file = resolve(base, 'content/sales-channels.json');
  const schema = resolve(base, 'schemas/sales-channels.schema.json');
  const stat=lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('configuration must be a regular, non-symlink file');
  const config = validateSchema(parseJson(readFileSync(file)), schema);
  const ids = new Set();
  for (const channel of config.channels) {
    if (ids.has(channel.id)) fail(`duplicate channel ID ${channel.id}`);
    ids.add(channel.id);
    validateDestination(channel);
    if (channel.flavors) for (const slug of channel.flavors) {
      if (!flavors.includes(slug)) fail(`unknown Flavor association ${slug} on ${channel.id}`);
    }
  }
  return config.channels;
}

export function channelsForFlavor(channels, flavor) {
  return channels.filter(channel => channel.enabled && (channel.flavors === undefined || channel.flavors.includes(flavor.slug)))
    .map(({ id, name, destinationUrl }) => ({
      id,
      name,
      destinationUrl,
      accessibleLabel: `Find ${flavor.name} at ${name} (opens in a new tab)`,
    }));
}
