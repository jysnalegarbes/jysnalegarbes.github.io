/*
  Work gallery WebGL layer: "flag"
  --------------------------------
  Draws each card's cover as a subdivided plane at the rect the gallery
  computes (no DOM reads per frame) and ripples it like cloth while the
  strip moves, after taroyoshimura.dev. Two travelling waves bend the
  plane, scaled by scroll speed, with a little shading on the folds; at
  rest the cards are flat and identical to the DOM images.

  For the case study transition a second program draws the opened card
  travelling from its slot to the case cover's rect (see
  case-transition.ts), with one of four motions:
    1 Glide   one eased move, the cloth ripple swelling mid-flight
    2 Liquid  each vertex leaves on its own delay, leading edge first, so
              the card stretches like a drop of ink and settles
    3 Strips  the card splits into horizontal strips that travel on a
              stagger, swaying apart and closing up at the cover
    4 Ink     a clean eased move while ink floods the page (ink-wipe.ts)

  The DOM image stays as the hit area and fallback, and is hidden once
  its texture is up. Clones of a project share one texture.
*/
import type { CardFrame, GalleryFrame, Rect } from './work-gallery';

export type CaseFx = 1 | 2 | 3 | 4;

export interface Travel {
  /** Card index (into the gallery's cards) being opened */
  index: number;
  from: Rect;
  to: Rect;
  /** Linear 0..1; each motion applies its own easing */
  t: number;
  fx: CaseFx;
}

export interface GlFrame extends GalleryFrame {
  cards: (CardFrame & { alpha?: number })[];
  travel?: Travel;
}

const STRIPS = 12;

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

const travelVertex = /* glsl */ `
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uFrom;
uniform vec4 uTo;
uniform float uT;
uniform float uFx;
uniform float uTime;
uniform vec2 uStrip;
uniform float uStripIndex;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;
const float STRIPS = ${STRIPS.toFixed(1)};

// power3.inOut, matching the JS side
float ease(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
}

void main() {
  vec2 uv = vec2(aUv.x, mix(uStrip.x, uStrip.y, aUv.y));
  float p;
  vec2 shift = vec2(0.0);

  if (uFx > 1.5 && uFx < 2.5) {
    // Liquid: lead with the edge facing the destination
    vec2 travel = (uTo.xy + uTo.zw * 0.5) - (uFrom.xy + uFrom.zw * 0.5);
    vec2 dir = travel / max(length(travel), 1.0);
    float lead = clamp(0.5 + dot(uv - 0.5, dir) * 0.9, 0.0, 1.0);
    float lag = 0.42;
    p = ease(clamp((uT - (1.0 - lead) * lag) / (1.0 - lag), 0.0, 1.0));
  } else if (uFx > 2.5 && uFx < 3.5) {
    // Strips: top strip first, alternate strips sway left and right
    float k = uStripIndex / (STRIPS - 1.0);
    float lag = 0.38;
    float lt = clamp((uT - k * lag) / (1.0 - lag), 0.0, 1.0);
    p = ease(lt);
    float side = mod(uStripIndex, 2.0) < 0.5 ? -1.0 : 1.0;
    shift.x = sin(lt * PI) * side * uTo.z * 0.06;
  } else {
    p = ease(uT);
  }

  vec4 r = mix(uFrom, uTo, p);
  vec2 pos = r.xy + uv * r.zw + shift;

  // Cloth ripple swelling mid-flight (strongest on Glide)
  float amp = sin(PI * uT) * (uFx < 1.5 ? 0.55 : uFx < 2.5 ? 0.2 : 0.0);
  float phase = uTime * 5.0;
  pos.y += sin(uv.x * PI * 1.8 - phase + uv.y * 1.2) * amp * r.w * 0.075;
  pos.x += sin(uv.y * PI * 1.4 - phase * 0.8) * amp * r.z * 0.035;
  vShade = cos(uv.x * PI * 1.8 - phase + uv.y * 1.2) * amp;

  vUv = uv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
varying vec2 vUv;
varying float vShade;

// object-fit: cover for a box of size uBox
vec2 cover(vec2 uv) {
  float rb = uBox.x / uBox.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec3 col = texture2D(uTex, cover(vUv)).rgb;
  col *= 1.0 + vShade * 0.12;
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`;

