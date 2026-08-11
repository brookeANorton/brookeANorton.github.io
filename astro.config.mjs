import { defineConfig } from 'astro/config';

// Static output: every page prerenders to plain HTML, which is the whole point
// of this site existing separately from the Flutter app (whose canvas-painted
// text no crawler can read).
//
// `site` must be set to the real domain before the first production deploy —
// sitemap and canonical URLs hang off it.
export default defineConfig({
  // site: 'https://www.tailfeathers.example',
  server: { port: 4321 },
  // The floating dev widget sits exactly where the hero dock lives; design
  // review screenshots kept mistaking it for part of the page.
  devToolbar: { enabled: false },
});
