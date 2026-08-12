// Copies the built globe engine out of the TravelApp repo into public/globe,
// where the landing page loads it as a plain ES module.
//
// The engine is BUILT by TravelApp (`cd ../TravelApp/globe_src && npm run
// build`), not by this repo — this script only mirrors the output. It fails
// loudly when the bundle is missing rather than leaving the site to render a
// hero with no planet in it.
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'TravelApp', 'web', 'globe');
const target = join(here, '..', 'public', 'globe');

if (!existsSync(join(source, 'globe-host.js'))) {
  console.error(
    `No built globe bundle at ${source}.\n` +
      'Build it first: cd ../TravelApp/globe_src && npm run build',
  );
  process.exit(1);
}

// Surface the bundle's own build stamp: the engine looks "outdated" in the
// hero long before anything errors, and the stamp is the only way to tell a
// stale sync from a design regression.
const stamp = readFileSync(join(source, 'globe-host.js'), 'utf8').match(/20\d{6}T\d{6}/)?.[0];
console.log(`bundle build stamp: ${stamp ?? 'not found'} (today is ${new Date().toISOString().slice(0, 10)})`);

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
// The bundle's own index.html is the mobile-webview host page — this site has
// its own pages, and a stray index.html under /globe/ would shadow nothing but
// confuse everyone.
rmSync(join(target, 'index.html'), { force: true });
console.log(`Synced globe engine -> ${target}`);
