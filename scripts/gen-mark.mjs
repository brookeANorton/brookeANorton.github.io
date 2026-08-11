// Generates public/mark.svg from the design spec's §1 constants — the mark is
// rebuilt from these values at any size, never scaled from artwork.
//
//   * two feathers wrapping into a sphere, each a 180° crescent on a 176px
//     circle (R = 88), tapering from a cut quill head to a point
//   * six barb notches per feather at a constant 5px gap (7 barb segments)
//   * an orbit ring at 97r closing the silhouette
//   * ink only (#33406B); no gradients, shadows or outlines (§1 don'ts)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INK = '#33406B';
const R = 88; // feather circle radius (176px diameter)
const RING_R = 97; // orbit ring radius
const RING_W = 7;
const HEAD_W = 30; // quill head thickness, tapering to the point
const NOTCH = 5; // constant barb notch gap, measured along the arc
const BARBS = 7; // 7 segments -> six notches
const SPAN = Math.PI; // 180° crescent

const arcLength = R * SPAN;
const bladeLength = arcLength - NOTCH * (BARBS - 1);
const segmentAngle = bladeLength / BARBS / R;
const notchAngle = NOTCH / R;

const point = (radius, theta) =>
  `${(radius * Math.cos(theta)).toFixed(2)},${(radius * Math.sin(theta)).toFixed(2)}`;

// Thickness along the feather: full at the (flat-cut) quill head, a point at
// the tip. The exponent keeps the taper reading as a feather rather than a
// wedge at small sizes.
const width = (t) => Math.max(1.2, HEAD_W * Math.pow(1 - t, 1.15));

// Barbs grow backward from the shaft: the inner edge of each segment trails
// the outer edge by a constant shear, which is what makes the band read as
// overlapping feather barbs instead of a segmented ring.
const SLANT = 0.14;

function feather(rotate) {
  const paths = [];
  for (let s = 0; s < BARBS; s++) {
    const a = -SPAN / 2 + s * (segmentAngle + notchAngle);
    const b = a + segmentAngle;
    const outer = [];
    const inner = [];
    const STEPS = 8;
    for (let i = 0; i <= STEPS; i++) {
      const theta = a + ((b - a) * i) / STEPS;
      const t = (theta + SPAN / 2) / SPAN;
      outer.push(point(R, theta + rotate));
      inner.push(point(R - width(t), theta + rotate - SLANT * (1 - t * 0.5)));
    }
    inner.reverse();
    paths.push(`<polygon points="${[...outer, ...inner].join(' ')}" fill="${INK}"/>`);
  }
  return paths.join('\n  ');
}

const size = (RING_R + RING_W / 2 + 1) * 2;
const half = size / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${half} -${half} ${size} ${size}">
  <circle r="${RING_R}" fill="none" stroke="${INK}" stroke-width="${RING_W}"/>
  ${feather(0)}
  ${feather(Math.PI)}
</svg>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mark.svg');
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
