# ClutchUp — marketing & support website

The static website for ClutchUp. Replaces the Lovable-hosted site so it can be
hosted free on GitHub Pages, Cloudflare Pages or Netlify.

**Six routes, all real directories, all clean URLs:**

| Route | File | Notes |
| --- | --- | --- |
| `/` | `index.html` | Home |
| `/how-it-works` | `how-it-works/index.html` | Full explainer |
| `/pricing` | `pricing/index.html` | Information only — no checkout |
| `/support` | `support/index.html` | **App Store Support URL** |
| `/privacy` | `privacy/index.html` | **App Store Privacy Policy URL** — generated |
| `/terms` | `terms/index.html` | Generated |

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
- **Fast by construction.** One 20 KB stylesheet, one 4 KB script, no webfonts
  (the system font stack means zero font requests), no third-party JS. There is
  no framework runtime to download and parse before anything renders.
- **All internal links are relative.** The site works identically at a domain
  root (`clutchup.co.uk`) or under a project subpath
  (`yourname.github.io/clutchup`) with no rebuild.

The only Node scripts here are authoring tools you run locally — they generate
the legal pages and stamp in URLs. They are not part of serving the site.

---

## Deploy it free — GitHub Pages

The fastest route. Roughly five minutes.

### 1. Set your site URL

Pick the URL first, because it goes into the `canonical` and OpenGraph tags.
For a GitHub Pages project site it is `https://<username>.github.io/<repo>`:

```bash
cd ~/clutchup-site && node scripts/set-site-url.mjs https://YOURNAME.github.io/clutchup
```

This stamps the absolute URLs, generates `sitemap.xml` and `robots.txt`, and
re-bases the 404 page's links. It is safe to re-run if the URL changes later.

### 2. Create the repo and push

```bash
cd ~/clutchup-site && git init -b main && git add -A && git commit -m "ClutchUp website" && gh repo create clutchup --public --source=. --push
```

No `gh` CLI? Create an empty **public** repo called `clutchup` on github.com,
then:

```bash
cd ~/clutchup-site && git remote add origin https://github.com/YOURNAME/clutchup.git && git push -u origin main
```

### 3. Turn on Pages

On github.com → your repo → **Settings** → **Pages** →
**Build and deployment** → **Source: Deploy from a branch** →
Branch: **`main`**, folder: **`/ (root)`** → **Save**.

*(Alternative: choose **Source: GitHub Actions** instead, and the included
`.github/workflows/deploy.yml` takes over with a proper deploy log. Either
works — the branch option needs no workflow at all.)*

### 4. Wait ~60 seconds, then check your URL

**`https://YOURNAME.github.io/clutchup`**

Your two App Store URLs will be:

- Support — `https://YOURNAME.github.io/clutchup/support`
- Privacy Policy — `https://YOURNAME.github.io/clutchup/privacy`

Both work without a trailing slash; GitHub Pages redirects to the directory index.

> **Repo name shortcut:** name the repo `YOURNAME.github.io` instead and the
> site is served at `https://YOURNAME.github.io` with no subpath at all. Set
> the site URL accordingly in step 1.

---

## Deploy it free — Cloudflare Pages

Also free, faster CDN, and gives you a `*.pages.dev` subdomain.

1. Push the repo to GitHub (steps 1–2 above).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick the repo.
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *leave completely empty*
   - **Build output directory:** `/`
4. **Save and Deploy.** You get `https://clutchup.pages.dev`.
5. Re-run step 1 with that URL so the canonical tags match:

```bash
node scripts/set-site-url.mjs https://clutchup.pages.dev && git commit -am "Set site URL" && git push
```

`_headers` and `_redirects` are already in the repo and are picked up
automatically by Cloudflare Pages and Netlify (and harmlessly ignored by
GitHub Pages).

---

## ⚠️ After deploying — before taking the Lovable site down

**Update App Store Connect first.** Go to App Store Connect → your app →
**App Information** and change:

- **Support URL** → `https://<your-new-site>/support`
- **Privacy Policy URL** → `https://<your-new-site>/privacy`

Save, and confirm both load in a browser. **Only then** delete or unpublish the
Lovable site. If the old URLs go dead while App Store Connect still points at
them, your listing has broken required links — which can hold up a review.

---

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

_headers, _redirects     Cloudflare Pages / Netlify (ignored by GitHub Pages)
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
