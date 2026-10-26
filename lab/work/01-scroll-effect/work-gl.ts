/*
  Work gallery WebGL layer
  ------------------------
  Draws each card's cover as a subdivided plane at the rect the gallery
  computes (no DOM reads per frame). The DOM image stays as the hit area
  and fallback, and is hidden once its texture is up. Effects are driven
  by scroll velocity and settle flat at rest:

    1 Flag      cloth-like wave through the card while it moves
                (after taroyoshimura.dev)
    2 Bend      the card bows against the motion with an RGB split, and
                zooms out to the full frame as it reaches the main slot
                (after Jesper Landberg's infinite WebGL slider, CodePen povjKxV)
    3 Ink drag  the image smears along the motion and its edges bleed
                ragged ink, like a wet print being dragged
    4 Halftone  the image breaks into ink halftone dots that grow with
                speed, then resolves back to the photo
*/
import type { GalleryFrame } from './work-gallery';

export const WORK_FX = { 1: 'Flag', 2: 'Bend', 3: 'Ink drag', 4: 'Halftone' } as const;
export type WorkFx = keyof typeof WORK_FX;

const MARGIN = 140; // px of quad around each card, room for the ink bleed

const vertex = /* glsl */ `
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
uniform float uFx;
uniform float uMargin;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

void main() {
  vec2 size = uRect.zw + 2.0 * uMargin;
  vec2 pos = uRect.xy - uMargin + aUv * size;
  vec2 uv = (pos - uRect.xy) / uRect.zw;
  float a = abs(uVelo);
  vShade = 0.0;

  if (uFx < 1.5) {
    // Flag: two travelling waves, pinned softly at the corners
    float phase = uTime * 5.0;
    float wy = sin(uv.x * PI * 1.8 - phase + uv.y * 1.2);
    float wx = sin(uv.y * PI * 1.4 - phase * 0.8);
    pos.y += wy * a * uRect.w * 0.075;
    pos.x += wx * a * uRect.z * 0.035;
    vShade = cos(uv.x * PI * 1.8 - phase + uv.y * 1.2) * a;
  } else if (uFx < 2.5) {
    // Bend: the middle lags behind the edges
    pos.x += sin(clamp(uv.y, 0.0, 1.0) * PI) * uVelo * uRect.z * 0.12;
  }

  vUv = uv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
uniform float uFx;
uniform float uFocus;
uniform vec3 uInk;
uniform vec3 uPaper;
varying vec2 vUv;
varying float vShade;

vec2 cover(vec2 uv, float zoom) {
  vec2 box = uRect.zw;
  float rb = box.x / box.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale * zoom + 0.5;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) { v += amp * noise(p); p *= 2.03; amp *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float a = abs(uVelo);
  bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  vec3 col;
  float alpha = 1.0;

  if (uFx < 1.5) {
    if (!inside) discard;
    col = texture2D(uTex, cover(uv, 1.0)).rgb;
    col *= 1.0 + vShade * 0.12;
  } else if (uFx < 2.5) {
    if (!inside) discard;
    vec2 t = cover(uv, mix(0.82, 1.0, uFocus));
    col.r = texture2D(uTex, t).r;
    col.g = texture2D(uTex, t + vec2(0.025 * uVelo, 0.0)).g;
    col.b = texture2D(uTex, t + vec2(0.045 * uVelo, 0.0)).b;
  } else if (uFx < 3.5) {
    // Ink drag. Distance to the card edge in px (negative outside)
    vec2 px = uv * uRect.zw;
    float edge = min(min(px.x, uRect.z - px.x), min(px.y, uRect.w - px.y));
    float trailing = uVelo > 0.0 ? uv.x : 1.0 - uv.x;
    // Streaky noise (stretched along x) reads as drag marks
    float n = fbm(vec2(uv.x * 2.5 + uTime * 0.5, uv.y * 26.0));
    float sideways = (px.x < 0.0 || px.x > uRect.z) ? 1.0 : 0.15;
    float reach = a * (6.0 + 56.0 * trailing * sideways) * n * n * 1.6;
    if (edge < 0.0 && -edge > reach) discard;

    vec3 sum = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float s = float(i) / 11.0 - 0.15;
      sum += texture2D(uTex, cover(uv - vec2(s * uVelo * 0.1, 0.0), 1.0)).rgb;
    }
    col = sum / 12.0;
    // Ink creeps in from the edge and soaks the trailing side
    float soak = smoothstep(reach * 0.9, reach * 0.2, edge) * step(0.001, a);
    col = mix(col, uInk, max(soak, a * trailing * 0.35));
    if (edge < 0.0) col = uInk;
  } else {
    if (!inside) discard;
    float amt = smoothstep(0.03, 0.45, a);
    vec3 img = texture2D(uTex, cover(uv, 1.0)).rgb;
    // 45-degree screen; cells grow with speed
    float cell = mix(5.0, 14.0, amt);
    vec2 px = uv * uRect.zw;
    mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
    mat2 unrot = mat2(0.7071, 0.7071, -0.7071, 0.7071);
    vec2 q = rot * px;
    vec2 centre = (floor(q / cell) + 0.5) * cell;
    vec2 cuv = (unrot * centre) / uRect.zw;
    vec3 s = texture2D(uTex, cover(clamp(cuv, 0.0, 1.0), 1.0)).rgb;
    float lum = dot(s, vec3(0.299, 0.587, 0.114));
    float r = sqrt(1.0 - lum) * cell * 0.72;
    float d = length(q - centre);
    float dotMask = 1.0 - smoothstep(r - 0.8, r + 0.8, d);
    vec3 tone = mix(uPaper, uInk, dotMask);
    col = mix(img, tone, amt);
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

interface Card {
  tex: WebGLTexture | null;
  size: [number, number];
}

export function mountWorkGl(
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  { fx, onReady }: { fx: WorkFx; onReady: (index: number) => void },
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

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  gl.useProgram(program);

  // Subdivided unit plane for the vertex waves
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
  const aUv = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  const u = Object.fromEntries(
    ['uViewport', 'uRect', 'uVelo', 'uTime', 'uFx', 'uMargin', 'uTex', 'uImg', 'uFocus', 'uInk', 'uPaper'].map((n) => [
      n,
      gl.getUniformLocation(program, n),
    ]),
  );

  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const css = getComputedStyle(document.documentElement);
  gl.uniform3fv(u.uInk, rgb(css.getPropertyValue('--black').trim() || '#141918'));
  gl.uniform3fv(u.uPaper, rgb(css.getPropertyValue('--bg').trim() || '#e1e8e8'));
  gl.uniform1i(u.uTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let currentFx: WorkFx = fx;
  let lastFrame: GalleryFrame | null = null;

  // Load the largest rendition of each cover as a texture
  const cards: Card[] = images.map((img, i) => {
    const card: Card = { tex: null, size: [1, 1] };
    const candidates = (img.srcset || '')
      .split(',')
      .map((c) => c.trim().split(/\s+/))
      .filter((c) => c[0])
      .sort((a, b) => parseFloat(b[1] ?? '0') - parseFloat(a[1] ?? '0'));
    const src = candidates[0]?.[0] || img.currentSrc || img.src;
    const source = new Image();
    source.decoding = 'async';
    source.src = src;
    source
      .decode()
      .then(() => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        card.tex = tex;
        card.size = [source.naturalWidth, source.naturalHeight];
        if (lastFrame) render(lastFrame);
        onReady(i);
      })
      .catch(() => {});
    return card;
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

  function render(frame: GalleryFrame) {
    lastFrame = frame;
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform2f(u.uViewport, view.w, view.h);
    gl!.uniform1f(u.uVelo, frame.velocity);
    gl!.uniform1f(u.uTime, frame.time);
    gl!.uniform1f(u.uFx, currentFx);
    gl!.uniform1f(u.uMargin, currentFx === 3 ? MARGIN : 0);

    frame.cards.forEach((r, i) => {
      const card = cards[i];
      if (!card.tex) return;
      if (r.x > view.w + MARGIN || r.x + r.w < -MARGIN) return;
      gl!.bindTexture(gl!.TEXTURE_2D, card.tex);
      gl!.uniform2f(u.uImg, card.size[0], card.size[1]);
      gl!.uniform4f(u.uRect, r.x, r.y, r.w, r.h);
      gl!.uniform1f(u.uFocus, r.focus);
      gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
    });
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    render,
    setFx(next: WorkFx) {
      currentFx = next;
      if (lastFrame) render(lastFrame);
    },
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}

export type WorkGl = NonNullable<ReturnType<typeof mountWorkGl>>;
