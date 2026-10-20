import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function auditRendered(base, directory, { indexingAuthorized = false } = {}) {
  const result = spawnSync('python3', ['-B', fileURLToPath(new URL('./audit-html.py', import.meta.url)), resolve(base, directory), indexingAuthorized ? '--indexing-authorized' : '--noindex'], { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout.trim();
}
