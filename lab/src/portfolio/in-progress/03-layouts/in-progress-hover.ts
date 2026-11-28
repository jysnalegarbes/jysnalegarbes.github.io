/*
  In Progress card hover: Liquid RGB
  ----------------------------------
  One WebGL canvas, moved into whichever card is under the cursor, so it
  takes on the card's scroll transform. It draws the card's photo exactly
  over the <img> (object-fit: cover) and, around the cursor, smears it in
  the direction the cursor moves, splitting it into red / green / blue,
  then springs back. Chosen 2026-11-07 from four hovers
  (lab/portfolio/in-progress/01-loop-and-effects); a black liquid-ink take
  on it was tried and set aside (02-drum-skew-ink).

  The cards move under a still cursor too (the loop), so the card under it
  is looked up again on every scroll frame. Fine pointers only.
*/
import { linkProgram, uploadTexture } from './liquid-morph';
import type { InProgressSettings } from './in-progress';

export interface InProgressHover {
  /** Each scroll frame: busy = the cards are moving */
  frame(busy: boolean): void;
  /** The cards were rebuilt (clones) */
  cardsChanged(): void;
  refresh(): void;
}

const ENTER = 0.22; // s, ease in / out of the effect

const vertex = /* glsl */ `
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aUv.x, 1.0 - aUv.y); // top-left origin, like the DOM
    gl_Position = vec4(aUv * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tex;
  uniform vec2 box;      // card, CSS px
  uniform float aspect;  // photo width / height
  uniform float amt;     // 0 → 1 while hovered
  uniform vec2 mouse;    // card uv
  uniform vec2 vel;      // card uv / s
  uniform vec3 p;        // radius, smear strength, rgb split
  varying vec2 vUv;

  vec2 coverUv(vec2 uv) {
    float b = box.x / box.y;
    vec2 s = b > aspect ? vec2(1.0, aspect / b) : vec2(b / aspect, 1.0);
    return 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s;
  }
  vec3 photo(vec2 uv) { return texture2D(tex, coverUv(uv)).rgb; }

  void main() {
    vec2 uv = vUv;
    vec2 d = (uv - mouse) * vec2(box.x / box.y, 1.0); // in card heights
    float fall = exp(-dot(d, d) / max(0.0001, p.x * p.x)) * amt;
    vec2 off = -vel * fall * p.y;
    gl_FragColor = vec4(
      photo(uv + off * (1.0 + p.z)).r,
      photo(uv + off).g,
      photo(uv + off * (1.0 - 0.5 * p.z)).b,
      1.0);
  }
`;

export function mountInProgressHover(root: HTMLElement, settings: InProgressSettings): InProgressHover | null {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return null;

  let prog: ReturnType<typeof linkProgram>;
  try {
    prog = linkProgram(gl, vertex, fragment, ['tex', 'box', 'aspect', 'amt', 'mouse', 'vel', 'p']);
  } catch (err) {
    console.warn('[in-progress-hover]', err);
    return null;
  }
  const { u } = prog;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(prog.aUv);
  gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(u.tex, 0);

  // One texture per photo, kept
  const textures = new Map<string, { tex: WebGLTexture; aspect: number }>();
  const textureFor = (img: HTMLImageElement) => {
    const key = img.currentSrc || img.src;
    const hit = textures.get(key);
    if (hit) return hit;
    if (!img.complete || !img.naturalWidth) return null;
    const entry = { tex: uploadTexture(gl, img), aspect: img.naturalWidth / img.naturalHeight };
    textures.set(key, entry);
    return entry;
  };

  let card: HTMLElement | null = null; // the card the canvas is in
  let hovered: HTMLElement | null = null; // the card under the cursor
  let pointer: { x: number; y: number } | null = null;
  let amt = 0;
  let raw = { x: 0.5, y: 0.5 };
  let vel = { x: 0, y: 0 };
  let lastRaw = { x: 0.5, y: 0.5, t: 0 };
  let w = 0;
  let h = 0;
  let raf = 0;
  let lastT = 0;

  const local = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: (pointer!.x - r.left) / r.width, y: (pointer!.y - r.top) / r.height };
  };

  function attach(el: HTMLElement) {
    card = el;
    el.append(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = el.offsetWidth;
    h = el.offsetHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    amt = 0;
    raw = pointer ? local(el) : { x: 0.5, y: 0.5 };
    lastRaw = { ...raw, t: performance.now() };
    vel = { x: 0, y: 0 };
  }

  function detach() {
    canvas.remove();
    card = null;
  }

  function lookup() {
    if (!pointer) return;
    const el = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('[data-ip-card]') ?? null;
    hovered = el && root.contains(el) && el.querySelector('img') ? el : null;
    if (hovered && hovered !== card) attach(hovered);
  }

  function draw(dt: number) {
    if (!card) return false;
    const img = card.querySelector('img');
    const t = img && textureFor(img);
    const active = hovered === card;
    amt += ((active ? 1 : 0) - amt) * (1 - Math.exp(-dt / ENTER));
    if (pointer && active) {
      raw = local(card);
      const now = performance.now();
      const span = (now - lastRaw.t) / 1000;
      if (span > 0.004) {
        const v = { x: (raw.x - lastRaw.x) / span, y: (raw.y - lastRaw.y) / span };
        vel.x += (v.x - vel.x) * 0.35;
        vel.y += (v.y - vel.y) * 0.35;
        lastRaw = { ...raw, t: now };
      }
    }
    vel.x *= Math.exp(-dt / 0.18);
    vel.y *= Math.exp(-dt / 0.18);

    if (t) {
      const k = settings.liquid;
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform2f(u.box, w, h);
      gl!.uniform1f(u.aspect, t.aspect);
      gl!.uniform1f(u.amt, amt);
      gl!.uniform2f(u.mouse, raw.x, raw.y);
      gl!.uniform2f(u.vel, vel.x, vel.y);
      gl!.uniform3f(u.p, k.radius, k.strength, k.split);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }

    // Runs while hovered (one quad a frame) and until the effect has faded
    if (!active && amt < 0.005) {
      detach();
      return false;
    }
    return true;
  }

  function tick(now: number) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));
    lastT = now;
    raf = draw(dt) ? requestAnimationFrame(tick) : 0;
  }

  function wake() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY };
      lookup();
      wake();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null;
    hovered = null;
    wake();
  });

  return {
    frame(busy) {
      if (busy) {
        lookup();
        if (card) wake();
      }
    },
    cardsChanged() {
      if (card && !card.isConnected) detach();
      hovered = null;
      lookup();
    },
    refresh() {
      if (card) attach(card);
      wake();
    },
  };
}
