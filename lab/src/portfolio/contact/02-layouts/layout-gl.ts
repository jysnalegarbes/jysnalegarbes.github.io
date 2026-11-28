/*
  Contact layouts: shared pieces
  ------------------------------
  A full-screen fragment-shader runner (one quad; u_res, u_time, u_mouse
  and u_dpr are set every frame), text-to-texture drawing in the site's
  type, the page content, a smoothed mouse and a rAF loop.
*/
import settingsJson from '../../config/contact-layouts.json';

export type ContactSettings = typeof settingsJson;

export interface ContactContent {
  lead: string;
  name: string;
  email: string;
  resume: string;
  sign: string;
  socials: { label: string; href: string; icon: string }[];
}

export interface ContactLayout {
  refresh(): void;
}

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const ease = (lag: number, dt: number) => (lag <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / lag));

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}`;

export interface Shader {
  gl: WebGLRenderingContext;
  u(name: string): WebGLUniformLocation | null;
  /** A texture on unit `unit` from a canvas; call again to re-upload */
  texture(unit: number, name: string, source: TexImageSource): void;
  draw(time: number, mouse: { x: number; y: number }): void;
  resize(): void;
  width: number;
  height: number;
  dpr: number;
}

export function shader(canvas: HTMLCanvasElement, frag: string): Shader | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s), src);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const cache = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
    return cache.get(name)!;
  };
  const textures = new Map<number, WebGLTexture>();

  const api: Shader = {
    gl,
    u,
    width: 1,
    height: 1,
    dpr: 1,
    texture(unit, name, source) {
      let t = textures.get(unit);
      if (!t) {
        t = gl.createTexture()!;
        textures.set(unit, t);
      }
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(u(name), unit);
    },
    resize() {
      api.dpr = Math.min(2, window.devicePixelRatio || 1);
      api.width = canvas.clientWidth;
      api.height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(api.width * api.dpr));
      canvas.height = Math.max(1, Math.round(api.height * api.dpr));
    },
    draw(time, mouse) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('u_res'), canvas.width, canvas.height);
      gl.uniform1f(u('u_dpr'), api.dpr);
      gl.uniform1f(u('u_time'), time);
      // Mouse in device px, GL orientation (y up)
      gl.uniform2f(u('u_mouse'), mouse.x * api.dpr, canvas.height - mouse.y * api.dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
  api.resize();
  return api;
}

/** A canvas the size of `w`×`h` CSS px (at dpr) to draw text into */
export function textCanvas(w: number, h: number, dpr: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

export const font = (weight: number | string, px: number, serif = false) =>
  `${serif ? 'italic ' : ''}${weight} ${px}px ${serif ? '"Playfair Display Variable", "Playfair Display", Georgia, serif' : '"Archivo Variable", Archivo, system-ui, sans-serif'}`;

export const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Mouse with an eased copy (`x`, `y`) and its speed; starts at the centre */
export function smoothMouse(lag = 0.12) {
  const m = {
    tx: window.innerWidth / 2,
    ty: window.innerHeight / 2,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: 0,
    vy: 0,
    step(dt: number) {
      const k = ease(lag, dt);
      const nx = m.x + (m.tx - m.x) * k;
      const ny = m.y + (m.ty - m.y) * k;
      if (dt > 0) {
        m.vx += ((nx - m.x) / dt - m.vx) * ease(0.1, dt);
        m.vy += ((ny - m.y) / dt - m.vy) * ease(0.1, dt);
      }
      m.x = nx;
      m.y = ny;
    },
  };
  window.addEventListener(
    'pointermove',
    (e) => {
      m.tx = e.clientX;
      m.ty = e.clientY;
    },
    { passive: true },
  );
  return m;
}

export function loop(fn: (dt: number, t: number) => void) {
  let last = performance.now();
  const t0 = last;
  const tick = (now: number) => {
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    fn(dt, (now - t0) / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Social icon links (the page's own icons) */
export function socialLinks(c: ContactContent, className: string) {
  return c.socials
    .map(
      (s) =>
        `<a class="${className}" href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}"><img src="${s.icon}" width="50" height="50" alt="" /><span>${s.label}</span></a>`,
    )
    .join('');
}
