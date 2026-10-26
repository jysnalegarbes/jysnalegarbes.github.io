/*
  Effects on the About portrait while it grows (opening sequence), as demos
  to choose from. The box geometry stays about-intro.ts's; these only change
  how the image looks inside it, fading to nothing by the time it fills the
  screen, so the wipe always starts on the plain <img>.
    1 Ink Edge       ragged, ink-soaked edges that straighten as it grows
    2 Lens Settle    starts zoomed in and soft, settles and sharpens (CSS)
    3 Lens Warp      bulges with scroll speed, faint RGB split at the edges
    4 Shutter Strips vertical strips open one after another, gaps close
  1, 3 and 4 draw the portrait on a stage-sized canvas (so edges can bleed
  past the box) and hide the <img> while they run.

  Library copy: ?pfx=N picks the mode; the switcher shows unless ?embed.
*/
import { linkProgram } from '../../../../src/scripts/liquid-morph';

export type PortraitMode = 0 | 1 | 2 | 3 | 4;
export const MODE_NAMES = ['None', 'Ink Edge', 'Lens Settle', 'Lens Warp', 'Shutter Strips'];

// Tunables
const SETTLE_ZOOM = 0.3; // 2: extra scale at the start
const SETTLE_BLUR = 0.006; // 2: blur at the start, as a fraction of the box width
const WARP_BASE = 0.3; // 3: warp while scrolling slowly
const WARP_SPEED = 3; // 3: progress/s that adds the full extra warp
const STRIPS = 7; // 4

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
      float reach = amt * (8.0 + 0.1 * side);
      float n = fbm(px / (24.0 + 0.12 * side) + u * 2.5);
      float speck = snoise(px / 3.5 + u * 9.0);
      float edge = sd + reach * (0.5 + 0.8 * n) + amt * 3.0 * speck;
      float a = 1.0 - smoothstep(-0.75, 0.75, edge);
      // ink pooling a little darker just inside the edge
      float pool = smoothstep(-reach * 0.7, 0.0, edge) * amt;
      col = cover(uv);
      col.rgb *= 1.0 - 0.35 * pool;
      col *= a;
    } else if (mode < 3.5) {
      // 3 Lens Warp: pillow-shaped outline, magnified centre, RGB split at the rim
      vec2 b = 0.5 * (1.0 + 0.09 * warp * (1.0 - 4.0 * c.yx * c.yx));
      vec2 d = (abs(c) - b) * rect.zw;
      float a = clamp(0.5 - max(d.x, d.y), 0.0, 1.0);
      vec2 cn = c / b * 0.5;
      float r2 = clamp(dot(cn, cn) * 2.0, 0.0, 1.0);
      vec2 s = cn * (1.0 - 0.28 * warp * (1.0 - r2));
      vec2 split = cn * 0.025 * warp * r2;
      col.r = cover(0.5 + s + split).r;
      col.ga = cover(0.5 + s).ga;
      col.b = cover(0.5 + s - split).b;
      col *= a;
    } else {
      // 4 Shutter Strips: alternate strips open from the top and the bottom
      float n = ${STRIPS.toFixed(1)};
      float i = floor(clamp(uv.x, 0.0, 0.9999) * n);
      float r = smoothstep(i * 0.04, i * 0.04 + 0.3, u);
      float down = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
      float v = down > 0.0 ? uv.y : 1.0 - uv.y;
      float sw = rect.z / n;
      float lx = fract(clamp(uv.x, 0.0, 0.9999) * n) * sw;
      float gap = 0.5 * sw * 0.22 * (1.0 - smoothstep(0.5, 1.0, u));
      float ax = min(lx - gap, sw - gap - lx);
      float ay = (r - v) * rect.w;
      vec2 o = abs(c * rect.zw) - rect.zw * 0.5;
      float a = clamp(min(min(ax, ay), -max(o.x, o.y)) + 0.5, 0.0, 1.0);
      col = cover(uv + vec2(0.0, down * (1.0 - r) * 0.18)) * a;
    }
    gl_FragColor = col;
  }
`;

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
}

function initialMode(): PortraitMode {
  const q = Number(new URLSearchParams(location.search).get('pfx'));
  if (q >= 0 && q <= 4 && location.search.includes('pfx')) return q as PortraitMode;
  try {
    const s = Number(localStorage.getItem('about-pfx'));
    if (s >= 0 && s <= 4) return s as PortraitMode;
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
  if (gl) {
    try {
      prog = linkProgram(gl, vertex, fragment, ['tex', 'res', 'dpr', 'rect', 'aspect', 'mode', 'amt', 'u', 'warp']);
    } catch (err) {
      console.warn('[portrait-expand]', err);
    }
  }
  let ready = false;
  let aspect = 1;

  if (gl && prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(prog.program);
    gl.enableVertexAttribArray(prog.aUv);
    gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
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

      // 1 → 0 over the growth, held near 1 at first
      const amt = 1 - u * u * (3 - 2 * u);
      const active = amt > 0.002 && box.w > 0.5;

      if (mode === 2 && active) {
        img!.style.transform = `scale(${1 + SETTLE_ZOOM * amt})`;
        img!.style.filter = amt > 0.02 ? `blur(${(SETTLE_BLUR * box.w * amt).toFixed(2)}px)` : '';
      } else clearCss();

      const gpu = (mode === 1 || mode === 3 || mode === 4) && active && ready && gl && prog;
      canvas.style.visibility = gpu ? 'visible' : 'hidden';
      img!.style.opacity = gpu ? '0' : '';
      if (!gpu) return;

      const { u: un } = prog!;
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1i(un.tex, 0);
      gl!.uniform2f(un.res, canvas.width, canvas.height);
      gl!.uniform1f(un.dpr, dpr);
      gl!.uniform4f(un.rect, box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
      gl!.uniform1f(un.aspect, aspect);
      gl!.uniform1f(un.mode, mode);
      gl!.uniform1f(un.amt, amt);
      gl!.uniform1f(un.u, u);
      gl!.uniform1f(un.warp, amt * clamp(WARP_BASE + (1 - WARP_BASE) * (speed / WARP_SPEED)));
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    },
  };

  if (!new URLSearchParams(location.search).has('embed')) mountSwitcher();

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
      b.addEventListener('click', () => {
        mode = i as PortraitMode;
        try {
          localStorage.setItem('about-pfx', String(i));
        } catch {}
        paint();
        rerender();
      });
      bar.append(b);
      return b;
    });
    const paint = () =>
      buttons.forEach((b, i) => {
        b.style.background = i === mode ? '#d7dede' : 'transparent';
        b.style.color = i === mode ? '#141918' : '#d7dede';
      });
    paint();
    document.body.append(bar);
  }

  return api;
}
