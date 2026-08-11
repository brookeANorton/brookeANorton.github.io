# Tail Feathers — marketing site

The public website for Tail Feathers (working title; the app lives in the
sibling `TravelApp` repo). This is the SEO-facing front door: landing page,
about, and the sign-up/log-in links into the app. Built with Astro; every page
prerenders to plain HTML, because the Flutter app paints its text to canvas and
is invisible to crawlers.

## Run it

```
npm install
npm run sync-globe   # copies the built globe engine from ../TravelApp
npm run dev          # http://localhost:4321
```

`sync-globe` expects a sibling checkout of TravelApp with a built globe
(`cd ../TravelApp/globe_src && npm run build`). The bundle lands in
`public/globe/` and stays untracked — the globe build bakes API keys into the
bundle, so it is never committed (same policy as TravelApp itself).

## The hero globe

The landing hero mounts the real globe engine (`/globe/globe-host.js`) and
switches it to the cartoon terrain mode. That mode streams free, keyless data
(OpenFreeMap vectors, Terrarium elevation) — no Google billing from this site.
The baked key in the bundle is only exercised by satellite/photoreal modes,
which this site never enables; a keyless engine build for the site is a nice
later hardening.

## Before production

- Set `site` in `astro.config.mjs` to the real domain; add a sitemap.
- Point the Log in / Start free links at the real app URL.
- Self-host a display webfont (the mockup leans on Bahnschrift, Windows-only).
- Decide the scrolled state of the hero dock (compact floating pill).
