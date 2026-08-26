# Tail Feathers — marketing site

The public website for Tail Feathers (working title; the app lives in the
sibling `TravelApp` repo). This is the SEO-facing front door: landing page,
about, and the sign-up/log-in links into the app. Built with Astro; every page
prerenders to plain HTML, because the Flutter app paints its text to canvas and
is invisible to crawlers.

## Run it

```
npm install
npm run dev          # http://localhost:4321
```

There is no sync step. The hero texture is committed, so a fresh clone renders
its own globe.

## The hero globe

The hero is a **baked texture on a sphere**, drawn by `src/scripts/hero-globe.js`
in ~250 lines of plain WebGL: a UV sphere, one equirectangular map, one fixed
light, and a 1.5 deg/s spin that stops under `prefers-reduced-motion` and pauses
when the hero scrolls out of view. No engine, no tiles, no input — the planet
turns and that is all it does.

### What this replaced, and why

The hero used to mount TravelApp's real cartoon engine: 735 MB of tiles and
datasets in `public/globe/`, a "LOADING THE WORLD…" placard over a ~6.4 s boot,
and a live OpenFreeMap/Terrarium tile stream on every page view — to render a
globe the page deliberately let nobody zoom. The whole site is now **1 MB**, and
the planet is on screen in the first frame.

Two things genuinely went away with it, both listed here rather than quietly
dropped:

* **The hero mode chips** (`Cartoon` / `Map`) switched the live engine between
  globe modes. A baked hero cannot switch modes, and only one cartoon look
  (`sage`) ships, so there was no second texture to bake that would honestly
  represent the product. The `#modes` section below the fold still tells the
  four-globes story with its own static swatches.
* **Drag to spin**, and the `Live — drag to spin` caption that advertised it.

### Rebaking the texture

The texture is painted with the app's own palette — `bake-hero-globe.mjs`
imports `buildAridityPaletteTable` and `lookById` from the engine source rather
than restating any hex — so the hero cannot drift from the product. Re-run it
after any change to `look.js`'s `classColors` / `classAridity`:

```
cd ../TravelApp/globe_src
node scripts/bake-hero-globe.mjs                        # -> build/hero-globe.2048.png
node scripts/png-to-webp.mjs build/hero-globe.2048.png  # -> 0.17 MB
cd ../../tail-feathers-site && npm run sync-hero
```

`--size 4096` bakes a sharper texture (~0.84 MB) if the hero ever fills a large
desktop viewport and looks soft. Keep both dimensions powers of two: WebGL1
silently refuses to mipmap a non-POT texture, and the globe's limb shimmers.

## Before production

- Set `site` in `astro.config.mjs` to the real domain; add a sitemap.
- Point the Log in / Start free links at the real app URL.
- Self-host a display webfont (the mockup leans on Bahnschrift, Windows-only).
- Decide the scrolled state of the hero dock (compact floating pill).
