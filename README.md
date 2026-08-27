# Tail Feathers — marketing site

The public website for tailFeathers (the app lives in the sibling `TravelApp`
repo). This is the SEO-facing front door. Built with Astro; every page
prerenders to plain HTML, because the Flutter app paints its text to canvas and
is invisible to crawlers.

The page is written for one reader: **someone who has not chosen a destination
yet.** Everything is ordered around that — the world view first, the theme and
month filters second, the timeline third. It is not written for someone who
already knows where they are going and wants to book.

## Run it

```
npm install
npm run dev          # http://localhost:4321
```

There is no sync step. The hero texture is committed, so a fresh clone renders
its own globe.

## The two switches

Both live at the top of `src/pages/index.astro`:

```js
const appUrl = null;        // no public address where the app runs — yet
const contactEmail = null;  // no published inbox — yet
```

`appUrl` is the important one. While it is `null` every call to action reads
**"See it working"** and scrolls to the screenshots; set it to a real URL and
every one of them becomes **"Open the globe"** pointing there, and the closing
panel changes from *"Not open to the public yet"* to an invitation. Nothing else
needs editing. Setting `contactEmail` turns the closing button into a mailto
waitlist instead.

They are `null` rather than `'#'` deliberately: the previous version of this page
shipped four different dead `#` links, which is worse than admitting the product
is not open.

## What the page deliberately does NOT claim

Every number and capability was audited against the app on **2026-08-27**, and
the page came out narrower than the product as a result. The full reasoning is
in the header comment of `src/pages/index.astro`; the short list of things that
are built but are **not** advertised, and why:

| Not claimed | Why |
| --- | --- |
| "hand-curated", "chosen by travel experts" | 2 of 3,785 rows carry human verification. The corpus is AI-researched and machine-checked, and the page says exactly that. |
| "ranked by prominence / popularity" | No such measurement exists. The tiers are editorial priority — which is what the zoom copy describes instead. |
| The **Trending** lens | It is a language model recalling virality from training data. Left out entirely, and the lens count on the page says *seven* to match the chips a reader can count. |
| Real flight schedules | Live Duffel search needs an account the public build cannot reach; the default build serves canned offers with invented carriers. |
| Real train / ferry times | Distance formulas the app does not yet mark as estimates. The page calls them estimates in two places. |
| Saving, accounts, sync, sharing, export | No hosted backend. A trip lasts as long as the tab. The trust row says so. |
| Satellite / photorealistic 3D as headline features | Real, but key-gated, never default-on, and Google's 15,000-tiles/day project ceiling lands around 1,000 users. One line in the trust row. |
| "Four globes in one" | Two of the four cards named the *same* mode. There is no separate "Cartoon terrain" — that surface **is** Clay. |
| A quoted engine team | Unverifiable, and a fabricated voice is the same class of problem as fabricated data. The whole "about us" section went with it. |

Driving times and road geometry **are** real (Mapbox, live traffic) in a
configured build, which is why the drive is the one leg the page shows.

## The screenshots

`public/shots/*.webp` are captures of the **real app**, not mockups, taken by
`globe_src/scripts/shot-marketing.mjs` in the TravelApp repo. That harness
drives the Flutter UI over CDP by clicking its **semantics tree** — Flutter
paints to canvas, so the accessibility DOM is the only thing with labels and
layout boxes to aim at.

There is one scene file per shipped image, named after it, so regenerating any
single asset is one command and the output lands under the right filename:

```
cd ../TravelApp
rm -rf build/web-verify
flutter build web --output=build/web-verify \
  --dart-define-from-file=dart_define.json --dart-define=BACKEND_URL=

cd globe_src
for s in world region islands roads timeline; do
  node scripts/shot-marketing.mjs --steps globe_src/scripts/shot-scenes/$s.json
  node scripts/png-to-webp.mjs ../build/marketing-shots/$s.png --width 1800 --quality 0.82
done
cp ../build/marketing-shots/*.webp ../../tail-feathers-site/public/shots/
```

`roads` and `timeline` build a real trip, which costs real Places Autocomplete
calls — three or five per run. Regenerate those two only when they actually need
it.

Three traps, each already paid for:

* **Build with `BACKEND_URL=` empty.** With a backend compiled in, the shell
  boots to `AuthScreen` and you photograph a login form.
* **The route line does not render in Clay mode.** Same trip, same camera, same
  zoom: bold orange in Map mode, absent in Clay. `shots/roads.webp` is therefore
  a Map-mode capture — which is also the app's default. This looks like a
  product bug, not a capture mistake.
* **Do not photograph a train or ferry leg.** Their durations are estimates the
  UI does not label, so a screenshot of one asserts something untrue. The trip
  in `shots/timeline.webp` uses car legs only, which are really routed.

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
  represent the product.
* **Drag to spin**, and the `Live — drag to spin` caption that advertised it.

The old headline was *"Spin the globe. Plan the trip."* — a hero promising a
gesture over an object with no input handling, which broke its own claim in the
first two seconds. The current headline promises scope rather than a gesture, so
a spinning-but-unclickable planet no longer contradicts it. Giving the baked
sphere pointer-drag and momentum is still a nice-to-have (~40 lines in
`hero-globe.js`); it is no longer an honesty fix.

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

- Set `appUrl` (and optionally `contactEmail`) in `src/pages/index.astro` — see
  **The two switches**. Until then the page honestly says the app is not open.
- Set `site` in `astro.config.mjs` to the real domain; add a sitemap.
- Add real Privacy / Terms pages before collecting anything from anyone. The
  footer currently links to neither, on purpose — a link to a page that does not
  exist is worse than no link.
- Re-audit the claims whenever the app gains a capability. The list above is a
  snapshot of 2026-08-27, not a standing description.
