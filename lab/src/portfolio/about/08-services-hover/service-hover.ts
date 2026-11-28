/*
  About "what I DO": hovering a service shows its image, which follows the
  cursor. Two Codrops effects together:
    - Motion Hover Effects, demo 1 (Niccolò Miranda & Clément Roche,
      tympanus.net/codrops/?p=44003): the image plane eases after the cursor
      (1s power4.out), bends in the direction it's dragged and splits off its
      red channel by the same offset; it fades in and out on enter / leave.
    - Revealing WebGL Images, variation 2 (@akella, tympanus.net/codrops/
      ?p=75561): each image arrives through a noise-edged band of grainy
      fill colour that sweeps over it, stretching it slightly as it goes.
      The fill is the site's green; the reveal runs 0 → 1 linearly, replayed
      whenever the hovered service changes.
  Hand-written WebGL like the rest of the site (the demos use Three.js).
  The canvas sits behind the services text, as in the demo. Fine pointers
  only; off under reduced motion.
*/
import gsap from 'gsap';
import { linkProgram } from '../../../../src/scripts/liquid-morph';

const GREEN = [15 / 255, 177 / 255, 42 / 255]; // --green, #0FB12A
const PLANE_H = 1 / 2.184; // of the viewport: the demo's 1-unit plane at fov 40, z 3
const STRENGTH = 0.25; // the demo's RGBShiftEffect strength
const FOLLOW = 1; // s, power4.out, as in the demo
const FADE = 0.5; // s, power4.out, as in the demo
const REVEAL = 1.5; // s, linear, as in the demo
const GRID = 32;

const vertex = /* glsl */ `
  attribute vec2 aUv;    // plane uv, three.js convention (0,0 bottom left)
  uniform vec2 uView;    // canvas, CSS px
  uniform vec2 uPos;     // plane centre, CSS px from the top left
  uniform vec2 uSize;    // plane size, CSS px
  uniform vec2 uOffset;  // drag offset, CSS px (y up)
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    // The demo's deformationCurve: bow the plane against the drag
    vec2 p = (aUv - 0.5) * uSize;
    p.x += sin(aUv.y * 3.14159265) * uOffset.x;
    p.y += sin(aUv.x * 3.14159265) * uOffset.y;
    vec2 px = vec2(uPos.x + p.x, uPos.y - p.y);
    vec2 ndc = px / uView * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uTextureSize;
  uniform vec2 uElementSize;
  uniform vec3 uFillColor;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec2 uShift;   // red channel shift, in uv (the demo's uOffset)
  varying vec2 vUv;

  float hashwithoutsine12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Classic Perlin 2D noise, Stefan Gustavson
  vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float cnoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i = permute(permute(ix) + iy);
    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
  }

  float cubicInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
  }
  float parabola(float x, float k) { return pow(4. * x * (1. - x), k); }

  void main() {
    // texture cover
    vec2 uv = vUv - vec2(0.5);
    float aspect1 = uTextureSize.x / uTextureSize.y;
    float aspect2 = uElementSize.x / uElementSize.y;
    if (aspect1 > aspect2) { uv *= vec2(aspect2 / aspect1, 1.); }
    else { uv *= vec2(1., aspect1 / aspect2); }
    uv += vec2(0.5);

    // Variation 2 (uType 1)
    float hash = hashwithoutsine12(vUv * 1000. + floor(uTime * 3.) * 0.1);
    vec3 fillColor = uFillColor + (vec3(hash) - vec3(0.5)) * 0.2;
    float n = (cnoise(vUv * vec2(35., 1.)) + 1.) * 0.5;
    float dt = parabola(cubicInOut(uProgress), 1.);
    vec2 distUV = uv;
    distUV.y = 1. - (1. - uv.y) * (1. - dt * 0.3);

    // Motion Hover: the red channel trails by the drag offset
    vec3 image = vec3(texture2D(uTexture, distUV + uShift).r, texture2D(uTexture, distUV).gb);

    // Done: the band's width is 0 here and smoothstep(1, 1, x) is undefined
    if (uProgress >= 1.) {
      gl_FragColor = vec4(image * uAlpha, uAlpha);
      return;
    }

    float w = dt;
    float maskvalue = smoothstep(1. - w, 1., vUv.y + mix(-w / 2., 1. - w / 2., cubicInOut(uProgress)));
    float mask = maskvalue + maskvalue * n;
    float final = smoothstep(1., 1. + 0.01, mask);
    float final1 = smoothstep(1., 1. + 0.01, mask + 0.5);
    if (final1 == 0.) discard;

    vec3 color = mix(fillColor, image, final);
    gl_FragColor = vec4(color * uAlpha, uAlpha);
  }
`;

function gridTriangles(n: number) {
  const out: number[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [x0, x1, y0, y1] = [x / n, (x + 1) / n, y / n, (y + 1) / n];
      out.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
    }
  }
  return new Float32Array(out);
}

