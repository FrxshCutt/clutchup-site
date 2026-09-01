#!/usr/bin/env node
/**
 * scripts/build-legal.mjs
 *
 * Renders /privacy and /terms from the ClutchUp APP REPO, which is the single
 * source of truth for both documents:
 *
 *   routeready/lib/legal/privacy.ts   → PRIVACY_VERSION / _EFFECTIVE_DATE / _MARKDOWN
 *   routeready/lib/legal/terms.ts     → TERMS_VERSION   / _EFFECTIVE_DATE   / _MARKDOWN
 *
 * The markdown is rendered VERBATIM — no paraphrasing, no editing, no
 * summarising. If the text changes in the app, bump the version there and
 * re-run this script; the website then matches the in-app documents exactly.
 *
 *   node scripts/build-legal.mjs [path-to-app-repo]
 *
 * Default app repo path: ../routeready relative to this site, then ~/routeready.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');

/* ── Locate the app repo ─────────────────────────────────────────────────── */

function findAppRepo() {
  const candidates = [
    process.argv[2],
    process.env.CLUTCHUP_APP_REPO,
    resolve(SITE_ROOT, '..', 'routeready'),
    join(homedir(), 'routeready'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(join(c, 'lib/legal/privacy.ts'))) return c;
  }
  console.error(
    '\n✗ Could not find the ClutchUp app repo (needs lib/legal/privacy.ts).\n' +
      '  Pass it explicitly:  node scripts/build-legal.mjs /path/to/routeready\n' +
      '  Tried:\n' + candidates.map((c) => '    ' + c).join('\n') + '\n'
  );
  process.exit(1);
}

/* ── Extract the exported constants ──────────────────────────────────────── */

function extract(source, prefix) {
  const pick = (name, re) => {
    const m = source.match(re);
    if (!m) throw new Error(`Could not find ${prefix}_${name} in the source file.`);
    return m[1];
  };

  const version = pick('VERSION', new RegExp(`export const ${prefix}_VERSION\\s*=\\s*'([^']+)'`));
  const effective = pick(
    'EFFECTIVE_DATE',
    new RegExp(`export const ${prefix}_EFFECTIVE_DATE\\s*=\\s*'([^']+)'`)
  );
  const markdown = pick(
    'MARKDOWN',
    new RegExp(`export const ${prefix}_MARKDOWN\\s*=\\s*\`([\\s\\S]*?)\`;`)
  );

  // The markdown is a plain template literal — any `${` would mean the text is
  // interpolated at runtime and could not be rendered faithfully here.
  if (markdown.includes('${')) {
    throw new Error(`${prefix}_MARKDOWN contains a template interpolation — cannot render verbatim.`);
  }
  return { version, effective, markdown };
}

/* ── Markdown → HTML (only the constructs these documents actually use) ──── */

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline: **bold**, then turn bare email addresses into mailto links. */
function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    '<a href="mailto:$1">$1</a>'
  );
  return out;
}

const slug = (s) =>
  'sec-' +
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Renders the document body. Returns { html, toc, title }.
 * Supported: # h1, ## h2, paragraphs (soft-wrapped), and `- ` bullet lists
 * with one level of nesting plus wrapped continuation lines.
 */
