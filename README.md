# ClutchUp — marketing & support website

The static website for ClutchUp, served free on Netlify at
**https://clutchup.co.uk** (replacing the Lovable-hosted site).

**Six routes, all real directories, all clean URLs:**

| Route | File | Notes |
| --- | --- | --- |
| `/` | `index.html` | Home (learner + parent sections) |
| `/how-it-works` | `how-it-works/index.html` | Full explainer |
| `/pricing` | `pricing/index.html` | Information only — no checkout |
| `/support` | `support/index.html` | **App Store Support URL** |
| `/about` | `about/index.html` | Who builds it and why |
| `/guides` | `guides/index.html` | Guides hub |
| `/guides/how-many-driving-lessons` | `guides/…/index.html` | SEO guide |
| `/guides/driving-test-pass-rates` | `guides/…/index.html` | SEO guide — real DVSA data (DRT121A/DRT122A) |
| `/guides/why-people-fail-driving-test` | `guides/…/index.html` | SEO guide — DVSA top-10 faults (DRT121F) |
| `/guides/driving-test-day` | `guides/…/index.html` | SEO guide |
| `/privacy` | `privacy/index.html` | **App Store Privacy Policy URL** — generated |
| `/terms` | `terms/index.html` | Generated |

Support email everywhere is **clutchup.support@gmail.com**, including the legal
pages (app repo legal docs are at v1.3, 2026-09-03). It is not hardcoded in the
generated pages: `build-legal.mjs` reads it off the Privacy Policy's `**Contact:**`
line, and `npm run verify` fails the build if any `mailto:` on any page disagrees
with it. To change the address, change it in `routeready/lib/legal/privacy.ts`
and `terms.ts`, then sweep the hand-written pages and run `npm run build`.

## Screenshots

Every phone on the site is a **real screenshot of the shipped app** — there are no
mockups or renders, and there should never be any. They live in
`assets/img/screens/` and are produced by:

```
./scripts/make-screenshots.sh
```

Read that script before replacing them: it resizes for the web *and* blurs the
route-replay map on the drive-summary screen, which otherwise publishes legible
street names around a real learner's home.

⚠️ **The pricing page's free-tier copy does not match the shipped app.** The
page says free users get unlimited drives and scores with AI feedback as the
paid feature; the app actually runs a 365-day / 9,999-drive free trial, after
which a new drive cannot be started at all. Terms v1.3 describe the shipped
behaviour. Either ship the free-scores model or correct this page.

---

## Stack

**Plain HTML, CSS and JavaScript. No framework, no bundler, no build step to
deploy.**

The repo *is* the site: every file you commit is a file the host serves. That
matters because:

- **Zero build = zero deploy config.** GitHub Pages "deploy from a branch"
  serves it as-is; there is no build command to get wrong and nothing to break
  when a dependency updates.
- **Nothing to host but files.** No server, no Node runtime, no database, no
  API routes — which is exactly what the free tiers give you.
- **Fast by construction.** One 43 KB stylesheet, one 7 KB script, a 3 KB logo,
  no webfonts (the system font stack means zero font requests) and no
  third-party JS. There is no framework runtime to download and parse before
  anything renders.
- **All internal links are relative.** The site works identically at a domain
  root (`clutchup.co.uk`) or under a project subpath
  (`yourname.github.io/clutchup`) with no rebuild.

The only Node scripts here are authoring tools you run locally — they generate
the legal pages and stamp in URLs. They are not part of serving the site.

---

## Deploy free to Netlify, on clutchup.co.uk

