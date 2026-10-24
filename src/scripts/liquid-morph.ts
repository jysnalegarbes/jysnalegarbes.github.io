/*
  Liquid morph
  ------------
  The card-to-cover motion used for every page change into a case study
  (Work → case, and a case's "Next project" → the next case). Each vertex
  of a subdivided plane leaves on its own delay, leading edge first, so the
  image stretches like a drop of ink towards its destination and settles
  into the new rect; a faint cloth ripple runs through it mid-flight.

  Shared pieces (shaders, plane, easing) are used by the Work page's WebGL
  layer; mountMorphOverlay() is a standalone full-screen version for pages
  without one (the case study's next-project link).
*/
import type { Rect } from './work-gallery';

export const MORPH_DURATION = 1.3;

/** power3.inOut, same curve as the shader's ease() */
export const easeMorph = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const liquidVertex = /* glsl */ `
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uFrom;
uniform vec4 uTo;
uniform float uT;
uniform float uTime;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

float ease(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
}

void main() {
  // Lead with the edge facing the destination
  vec2 travel = (uTo.xy + uTo.zw * 0.5) - (uFrom.xy + uFrom.zw * 0.5);
  vec2 dir = travel / max(length(travel), 1.0);
  float lead = clamp(0.5 + dot(aUv - 0.5, dir) * 0.9, 0.0, 1.0);
  float lag = 0.42;
  float p = ease(clamp((uT - (1.0 - lead) * lag) / (1.0 - lag), 0.0, 1.0));

  vec4 r = mix(uFrom, uTo, p);
  vec2 pos = r.xy + aUv * r.zw;

  // Faint cloth ripple mid-flight
  float amp = sin(PI * uT) * 0.2;
  float phase = uTime * 5.0;
  pos.y += sin(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * amp * r.w * 0.075;
  pos.x += sin(aUv.y * PI * 1.4 - phase * 0.8) * amp * r.z * 0.035;
  vShade = cos(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * amp;

  vUv = aUv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

/** Image with object-fit: cover in a box of uBox, cloth shading, alpha */
export const imageFragment = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
varying vec2 vUv;
varying float vShade;

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

/** Subdivided unit plane (positions 0..1), as vertex + index arrays */
export function planeGeometry(sx = 48, sy = 32) {
  const verts: number[] = [];
  for (let y = 0; y <= sy; y++) for (let x = 0; x <= sx; x++) verts.push(x / sx, y / sy);
  const idx: number[] = [];
  for (let y = 0; y < sy; y++)
    for (let x = 0; x < sx; x++) {
      const i = y * (sx + 1) + x;
      idx.push(i, i + 1, i + sx + 1, i + 1, i + sx + 2, i + sx + 1);
    }
  return { verts: new Float32Array(verts), idx: new Uint16Array(idx) };
}

export function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string, names: string[]) {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
  return { program, u, aUv: gl.getAttribLocation(program, 'aUv') };
}

export function uploadTexture(gl: WebGLRenderingContext, source: TexImageSource) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/**
  Full-screen overlay that draws one image morphing between two viewport
  rects. Resolves to null without WebGL or if the image can't decode.
*/
export async function mountMorphOverlay(img: HTMLImageElement, { zIndex = 25 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: String(zIndex),
    pointerEvents: 'none',
  });
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;

  const source = new Image();
  source.src = img.currentSrc || img.src;
  try {
    await source.decode();
  } catch {
    return null;
  }

  const p = linkProgram(gl, liquidVertex, imageFragment, [
    'uViewport', 'uFrom', 'uTo', 'uT', 'uTime', 'uTex', 'uImg', 'uBox', 'uAlpha',
  ]);
  const { verts, idx } = planeGeometry();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.useProgram(p.program);
  gl.enableVertexAttribArray(p.aUv);
  gl.vertexAttribPointer(p.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  uploadTexture(gl, source);
  gl.uniform1i(p.u.uTex, 0);
  gl.uniform1f(p.u.uAlpha, 1);
  gl.uniform2f(p.u.uImg, source.naturalWidth, source.naturalHeight);

  document.body.append(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(p.u.uViewport, w, h);

  return {
    draw(from: Rect, to: Rect, t: number) {
      const e = easeMorph(t);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(p.u.uFrom, from.x, from.y, from.w, from.h);
      gl.uniform4f(p.u.uTo, to.x, to.y, to.w, to.h);
      gl.uniform2f(p.u.uBox, from.w + (to.w - from.w) * e, from.h + (to.h - from.h) * e);
      gl.uniform1f(p.u.uT, t);
      gl.uniform1f(p.u.uTime, performance.now() / 1000);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    },
    destroy() {
      canvas.remove();
    },
  };
}
