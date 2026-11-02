import fs from 'node:fs';
import path from 'node:path';
// Load ../.env.local for local dev (never logged). In prod, platform env vars are used.
for (const p of [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '../.env.local')]) {
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
export const env = (k: string, d = '') => process.env[k] ?? d;
