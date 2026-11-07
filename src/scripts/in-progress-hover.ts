/*
  In Progress card hover
  ----------------------
  One WebGL canvas, moved into whichever card is under the cursor, so it
  takes on the card's scroll transform. It draws the card's photo exactly
  over the <img> (object-fit: cover), plus the effect on test (hoverFx,
  ?hfx=1..3):
    1 Halftone Lens  a soft disc around the cursor turns into the site's ink
                     halftone (ink-halftone.ts), trailing a little behind
    2 Pixel Trail    the cursor leaves a trail of blocks that pixelate the
                     photo, finer where it's fresh and coarser as it fades,
                     after the Produx project cards / footer (produx.design)
    3 Liquid RGB     the photo smears in the direction the cursor moves,
                     splitting into red / green / blue, and springs back
    4 Liquid Halftone Trail  the cursor paints a soft, wobbling ink trail;
                     inside it the photo turns into the ink halftone and
                     smears along the cursor's motion, then the trail dries
                     back into the photo
  The cards move under a still cursor too (the loop), so the card under it
  is looked up again on every scroll frame. Fine pointers only.
*/
import { linkProgram, uploadTexture } from './liquid-morph';
import { inkGlsl, setInkColors } from './ink-halftone';
import { PixelTrail, createTrailTexture } from './pixel-trail';
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
  uniform sampler2D trail;
  uniform vec2 box;      // card, CSS px
  uniform float aspect;  // photo width / height
  uniform float mode;
  uniform float amt;     // 0 → 1 while hovered
  uniform vec2 mouse;    // card uv
  uniform vec2 vel;      // card uv / s
  uniform vec4 p;        // lens radius, lens cell px, pixel block px, liquid radius
  uniform vec2 q;        // liquid strength, rgb split
  uniform vec4 lt;       // liquid trail: edge, softness, wobble, dot px
  uniform float smear;   // liquid trail smear
  uniform float time;
  varying vec2 vUv;
  ${inkGlsl}

  vec2 coverUv(vec2 uv) {
    float b = box.x / box.y;
    vec2 s = b > aspect ? vec2(1.0, aspect / b) : vec2(b / aspect, 1.0);
    return 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s;
  }
  vec3 photo(vec2 uv) { return texture2D(tex, coverUv(uv)).rgb; }
  float hash(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 base = photo(uv);
    vec2 d = (uv - mouse) * vec2(box.x / box.y, 1.0); // in card heights
    float r = length(d);

    // 1 Halftone Lens. Every sample is unconditional (no texture reads
    // under per-pixel branching).
    vec2 g = inkGridPx(uv, box, p.y);
    vec3 dots = inkDotsPx(g, p.y, photo(inkCentrePx(g, box, p.y)));
    float lens = (1.0 - smoothstep(p.x * 0.7, p.x, r)) * amt;
    vec3 c1 = mix(base, dots, lens);

    // 2 Pixel Trail: fresh trail = fine blocks, fading trail = coarse ones
    float m = texture2D(trail, uv).r;
    float blk = p.z * (m > 0.66 ? 0.25 : (m > 0.33 ? 0.5 : 1.0));
    vec2 cell = floor(uv * box / blk);
    vec3 pix = photo((cell + 0.5) * blk / box) * (0.82 + 0.36 * hash(cell + floor(m * 6.0)));
    vec3 c2 = mix(base, pix, step(0.02, m));

    // 3 Liquid RGB
    float fall = exp(-(r * r) / max(0.0001, p.w * p.w)) * amt;
    vec2 off = -vel * fall * q.x;
    vec3 c3 = vec3(photo(uv + off * (1.0 + q.y)).r, photo(uv + off).g, photo(uv + off * (1.0 - 0.5 * q.y)).b);

    // 4 Liquid Halftone Trail: the soft trail (LINEAR), its edge wobbled
    // and cut like the home ink, dots inside smeared along the motion
    vec2 wob = lt.z * 0.012 * vec2(
      sin(uv.y * 31.0 + time * 2.3) + sin(uv.x * 17.0 - time * 1.7),
      cos(uv.x * 27.0 - time * 2.1) + cos(uv.y * 13.0 + time * 1.3));
    float wet = texture2D(trail, uv + wob).r;
    float inked = smoothstep(lt.x - lt.y, lt.x + lt.y, wet);
    vec2 suv = uv - vel * wet * smear;
    vec2 g4 = inkGridPx(suv, box, lt.w);
    vec3 dots4 = inkDotsPx(g4, lt.w, photo(inkCentrePx(g4, box, lt.w)));
    vec3 c4 = mix(base, dots4, inked);

    vec3 c = c1;
    c = mix(c, c2, step(1.5, mode));
    c = mix(c, c3, step(2.5, mode));
    c = mix(c, c4, step(3.5, mode));
    gl_FragColor = vec4(c, 1.0);
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
    prog = linkProgram(gl, vertex, fragment, ['tex', 'trail', 'box', 'aspect', 'mode', 'amt', 'mouse', 'vel', 'p', 'q', 'lt', 'smear', 'time']);
  } catch (err) {
    console.warn('[in-progress-hover]', err);
    return null;
  }
  const { u } = prog;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  setInkColors(gl, prog.program);
  gl.enableVertexAttribArray(prog.aUv);
  gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(u.tex, 0);
  gl.uniform1i(u.trail, 1);

  gl.activeTexture(gl.TEXTURE1);
  const trailTex = createTrailTexture(gl);
  gl.activeTexture(gl.TEXTURE0);
  const trail = new PixelTrail();

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
  let mouse = { x: 0.5, y: 0.5 }; // eased (lens)
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
    // Pixel Trail: hard blocks; Liquid Halftone Trail: a finer, soft grid
    const liquid = settings.hoverFx === 4;
    const cell = Math.max(3, liquid ? settings.liquidTrail.cell : settings.pixel.block);
    trail.resize(w / cell, h / cell);
    trail.clear();
    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, trailTex);
    const filter = liquid ? gl!.LINEAR : gl!.NEAREST;
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
    gl!.activeTexture(gl!.TEXTURE0);
    amt = 0;
    const at = local(el);
    mouse = { ...at };
    raw = { ...at };
    lastRaw = { ...at, t: performance.now() };
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
      const span = Math.max(0.001, (now - lastRaw.t) / 1000);
      if (span > 0.004) {
        const v = { x: (raw.x - lastRaw.x) / span, y: (raw.y - lastRaw.y) / span };
        vel.x += (v.x - vel.x) * 0.35;
        vel.y += (v.y - vel.y) * 0.35;
        lastRaw = { ...raw, t: now };
      }
      if (settings.hoverFx === 2) trail.move(raw.x, raw.y, settings.pixel.radius, 0.6);
      if (settings.hoverFx === 4) trail.move(raw.x, raw.y, settings.liquidTrail.brush, 0);
    }
    vel.x *= Math.exp(-dt / 0.18);
    vel.y *= Math.exp(-dt / 0.18);
    const follow = Math.max(0.001, settings.halftone.follow);
    mouse.x += (raw.x - mouse.x) * (1 - Math.exp(-dt / follow));
    mouse.y += (raw.y - mouse.y) * (1 - Math.exp(-dt / follow));
    const trailOn = trail.decay(dt, settings.hoverFx === 4 ? settings.liquidTrail.fade : settings.pixel.fade);

    if (t) {
      gl!.activeTexture(gl!.TEXTURE1);
      trail.upload(gl!, trailTex);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform2f(u.box, w, h);
      gl!.uniform1f(u.aspect, t.aspect);
      gl!.uniform1f(u.mode, settings.hoverFx);
      gl!.uniform1f(u.amt, amt);
      gl!.uniform2f(u.mouse, mouse.x, mouse.y);
      gl!.uniform2f(u.vel, vel.x, vel.y);
      gl!.uniform4f(u.p, settings.halftone.radius, settings.halftone.cell, settings.pixel.block, settings.liquid.radius);
      gl!.uniform2f(u.q, settings.liquid.strength, settings.liquid.split);
      const lt = settings.liquidTrail;
      gl!.uniform4f(u.lt, lt.edge, lt.softness, lt.wobble, lt.dot);
      gl!.uniform1f(u.smear, lt.smear);
      gl!.uniform1f(u.time, performance.now() / 1000);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }

    // Runs while hovered (one quad a frame) and until the effect has faded
    if (!active && amt < 0.005 && !trailOn) {
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
    trail.lift();
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
