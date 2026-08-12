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

`sync-globe` expects a sibling checkout of TravelApp with a built globe. Build
it with the **public** target, not the default one:

```
cd ../TravelApp/globe_src && npm run build:public
```

`npm run build` (no suffix) is TravelApp's dev build: it points clay terrain
tiles at `localhost:8443` and only fail-softs to public origins, so a site
built from it would send every visitor's browser knocking on their own
machine first. `build:public` is the shippable one. Rebuild TravelApp's dev
bundle afterwards if you work on the app (`npm run build`) — the two targets
share one output directory.

The bundle lands in `public/globe/` and stays untracked — the globe build bakes
API keys into the bundle, so it is never committed (same policy as TravelApp
itself). `sync-globe` prints the bundle's build stamp: if it is older than the
last engine change you made, the hero is showing a stale planet.

## The hero globe

The landing hero mounts the real globe engine (`/globe/globe-host.js`) with
`backdrop: false` — so the planet floats on the page's own butter field rather
than the engine's pastel sky — switches it to the cartoon terrain mode, and
sets a 1.5 deg/s idle spin (`setAutoRotate`, suppressed under
`prefers-reduced-motion`, and stopped for good by the engine the moment a
visitor drags the globe). That mode streams free, keyless data
(OpenFreeMap vectors, Terrarium elevation) — no Google billing from this site.
The baked key in the bundle is only exercised by satellite/photoreal modes,
which this site never enables; a keyless engine build for the site is a nice
later hardening.

## Before production

- Set `site` in `astro.config.mjs` to the real domain; add a sitemap.
- Point the Log in / Start free links at the real app URL.
- Self-host a display webfont (the mockup leans on Bahnschrift, Windows-only).
- Decide the scrolled state of the hero dock (compact floating pill).
