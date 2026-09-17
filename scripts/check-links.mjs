#!/usr/bin/env node
/** Internal link and asset checker: every relative href AND src in every HTML
 *  file must resolve to a real file/directory in the repo. Runs as part of
 *  `npm run build`, and the build fails if anything is missing.
 *
 *  Why src is checked, and why the build fails rather than warns:
 *
 *  On 16 Sep 2026 the recommended-mount block shipped referencing three photos
 *  that had not been committed yet — the files arrived fifteen hours later.
 *  This script existed at the time and passed, because it only looked at href.
 *
 *  A missing image is not a cosmetic problem on this site. `_headers` gives
 *  /assets/img/* a `Cache-Control: public, max-age=604800`, and Netlify applies
 *  that header to 404 responses as well as to real files. So every visitor in
 *  that window had "this image does not exist" pinned in their browser cache
 *  for SEVEN DAYS. Shipping the files afterwards did not help them: the browser
 *  never re-requested the URL. The only cure was renaming the files, which is
 *  why they now carry content hashes.
 *
 *  So: a broken src here is a week-long outage for anyone who loads the page
 *  before the fix, and it is invisible to whoever shipped it. Hence a hard fail.
 */
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

/** Resolve one relative URL against the page that references it. */
function resolves(page, url, { mustBeFile }) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return true;
  const base = clean.startsWith('/') ? join(ROOT, clean) : resolve(dirname(page), clean);
  if (!existsSync(base)) return false;
  // A link may point at a directory that has an index.html; an asset may not.
  if (statSync(base).isFile()) return true;
  return mustBeFile ? false : existsSync(join(base, 'index.html'));
}

const EXTERNAL = /^(https?:|mailto:|tel:|data:|#|\/\/)/;
let bad = 0;
let checkedLinks = 0;
let checkedAssets = 0;

for (const page of pages(ROOT)) {
  const html = readFileSync(page, 'utf8');

  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (EXTERNAL.test(href)) continue;
    checkedLinks++;
    if (!resolves(page, href, { mustBeFile: false })) {
      console.log(`  ✗ link   ${relative(ROOT, page)} → ${href}`);
      bad++;
    }
  }

  // src on img/script/video/source/iframe, plus every candidate in a srcset.
  for (const m of html.matchAll(/\bsrc="([^"]+)"/g)) {
    const src = m[1];
    if (EXTERNAL.test(src)) continue;
    checkedAssets++;
    if (!resolves(page, src, { mustBeFile: true })) {
      console.log(`  ✗ asset  ${relative(ROOT, page)} → ${src}`);
      bad++;
    }
  }
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const candidate of m[1].split(',')) {
      const src = candidate.trim().split(/\s+/)[0];
      if (!src || EXTERNAL.test(src)) continue;
      checkedAssets++;
      if (!resolves(page, src, { mustBeFile: true })) {
        console.log(`  ✗ srcset ${relative(ROOT, page)} → ${src}`);
        bad++;
      }
    }
  }
}

console.log('');
if (bad === 0) {
  console.log(`  ✓ ${checkedLinks} internal links and ${checkedAssets} assets all resolve`);
} else {
  console.log(`  ${bad} broken reference(s) — NOT deployable.`);
  console.log('  A missing asset under /assets/img/ is cached as a 404 for a week.');
}
console.log('');
process.exit(bad === 0 ? 0 : 1);
