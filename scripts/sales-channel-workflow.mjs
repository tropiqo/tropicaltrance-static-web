import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, readFileSync, rmSync, renameSync, writeFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawnSync } from 'node:child_process';
import { loadRelease } from './public-inputs.mjs';
import { loadSalesChannels } from './sales-channels.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const idPattern = /^[a-z][a-z0-9-]*$/;
const configFile = base => join(base, 'content/sales-channels.json');
const pretty = value => JSON.stringify(value, null, 2) + '\n';

function readConfig(base) {
  const path = configFile(base), stat = lstatSync(path);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Sales-channel configuration must be a regular file');
  const bytes = readFileSync(path);
  const config = JSON.parse(bytes.toString('utf8'));
  assert(config.contractVersion === '1' && Array.isArray(config.channels), 'Invalid sales-channel configuration');
  return { config, bytes };
}

function validateCandidate(base, config) {
  const temp = mkdtempSync(join(tmpdir(), 'tt-channel-candidate-'));
  try {
    cpSync(join(base, 'schemas'), join(temp, 'schemas'), { recursive: true });
    mkdirSync(join(temp, 'content'));
    writeFileSync(configFile(temp), pretty(config));
    const flavors = loadRelease({ base }).flavors.map(flavor => flavor.slug);
    loadSalesChannels({ base: temp, flavors });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateName(name) {
  assert(typeof name === 'string' && name.trim() && name.trim() === name, 'Channel name must be non-empty trimmed text');
}

export function planChannelChange({ operation, id, options = {}, base = root }) {
  assert(['add', 'update', 'disable', 'remove'].includes(operation), `Unknown channel operation: ${operation}`);
  assert(typeof id === 'string' && idPattern.test(id), `Invalid channel ID: ${id}`);
  const { config, bytes } = readConfig(base);
  const oldChannels = config.channels;
  const index = oldChannels.findIndex(channel => channel.id === id);
  let nextChannels;
  if (operation === 'add') {
    assert(index === -1, `Channel already exists: ${id}`);
    assert(options.clearDestination !== true && options.allFlavors !== true, 'Option is not supported when adding a channel');
    const name = options.name;
    validateName(name);
    const kind = options.kind ?? 'website';
    assert(['website', 'whatsapp'].includes(kind), `Invalid channel kind: ${kind}`);
    const channel = { id, name, kind, destinationUrl: options.destinationUrl ?? null, enabled: false };
    if (options.flavors !== undefined) channel.flavors = options.flavors;
    nextChannels = [...oldChannels, channel];
  } else {
    assert(index !== -1, `Unknown channel: ${id}`);
    const old = oldChannels[index];
    if (operation === 'update') {
      assert(!old.enabled, 'Disable an enabled channel before updating it');
      assert(options.kind === undefined, 'Channel kind is fixed when the channel is registered');
      const next = { ...old };
      if (options.name !== undefined) { validateName(options.name); next.name = options.name; }
      if (options.destinationUrl !== undefined) next.destinationUrl = options.destinationUrl;
      if (options.clearDestination) next.destinationUrl = null;
      if (options.flavors !== undefined) next.flavors = options.flavors;
      if (options.allFlavors) delete next.flavors;
      assert(JSON.stringify(next) !== JSON.stringify(old), 'Update contains no changes');
      nextChannels = oldChannels.map((channel, at) => at === index ? next : channel);
    } else if (operation === 'disable') {
      assert(old.enabled, `Channel is already disabled: ${id}`);
      nextChannels = oldChannels.map((channel, at) => at === index ? { ...channel, enabled: false } : channel);
    } else {
      assert(!old.enabled, 'Disable the channel before removing it');
      nextChannels = oldChannels.filter((_, at) => at !== index);
    }
  }
  const nextConfig = { ...config, channels: nextChannels };
  validateCandidate(base, nextConfig);
  return { operation, id, base, before: bytes, oldChannels, nextConfig, nextChannels };
}

export function applyChannelChange(candidate, { confirm = true, runValidation = () => {} } = {}) {
  const path = configFile(candidate.base), current = readFileSync(path);
  assert(current.equals(candidate.before), 'Sales-channel configuration changed during preview; prepare the candidate again');
  if (!confirm) return false;
  const temp = `${path}.channel-workflow-${process.pid}.tmp`;
  let installed = false;
  try {
    writeFileSync(temp, pretty(candidate.nextConfig), { flag: 'wx' });
    renameSync(temp, path); installed = true;
    runValidation();
  } catch (error) {
    rmSync(temp, { force: true });
    if (installed) writeFileSync(path, candidate.before);
    throw error;
  }
  return true;
}

function parseArgs(argv) {
  const [operation, id, ...rest] = argv;
  const options = { developmentOnly: false, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--development-only') options.developmentOnly = true;
    else if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--clear-destination') options.clearDestination = true;
    else if (flag === '--all-flavors') options.allFlavors = true;
    else if (['--name', '--kind', '--destination', '--flavors'].includes(flag)) {
      assert(i + 1 < rest.length && !rest[i + 1].startsWith('--'), `${flag} requires a value`);
      const value = rest[++i];
      if (flag === '--name') options.name = value;
      if (flag === '--kind') options.kind = value;
      if (flag === '--destination') options.destinationUrl = value;
      if (flag === '--flavors') options.flavors = value === 'none' ? [] : value.split(',');
    } else throw Error(`Unknown option: ${flag}`);
  }
  assert(options.developmentOnly, 'Local channel changes require --development-only');
  assert(!(options.clearDestination && options.destinationUrl !== undefined), 'Choose either --destination or --clear-destination');
  assert(!(options.allFlavors && options.flavors !== undefined), 'Choose either --all-flavors or --flavors');
  if (operation !== 'update') assert(!options.clearDestination && !options.allFlavors, `Options are not supported for ${operation}`);
  if (operation !== 'add' && operation !== 'update') assert(!options.name && !options.kind && options.destinationUrl === undefined && options.flavors === undefined, `Metadata options are not supported for ${operation}`);
  return { operation, id, options };
}

async function main() {
  const { operation, id, options } = parseArgs(process.argv.slice(2));
  assert(operation, 'Usage: npm run channel:<add|update|disable|remove> -- <id> --development-only [options]');
  if (!options.dryRun) assert(stdin.isTTY && stdout.isTTY, 'Interactive terminal required; use --dry-run for a non-applying preview');
  const candidate = planChannelChange({ operation, id, options, base: root });
  console.log(`Candidate ${operation}: ${id}`);
  console.log(pretty({ before: candidate.oldChannels.find(channel => channel.id === id) ?? null, after: candidate.nextChannels.find(channel => channel.id === id) ?? null }));
  console.log('All candidate channels pass the existing schema, HTTPS destination, and flavor-association checks. This does not grant commercial approval or activation.');
  if (options.dryRun) return;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question('Apply this development-only change? [y/N] ');
    if (!/^y(es)?$/i.test(answer.trim())) { console.log('Cancelled; no files changed.'); return; }
  } finally { prompt.close(); }
  applyChannelChange(candidate, { runValidation: () => {
    const result = spawnSync('npm', ['run', 'validate'], { cwd: root, stdio: 'inherit' });
    assert.equal(result.status, 0, `npm run validate failed with exit ${result.status}`);
  } });
  console.log('Channel configuration updated; channel remains disabled.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch(error => { console.error(`Channel workflow failed: ${error.message}`); process.exitCode = 1; });
}
