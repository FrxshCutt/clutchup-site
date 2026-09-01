#!/usr/bin/env node
/** Internal link checker: every relative href in every HTML file must resolve
 *  to a real file/directory in the repo. Run before every deploy. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', '.github', 'scripts']);

function pages(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (e.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let bad = 0;
for (const page of pages(ROOT)) {
  const html = readFileSync(page, 'utf8');
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#|tel:)/.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    const base = clean.startsWith('/') ? join(ROOT, clean) : resolve(dirname(page), clean);
    const ok = existsSync(base) &&
      (statSync(base).isFile() || existsSync(join(base, 'index.html')));
    if (!ok) { console.log(`✗ ${relative(ROOT, page)} → ${href}`); bad++; }
  }
}
console.log(bad === 0 ? '✓ all internal links resolve' : `${bad} broken link(s)`);
process.exit(bad === 0 ? 0 : 1);
