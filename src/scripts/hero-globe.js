// The landing hero: a textured sphere that spins. No engine, no tiles, no input.
//
// WHY THIS IS NOT THE REAL GLOBE. The hero used to mount TravelApp's cartoon
// engine — 735 MB of tiles, datasets and worker code behind a "LOADING THE
// WORLD…" placard — to render a planet nobody can zoom. This draws the same
// planet from one baked equirectangular texture (`scripts/bake-hero-globe.mjs`
// in the TravelApp repo, which paints it with the SHIPPING look's palette so the
// hero cannot drift from the product).
//
// WHY NOT three.js. This needs a sphere, a texture and one light. Tree-shaken,
// three.js is still ~150 KB gzipped — most of it a renderer abstraction for
// features nothing here uses — against ~4 KB for the code below and a 0.17 MB
// texture. The whole hero is smaller than the library would have been.
//
// ⚠ A MESH, NOT A RAY-MARCHED SPHERE IN THE FRAGMENT SHADER. The shader-only
// version is shorter and was tried first. It derives longitude with `atan2`,
// which is DISCONTINUOUS at the antimeridian — and the GPU picks its mip level
// from the derivative of the texture coordinate, so that one-pixel discontinuity
// selects the coarsest mip down a seam running pole to pole. It renders as a
// blurred stripe across the Pacific that no amount of filtering fixes. A UV
// sphere with the seam column DUPLICATED (u = 0 and u = 1 at the same position)
// has no discontinuity to differentiate, so mipmapping behaves.

/// Rotation, in degrees per second. Matches the `setAutoRotate` rate the engine
/// hero used, so the replacement spins at the speed the page was designed for.
const DEGREES_PER_SECOND = 1.5;

/// Axial tilt, degrees. Earth's is 23.4; the globe reads as a planet rather than
/// a ball at anything near it, and upright reads as a diagram.
const AXIAL_TILT_DEG = 23.4;

/// Longitude facing the viewer on the first frame.
///
/// At spin 0 the sphere presents the antimeridian, which is open Pacific — a
/// hero that opens on an empty blue disc and only finds land once it has turned
/// for a minute. 25°E puts Africa and Europe on the face, with Asia arriving as
/// it spins. The copy sits over the globe's left edge, so the land wants to be
/// centre-right rather than centred.
const INITIAL_LONGITUDE_DEG = 25;

/// The spin angle that brings [INITIAL_LONGITUDE_DEG] to face the camera.
///
/// A point at texture longitude L sits at phi = (L + 180)/360 · 2π, and the spin
/// rotates it to face the viewer when phi + spin = 0.
const INITIAL_SPIN = -((INITIAL_LONGITUDE_DEG + 180) / 180) * Math.PI;

/// Mesh resolution. 96x48 is 4,656 vertices — the silhouette is round to well
/// under a pixel at any hero size, and the cost is irrelevant next to one
/// full-screen fragment pass.
const LON_BANDS = 96;
const LAT_BANDS = 48;

/// Cap on devicePixelRatio. A 3x phone would otherwise rasterise ~9x the pixels
/// for a decorative sphere and cost real battery.
const MAX_DPR = 2;

/// Vertical field of view. Narrow on purpose: a wide one gives the sphere a
/// fisheye limb, which reads as a lens rather than as a planet.
const FOV_Y = Math.PI / 5;

/// The sphere's diameter as a fraction of its CONTAINER's height — not the
/// viewport's. `#globeEmbed` is deliberately oversized (164% tall, offset up and
/// right) so the planet crops off the top and bottom of the hero, so the two
/// numbers are far apart: 0.58 here is a globe about as tall as the hero itself.
///
/// ⚠ THIS REPLACES A HARD-CODED CAMERA DISTANCE, WHICH IS WHY IT EXISTS. At a
/// fixed distance the sphere's on-screen size is whatever the container happens
/// to be, so a CSS tweak to `#globeEmbed` silently re-frames the planet — and
/// the first build of this hero came out cropped so tight the limb never closed
/// and it read as a texture, not a globe.
const SPHERE_FILL = 0.58;

/// Distance from the sphere's centre that makes [SPHERE_FILL] true.
///
/// A sphere of radius 1 at distance d projects to a half-height of
/// `(1/d) / tan(fov/2)` in normalised device coordinates, where 1.0 is half the
/// viewport. Setting that equal to SPHERE_FILL and solving for d gives:
const CAMERA_DISTANCE = 1 / (SPHERE_FILL * Math.tan(FOV_Y / 2));

/// The cloud shell's radius, as a multiple of the globe's.
///
/// The engine floats its clouds 80 km up (`CLOUD_SHELL_ALTITUDE_M` in
/// `cartoon/clouds.js`) against an equatorial radius of 6,371 km. Matching the
/// ratio rather than picking a pleasing offset is what keeps the shell reading
/// as weather sitting above the ground: too low and the clouds look painted on,
/// too high and they detach into a visible ring around the limb.
const CLOUD_RADIUS = 1 + 80_000 / 6_371_000;

