/*
  About portrait effect while it grows (opening sequence): "Ripple + Ink
  Develop", chosen 2026-10-26 from six options (all kept in the effects
  library, lab/portfolio/about/06-portrait-expand).
    - Ripple: the home hero's intro wave (portrait-fx.ts) on a subdivided
      plane, driven by scroll speed. It wobbles in perspective, with an RGB
      split where it bends, while you scroll, and settles flat when you stop.
    - Ink Develop: the portrait starts as a grainy two-tone ink print in the
      site's black and off-white and gains tones as it grows. The print
      stays through full screen until the wipe covers it ("photo at end"
      blends the real photo back in, 0 by default).
  The ripple fades out over the growth, so the full-screen print sits flat.
  The box geometry stays about-intro.ts's.

  Halftone variants on test (2026-11-07, `variant` in the config; 0 is the
  live look above). All keep the ripple and use the site's shared halftone
  (ink-halftone.ts), its cells growing finer as the portrait grows
  (halftone.cellStart → cellEnd, CSS px):
    1 Halftone Develop  the portrait is ink dots while it grows; from
                        "resolve from" it resolves top-down into the photo
                        ("dots at end" keeps some dots at full screen)
    2 Print + Scroll Dots  the Ink Develop print, breaking into dots while
                        you scroll (speed, "speed for dots") and settling
                        back into the print when you stop
    3 Photo + Scroll Dots  the photo, breaking into dots while you scroll,
                        like the Work strip

  Every value lives in src/config/portrait-expand.json. ?tweak opens a panel
  (portrait-tweaks.ts); on the dev server its "Save to project" writes it.
*/
import { linkProgram } from './liquid-morph';
import { inkGlsl, setInkColors } from './ink-halftone';
import defaults from '../config/portrait-expand.json';

export const PORTRAIT_VARIANTS = {
  'Ink Develop (live)': 0,
  'Halftone Develop': 1,
  'Print + Scroll Dots': 2,
  'Photo + Scroll Dots': 3,
};

export type PortraitSettings = typeof defaults;

const GRID = 32; // mesh subdivisions per side

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Plane seen from a camera centred on the stage, 50 units away
const vertex = /* glsl */ `
  attribute vec2 aUv; // plane uv, top-left origin
  uniform vec4 rect;  // portrait box: x, y, w, h in CSS px from the top left
  uniform vec2 view;  // stage, CSS px
  uniform float amp;
  uniform float phase;
  uniform float height;
  uniform float freq;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = aUv;
    float z = sin((aUv.y - 0.5) * freq + phase) * amp * height;
    vWave = z;
    vec2 p = rect.xy + aUv * rect.zw;
    vec2 centre = view * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));
    vec2 ndc = p / view * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tex;
  uniform vec4 rect;
  uniform float aspect;  // image width / height
  uniform float split;   // RGB split along the wave
  uniform vec2 res;      // canvas, device px
  uniform float dpr;
  uniform float amt;     // 1 at the start, 0 once it fills the screen
  uniform float u;       // progress through the growth, 0 → 1
  uniform vec4 ink;      // start tones, end tones, fine grain, coarse grain
  uniform vec3 inkB;     // grain size, photo blend from, photo at end
  uniform float mode;    // variant, see the top of the file
  uniform vec4 ht;       // cell start, cell end, resolve from, dots at end
  uniform float dotsAmt; // scroll-speed dots, 0..1
  varying vec2 vUv;
  varying float vWave;
  ${inkGlsl}

  // 2D simplex noise (Ashima / Stefan Gustavson)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // object-fit: cover, centred
  vec3 cover(vec2 uv) {
    float box = rect.z / rect.w;
    vec2 s = box > aspect ? vec2(1.0, aspect / box) : vec2(box / aspect, 1.0);
    return texture2D(tex, 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s).rgb;
  }

  void main() {
    float w = vWave;
    vec3 base = cover(vUv);
    vec3 shifted = vec3(cover(vUv + w * 0.04).r, cover(vUv + w * 0.01).g, cover(vUv - w * 0.03).b);
    vec3 col = mix(base, shifted, split);

    // Ink print, gaining tones as it grows
    vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float grain = ink.z * snoise(px / inkB.x + u * 7.0) + ink.w * snoise(px / 9.0);
    float dev = 1.0 - amt;
    float n = mix(ink.x, ink.y, pow(dev, 1.5));
    float q = clamp(floor((l + grain) * n) / (n - 1.0), 0.0, 1.0);
    vec3 tone = mix(vec3(0.078, 0.098, 0.094), vec3(0.843, 0.871, 0.871), q);
    vec3 print = mix(tone, col, smoothstep(inkB.y, 1.0, dev) * inkB.z);

    // Halftone over the portrait box, finer as it grows. The sample is
    // unconditional: no texture read under per-pixel branching.
    float cell = mix(ht.x, ht.y, u);
    vec2 g = inkGridPx(vUv, rect.zw, cell);
    vec3 dots = inkDotsPx(g, cell, cover(inkCentrePx(g, rect.zw, cell)));
    // Per-cell threshold, so scroll dots scatter in and out cell by cell
    float h = fract(sin(dot(floor(g), vec2(12.9898, 78.233))) * 43758.5453);

    // 1: dots, resolving top-down into the photo from "resolve from"
    float k1 = inkFront(mix(1.0, ht.w, smoothstep(ht.z, 1.0, u)), vUv.y);
    vec3 v1 = mix(col, dots, smoothstep(0.0, 1.0, k1));
    // 2 / 3: the print or the photo, breaking into dots with scroll speed
    float kS = smoothstep(h * 0.8, h * 0.8 + 0.2, dotsAmt);
    vec3 v2 = mix(print, dots, kS);
    vec3 v3 = mix(col, dots, kS);

    vec3 outC = print;
    outC = mix(outC, v1, step(0.5, mode) * step(mode, 1.5));
    outC = mix(outC, v2, step(1.5, mode) * step(mode, 2.5));
    outC = mix(outC, v3, step(2.5, mode));
    gl_FragColor = vec4(outC, 1.0);
  }
`;

