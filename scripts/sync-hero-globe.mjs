// Copies the baked hero-globe texture out of the TravelApp repo into
// public/hero/globe.webp.
//
// REPLACES `sync-globe.mjs`, which mirrored the entire built cartoon ENGINE —
// 735 MB of tiles, datasets and worker code in public/ — so the landing page
// could run a live globe nobody was allowed to zoom. The hero is now one
// texture on a sphere (`src/scripts/hero-globe.js`), and this syncs the texture.
//
// The texture is BAKED by TravelApp, not by this repo, because the palette that
// paints it lives there and must not be copied:
//
//   cd ../TravelApp/globe_src
//   node scripts/bake-hero-globe.mjs          # -> build/hero-globe.2048.png
//   node scripts/png-to-webp.mjs build/hero-globe.2048.png
//   cd ../../tail-feathers-site && npm run sync-hero
//
// ⚠ UNLIKE THE ENGINE BUNDLE IT REPLACES, THE RESULT IS COMMITTED. The old
// bundle was gitignored because the build baked API keys into it; a texture
// carries no secret, it is 0.17 MB, and a fresh clone that cannot render its own
// hero is a worse trade than the diff noise.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'TravelApp', 'globe_src', 'build', 'hero-globe.2048.webp');
const targetDir = join(here, '..', 'public', 'hero');
const target = join(targetDir, 'globe.webp');

if (!existsSync(source)) {
  console.error(
    `No baked hero texture at ${source}.\n\n`
    + 'Bake it first:\n'
    + '  cd ../TravelApp/globe_src\n'
    + '  node scripts/bake-hero-globe.mjs\n'
    + '  node scripts/png-to-webp.mjs build/hero-globe.2048.png',
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);

const { size, mtime } = statSync(target);
console.log(
  `hero texture: ${(size / 1e6).toFixed(2)} MB -> public/hero/globe.webp `
  + `(baked ${mtime.toISOString().slice(0, 10)})`,
);

// ⚠ THE SPHERE SAMPLES THIS AS A POWER-OF-TWO TEXTURE. WebGL1 will not build
// mipmaps for a non-POT image, and the failure is silent: the globe still
// renders, but with LINEAR-only minification it aliases into shimmer along the
// limb, where the texture is most compressed. 2048x1024 is the baked default;
// anything else must stay a power of two in BOTH dimensions.
if (size > 4e6) {
  console.warn(
    `\n⚠ ${(size / 1e6).toFixed(1)} MB is large for a decorative hero. The 2048x1024 `
    + 'bake is ~0.17 MB; check you did not sync the PNG or a 4096 bake by mistake.',
  );
}