const VERT = `
attribute vec3 aPos;
attribute vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uScale;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = aUv;
  // The sphere is a unit sphere at the origin, so the position IS the normal.
  // uModel carries only rotation, so it may be applied to the normal directly.
  // uScale lifts the cloud shell and does not affect the normal.
  vNormal = normalize((uModel * vec4(aPos, 0.0)).xyz);
  gl_Position = uProj * uView * uModel * vec4(aPos * uScale, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uLight;
uniform float uCloudMode;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vec3 albedo = texture2D(uMap, vUv).rgb;
  vec3 n = normalize(vNormal);

  if (uCloudMode > 0.5) {
    // The bake stores the cloud mask in all three channels; one is enough.
    float a = albedo.r;
    // The engine draws its shell with MeshBasicMaterial — unlit, flat white. A
    // literal port would leave the night side glowing over a shaded globe, so
    // the clouds take a SLIVER of the same light instead: enough to sit on the
    // terminator, not enough to turn grey in daylight.
    float cloudLight = 0.86 + 0.14 * max(dot(n, normalize(uLight)), 0.0);
    // ⚠ SOFTENED, AND THE REASON IS THE ZOOM, NOT TASTE. The engine's shell is
    // authored for the app's globe view (~14,000 km, whole planet in frame);
    // this hero crops in about 1.4x on top of that, so the same texels cover
    // proportionally more screen and the same clouds read much heavier. Land is
    // what the hero is selling, so the shell gives way to it.
    gl_FragColor = vec4(vec3(cloudLight), a * 0.72);
    return;
  }

  // ⚠ THE LIGHT IS FIXED IN WORLD SPACE, NOT ATTACHED TO THE MODEL. uModel spins
  // the planet and the normal with it; uLight does not move. Bake a sun into the
  // texture instead and the lit side rotates WITH the continents, which reads as
  // the sun orbiting the Earth once every four minutes.
  float diffuse = max(dot(n, normalize(uLight)), 0.0);

  // A wide, shallow terminator. A hard one looks like a photograph of a planet;
  // this look is a PAINTED globe, and the palette was authored to be read, not
  // shaded off. The relief and canopy are baked into the texture, so this pass
  // only has to keep the sphere from reading flat — it does not have to do the
  // modelling as well.
  float light = 0.74 + 0.26 * smoothstep(-0.25, 0.90, diffuse);

  // Toward the palette, not away from it. Baking averages colour in linear light
  // across sixteen source texels per output texel, which is correct and also
  // desaturating; this puts back roughly what the averaging took out, so the
  // sphere matches the reference render rather than the flat texture.
  vec3 lit = albedo * light;
  float luma = dot(lit, vec3(0.2126, 0.7152, 0.0722));
  lit = mix(vec3(luma), lit, 1.12);

  // Rim: the atmosphere read, and what separates the dark limb from the page.
  // Keyed off the view direction, which is -Z in view space; the model matrix is
  // rotation-only, so the world-space normal is comparable.
  float rim = pow(1.0 - max(n.z, 0.0), 3.0);
  // A second, wider and much fainter term. One sharp rim reads as a lit edge; a
  // sharp one over a broad one reads as air.
  float halo = pow(1.0 - max(n.z, 0.0), 1.6);
  vec3 color = lit
    + vec3(0.34, 0.53, 0.62) * rim * 0.55
    + vec3(0.30, 0.48, 0.58) * halo * 0.16;

  gl_FragColor = vec4(color, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`hero-globe: shader failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

/// A UV sphere with the antimeridian column duplicated — see the header.
function buildSphere(lonBands, latBands) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat / latBands) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon / lonBands) * 2 * Math.PI;
      // ⚠ sin FOR X AND cos FOR Z, NOT THE OTHER WAY ROUND, AND IT IS NOT
      // ARBITRARY. Swapping them mirrors the parameterisation, which flips the
      // triangle winding: every outward-facing triangle becomes a BACK face,
      // `cullFace(BACK)` throws away the near hemisphere, and what reaches the
      // screen is the inside of the FAR wall.
      //
      // That renders a globe that looks entirely correct — the mirrored
      // parameterisation and the mirror of viewing a far wall from outside
      // cancel exactly — so the defect is invisible on a lone sphere. It shows
      // up the moment a second shell is added: the clouds landed BEHIND the
      // planet and were depth-rejected everywhere except the sliver overhanging
      // the limb, which reads as "the cloud texture is not loading".
      positions.push(sinT * Math.sin(phi), cosT, sinT * Math.cos(phi));
      uvs.push(lon / lonBands, lat / latBands);
    }
  }

  const stride = lonBands + 1;
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = lat * stride + lon;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

// --- the four matrices this needs, written out rather than pulled from a lib ---

