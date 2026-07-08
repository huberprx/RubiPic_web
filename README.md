# RubiPic — website

Landing page for **RubiPic**, a mobile app that turns any photo into a print-ready Rubik's Cube mosaic plan (crop → choose cube size/colors → pick a generation method → fine-tune → export a 1:1 scale PDF).

Static site — plain HTML/CSS/JS, no build step, no framework, no dependencies. Ready to serve as-is from GitHub Pages.

## Structure

```
index.html                 Landing page (PL/EN, language switch in header)
privacy.html               Privacy Policy (PL/EN, same language switch)
terms.html                 Terms of Use (PL/EN, same language switch)
assets/css/styles.css      All styles
assets/js/translations.js  PL/EN copy dictionary
assets/js/main.js          Language switching, mobile nav, scroll reveal
assets/icons/              Favicons + logo, generated from the RubiPic app icon
assets/screens/            Optimized (WebP, ~300px wide) app screenshots used on the page
_originals/                Original, full-resolution PNG screenshots (kept locally, git-ignored, not published)
CNAME                      Custom domain for GitHub Pages: rubipic.app
robots.txt / sitemap.xml   Basic SEO
```

## Content & languages

All page copy lives in `assets/js/translations.js` as a `{ pl: {...}, en: {...} }` dictionary. Text elements are marked with `data-i18n="key"` (or `data-i18n-attr='{"alt":"key"}'` for attributes) and `assets/js/main.js` swaps them on load (auto-detected from the browser language, defaulting to English) and whenever the PL/EN toggle in the header is used. The choice is remembered in `localStorage`.

To add a language: add a new key (e.g. `de`) to `RUBIPIC_I18N` in `translations.js` with the same set of keys as `pl`/`en`, then add a matching button to `.lang-toggle` in `index.html`.

## Images

Screenshots come from the RubiPic app and are stored full-resolution in `_originals/` (not published). Published copies in `assets/screens/` are resized to ~640px on the long edge and converted to WebP (via `sips` + `cwebp`), which keeps every screenshot under ~30 KB instead of several hundred KB/PNG.

To regenerate an optimized image from a new raw screenshot:

```bash
sips -Z 640 _originals/screens-raw/SOURCE.png --out /tmp/resized.png
cwebp -q 80 /tmp/resized.png -o assets/screens/NAME.webp
```

## Local preview

No build step needed — just serve the folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment (GitHub Pages)

1. Push this repo to GitHub.
2. In repo Settings → Pages, set the source to the `main` branch, root folder.
3. `CNAME` already points to `rubipic.app` — add the corresponding DNS records (A/ALIAS records to GitHub Pages IPs, or a CNAME record if using a `www` subdomain) at your domain registrar, then enable "Enforce HTTPS" once DNS propagates.
