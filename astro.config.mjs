import { defineConfig } from 'astro/config';

// Static output: every page prerenders to plain HTML, which is the whole point
// of this site existing separately from the Flutter app (whose canvas-painted
// text no crawler can read).
//
// `site` must be set to the real domain before the first production deploy —
// sitemap and canonical URLs hang off it.
export default defineConfig({
  // The live origin. Canonical URLs and any sitemap hang off this, so it must be
  // the address visitors actually reach.
  //
  // ⚠ A USER SITE, NOT A PROJECT SITE, AND THAT IS LOAD-BEARING. GitHub serves
  // `<user>.github.io` at the ROOT; a project repo would serve at
  // `<user>.github.io/<repo>/`, which needs Astro's `base` set AND every
  // absolute asset path rewritten — `/hero/globe.webp` in the hero mount would
  // 404, and the planet would silently never appear. Root hosting avoids the
  // whole class.
  //
  // Swap this for a custom domain when there is one: add the domain in the
  // repo's Pages settings, drop a CNAME file in `public/`, and change this line.
  site: 'https://brookeanorton.github.io',
  server: { port: 4321 },
  // The floating dev widget sits exactly where the hero dock lives; design
  // review screenshots kept mistaking it for part of the page.
  devToolbar: { enabled: false },
});
