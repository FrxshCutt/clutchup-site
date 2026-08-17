#!/usr/bin/env node
/**
 * scripts/set-appstore-link.mjs
 *
 * Fills in every "Download on the App Store" link across the site.
 *
 * Until you run this, every download button points at the marker
 * `#APP_STORE_LINK_PLACEHOLDER` so it is obvious (and greppable) that the real
 * URL has not been set yet:
 *
 *   grep -rn "APP_STORE_LINK_PLACEHOLDER" .
 *
 * Then, once the app is live on the App Store:
 *
 *   node scripts/set-appstore-link.mjs https://apps.apple.com/gb/app/clutchup/id0000000000
 *
 * Safe to re-run — it remembers the value it last wrote. Note that /privacy and
 * /terms are generated, so run `npm run legal` BEFORE this script (or just run
 * `npm run build`, which does both in the right order).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATE = join(__dirname, '.appstore-link');
const PLACEHOLDER = '#APP_STORE_LINK_PLACEHOLDER';

const input = process.argv[2];
if (!input) {
  console.error(
    '\nUsage: node scripts/set-appstore-link.mjs <https://apps.apple.com/...>\n' +
      '   or: node scripts/set-appstore-link.mjs --reset   (back to the placeholder)\n'
  );
  process.exit(1);
}

const prev = existsSync(STATE) ? readFileSync(STATE, 'utf8').trim() : '';
const reset = input === '--reset';
let target;

if (reset) {
  target = PLACEHOLDER;
} else {
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:') throw new Error('not https');
    target = u.toString();
  } catch {
    console.error(`\n✗ "${input}" is not a valid https:// URL.\n`);
    process.exit(1);
  }
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'scripts']);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (entry.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let touched = 0;
let links = 0;

for (const file of walk(ROOT)) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  const current = prev && prev !== PLACEHOLDER ? prev : PLACEHOLDER;
  const count = after.split(current).length - 1;
  if (!count) continue;

  after = after.split(current).join(target);
  writeFileSync(file, after, 'utf8');
  touched++;
  links += count;
  console.log(`    ${relative(ROOT, file)} — ${count} link${count === 1 ? '' : 's'}`);
}

writeFileSync(STATE, target + '\n', 'utf8');

console.log(
  `\n✓ App Store link set to ${target}\n  ${links} link(s) across ${touched} file(s)\n`
);
