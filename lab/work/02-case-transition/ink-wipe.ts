/*
  Ink wipe
  --------
  A full-screen ink layer whose edge is a noisy, blotted contour around a
  rect (the travelling card, or the case study cover), used by the "Ink"
  case transition on both sides of the page change:

    spread   ink grows outward from the rect until it covers the screen
             (Work page; the rect itself stays clear, so the card shows)
    recede   the screen starts inked and the clear area grows outward
             from the rect until the ink is gone (case study page)

  `progress` 0..1 drives the contour; at 1 (spread) / 0 (recede) the
  screen is fully inked except the rect, so both sides meet on an
  identical frame.
*/

const vertex = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uReach;
uniform float uRecede;
uniform float uTime;
uniform vec3 uInk;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
  return v;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  vec2 c = uRect.xy + uRect.zw * 0.5;
  vec2 q = abs(px - c) - uRect.zw * 0.5;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  if (d <= 0.0) discard;

  // Blotted contour: broad lobes plus fine bleed, slowly drifting
  float scale = 1.0 / max(uViewport.x, uViewport.y);
  float n = fbm(px * scale * 6.0 + vec2(uTime * 0.12, -uTime * 0.08));
  float fine = fbm(px * scale * 28.0 - uTime * 0.2);
  float edge = uReach + (n - 0.5) * 220.0 + (fine - 0.5) * 40.0;

  float inked = uRecede > 0.5 ? smoothstep(edge - 1.0, edge + 1.0, d) : 1.0 - smoothstep(edge - 1.0, edge + 1.0, d);
  if (inked <= 0.0) discard;
  gl_FragColor = vec4(uInk * inked, inked);
}
`;

export interface InkRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function mountInkWipe(mode: 'spread' | 'recede', { zIndex = 30 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // 100vw/100vh so the ink also covers a reserved scrollbar gutter
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: String(zIndex),
    pointerEvents: 'none',
  });
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
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
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = Object.fromEntries(
    ['uViewport', 'uRect', 'uReach', 'uRecede', 'uTime', 'uInk'].map((n) => [n, gl.getUniformLocation(program, n)]),
  );
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--black').trim() || '#141918';
  gl.uniform3f(u.uInk, ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]));
  gl.uniform1f(u.uRecede, mode === 'recede' ? 1 : 0);

  let w = 1;
  let h = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  document.body.append(canvas);
  resize();
  window.addEventListener('resize', resize);

  return {
    canvas,
    /** Draw one frame: `rect` stays clear, `progress` 0..1 moves the contour */
    draw(rect: InkRect, progress: number, time = performance.now() / 1000) {
      // Far enough that the noisy contour has cleared every corner
      const far = Math.hypot(w, h) + 260;
      // Starts just inside the rect's edge so progress 0 / 1 are exact
      const reach = -140 + progress * far;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uViewport, w, h);
      gl.uniform4f(u.uRect, rect.x, rect.y, rect.w, rect.h);
      gl.uniform1f(u.uReach, reach);
      gl.uniform1f(u.uTime, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}