function renderMarkdown(md) {
  const lines = md.split('\n');
  const out = [];
  const toc = [];
  let title = '';

  let para = [];          // buffered paragraph lines
  let list = null;        // { items: [{ text, children: [] }] } | null
  let inNested = false;

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const render = (items) =>
      '<ul>' +
      items
        .map(
          (it) =>
            `<li>${inline(it.text)}${it.children.length ? render(it.children) : ''}</li>`
        )
        .join('') +
      '</ul>';
    out.push(render(list.items));
    list = null;
    inNested = false;
  };

  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (line.trim() === '') { flushAll(); continue; }

    // Headings
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) { flushAll(); title = h1[1].trim(); continue; }

    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      flushAll();
      const text = h2[1].trim();
      const id = slug(text);
      toc.push({ id, text });
      out.push(`<h2 id="${id}">${inline(text)}</h2>`);
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushAll(); out.push(`<h3>${inline(h3[1].trim())}</h3>`); continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { flushAll(); out.push('<hr>'); continue; }

    const indent = line.length - line.trimStart().length;
    const bullet = line.trimStart().match(/^-\s+(.*)$/);

    if (bullet) {
      flushPara();
      if (!list) list = { items: [] };

      if (indent >= 2 && list.items.length) {
        // Nested bullet under the current top-level item
        list.items[list.items.length - 1].children.push({ text: bullet[1], children: [] });
        inNested = true;
      } else {
        list.items.push({ text: bullet[1], children: [] });
        inNested = false;
      }
      continue;
    }

    if (list) {
      // Wrapped continuation of the current list item
      const last = list.items[list.items.length - 1];
      const target = inNested && last.children.length
        ? last.children[last.children.length - 1]
        : last;
      target.text += ' ' + line.trim();
      continue;
    }

    para.push(line.trim());
  }

  flushAll();
  return { html: out.join('\n'), toc, title };
}

/* ── Page template ───────────────────────────────────────────────────────── */

const APPSTORE = '#APP_STORE_LINK_PLACEHOLDER';