function gridTriangles(n: number) {
  const out: number[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [x0, x1, y0, y1] = [x / n, (x + 1) / n, y / n, (y + 1) / n];
      out.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
    }
  }
  return new Float32Array(out);
}

interface Box {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface PortraitExpand {
  resize(width: number, height: number): void;
  /** u: progress through the growth 0 → 1; box: the portrait rect */
  render(u: number, box: Box): void;
  /** Live settings: change them, then call refresh() */
  settings: PortraitSettings;
  refresh(): void;
}

/** Null without WebGL: the portrait then just grows as a plain image. */
export function mountPortraitExpand(media: HTMLElement, rerender: () => void): PortraitExpand | null {
  const img = media.querySelector<HTMLImageElement>('img');
  if (!img) return null;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    visibility: 'hidden',
  });

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  let prog: ReturnType<typeof linkProgram>;
  try {
    prog = linkProgram(gl, vertex, fragment, [
      'tex', 'rect', 'view', 'aspect', 'amp', 'phase', 'height', 'freq', 'split',
      'res', 'dpr', 'amt', 'u', 'ink', 'inkB', 'mode', 'ht', 'dotsAmt',
    ]);
  } catch (err) {
    console.warn('[portrait-expand]', err);
    return null;
  }
  media.after(canvas);

  const settings: PortraitSettings = structuredClone(defaults);
  // ?pv=1..3 opens a variant without the panel (for side-by-side tests)
  const pv = Number(new URLSearchParams(location.search).get('pv'));
  if (Object.values(PORTRAIT_VARIANTS).includes(pv) && pv > 0) settings.variant = pv;
  const verts = gridTriangles(GRID);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  setInkColors(gl, prog.program); // also makes it the current program
  gl.enableVertexAttribArray(prog.aUv);
  gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);

  let ready = false;
  let aspect = 1;

  // Power-of-two copy so the texture can mipmap (the box starts tiny)
  img
    .decode()
    .then(() => {
      aspect = img.naturalWidth / img.naturalHeight;
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const pot = document.createElement('canvas');
      pot.width = Math.min(2048, max);
      pot.height = Math.min(4096, max);
      pot.getContext('2d')!.drawImage(img, 0, 0, pot.width, pot.height);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pot);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ready = true;
      rerender();
    })
    .catch((err) => console.warn('[portrait-expand]', err));

  let dpr = 1;
  let speed = 0; // growth progress per second, smoothed
  let lastU = -1;
  let lastT = 0;
  let lastBox: Box = { w: 0, h: 0, cx: 0, cy: 0 };
  let phase = 0;
  let drawnAt = 0;
  let settleRaf = 0;

  // 1 → 0 over the growth, held near 1 at first
  const amount = (u: number) => 1 - u * u * (3 - 2 * u);
  // The scroll-dot variants keep settling at full screen too, so the dots fade
  const settles = () => speed > 0.01 && (amount(lastU) > 0.002 || settings.variant >= 2);

  // After the scroll stops, let the speed die down and keep drawing
  function settle(now: number) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));
    if (now - lastT > 50) speed *= Math.exp(-dt / Math.max(0.01, settings.settle));
    if (speed < 0.01) speed = 0;
    draw();
    settleRaf = settles() ? requestAnimationFrame(settle) : 0;
  }

  function draw() {
    const now = performance.now();
    phase += Math.max(0, Math.min(0.1, (now - drawnAt) / 1000)) * settings.ripple.waveSpeed;
    drawnAt = now;
    const u = Math.max(0, lastU);
    const box = lastBox;
    const amt = amount(u);
    // On for the whole sequence: the print stays at full screen, under the wipe
    const on = ready && box.w > 0.5;
    canvas.style.visibility = on ? 'visible' : 'hidden';
    img!.style.opacity = on ? '0' : '';
    if (!on) return;

    const { u: un } = prog;
    const r = settings.ripple;
    const d = settings.inkDevelop;
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform1i(un.tex, 0);
    gl!.uniform4f(un.rect, box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
    gl!.uniform2f(un.view, canvas.width / dpr, canvas.height / dpr);
    gl!.uniform1f(un.aspect, aspect);
    gl!.uniform1f(un.amp, amt * clamp(speed / r.speedForFull));
    gl!.uniform1f(un.phase, phase);
    gl!.uniform1f(un.height, r.height);
    gl!.uniform1f(un.freq, r.frequency);
    gl!.uniform1f(un.split, r.rgbSplit);
    gl!.uniform2f(un.res, canvas.width, canvas.height);
    gl!.uniform1f(un.dpr, dpr);
    gl!.uniform1f(un.amt, amt);
    gl!.uniform1f(un.u, u);
    gl!.uniform4f(un.ink, d.startLevels, d.endLevels, d.grain, d.coarseGrain);
    gl!.uniform3f(un.inkB, d.grainSize, d.fullTonesAt, d.photoAtEnd);
    const ht = settings.halftone;
    gl!.uniform1f(un.mode, settings.variant);
    gl!.uniform4f(un.ht, ht.cellStart, ht.cellEnd, ht.resolveFrom, ht.dotsAtEnd);
    gl!.uniform1f(un.dotsAmt, clamp(speed / Math.max(0.05, ht.speedForDots)));
    gl!.drawArrays(gl!.TRIANGLES, 0, verts.length / 2);
  }

  const api: PortraitExpand = {
    resize(width, height) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render(u, box) {
      const now = performance.now();
      if (lastU >= 0) {
        const dt = Math.max(0.001, (now - lastT) / 1000);
        const v = Math.min(5, Math.abs(u - lastU) / dt);
        speed += (v - speed) * 0.25;
      }
      lastU = u;
      lastT = now;
      lastBox = box;
      draw();
      if (settles() && !settleRaf) settleRaf = requestAnimationFrame(settle);
    },
    settings,
    refresh: () => rerender(),
  };

  if (new URLSearchParams(location.search).has('tweak')) {
    import('./portrait-tweaks').then(({ mountPortraitTweaks }) =>
      mountPortraitTweaks(api, defaults, import.meta.env.DEV ? '/__portrait-config' : null),
    );
  }

  return api;
}