interface Tex {
  tex: WebGLTexture;
  size: [number, number];
}

/** power3.inOut, same curve as the shader's ease() */
export const easeMorph = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function mountWorkGl(
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  { onReady }: { onReady: (index: number) => void },
) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const link = (vs: string, names: string[]) => {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
    return { program, u, aUv: gl.getAttribLocation(program, 'aUv') };
  };

  const shared = ['uViewport', 'uTime', 'uTex', 'uImg', 'uBox', 'uAlpha'];
  const flag = link(flagVertex, [...shared, 'uRect', 'uVelo']);
  const travel = link(travelVertex, [...shared, 'uFrom', 'uTo', 'uT', 'uFx', 'uStrip', 'uStripIndex']);

  // Subdivided unit plane for the waves
  const SX = 48;
  const SY = 32;
  const verts: number[] = [];
  for (let y = 0; y <= SY; y++) for (let x = 0; x <= SX; x++) verts.push(x / SX, y / SY);
  const idx: number[] = [];
  for (let y = 0; y < SY; y++)
    for (let x = 0; x < SX; x++) {
      const i = y * (SX + 1) + x;
      idx.push(i, i + 1, i + SX + 1, i + 1, i + SX + 2, i + SX + 1);
    }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const use = (p: typeof flag) => {
    gl.useProgram(p.program);
    gl.enableVertexAttribArray(p.aUv);
    gl.vertexAttribPointer(p.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(p.u.uTex, 0);
  };

  let lastFrame: GlFrame | null = null;

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
        source.decode().then(() => {
          const tex = gl.createTexture()!;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          return { tex, size: [source.naturalWidth, source.naturalHeight] as [number, number] };
        }),
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

    frame.cards.forEach((r, i) => {
      const t = textures[i];
      const alpha = r.alpha ?? 1;
      if (!t || alpha <= 0 || i === frame.travel?.index) return;
      if (r.x > view.w + 40 || r.x + r.w < -40) return;
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform2f(flag.u.uImg, t.size[0], t.size[1]);
      gl!.uniform2f(flag.u.uBox, r.w, r.h);
      gl!.uniform4f(flag.u.uRect, r.x, r.y, r.w, r.h);
      gl!.uniform1f(flag.u.uAlpha, alpha);
      gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
    });

    const tr = frame.travel;
    const t = tr && textures[tr.index];
    if (!tr || !t) return;
    use(travel);
    const e = easeMorph(tr.t);
    gl!.uniform2f(travel.u.uViewport, view.w, view.h);
    gl!.uniform1f(travel.u.uTime, frame.time);
    gl!.uniform2f(travel.u.uImg, t.size[0], t.size[1]);
    gl!.uniform2f(travel.u.uBox, tr.from.w + (tr.to.w - tr.from.w) * e, tr.from.h + (tr.to.h - tr.from.h) * e);
    gl!.uniform4f(travel.u.uFrom, tr.from.x, tr.from.y, tr.from.w, tr.from.h);
    gl!.uniform4f(travel.u.uTo, tr.to.x, tr.to.y, tr.to.w, tr.to.h);
    gl!.uniform1f(travel.u.uT, tr.t);
    gl!.uniform1f(travel.u.uFx, tr.fx);
    gl!.uniform1f(travel.u.uAlpha, 1);
    gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
    const strips = tr.fx === 3 ? STRIPS : 1;
    for (let s = 0; s < strips; s++) {
      gl!.uniform2f(travel.u.uStrip, s / strips, (s + 1) / strips);
      gl!.uniform1f(travel.u.uStripIndex, s);
      gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
    }
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