/** '2026-08-13' → '13 August 2026' */
function prettyDate(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ['January','February','March','April','May','June','July',
    'August','September','October','November','December'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

function page({ slugPath, title, metaTitle, description, version, effective, toc, body, otherDoc }) {
  const tocHtml = toc
    .map((t) => `        <li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.className+=" js"</script>
<title>${escapeHtml(metaTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="https://SITE-URL-PLACEHOLDER/${slugPath}">
<meta name="theme-color" content="#050506">

<meta property="og:type" content="article">
<meta property="og:site_name" content="ClutchUp">
<meta property="og:title" content="${escapeHtml(metaTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="https://SITE-URL-PLACEHOLDER/${slugPath}">
<meta property="og:image" content="https://SITE-URL-PLACEHOLDER/assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(metaTitle)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="https://SITE-URL-PLACEHOLDER/assets/img/og.png">

<link rel="icon" href="../assets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="../assets/img/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">
<link rel="manifest" href="../site.webmanifest">
<link rel="stylesheet" href="../assets/css/site.css">
<script src="../assets/js/site.js" defer></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<nav class="nav">
  <div class="nav__inner">
    <a class="brand" href="../">
      <img src="../assets/img/logo-64.png" width="32" height="32" alt="" decoding="async">
      ClutchUp
    </a>
    <div class="nav__links" id="nav-links">
      <a href="../">Home</a>
      <a href="../how-it-works/">How it works</a>
      <a href="../pricing/">Pricing</a>
      <a href="../guides/">Guides</a>
      <a href="../support/">Support</a>
      <a href="../about/">About</a>
      <a class="nav__cta-mobile" href="${APPSTORE}">Download for iPhone</a>
    </div>
    <a class="btn btn--primary nav__cta" href="${APPSTORE}">Download for iPhone</a>
    <button class="nav__toggle" type="button" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links">
      <span></span>
    </button>
  </div>
</nav>

<div class="progress" aria-hidden="true"></div>

<main id="main">

<section class="legal-hero">
  <div class="wrap">
    <p class="eyebrow hero-in" style="--i:0">Legal</p>
    <h1 class="hero-in" style="--i:1">${escapeHtml(title)}</h1>
    <div class="legal-meta hero-in" style="--i:2">
      <span>Version <b>${escapeHtml(version)}</b></span>
      <span>Effective <b>${escapeHtml(prettyDate(effective))}</b></span>
      <span>Zachary Stephens trading as ClutchUp</span>
    </div>
  </div>
</section>

<div class="wrap">
  <div class="legal-layout">

    <nav class="toc" aria-label="On this page">
      <p class="toc__title">On this page</p>
      <ol>
${tocHtml}
      </ol>
    </nav>

    <article class="prose">
${body}

      <div class="legal-foot-note">
        This is the current published version of the ${escapeHtml(title)} —
        version ${escapeHtml(version)}, effective ${escapeHtml(prettyDate(effective))} — and it
        matches the document shown in the ClutchUp app under Profile → Legal.
        See also the <a href="../${otherDoc.href}">${escapeHtml(otherDoc.label)}</a>, or email
        <a href="mailto:support@clutchup.co.uk">support@clutchup.co.uk</a> with any question
        about it.
      </div>
    </article>

  </div>
</div>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer__top">
      <div class="footer__brand">
        <a class="brand" href="../">
          <img src="../assets/img/logo-64.png" width="32" height="32" alt="" decoding="async">
          ClutchUp
        </a>
        <p>An AI driving coach for UK learner drivers. Clear AI feedback on every practice drive.</p>
      </div>
      <div class="footer__nav">
        <div class="footer__col">
          <h4>Product</h4>
          <a href="../">Home</a>
          <a href="../how-it-works/">How it works</a>
          <a href="../pricing/">Pricing</a>
        </div>
        <div class="footer__col">
          <h4>Guides</h4>
          <a href="../guides/how-many-driving-lessons/">How many lessons?</a>
          <a href="../guides/driving-test-pass-rates/">Pass rates by centre</a>
          <a href="../guides/why-people-fail-driving-test/">Why people fail</a>
          <a href="../guides/driving-test-day/">Test day explained</a>
        </div>
        <div class="footer__col">
          <h4>Help</h4>
          <a href="../support/">Support</a>
          <a href="../about/">About</a>
          <a href="mailto:support@clutchup.co.uk">Email us</a>
        </div>
        <div class="footer__col">
          <h4>Legal</h4>
          <a href="../privacy/">Privacy Policy</a>
          <a href="../terms/">Terms</a>
        </div>
      </div>
    </div>
    <div class="footer__bottom">
      <p><a href="mailto:support@clutchup.co.uk">support@clutchup.co.uk</a> · © <span data-year>2026</span> ClutchUp</p>
      <p class="footer__legal-line">ClutchUp is not affiliated with, endorsed by, or connected to the DVSA, and does not provide official test results.</p>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

/* ── Build ───────────────────────────────────────────────────────────────── */

const appRepo = findAppRepo();
const legalDir = join(appRepo, 'lib/legal');

const docs = [
  {
    prefix: 'PRIVACY',
    file: 'privacy.ts',
    slugPath: 'privacy',
    metaTitle: 'Privacy Policy — ClutchUp',
    description:
      'The current ClutchUp Privacy Policy: what data the app collects, why, the legal bases, who processes it, how long it is kept, and your rights.',
    otherDoc: { href: 'terms/', label: 'Terms & Conditions' },
  },
  {
    prefix: 'TERMS',
    file: 'terms.ts',
    slugPath: 'terms',
    metaTitle: 'Terms & Conditions — ClutchUp',
    description:
      'The current ClutchUp Terms & Conditions: what the app is and is not, your safety and legal responsibilities, subscriptions, and liability.',
    otherDoc: { href: 'privacy/', label: 'Privacy Policy' },
  },
];

console.log(`\nClutchUp legal build — source: ${legalDir}\n`);

for (const doc of docs) {
  const source = readFileSync(join(legalDir, doc.file), 'utf8');
  const { version, effective, markdown } = extract(source, doc.prefix);
  const { html, toc, title } = renderMarkdown(markdown);

  const outDir = join(SITE_ROOT, doc.slugPath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'index.html'),
    page({
      slugPath: doc.slugPath,
      title,
      metaTitle: doc.metaTitle,
      description: doc.description,
      version,
      effective,
      toc,
      body: html,
      otherDoc: doc.otherDoc,
    }),
    'utf8'
  );

  console.log(
    `  ✓ /${doc.slugPath.padEnd(8)} ${title}\n` +
      `      version ${version}, effective ${prettyDate(effective)}\n` +
      `      ${toc.length} sections, ${markdown.length.toLocaleString()} characters rendered verbatim`
  );
}

console.log('\nDone. Re-run this after any change to the app repo legal documents.\n');
