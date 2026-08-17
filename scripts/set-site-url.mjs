#!/usr/bin/env node
/**
 * scripts/set-site-url.mjs
 *
 * Stamps the site's public URL into the places that REQUIRE an absolute URL
 * (canonical links, OpenGraph/Twitter tags, sitemap) and fixes the 404 page's
 * link base. Everything else on the site uses relative paths, so the site
 * works at a domain root or under a project subpath without any changes.
 *
 *   node scripts/set-site-url.mjs https://yourname.github.io/clutchup
 *   node scripts/set-site-url.mjs https://clutchup.pages.dev
 *   node scripts/set-site-url.mjs https://clutchup.co.uk
 *
 * Safe to re-run — it remembers the value it last wrote.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATE = join(__dirname, '.site-url');
const PLACEHOLDER = 'https://SITE-URL-PLACEHOLDER';

const input = process.argv[2];
if (!input) {
  console.error('\nUsage: node scripts/set-site-url.mjs <https://your-site-url>\n');
  process.exit(1);
}

let url;
try {
  url = new URL(input);
} catch {
  console.error(`\n✗ "${input}" is not a valid URL. Include the https:// prefix.\n`);
  process.exit(1);
}

// Normalised base, no trailing slash. e.g. https://me.github.io/clutchup
const base = (url.origin + url.pathname).replace(/\/+$/, '');
// Path portion only, for the 404 page's root-relative links. '' at a domain root.
const basePath = url.pathname.replace(/\/+$/, '');

const prev = existsSync(STATE) ? readFileSync(STATE, 'utf8').trim() : '';
const prevPath = prev ? new URL(prev).pathname.replace(/\/+$/, '') : '';

/* ── Walk the site's text files ──────────────────────────────────────────── */

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'scripts']);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(html|xml|txt|webmanifest)$/.test(entry)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
let touched = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  // Absolute-URL metadata: replace the placeholder, or the value we wrote last time.
  after = after.split(PLACEHOLDER).join(base);
  if (prev && prev !== base) after = after.split(prev).join(base);

  after = writeIf(file, before, after);
}

/* ── 404 page: re-base its root-relative links ───────────────────────────── */

const notFound = join(ROOT, '404.html');
if (existsSync(notFound)) {
  const before = readFileSync(notFound, 'utf8');
  // Strip whatever base is currently applied, then apply the new one.
  const stripped = prevPath
    ? before.replace(new RegExp(`href="${escapeRe(prevPath)}/`, 'g'), 'href="/')
    : before;
  const after = basePath
    ? stripped.replace(/href="\//g, `href="${basePath}/`)
    : stripped;
  writeIf(notFound, before, after);
}

/* ── Sitemap ─────────────────────────────────────────────────────────────── */

const ROUTES = [
  { path: '/', priority: '1.0' },
  { path: '/how-it-works', priority: '0.8' },
  { path: '/pricing', priority: '0.8' },
  { path: '/support', priority: '0.9' },
  { path: '/privacy', priority: '0.5' },
  { path: '/terms', priority: '0.5' },
];

const today = new Date().toISOString().slice(0, 10);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ROUTES.map(
    (r) =>
      `  <url>\n` +
      `    <loc>${base}${r.path === '/' ? '/' : r.path}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `    <priority>${r.priority}</priority>\n` +
      `  </url>\n`
  ).join('') +
  `</urlset>\n`;

writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

writeFileSync(
  join(ROOT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
  'utf8'
);

writeFileSync(STATE, base + '\n', 'utf8');

console.log(`\n✓ Site URL set to ${base}`);
console.log(`  ${touched} file(s) updated, plus sitemap.xml and robots.txt`);
if (basePath) console.log(`  404 page links re-based to ${basePath}/`);
console.log('');

/* ── helpers ─────────────────────────────────────────────────────────────── */

function writeIf(file, before, after) {
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    touched++;
    console.log(`    ${relative(ROOT, file)}`);
  }
  return after;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
