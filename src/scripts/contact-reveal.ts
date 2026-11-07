/*
  Contact name reveal (Figma 1:493, "Jayson Alegarbes" 1:552)
  -----------------------------------------------------------
  The area under "GOT a project IN MIND?" looks blank. Moving the cursor
  over it uncovers the name in the brand green, only where the cursor has
  passed, as blocky pixels that fade back out: after the Produx footer
  (produx.design). The trail is a grid of blocks (pixel-trail.ts): fresh
  trail shows the letters in fine blocks, older trail in coarser ones, and
  each block gets its own shade of green (a few go near-black), so the
  letters read like a pixelated photo rather than flat type.

  The name stays in the page as the hidden .contact__name (aria-hidden, in
  the background colour), which also gives the canvas its type and
  position. Desktop fine pointers only; off under reduced motion.
  Settings: src/config/contact-reveal.json; /contact/?tweak opens a panel.
*/
import { linkProgram, uploadTexture } from './liquid-morph';
import { PixelTrail, createTrailTexture } from './pixel-trail';
import defaults from '../config/contact-reveal.json';

export type ContactRevealSettings = typeof defaults;

export interface ContactReveal {
  settings: ContactRevealSettings;
  refresh(): void;
}

const GREEN = [15 / 255, 177 / 255, 42 / 255]; // --green
const INK = [20 / 255, 25 / 255, 24 / 255]; // --black

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
  uniform sampler2D text;   // the name, white on transparent
  uniform sampler2D trail;  // 0..1 per block
  uniform vec2 box;         // CSS px
  uniform float block;      // px
  uniform vec3 look;        // shade, dark blocks, -
  uniform vec3 green;
  uniform vec3 ink;
  varying vec2 vUv;

  float hash(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    float m = texture2D(trail, vUv).r;
    // Fresh trail: quarter blocks; fading: half, then whole blocks
    float blk = block * (m > 0.66 ? 0.25 : (m > 0.33 ? 0.5 : 1.0));
    vec2 cell = floor(vUv * box / blk);
    float a = texture2D(text, (cell + 0.5) * blk / box).a;
    float h = hash(cell + floor(m * 5.0) * 17.0);
    vec3 c = green * (1.0 - look.x + 2.0 * look.x * h);
    c = mix(c, ink, step(1.0 - look.y, hash(cell * 1.7 + 3.0)));
    float on = step(0.02, m) * step(0.5, a);
    gl_FragColor = vec4(c * on, on);
  }
`;

export function mountContactReveal(section: HTMLElement): ContactReveal | null {
  const name = section.querySelector<HTMLElement>('[data-contact-name]');
  const hero = section.querySelector<HTMLElement>('[data-contact-hero]');
  const foot = section.querySelector<HTMLElement>('[data-contact-foot]');
  if (!name || !hero || !foot) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const able = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');

  const canvas = document.createElement('canvas');
  canvas.className = 'contact__reveal';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', left: '0', pointerEvents: 'none' });
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  let prog: ReturnType<typeof linkProgram>;
  try {
    prog = linkProgram(gl, vertex, fragment, ['text', 'trail', 'box', 'block', 'look', 'green', 'ink']);
  } catch (err) {
    console.warn('[contact-reveal]', err);
    return null;
  }
  const { u } = prog;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(prog.aUv);
  gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(u.text, 0);
  gl.uniform1i(u.trail, 1);
  gl.uniform3fv(u.green, GREEN);
  gl.uniform3fv(u.ink, INK);
  gl.clearColor(0, 0, 0, 0);

  gl.activeTexture(gl.TEXTURE1);
  const trailTex = createTrailTexture(gl);
  gl.activeTexture(gl.TEXTURE0);
  let textTex: WebGLTexture | null = null;

  const settings: ContactRevealSettings = structuredClone(defaults);
  const trail = new PixelTrail();
  section.append(canvas);

  let area = { top: 0, w: 0, h: 0 };
  let inside: { x: number; y: number } | null = null;

  // The area: from under the heading to above the footer, full width
  function measure() {
    const s = section.getBoundingClientRect();
    const top = hero!.getBoundingClientRect().bottom - s.top;
    const bottom = foot!.getBoundingClientRect().top - s.top;
    area = { top, w: s.width, h: Math.max(1, bottom - top) };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    Object.assign(canvas.style, { top: `${top}px`, width: `${area.w}px`, height: `${area.h}px` });
    canvas.width = Math.round(area.w * dpr);
    canvas.height = Math.round(area.h * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    trail.resize(area.w / settings.block, area.h / settings.block);
    paintText(dpr);
  }

  // The name drawn where .contact__name sits, in its own type
  function paintText(dpr: number) {
    const style = getComputedStyle(name!);
    const box = name!.getBoundingClientRect();
    const s = section.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const text = (name!.textContent ?? '').trim().toUpperCase();
    const metrics = ctx.measureText(text);
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
    const cy = box.top - s.top - area.top + box.height / 2;
    ctx.fillText(text, box.left - s.left + box.width / 2, cy + (ascent - descent) / 2);
    if (textTex) gl!.deleteTexture(textTex);
    gl!.activeTexture(gl!.TEXTURE0);
    textTex = uploadTexture(gl!, c);
  }

  function draw() {
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.activeTexture(gl!.TEXTURE1);
    trail.upload(gl!, trailTex);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, textTex);
    gl!.uniform2f(u.box, area.w, area.h);
    gl!.uniform1f(u.block, settings.block);
    gl!.uniform3f(u.look, settings.shade, settings.darkBlocks, 0);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  let raf = 0;
  let lastT = 0;

  function tick(now: number) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));
    lastT = now;
    if (inside) trail.move(inside.x, inside.y, settings.brush, settings.edge);
    const on = trail.decay(dt, settings.fade);
    draw();
    raf = on || inside ? requestAnimationFrame(tick) : 0;
  }

  function wake() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !able.matches) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        inside = { x, y };
        wake();
      } else if (inside) {
        inside = null;
        trail.lift();
      }
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    inside = null;
    trail.lift();
  });

  const onResize = () => {
    canvas.style.display = able.matches ? '' : 'none';
    if (able.matches) {
      measure();
      draw();
    }
  };
  window.addEventListener('resize', onResize);
  able.addEventListener('change', onResize);
  document.fonts?.ready.then(onResize);
  onResize();

  const api: ContactReveal = {
    settings,
    refresh() {
      onResize();
      wake();
    },
  };

  if (new URLSearchParams(location.search).has('tweak')) {
    import('./contact-reveal-tweaks').then(({ mountContactRevealTweaks }) =>
      mountContactRevealTweaks(api, defaults, import.meta.env.DEV ? '/__contact-reveal' : null),
    );
  }
  return api;
}
