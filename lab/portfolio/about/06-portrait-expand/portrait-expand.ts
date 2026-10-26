/*
  Effects on the About portrait while it grows (opening sequence), as demos
  to choose from. The box geometry stays about-intro.ts's; these only change
  how the image looks inside it, fading to nothing by the time it fills the
  screen, so the wipe always starts on the plain <img>.
    1 Ink Edge       ragged, ink-soaked edges that straighten as it grows
    2 Lens Settle    starts zoomed in and soft, settles and sharpens (CSS)
    3 Lens Warp      bulges with scroll speed, faint RGB split at the edges
    4 Shutter Strips vertical strips open one after another, gaps close
    5 Ripple         the home hero's intro wave, driven by scroll speed: it
                     wobbles in perspective while you scroll, settles flat
    6 Ink Develop    starts as a grainy two-tone ink print; the tones come in
                     as it grows, like a print developing
    7 Ripple + Ink   5 and 6 together: the wave while scrolling, on a print
                     that develops to the full photo by full screen
  All but 2 draw the portrait on a stage-sized canvas (so edges can bleed
  past the box) and hide the <img> while they run. 3 and 5 keep drawing for
  a moment after the scroll stops, so they ease back flat (7 too).

  Every value lives in src/config/portrait-expand.json. ?tweak opens a panel
  for the current effect (portrait-tweaks.ts); on the dev server its "Save to
  project" writes that file.

  Library copy: ?pfx=N picks the mode; the switcher and the tweak panel
  (without Save) show unless ?embed.
*/
import { linkProgram } from '../../../../src/scripts/liquid-morph';
import defaults from './portrait-expand.json';

export type PortraitSettings = typeof defaults;

export type PortraitMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const MODE_NAMES = [
  'None',
  'Ink Edge',
  'Lens Settle',
  'Lens Warp',
  'Shutter Strips',
  'Ripple',
  'Ink Develop',
  'Ripple + Ink',
];
const LAST_MODE = MODE_NAMES.length - 1;