/** items: each hover target with the URL of its image */
export function mountServiceHover(section: HTMLElement, items: { el: HTMLElement; src: string }[]) {
  if (!items.length) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'service-hover';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return;
  let prog: ReturnType<typeof linkProgram>;
  try {
    prog = linkProgram(gl, vertex, fragment, [
      'uView', 'uPos', 'uSize', 'uOffset', 'uTexture', 'uTextureSize', 'uElementSize',
      'uFillColor', 'uProgress', 'uTime', 'uAlpha', 'uShift',
    ]);
  } catch (err) {
    console.warn('[service-hover]', err);
    return;
  }
  section.prepend(canvas);

  const verts = gridTriangles(GRID);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.useProgram(prog.program);
  gl.enableVertexAttribArray(prog.aUv);
  gl.vertexAttribPointer(prog.aUv, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // three.js's default, as the shader expects
  gl.uniform3fv(prog.u.uFillColor, GREEN);
  gl.uniform1i(prog.u.uTexture, 0);

  // Textures load in the background; a service shows nothing until its own is ready
  const textures = items.map(({ src }) => {
    const t = { tex: null as WebGLTexture | null, w: 1, h: 1 };
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img
      .decode()
      .then(() => {
        t.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        [t.w, t.h] = [img.naturalWidth, img.naturalHeight];
      })
      .catch((err) => console.warn('[service-hover]', err));
    return t;
  });

  let W = 0;
  let H = 0;
  let dpr = 1;
  const target = { x: 0, y: 0 }; // cursor, CSS px within the canvas
  const pos = { x: 0, y: 0 }; // plane centre, eased after the cursor
  // Fade and reveal run on the frame clock (not tweens), so the first hover
  // can't lag behind an idle ticker
  const fade = { from: 0, to: 0, at: 0 }; // alpha, power4.out over FADE
  let revealAt = -Infinity; // progress 0 → 1, linear over REVEAL
  const alphaAt = (now: number) => {
    const k = Math.min(1, (now - fade.at) / 1000 / FADE);
    return fade.from + (fade.to - fade.from) * (1 - (1 - k) ** 4);
  };
  const fadeTo = (to: number) => {
    const now = performance.now();
    Object.assign(fade, { from: alphaAt(now), to, at: now });
  };
  const fading = (now: number) => now - fade.at < FADE * 1000;
  let current = -1;
  let raf = 0;
  let time = 0;
  let last = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    [W, H] = [r.width, r.height];
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  function frame(now: number) {
    time += last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    const t = textures[current];
    const alpha = alphaAt(now);
    const progress = Math.min(1, Math.max(0, (now - revealAt) / 1000 / REVEAL));
    if (t?.tex && alpha > 0.001) {
      const h = H * PLANE_H;
      const w = h * (t.w / t.h);
      // The demo's offset: how far the plane lags the cursor, times -strength
      const ox = (pos.x - target.x) * -STRENGTH;
      const oy = -(pos.y - target.y) * -STRENGTH; // y up, like world space
      const u = prog.u;
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform2f(u.uView, W, H);
      gl!.uniform2f(u.uPos, pos.x, pos.y);
      gl!.uniform2f(u.uSize, w, h);
      gl!.uniform2f(u.uOffset, ox, oy);
      gl!.uniform2f(u.uShift, ox / h, oy / h); // world units = plane heights
      gl!.uniform2f(u.uTextureSize, t.w, t.h);
      gl!.uniform2f(u.uElementSize, w, h);
      gl!.uniform1f(u.uProgress, progress);
      gl!.uniform1f(u.uTime, time);
      gl!.uniform1f(u.uAlpha, alpha);
      gl!.drawArrays(gl!.TRIANGLES, 0, verts.length / 2);
    }
    // Keep drawing while visible (the grain flickers with uTime) or fading
    raf = alpha > 0.001 || fading(now) ? requestAnimationFrame(frame) : 0;
  }

  const run = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  function moveTo(e: PointerEvent, snap = false) {
    const r = canvas.getBoundingClientRect();
    target.x = e.clientX - r.left;
    target.y = e.clientY - r.top;
    if (snap) gsap.set(pos, { x: target.x, y: target.y });
    else gsap.to(pos, { x: target.x, y: target.y, duration: FOLLOW, ease: 'power4.out', overwrite: true });
  }

  items.forEach(({ el }, i) => {
    el.addEventListener('pointerenter', (e) => {
      const entering = alphaAt(performance.now()) < 0.01;
      moveTo(e, entering);
      if (i !== current || entering) {
        current = i;
        revealAt = performance.now();
      }
      fadeTo(1);
      run();
    });
  });

  section.addEventListener('pointermove', (e) => {
    if (current >= 0 && fade.to > 0) moveTo(e);
  });

  const hide = () => {
    fadeTo(0);
    run();
  };

  // Leaving the list (not just one service) fades it out, as in the demo
  items[0].el.parentElement!.addEventListener('pointerleave', hide);

  // So does scrolling on: the section stops being the active one
  new MutationObserver(() => {
    if (!section.classList.contains('is-active') && fade.to > 0) hide();
  }).observe(section, { attributes: true, attributeFilter: ['class'] });

  resize();
  window.addEventListener('resize', resize);
}
