/*
  Work gallery WebGL layer: "flag"
  --------------------------------
  Draws each card's cover as a subdivided plane at the rect the gallery
  computes (no DOM reads per frame) and ripples it like cloth while the
  strip moves, after taroyoshimura.dev. Two travelling waves bend the
  plane, scaled by scroll speed, with a little shading on the folds; at
  rest the cards are flat and identical to the DOM images.

  Opening a case study draws the opened card with the liquid morph
  (liquid-morph.ts) from its slot to the case cover's rect.

  The DOM image stays as the hit area and fallback, and is hidden once
  its texture is up. Clones of a project share one texture.

  Each card comes on screen as black ink halftone dots and resolves back
  into its cover (ink-halftone.ts, 2026-11-06): on load, and every time
  scrolling the strip brings it back into view.
*/
import type { CardFrame, GalleryFrame, Rect } from './work-gallery';
import { easeMorph, imageFragment, linkProgram, liquidVertex, planeGeometry, uploadTexture } from './liquid-morph';
import { INK_DONE, inkAt, inkGlsl, setInkColors } from './ink-halftone';

export interface Travel {
  /** Card index (into the gallery's cards) being opened */
  index: number;
  from: Rect;
  to: Rect;
  /** Linear 0..1; the shader applies the easing */
  t: number;
}

export interface GlFrame extends GalleryFrame {
  cards: (CardFrame & { alpha?: number })[];
  travel?: Travel;
}

const flagVertex = /* glsl */ `
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

void main() {
  vec2 pos = uRect.xy + aUv * uRect.zw;
  float a = abs(uVelo);
  float phase = uTime * 5.0;
  float wy = sin(aUv.x * PI * 1.8 - phase + aUv.y * 1.2);
  float wx = sin(aUv.y * PI * 1.4 - phase * 0.8);
  pos.y += wy * a * uRect.w * 0.075;
  pos.x += wx * a * uRect.z * 0.035;
  vShade = cos(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * a;

  vUv = aUv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

// imageFragment (liquid-morph.ts) with the ink halftone over it
const flagFragment = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
uniform float uInk;
varying vec2 vUv;
varying float vShade;
${inkGlsl}

vec2 cover(vec2 uv) {
  float rb = uBox.x / uBox.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec3 col = texture2D(uTex, cover(vUv)).rgb;
  vec2 g = inkGrid(vUv, uBox, uInk);
  vec3 c = texture2D(uTex, cover(inkCentre(g, uBox, uInk))).rgb;
  col = mix(col, inkDots(g, uInk, c), smoothstep(0.0, 1.0, inkFront(uInk, vUv.y)));
  col *= 1.0 + vShade * 0.12;
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`;

interface Tex {
  tex: WebGLTexture;
  size: [number, number];
}

export function mountWorkGl(
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  { onReady }: { onReady: (index: number) => void },
) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;

  const shared = ['uViewport', 'uTime', 'uTex', 'uImg', 'uBox', 'uAlpha'];
  const flag = linkProgram(gl, flagVertex, flagFragment, [...shared, 'uRect', 'uVelo', 'uInk']);
  setInkColors(gl, flag.program);
  const liquid = linkProgram(gl, liquidVertex, imageFragment, [...shared, 'uFrom', 'uTo', 'uT']);

  const { verts, idx } = planeGeometry();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const use = (p: typeof flag) => {
    gl.useProgram(p.program);
    gl.enableVertexAttribArray(p.aUv);
    gl.vertexAttribPointer(p.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(p.u.uTex, 0);
  };

  let lastFrame: GlFrame | null = null;

  // Halftone per card: when it last came on screen (ms), and whether it's on now
  const inkFrom = images.map(() => -Infinity);
  const onScreen = images.map(() => false);
  let inkRaf = 0;

  // Largest rendition of each cover, one texture per source
  const largest = (img: HTMLImageElement) =>
    (img.srcset || '')
      .split(',')
      .map((c) => c.trim().split(/\s+/))
      .filter((c) => c[0])
      .sort((a, b) => parseFloat(b[1] ?? '0') - parseFloat(a[1] ?? '0'))[0]?.[0] ||
    img.currentSrc ||
    img.src;

  const bySrc = new Map<string, Promise<Tex>>();
  const textures: (Tex | null)[] = images.map(() => null);

  images.forEach((img, i) => {
    const src = largest(img);
    if (!bySrc.has(src)) {
      const source = new Image();
      source.decoding = 'async';
      source.src = src;
      bySrc.set(
        src,
        source.decode().then(() => ({
          tex: uploadTexture(gl, source),
          size: [source.naturalWidth, source.naturalHeight] as [number, number],
        })),
      );
    }
    bySrc
      .get(src)!
      .then((t) => {
        textures[i] = t;
        if (lastFrame) render(lastFrame);
        onReady(i);
      })
      .catch(() => {});
  });

  // The canvas covers the gallery stage, so card rects map 1:1 onto it
  let view = { w: 1, h: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 };
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    if (lastFrame) render(lastFrame);
  }

  function render(frame: GlFrame) {
    lastFrame = frame;
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    use(flag);
    gl!.uniform2f(flag.u.uViewport, view.w, view.h);
    gl!.uniform1f(flag.u.uVelo, frame.velocity);
    gl!.uniform1f(flag.u.uTime, frame.time);

    const now = performance.now();
    let inking = false;
    frame.cards.forEach((r, i) => {
      const t = textures[i];
      const alpha = r.alpha ?? 1;
      // Coming (back) into view starts its halftone; counted once its texture is up
      const seen = !!t && r.x < view.w && r.x + r.w > 0;
      if (seen && !onScreen[i]) inkFrom[i] = now;
      onScreen[i] = seen;
      if (!t || alpha <= 0 || i === frame.travel?.index) return;
      if (r.x > view.w + 40 || r.x + r.w < -40) return;
      const since = (now - inkFrom[i]) / 1000;
      if (since < INK_DONE) inking = true;
      gl!.uniform1f(flag.u.uInk, inkAt(since));
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform2f(flag.u.uImg, t.size[0], t.size[1]);
      gl!.uniform2f(flag.u.uBox, r.w, r.h);
      gl!.uniform4f(flag.u.uRect, r.x, r.y, r.w, r.h);
      gl!.uniform1f(flag.u.uAlpha, alpha);
      gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
    });

    // The gallery only draws while it moves: keep drawing while dots resolve
    if (inking && !inkRaf) {
      inkRaf = requestAnimationFrame(() => {
        inkRaf = 0;
        if (lastFrame) render(lastFrame);
      });
    }

    const tr = frame.travel;
    const t = tr && textures[tr.index];
    if (!tr || !t) return;
    use(liquid);
    const e = easeMorph(tr.t);
    gl!.uniform2f(liquid.u.uViewport, view.w, view.h);
    gl!.uniform1f(liquid.u.uTime, frame.time);
    gl!.uniform2f(liquid.u.uImg, t.size[0], t.size[1]);
    gl!.uniform2f(liquid.u.uBox, tr.from.w + (tr.to.w - tr.from.w) * e, tr.from.h + (tr.to.h - tr.from.h) * e);
    gl!.uniform4f(liquid.u.uFrom, tr.from.x, tr.from.y, tr.from.w, tr.from.h);
    gl!.uniform4f(liquid.u.uTo, tr.to.x, tr.to.y, tr.to.w, tr.to.h);
    gl!.uniform1f(liquid.u.uT, tr.t);
    gl!.uniform1f(liquid.u.uAlpha, 1);
    gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
    gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    render,
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}

export type WorkGl = NonNullable<ReturnType<typeof mountWorkGl>>;