const RIPPLE_GRID = 32; // 5: mesh subdivisions per side

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const vertex = /* glsl */ `
  attribute vec2 aUv;
  void main() { gl_Position = vec4(aUv * 2.0 - 1.0, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tex;
  uniform vec2 res;      // canvas, device px
  uniform float dpr;
  uniform vec4 rect;     // portrait box: x, y, w, h in CSS px from the top left
  uniform float aspect;  // image width / height
  uniform float mode;
  uniform float amt;     // 1 at the start, 0 once it fills the screen
  uniform float u;       // progress through the growth, 0 → 1
  uniform float warp;    // 3: strength, from scroll speed
  uniform vec4 pa;       // the current effect's settings (see draw())
  uniform vec4 pb;

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
  float fbm(vec2 p) {
    return 0.6 * snoise(p) + 0.3 * snoise(p * 2.1 + 7.3) + 0.1 * snoise(p * 4.3 - 3.1);
  }

  // object-fit: cover, centred
  vec4 cover(vec2 uv) {
    float box = rect.z / rect.w;
    vec2 s = box > aspect ? vec2(1.0, aspect / box) : vec2(box / aspect, 1.0);
    return texture2D(tex, 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s);
  }

  void main() {
    vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
    vec2 uv = (px - rect.xy) / rect.zw;
    vec2 c = uv - 0.5;
    float side = min(rect.z, rect.w);
    vec4 col = vec4(0.0);

    if (mode < 1.5) {
      // 1 Ink Edge: the box edge pushed in (and now and then out) by noise
      vec2 q = abs(c * rect.zw) - rect.zw * 0.5;
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float reach = amt * (8.0 + 0.1 * side) * pa.x;
      float n = fbm(px / ((24.0 + 0.12 * side) * pa.y) + u * pb.x);
      float speck = snoise(px / 3.5 + u * 9.0);
      float edge = sd + reach * (0.5 + 0.8 * n) + amt * pa.z * speck;
      float a = 1.0 - smoothstep(-0.75, 0.75, edge);
      // ink pooling a little darker just inside the edge
      float pool = smoothstep(-reach * 0.7, 0.0, edge) * amt;
      col = cover(uv);
      col.rgb *= 1.0 - pa.w * pool;
      col *= a;
    } else if (mode < 3.5) {
      // 3 Lens Warp: pillow-shaped outline, magnified centre, RGB split at the rim
      vec2 b = 0.5 * (1.0 + pa.x * warp * (1.0 - 4.0 * c.yx * c.yx));
      vec2 d = (abs(c) - b) * rect.zw;
      float a = clamp(0.5 - max(d.x, d.y), 0.0, 1.0);
      vec2 cn = c / b * 0.5;
      float r2 = clamp(dot(cn, cn) * 2.0, 0.0, 1.0);
      vec2 s = cn * (1.0 - pa.y * warp * (1.0 - r2));
      vec2 split = cn * pa.z * warp * r2;
      col.r = cover(0.5 + s + split).r;
      col.ga = cover(0.5 + s).ga;
      col.b = cover(0.5 + s - split).b;
      col *= a;
    } else if (mode < 4.5) {
      // 4 Shutter Strips: alternate strips open from the top and the bottom
      float n = pa.x;
      float i = floor(clamp(uv.x, 0.0, 0.9999) * n);
      float r = smoothstep(i * pa.y, i * pa.y + pa.z, u);
      float down = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
      float v = down > 0.0 ? uv.y : 1.0 - uv.y;
      float sw = rect.z / n;
      float lx = fract(clamp(uv.x, 0.0, 0.9999) * n) * sw;
      float gap = 0.5 * sw * pa.w * (1.0 - smoothstep(0.5, 1.0, u));
      float ax = min(lx - gap, sw - gap - lx);
      float ay = (r - v) * rect.w;
      vec2 o = abs(c * rect.zw) - rect.zw * 0.5;
      float a = clamp(min(min(ax, ay), -max(o.x, o.y)) + 0.5, 0.0, 1.0);
      col = cover(uv + vec2(0.0, down * (1.0 - r) * pb.x)) * a;
    } else {
      // 6 Ink Develop: two-tone ink print, then posterised, then full tones
      vec4 src = cover(uv);
      float l = dot(src.rgb, vec3(0.299, 0.587, 0.114));
      float grain = pa.z * snoise(px / pb.x + u * 7.0) + pa.w * snoise(px / 9.0);
      float dev = 1.0 - amt;
      float n = mix(pa.x, pa.y, pow(dev, 1.5));
      float q = clamp(floor((l + grain) * n) / (n - 1.0), 0.0, 1.0);
      vec3 tone = mix(vec3(0.078, 0.098, 0.094), vec3(0.843, 0.871, 0.871), q);
      vec2 o = abs(c * rect.zw) - rect.zw * 0.5;
      float a = clamp(0.5 - max(o.x, o.y), 0.0, 1.0);
      col = vec4(mix(tone, src.rgb, smoothstep(pb.y, 1.0, dev)), 1.0) * a;
    }
    gl_FragColor = col;
  }
`;

