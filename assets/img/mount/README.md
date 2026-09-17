# Recommended-mount photos

Three photos of the MRGLAS mount (Amazon ASIN B0DY122XRP):

    recommended-mount-1.492b44af.jpg   679×646   product and packaging on white
    recommended-mount-2.19b4d13e.jpg   679×849   "Design for MagSafe"
    recommended-mount-3.b52abf54.jpg   679×835   "INFINITE ANGLES / 210°"

Used by:
  • /          (the "The mount we recommend" section on the home page)
  • /testers

## Why the filenames carry a hash

They were `recommended-mount-N.jpg` until 17 Sep 2026. The block shipped on
16 Sep referencing those paths **fifteen hours before the files were
committed**, so for that whole window every visitor got a 404 for each one —
and `_headers` gives `/assets/img/*` a `Cache-Control: public, max-age=604800`
which Netlify applies to 404 responses too. Anyone who loaded the page in that
window had "no such image" pinned in their browser for seven days, on every
device they used. Adding the files changed nothing for them: the browser never
re-requested the URL.

The only cure is a new URL, hence the content hash. It also makes the
week-long cache honest: change a photo, the hash changes, the URL changes,
everyone sees it immediately.

**If you swap a photo, recompute the hash and rename:**

```bash
shasum -a 256 newphoto.jpg | cut -c1-8
```

Then update the filename, the `src` and the `width`/`height` in both
`index.html` and `testers/index.html`. `npm run build` now fails if a `src`
points at a file that isn't there, so a mistake can't reach the site again.

## Layout notes

  • The frames are portrait (aspect-ratio 4/5) and the image is
    object-fit: **contain**, so each photo is shown whole whatever its exact
    ratio. Contain, not cover, because the marketing text is baked into the
    photos and a 4:3 crop cut it off.
  • The intrinsic sizes above are also set as width/height attributes on each
    <img>, so the box is reserved before the file arrives.
  • Keep them under a few hundred KB each.
  • They are served from this folder, never hotlinked. Amazon's own image URLs
    rot, and hotlinking breaches the Associates terms.

## Provenance

These are the manufacturer's listing images rather than photos taken for
ClutchUp. The Associates Operating Agreement covers product images obtained
through SiteStripe or the Product Advertising API; images copied from a
listing page are not automatically covered.