function perspective(fovyRad, aspect, near, far) {
  const f = 1 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function translation(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

/// Rotation about Y (the spin) pre-multiplied by a tilt about Z, as one matrix.
/// Column-major, to match WebGL's uniformMatrix4fv with transpose = false.
function spinWithTilt(spinRad, tiltRad) {
  const cs = Math.cos(spinRad);
  const ss = Math.sin(spinRad);
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  // tiltZ * spinY
  return new Float32Array([
    ct * cs, st * cs, -ss, 0,
    -st, ct, 0, 0,
    ct * ss, st * ss, cs, 0,
    0, 0, 0, 1,
  ]);
}

/// Mounts the hero globe. Returns a disposer.
///
/// @param {HTMLElement} host
/// @param {{texture: string, clouds?: string, degreesPerSecond?: number}} options
export function mountHeroGlobe(host, options) {
  const { texture, clouds = null, degreesPerSecond = DEGREES_PER_SECOND } = options;
  if (!host) throw new Error('hero-globe: no host element');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  // Decorative: the planet carries no information the copy does not, and a
  // screen reader announcing "globe" between the headline and the CTA is noise.
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  if (!gl) {
    // No WebGL: leave the host empty rather than showing a flat rectangle of
    // world map, which is not what this element is for. The page's sky field
    // shows through and the hero still reads.
    host.dataset.globe = 'unsupported';
    return () => canvas.remove();
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`hero-globe: link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  const mesh = buildSphere(LON_BANDS, LAT_BANDS);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);
  const aUv = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const uProj = gl.getUniformLocation(program, 'uProj');
  const uView = gl.getUniformLocation(program, 'uView');
  const uModel = gl.getUniformLocation(program, 'uModel');
  const uLight = gl.getUniformLocation(program, 'uLight');
  const uScale = gl.getUniformLocation(program, 'uScale');
  const uCloudMode = gl.getUniformLocation(program, 'uCloudMode');

  /// Creates a texture holding one placeholder texel, then swaps in the real
  /// image when it arrives. The placeholder matters: without it the first frames
  /// sample an undefined texture, which is black on most drivers, and the hero
  /// flashes a dark ball before the planet appears.
  function loadTexture(url, placeholder, onReady) {
    const handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (!url) return handle;

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, handle);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      // Both bakes are power-of-two (2048x1024 and 1024x512), which is what lets
      // WebGL1 mipmap them at all. A non-POT texture silently falls back to no
      // mips and aliases badly at the limb, where it is most minified.
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      onReady?.();
    };
    image.onerror = () => { host.dataset.globe = 'texture-failed'; };
    image.src = url;
    return handle;
  }

  const tex = loadTexture(texture, new Uint8Array([13, 65, 89, 255]), () => {
    host.dataset.globe = 'ready';
  });
  // Placeholder is fully transparent, so a missing or slow cloud texture is a
  // clear sky rather than a white shell over the planet.
  const cloudTex = loadTexture(clouds, new Uint8Array([0, 0, 0, 0]), () => {
    host.dataset.clouds = 'ready';
  });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);

  // The light sits up and to the left of the viewer, which puts the terminator
  // down the right-hand limb — away from the hero copy, which sits left.
  gl.uniform3f(uLight, -0.45, 0.35, 0.82);
  gl.uniformMatrix4fv(uView, false, translation(0, 0, -CAMERA_DISTANCE));

  let width = 0;
  let height = 0;
  function resize() {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(host.clientWidth * dpr));
    const h = Math.max(1, Math.round(host.clientHeight * dpr));
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniformMatrix4fv(uProj, false, perspective(FOV_Y, w / h, 0.1, 100));
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tilt = (AXIAL_TILT_DEG * Math.PI) / 180;

  let raf = 0;
  let spin = INITIAL_SPIN;
  let last = 0;
  let visible = true;
  let disposed = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    resize();
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    // ⚠ THE DESIGN SPEC MAKES THIS MANDATORY, AND IT IS READ EVERY FRAME rather
    // than latched at mount: the setting can change while the page is open.
    if (!reduceMotion.matches) {
      spin += ((degreesPerSecond * Math.PI) / 180) * dt;
    }
    gl.uniformMatrix4fv(uModel, false, spinWithTilt(spin, tilt));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // --- the planet ---
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1f(uScale, 1);
    gl.uniform1f(uCloudMode, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);

    // --- the cloud shell, 80 km up ---
    // Back-face culling does the hiding here, exactly as the engine's FrontSide
    // material does: only the near hemisphere of the shell is drawn, so the far
    // side never shows through the planet and no sorting is needed.
    //
    // Depth WRITES are off. The shell is the last thing drawn, so writing would
    // change nothing this frame — but leaving it on means any later pass has to
    // know about a depth surface floating above the globe, which is the kind of
    // thing that is discovered by a bug rather than by reading.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(uScale, CLOUD_RADIUS);
    gl.uniform1f(uCloudMode, 1);
    gl.bindTexture(gl.TEXTURE_2D, cloudTex);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  // Scrolled past, the hero is still rendering every frame behind the rest of
  // the page. On a laptop that is a fan for nothing.
  const observer = new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { threshold: 0 },
  );
  observer.observe(host);

  raf = requestAnimationFrame(frame);

  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
}