// 5 Ripple: the home hero's intro wave (portrait-fx.ts) on a subdivided
// plane, seen from a camera centred on the stage, 50 units away
const rippleVertex = /* glsl */ `
  attribute vec2 aUv; // plane uv, top-left origin
  uniform vec4 rect;
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

const rippleFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tex;
  uniform vec4 rect;
  uniform float aspect;
  uniform float split;
  uniform float develop; // 7: 1 to tone it like Ink Develop
  uniform vec2 res;
  uniform float dpr;
  uniform float amt;
  uniform float u;
  uniform vec4 pa;       // Ink Develop's settings, as in the main shader
  uniform vec4 pb;
  varying vec2 vUv;
  varying float vWave;
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
    if (develop > 0.5) {
      vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float grain = pa.z * snoise(px / pb.x + u * 7.0) + pa.w * snoise(px / 9.0);
      float dev = 1.0 - amt;
      float n = mix(pa.x, pa.y, pow(dev, 1.5));
      float q = clamp(floor((l + grain) * n) / (n - 1.0), 0.0, 1.0);
      vec3 tone = mix(vec3(0.078, 0.098, 0.094), vec3(0.843, 0.871, 0.871), q);
      col = mix(tone, col, smoothstep(pb.y, 1.0, dev));
    }
    gl_FragColor = vec4(col, 1.0);
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
  mode(): PortraitMode;
  setMode(m: PortraitMode): void;
  onMode(fn: (m: PortraitMode) => void): void;
  refresh(): void;
}

function initialMode(): PortraitMode {
  const q = Number(new URLSearchParams(location.search).get('pfx'));
  if (q >= 0 && q <= LAST_MODE && location.search.includes('pfx')) return q as PortraitMode;
  try {
    const s = Number(localStorage.getItem('about-pfx'));
    if (s >= 0 && s <= LAST_MODE) return s as PortraitMode;
  } catch {}
  return 1;
}

export function mountPortraitExpand(
  stage: HTMLElement,
  media: HTMLElement,
  rerender: () => void,
): PortraitExpand | null {
  const img = media.querySelector<HTMLImageElement>('img');
  if (!img) return null;
  let mode: PortraitMode = initialMode();
  const settings: PortraitSettings = structuredClone(defaults);
  const modeListeners: ((m: PortraitMode) => void)[] = [];

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
  media.after(canvas);

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  let prog: ReturnType<typeof linkProgram> | null = null;
  let ripple: ReturnType<typeof linkProgram> | null = null;
  if (gl) {
    try {
      prog = linkProgram(gl, vertex, fragment, ['tex', 'res', 'dpr', 'rect', 'aspect', 'mode', 'amt', 'u', 'warp', 'pa', 'pb']);
      ripple = linkProgram(gl, rippleVertex, rippleFragment, [
        'tex', 'rect', 'view', 'aspect', 'amp', 'phase', 'height', 'freq', 'split',
        'develop', 'res', 'dpr', 'amt', 'u', 'pa', 'pb',
      ]);
    } catch (err) {
      console.warn('[portrait-expand]', err);
    }
  }
  let ready = false;
  let aspect = 1;

  const quad = gl?.createBuffer() ?? null;
  const grid = gl?.createBuffer() ?? null;
  const gridVerts = gridTriangles(RIPPLE_GRID);

  if (gl && prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, grid);
    gl.bufferData(gl.ARRAY_BUFFER, gridVerts, gl.STATIC_DRAW);
    gl.clearColor(0, 0, 0, 0);

    // Power-of-two copy so the texture can mipmap (the box starts tiny)
    const load = () =>
      img.decode().then(() => {
        aspect = img.naturalWidth / img.naturalHeight;
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        const pot = document.createElement('canvas');
        pot.width = Math.min(2048, max);
        pot.height = Math.min(4096, max);
        pot.getContext('2d')!.drawImage(img, 0, 0, pot.width, pot.height);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pot);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        ready = true;
        rerender();
      });
    load().catch((err) => console.warn('[portrait-expand]', err));
  }

  let dpr = 1;
  let speed = 0;
  let lastU = -1;
  let lastT = 0;
  let lastBox: Box = { w: 0, h: 0, cx: 0, cy: 0 };
  let phase = 0;
  let drawnAt = 0;
  let settleRaf = 0;

  function clearCss() {
    img!.style.transform = '';
    img!.style.filter = '';
  }

  const api: PortraitExpand = {
    resize(width, height) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl?.viewport(0, 0, canvas.width, canvas.height);
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
    mode: () => mode,
    setMode(m) {
      mode = m;
      try {
        localStorage.setItem('about-pfx', String(m));
      } catch {}
      modeListeners.forEach((fn) => fn(m));
      rerender();
    },
    onMode(fn) {
      modeListeners.push(fn);
    },
    refresh: () => rerender(),
  };

  // 1 → 0 over the growth, held near 1 at first
  const amount = (u: number) => 1 - u * u * (3 - 2 * u);
  const settles = () => (mode === 3 || mode === 5 || mode === 7) && speed > 0.01 && amount(lastU) > 0.002;

  // After the scroll stops, let the speed die down and keep drawing
  function settle(now: number) {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    if (now - lastT > 50) speed *= Math.exp(-dt / Math.max(0.01, settings.settle));
    if (speed < 0.01) speed = 0;
    draw();
    settleRaf = settles() ? requestAnimationFrame(settle) : 0;
  }

  function draw() {
    const now = performance.now();
    phase += Math.min(0.1, (now - drawnAt) / 1000) * settings.ripple.waveSpeed;
    drawnAt = now;
    const u = Math.max(0, lastU);
    const box = lastBox;
    const amt = amount(u);
    const active = amt > 0.002 && box.w > 0.5;

    if (mode === 2 && active) {
      const { zoom, blur } = settings.lensSettle;
      img!.style.transform = `scale(${1 + zoom * amt})`;
      img!.style.filter = amt > 0.02 ? `blur(${((blur / 100) * box.w * amt).toFixed(2)}px)` : '';
    } else clearCss();

    const gpu = mode !== 0 && mode !== 2 && active && ready && gl && prog && ripple;
    canvas.style.visibility = gpu ? 'visible' : 'hidden';
    img!.style.opacity = gpu ? '0' : '';
    if (!gpu) return;

    const g = gl!;
    const x = box.cx - box.w / 2;
    const y = box.cy - box.h / 2;
    g.clear(g.COLOR_BUFFER_BIT);

    if (mode === 5 || mode === 7) {
      const { program, u: un, aUv } = ripple!;
      g.useProgram(program);
      g.bindBuffer(g.ARRAY_BUFFER, grid);
      g.enableVertexAttribArray(aUv);
      g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
      g.uniform1i(un.tex, 0);
      g.uniform4f(un.rect, x, y, box.w, box.h);
      g.uniform2f(un.view, canvas.width / dpr, canvas.height / dpr);
      g.uniform1f(un.aspect, aspect);
      const r = settings.ripple;
      g.uniform1f(un.amp, amt * clamp(speed / r.speedForFull));
      g.uniform1f(un.phase, phase);
      g.uniform1f(un.height, r.height);
      g.uniform1f(un.freq, r.frequency);
      g.uniform1f(un.split, r.rgbSplit);
      g.uniform1f(un.develop, mode === 7 ? 1 : 0);
      g.uniform2f(un.res, canvas.width, canvas.height);
      g.uniform1f(un.dpr, dpr);
      g.uniform1f(un.amt, amt);
      g.uniform1f(un.u, u);
      const [pa, pb] = params();
      g.uniform4f(un.pa, ...pa);
      g.uniform4f(un.pb, ...pb);
      g.drawArrays(g.TRIANGLES, 0, gridVerts.length / 2);
      return;
    }

    const { program, u: un, aUv } = prog!;
    g.useProgram(program);
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.enableVertexAttribArray(aUv);
    g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
    g.uniform1i(un.tex, 0);
    g.uniform2f(un.res, canvas.width, canvas.height);
    g.uniform1f(un.dpr, dpr);
    g.uniform4f(un.rect, x, y, box.w, box.h);
    g.uniform1f(un.aspect, aspect);
    g.uniform1f(un.mode, mode);
    g.uniform1f(un.amt, amt);
    g.uniform1f(un.u, u);
    const w = settings.lensWarp;
    g.uniform1f(un.warp, amt * clamp(w.base + (1 - w.base) * (speed / w.speedForFull)));
    const [pa, pb] = params();
    g.uniform4f(un.pa, ...pa);
    g.uniform4f(un.pb, ...pb);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  // The current effect's settings, packed for the shader's pa / pb
  function params(): [[number, number, number, number], [number, number, number, number]] {
    const { inkEdge: e, lensWarp: w, shutterStrips: st, inkDevelop: d } = settings;
    if (mode === 1) return [[e.reach, e.blotSize, e.speckle, e.pool], [e.drift, 0, 0, 0]];
    if (mode === 3) return [[w.bulge, w.magnify, w.rgbSplit, 0], [0, 0, 0, 0]];
    if (mode === 4) return [[Math.round(st.count), st.stagger, st.duration, st.gap], [st.offset, 0, 0, 0]];
    return [[d.startLevels, d.endLevels, d.grain, d.coarseGrain], [d.grainSize, d.fullTonesAt, 0, 0]];
  }

  if (!new URLSearchParams(location.search).has('embed')) {
    mountSwitcher();
    import('./portrait-tweaks').then(({ mountPortraitTweaks }) => mountPortraitTweaks(api, defaults, null));
  }

  function mountSwitcher() {
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      zIndex: '9999',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      padding: '6px',
      maxWidth: 'calc(100vw - 32px)',
      background: 'rgba(20,25,24,.85)',
      borderRadius: '8px',
      font: '12px/1 system-ui, sans-serif',
    });
    const buttons = MODE_NAMES.map((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i ? `${i} ${name}` : name;
      Object.assign(b.style, {
        padding: '7px 10px',
        border: '0',
        borderRadius: '5px',
        cursor: 'pointer',
        font: 'inherit',
      });
      b.addEventListener('click', () => api.setMode(i as PortraitMode));
      bar.append(b);
      return b;
    });
    const paint = () =>
      buttons.forEach((b, i) => {
        b.style.background = i === mode ? '#d7dede' : 'transparent';
        b.style.color = i === mode ? '#141918' : '#d7dede';
      });
    paint();
    api.onMode(paint);
    document.body.append(bar);
  }

  return api;
}