**Why Netlify here rather than Cloudflare Pages:** both are free and both give
free auto-renewing SSL, but Cloudflare Pages needs an *apex* domain
(`clutchup.co.uk`, no `www.`) to use Cloudflare's own nameservers — meaning you
move ALL DNS for the domain to Cloudflare, including any email MX records.
Netlify attaches an apex domain with two ordinary records you add at your
existing registrar. Since you want to add records where the domain is
registered, Netlify is the lower-risk path. (Cloudflare Pages instructions are
further down if you'd rather use it.)

The site URL is already stamped in as `https://clutchup.co.uk` — canonical
tags, OpenGraph tags, `sitemap.xml` and `robots.txt`.

### 1. Push the repo to GitHub

```bash
cd ~/clutchup-site && git add -A && git commit -m "Configure clutchup.co.uk" && gh repo create clutchup-site --public --source=. --push
```

No `gh` CLI? Create an empty repo on github.com, then
`git remote add origin <url> && git push -u origin main`.

### 2. Create the Netlify site

1. Sign up / log in at **app.netlify.com** (free "Personal" plan — no card).
2. **Add new site** → **Import an existing project** → **GitHub** → authorise →
   pick the repo.
3. Build settings — `netlify.toml` already declares these, so just confirm:
   - **Build command:** *empty*
   - **Publish directory:** `.`
4. **Deploy.** You get a temporary URL like `random-name-123.netlify.app`.
   Check it works before touching DNS.

### 3. Attach clutchup.co.uk

In Netlify: **Site configuration** → **Domain management** → **Add a domain** →
enter `clutchup.co.uk` → **Verify** → **Add domain**.

Netlify will also offer to add `www.clutchup.co.uk`. Add it too, then set
**`clutchup.co.uk` as the primary domain** — Netlify then permanently redirects
www → apex, so only your App Store URLs are ever served.

### 4. DNS records — add these at your registrar

Wherever `clutchup.co.uk` is registered (123-reg, Namecheap, GoDaddy, IONOS…),
open its **DNS** / **Advanced DNS** / **Manage DNS** panel and add:

| Type | Host / Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `@` (or blank, or `clutchup.co.uk`) | `75.2.60.5` | Automatic / 3600 |
| `CNAME` | `www` | `<your-site>.netlify.app` | Automatic / 3600 |

> **Read the IP off Netlify's own screen, not off this table.** When you add the
> domain, Netlify displays the exact A record value to use. `75.2.60.5` is its
> published load-balancer address, but Netlify is the authority — if its
> dashboard shows something different, use what the dashboard says.

Notes:
- Some registrars write the apex as `@`, some want the field left blank, some
  want the full `clutchup.co.uk`. All three mean the same thing.
- The CNAME value must end in `.netlify.app` and is shown in your Netlify
  dashboard. Do **not** point the CNAME at `75.2.60.5`.
- **Delete any existing A / CNAME / "parking" / "under construction" records
  for `@` and `www`** left over from the registrar's default page, or they will
  conflict.
- Leave `MX` and `TXT` records alone — those are email and domain verification,
  and this change does not affect them.

### 5. HTTPS

Once DNS resolves (usually minutes; allow up to 24h for full propagation),
Netlify provisions a free Let's Encrypt certificate automatically.

Netlify → **Domain management** → **HTTPS**:
- Wait for **"Your site has HTTPS enabled"**. If it's still pending after DNS
  has propagated, click **Verify DNS configuration** then **Provision
  certificate**.
- Turn **Force HTTPS** ON. This 301-redirects every `http://` request to
  `https://` — which is what makes the Apple-facing URLs safe to submit.

Certificates auto-renew. There is nothing to maintain.

### 6. Verify before you touch App Store Connect

```bash
for p in / /support /privacy /terms /how-it-works /pricing; do echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' -L https://clutchup.co.uk$p)"; done
```

All six must print `200`. Then confirm http → https and www → apex:

```bash
curl -sI http://clutchup.co.uk/support | head -1 && curl -sI https://www.clutchup.co.uk/privacy | head -1
```

Both should show a `301`, landing on the `https://clutchup.co.uk/...` equivalent.

---

## Alternative: Cloudflare Pages

Same cost, but attaching the apex domain requires moving your nameservers to
Cloudflare (which moves all your DNS, email included).

1. Add the site: Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → pick the repo.
2. Build settings: **Framework preset** `None`, **Build command** *empty*,
   **Build output directory** `/`.
3. Add the domain to Cloudflare: **Add a site** → `clutchup.co.uk` → Free plan →
   Cloudflare shows two nameservers.
4. At your registrar, replace the existing nameservers with Cloudflare's. This
   takes anywhere from minutes to 24h.
5. Pages project → **Custom domains** → **Set up a custom domain** →
   `clutchup.co.uk`. Cloudflare adds the DNS record itself (CNAME flattening
   handles the apex) and issues the certificate.
6. SSL/TLS → **Overview** → set encryption mode to **Full (strict)**, and
   SSL/TLS → **Edge Certificates** → turn on **Always Use HTTPS**.

`_headers` and `_redirects` are read by Cloudflare Pages too, so the security
headers and redirect rules carry over unchanged.

---

## ⚠️ App Store Connect — after HTTPS is confirmed live

App Store Connect → your app → **App Information**:

- **Support URL** → `https://clutchup.co.uk/support`
- **Privacy Policy URL** → `https://clutchup.co.uk/privacy`

Save, then load both in a browser to confirm. **Only then** take the Lovable
site down. If the old URLs die while App Store Connect still points at them,
your listing has broken required links, which can hold up a review.

## Filling in the App Store link

Every "Download on the App Store" button currently points at the marker
`#APP_STORE_LINK_PLACEHOLDER`. Find them all any time with:

```bash
grep -rn "APP_STORE_LINK_PLACEHOLDER" --include="*.html" .
```

Once the app is live, fill them all in at once:

```bash
node scripts/set-appstore-link.mjs https://apps.apple.com/gb/app/clutchup/idYOURAPPID
```

---

## The legal pages are generated — do not hand-edit them

`/privacy` and `/terms` are rendered **verbatim** from the app repo, which is
the single source of truth:

```
routeready/lib/legal/privacy.ts
routeready/lib/legal/terms.ts
```

Editing `privacy/index.html` or `terms/index.html` by hand will be silently
overwritten and would put the website out of step with the documents users
accepted in the app. Instead, edit the app repo, bump the version there, then:

```bash
npm run build
```

That runs two steps:

- `npm run legal` — regenerates both pages, reading the version, effective date
  and full markdown from the app repo.
- `npm run verify` — proves the rendered pages match the source **word for
  word**, and that the version and effective date shown on the page match the
  exported constants. It exits non-zero if anything drifted.

If the app repo isn't at `~/routeready`, pass its path:
`npm run legal -- /path/to/routeready`.

---

## Local preview

```bash
npm run serve
```

Then open <http://localhost:4321>. Any static file server works — there is
nothing to compile.

---

## Project layout

```
index.html               /
how-it-works/index.html  /how-it-works
pricing/index.html       /pricing
support/index.html       /support
privacy/index.html       /privacy   ← generated, do not edit
terms/index.html         /terms     ← generated, do not edit
404.html                 self-contained (served at arbitrary paths)

assets/css/site.css      the whole design system
assets/js/site.js        reveals, nav, accordion, scroll spy — all optional
assets/img/              logo, icons, OpenGraph image

scripts/build-legal.mjs      renders /privacy and /terms from the app repo
scripts/verify-legal.mjs     proves they match the source verbatim
scripts/set-site-url.mjs     stamps canonical/OG URLs + sitemap + robots
scripts/set-appstore-link.mjs fills in every App Store button
scripts/og-template.html     source of assets/img/og.png

netlify.toml             Netlify build config (no build command, publish root)
_headers, _redirects     Netlify / Cloudflare Pages (ignored by GitHub Pages)
.nojekyll                stops GitHub Pages running Jekyll over the files
.github/workflows/       optional GitHub Actions deploy
```

---

## Motion

The site leans on scroll-triggered reveals, staggered entrances, a drifting
gradient hero, and hover states with a cursor spotlight. All of it is
`transform`/`opacity` only, so it composites on the GPU and holds 60fps.

Everything degrades under `prefers-reduced-motion: reduce`: reveals become
plain opacity fades with no movement, all looping ambient animation stops, the
parallax and cursor-spotlight code paths are skipped in JS entirely, and hover
states keep their colour changes but lose their movement.

With JavaScript disabled the site is still fully readable — the reveal
animations are the only thing that needs JS, and the FAQ answers remain in the
DOM.
