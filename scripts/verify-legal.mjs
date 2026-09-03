#!/usr/bin/env node
/**
 * scripts/verify-legal.mjs
 *
 * Proves the rendered /privacy and /terms pages contain the app repo's legal
 * text VERBATIM — every word, in order, nothing added or dropped.
 *
 * Method: strip all tags from the rendered <article class="prose">, normalise
 * whitespace and markdown syntax out of the source markdown, and require the
 * two token streams to be identical. Also checks the version and effective
 * date shown on the page match the exported constants.
 *
 *   node scripts/verify-legal.mjs [path-to-app-repo]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');

const appRepo = [
  process.argv[2],
  process.env.CLUTCHUP_APP_REPO,
  resolve(SITE_ROOT, '..', 'routeready'),
  join(homedir(), 'routeready'),
].filter(Boolean).find((c) => existsSync(join(c, 'lib/legal/privacy.ts')));

if (!appRepo) {
  console.error('✗ Could not find the app repo.');
  process.exit(1);
}

/** Reduce a string to a comparable stream of words. */
const tokens = (s) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** The `# Title` line is rendered as the page <h1> in the header, not inside
 *  .prose — checked separately. Everything else must appear in the prose. */
function sourceText(md) {
  return md
    .split('\n')
    .filter((l) => !/^#\s+/.test(l))
    .map((l) => l.replace(/^\s*#{2,3}\s+/, '').replace(/^\s*-\s+/, ''))
    .join('\n')
    .replace(/\*\*/g, '');
}

function renderedText(html) {
  const m = html.match(/<article class="prose">([\s\S]*?)<div class="legal-foot-note">/);
  if (!m) throw new Error('Could not find the prose block in the rendered page.');
  return m[1]
    // Inline tags vanish (they sit mid-word/mid-punctuation); block tags
    // become a space so adjacent blocks don't run together.
    .replace(/<\/?(?:strong|em|b|i|a|code|span)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

const docs = [
  { prefix: 'PRIVACY', src: 'privacy.ts', out: 'privacy' },
  { prefix: 'TERMS', src: 'terms.ts', out: 'terms' },
];

let failed = false;
console.log('\nVerifying rendered legal pages against the app repo source…\n');

for (const doc of docs) {
  const src = readFileSync(join(appRepo, 'lib/legal', doc.src), 'utf8');
  const version = src.match(new RegExp(`${doc.prefix}_VERSION\\s*=\\s*'([^']+)'`))[1];
  const effective = src.match(new RegExp(`${doc.prefix}_EFFECTIVE_DATE\\s*=\\s*'([^']+)'`))[1];
  const md = src.match(new RegExp(`${doc.prefix}_MARKDOWN\\s*=\\s*\`([\\s\\S]*?)\`;`))[1];

  const page = readFileSync(join(SITE_ROOT, doc.out, 'index.html'), 'utf8');

  const a = tokens(sourceText(md));
  const b = tokens(renderedText(page));

  let ok = a.length === b.length;
  let firstDiff = -1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) { ok = false; firstDiff = i; break; }
  }

  // Version + date must be visible on the page
  const hasVersion = page.includes(`Version <b>${version}</b>`);
  const y = effective.slice(0, 4), mo = Number(effective.slice(5, 7)), d = Number(effective.slice(8, 10));
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const pretty = `${d} ${months[mo - 1]} ${y}`;
  const hasDate = page.includes(`Effective <b>${pretty}</b>`);

  if (ok && hasVersion && hasDate) {
    console.log(`  ✓ /${doc.out}`);
    console.log(`      ${a.length.toLocaleString()} words match the source exactly`);
    console.log(`      shows: Version ${version} · Effective ${pretty}\n`);
  } else {
    failed = true;
    console.log(`  ✗ /${doc.out}`);
    if (!ok) {
      console.log(`      word streams differ (source ${a.length}, rendered ${b.length})`);
      if (firstDiff >= 0) {
        console.log(`      first difference at word ${firstDiff}:`);
        console.log(`        source:   …${a.slice(Math.max(0, firstDiff - 6), firstDiff + 6).join(' ')}…`);
        console.log(`        rendered: …${b.slice(Math.max(0, firstDiff - 6), firstDiff + 6).join(' ')}…`);
      }
    }
    if (!hasVersion) console.log(`      version ${version} not shown on the page`);
    if (!hasDate) console.log(`      effective date "${pretty}" not shown on the page`);
    console.log('');
  }
}

/* ── One support address, everywhere ─────────────────────────────────────── */
/* The address is published in the Privacy Policy, so every mailto: on the site
   has to agree with it. This exists because it went wrong once: the address was
   changed across the site by hand while the /privacy and /terms page templates
   in build-legal.mjs kept the old one, and the two documents that matter most
   ended up telling people to write to a mailbox nobody reads. */

const privacyMd = readFileSync(join(appRepo, 'lib/legal/privacy.ts'), 'utf8');
const contact = privacyMd.match(/\*\*Contact:\*\*\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);

if (!contact) {
  console.log('  ✗ the Privacy Policy has no "**Contact:** <email>" line\n');
  failed = true;
} else {
  const expected = contact[1];
  const pages = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.html')) pages.push(full);
    }
  };
  walk(SITE_ROOT);

  const strays = new Map();
  for (const file of pages) {
    for (const [, addr] of readFileSync(file, 'utf8').matchAll(/mailto:([^"'?>\s]+)/g)) {
      if (addr !== expected) {
        const rel = file.slice(SITE_ROOT.length + 1);
        strays.set(`${rel} → ${addr}`, (strays.get(`${rel} → ${addr}`) || 0) + 1);
      }
    }
  }

  if (strays.size === 0) {
    console.log(`  ✓ support address`);
    console.log(`      every mailto: across ${pages.length} pages is ${expected}\n`);
  } else {
    failed = true;
    console.log('  ✗ support address');
    console.log(`      the Privacy Policy publishes ${expected}, but these disagree:`);
    for (const [where, n] of strays) console.log(`        ${where}${n > 1 ? ` (×${n})` : ''}`);
    console.log('');
  }
}

if (failed) {
  console.error('Verification FAILED — the website does not match the app documents.\n');
  process.exit(1);
}
console.log('All legal pages match the app repo source verbatim.\n');
