/*
  About portrait effect while it grows (opening sequence): "Ripple +
  Halftone Develop", chosen 2026-11-07 (variants kept in the effects
  library, lab/portfolio/about/15-portrait-halftone-wipe; earlier options in
  06-portrait-expand).
    - Ripple: the home hero's intro wave (portrait-fx.ts) on a subdivided
      plane, driven by scroll speed. It wobbles in perspective, with an RGB
      split where it bends, while you scroll, and settles flat when you stop.
    - Halftone Develop: the portrait is the site's ink halftone
      (ink-halftone.ts) while it grows, its cells going from
      halftone.cellStart to cellEnd (CSS px). From "resolve from" it
      resolves top-down into the photo; "dots at end" keeps part of the
      screen at full size, which stays until the wipe covers it.
  The ripple fades out over the growth, so the full-screen portrait sits
  flat. The box geometry stays about-intro.ts's.

  Every value lives in src/config/portrait-expand.json. ?tweak opens a panel
  (portrait-tweaks.ts); on the dev server its "Save to project" writes it.
*/
import { linkProgram } from './liquid-morph';
import { inkGlsl, setInkColors } from './ink-halftone';
import defaults from '../config/portrait-expand.json';

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
  uniform float u;       // progress through the growth, 0 → 1
  uniform vec4 ht;       // cell start, cell end, resolve from, dots at end
  varying vec2 vUv;
  varying float vWave;
  ${inkGlsl}

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

    // Halftone over the portrait box. The sample is unconditional: no
    // texture read under per-pixel branching.
    float cell = mix(ht.x, ht.y, u);
    vec2 g = inkGridPx(vUv, rect.zw, cell);
    vec3 dots = inkDotsPx(g, cell, cover(inkCentrePx(g, rect.zw, cell)));
    // Resolves top-down into the photo from "resolve from"
    float k = inkFront(mix(1.0, ht.w, smoothstep(ht.z, 1.0, u)), vUv.y);
    gl_FragColor = vec4(mix(col, dots, smoothstep(0.0, 1.0, k)), 1.0);
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
      'tex', 'rect', 'view', 'aspect', 'amp', 'phase', 'height', 'freq', 'split', 'u', 'ht',
    ]);
  } catch (err) {
    console.warn('[portrait-expand]', err);
    return null;
  }
  media.after(canvas);

  const settings: PortraitSettings = structuredClone(defaults);
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
  const settles = () => speed > 0.01 && amount(lastU) > 0.002;

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
    // On for the whole sequence: the dots stay at full screen, under the wipe
    const on = ready && box.w > 0.5;
    canvas.style.visibility = on ? 'visible' : 'hidden';
    img!.style.opacity = on ? '0' : '';
    if (!on) return;

    const { u: un } = prog;
    const r = settings.ripple;
    const ht = settings.halftone;
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
    gl!.uniform1f(un.u, u);
    gl!.uniform4f(un.ht, ht.cellStart, ht.cellEnd, ht.resolveFrom, ht.dotsAtEnd);
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
