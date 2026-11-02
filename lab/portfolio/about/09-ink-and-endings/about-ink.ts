/*
  About ink: ink in water behind the text sections
  ------------------------------------------------
  A WebGL fluid (stable-fluids solver, after Pavel Dobryakov's MIT-licensed
  WebGL-Fluid-Simulation, as in fluid-trail.ts) drawn as a grainy ink print:
  density is cut into a few tones with a fixed grain dither, the same idea as
  the portrait's Ink Develop, so it reads as print rather than glow. Two inks
  share the water: grey-white smoke (red channel) and the site's green
  (green channel).

  What puts ink in, per option (settings.cursor / scroll / drops / exits):
    cursor  the pointer stirs smoke into the water (fine pointers only)
    scroll  scrolling pushes smoke up from the bottom edge (down from the top
            when scrolling back), as strong as the scroll is fast
    drops   a green drop blooms by each section's heading as it comes in
    exits   text bleeds into smoke where it stood as its section leaves

  The canvas is transparent where there's no ink, so the story's black and
  the opening wipe show through. It only runs while the story is on screen
  and parks a few seconds after the last input. quiet(true) dims it (the
  services hover). Reduced motion: not mounted.
*/

export interface InkSettings {
  cursor: boolean;
  scroll: boolean;
  drops: boolean;
  exits: boolean;
  /** Peak opacity of the smoke / green ink */
  smoke: number;
  green: number;
  /** Print look: tones the density is cut into, dither amount, grain px */
  tones: number;
  grain: number;
  grainSize: number;
  /** How long ink lingers (lower = longer) and how much it swirls */
  dissipation: number;
  curl: number;
  /** Cursor splat size and push */
  radius: number;
  force: number;
}

export const INK_DEFAULTS: InkSettings = {
  cursor: true,
  scroll: true,
  drops: true,
  exits: true,
  smoke: 0.24,
  green: 0.45,
  tones: 6,
  grain: 0.08,
  grainSize: 2,
  dissipation: 0.9,
  curl: 22,
  radius: 0.35,
  force: 5000,
};

/** The options on review: what puts ink in */
export const INK_OPTIONS = {
  a: { cursor: true, scroll: true, drops: false, exits: false }, // Smoke
  b: { cursor: false, scroll: false, drops: true, exits: true }, // Ink drops
  c: { cursor: true, scroll: true, drops: true, exits: true }, // both
} as const;

export type InkOption = keyof typeof INK_OPTIONS | 'off';

const SIM = 128;
const DYE = 640;
const PRESSURE_ITERATIONS = 20;
const IDLE_SECONDS = 7; // simulated time without input before the loop parks
const QUIET = 0.25; // brightness while quiet
const GREEN = [15 / 255, 177 / 255, 42 / 255]; // --green, #0FB12A

type GL = WebGLRenderingContext | WebGL2RenderingContext;

const baseVertex = `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform vec2 texelSize;
  void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const clearShader = `
  precision mediump float;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
`;

const splatShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + exp(-dot(p, p) / radius) * color, 1.0);
  }
`;

const advectionShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity, uSource;
  uniform vec2 texelSize;
  uniform float dt, dissipation;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
  }
`;

const divergenceShader = `
  precision mediump float;
  varying highp vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
  }
`;

const curlShader = `
  precision mediump float;
  varying highp vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
  }
`;

const vorticityShader = `
  precision highp float;
  varying vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uVelocity, uCurl;
  uniform float curl, dt;
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
    gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
  }
`;

const pressureShader = `
  precision mediump float;
  varying highp vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uPressure, uDivergence;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float div = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
  }
`;

const gradientSubtractShader = `
  precision mediump float;
  varying highp vec2 vUv, vL, vR, vT, vB;
  uniform sampler2D uPressure, uVelocity;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
    gl_FragColor = vec4(v, 0.0, 1.0);
  }
`;

/* The print: each ink cut into tones through a fixed grain, green over smoke.
   Premultiplied output on a transparent canvas. */
const displayShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform vec3 uWhite, uGreen;
  uniform float uSmoke, uGreenAmt, uTones, uGrain, uGrainSize, uDim;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // The grain only works inside the ink: clean water stays clean
  float print(float d, float n) {
    float v = clamp(d + n * uGrain * smoothstep(0.0, 0.12, d), 0.0, 1.0);
    return floor(v * uTones + 0.5) / uTones;
  }

  void main () {
    vec2 d = texture2D(uDye, vUv).rg;
    float n = hash(floor(gl_FragCoord.xy / uGrainSize)) * 2.0 - 1.0;
    // Thin tails fade out instead of breaking into dots
    float s = print(min(d.x, 1.0), n) * smoothstep(0.02, 0.15, d.x) * uSmoke * uDim;
    float g = print(min(d.y, 1.0), n) * smoothstep(0.02, 0.15, d.y) * uGreenAmt * uDim;
    vec3 col = uWhite * s * (1.0 - g) + uGreen * g;
    gl_FragColor = vec4(col, s + g - s * g);
  }
`;

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  attach(id: number): number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap(): void;
}

export function mountAboutInk(
  canvas: HTMLCanvasElement,
  story: HTMLElement,
  settings: InkSettings = { ...INK_DEFAULTS },
) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const params: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, depth: false, stencil: false, antialias: false };
  const gl2 = canvas.getContext('webgl2', params);
  const gl: GL | null = gl2 ?? canvas.getContext('webgl', params);
  if (!gl) return null;

  // Half-float targets with linear filtering, or no ink at all
  let halfFloat: number;
  let fmtR: [number, number];
  let fmtRG: [number, number];
  if (gl2) {
    gl2.getExtension('EXT_color_buffer_float');
    halfFloat = gl2.HALF_FLOAT;
    fmtR = [gl2.R16F, gl2.RED];
    fmtRG = [gl2.RG16F, gl2.RG];
  } else {
    const ext = gl.getExtension('OES_texture_half_float');
    if (!ext || !gl.getExtension('OES_texture_half_float_linear')) return null;
    halfFloat = ext.HALF_FLOAT_OES;
    fmtR = fmtRG = [gl.RGBA, gl.RGBA];
  }

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
    return s;
  };

  let vertex: WebGLShader;
  const program = (frag: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vertex);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
    const u: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { u, bind: () => gl.useProgram(p) };
  };

  let P;
  try {
    vertex = compile(gl.VERTEX_SHADER, baseVertex);
    P = {
      clear: program(clearShader),
      splat: program(splatShader),
      advection: program(advectionShader),
      divergence: program(divergenceShader),
      curl: program(curlShader),
      vorticity: program(vorticityShader),
      pressure: program(pressureShader),
      gradient: program(gradientSubtractShader),
      display: program(displayShader),
    };
  } catch (err) {
    console.warn('[about-ink]', err);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const blit = (target: FBO | null) => {
    if (target) {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];

  const createFBO = (w: number, h: number, [internal, format]: [number, number], filter: number): FBO => {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, halfFloat, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    textures.push(texture);
    framebuffers.push(fbo);
    return {
      texture,
      fbo,
      w,
      h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  };

  const createDouble = (w: number, h: number, fmt: [number, number], filter: number): DoubleFBO => {
    let a = createFBO(w, h, fmt, filter);
    let b = createFBO(w, h, fmt, filter);
    return {
      get read() {
        return a;
      },
      get write() {
        return b;
      },
      swap() {
        [a, b] = [b, a];
      },
    };
  };

  const res = (r: number) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const long = Math.round(r * (w > h ? w / h : h / w));
    return w > h ? [long, r] : [r, long];
  };

  let dye!: DoubleFBO;
  let velocity!: DoubleFBO;
  let divergence!: FBO;
  let curl!: FBO;
  let pressure!: DoubleFBO;
  let simTexel: [number, number] = [0, 0];

  const initFramebuffers = () => {
    textures.splice(0).forEach((t) => gl.deleteTexture(t));
    framebuffers.splice(0).forEach((f) => gl.deleteFramebuffer(f));
    const [sw, sh] = res(SIM);
    const [dw, dh] = res(Math.min(DYE, Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight)));
    simTexel = [1 / sw, 1 / sh];
    gl.disable(gl.BLEND);
    dye = createDouble(dw, dh, fmtRG, gl.LINEAR);
    velocity = createDouble(sw, sh, fmtRG, gl.LINEAR);
    divergence = createFBO(sw, sh, fmtR, gl.NEAREST);
    curl = createFBO(sw, sh, fmtR, gl.NEAREST);
    pressure = createDouble(sw, sh, fmtR, gl.NEAREST);
  };

  const resize = () => {
    // Cap at 1x: the print grain sets the detail, not the screen
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width === w && canvas.height === h && dye) return;
    canvas.width = w;
    canvas.height = h;
    initFramebuffers();
  };

  const aspect = () => canvas.width / canvas.height;

  /** uv 0..1 (origin bottom left); smoke / green amounts; radius in uv² */
  const splat = (x: number, y: number, dx: number, dy: number, smoke: number, green: number, radius: number) => {
    const s = P.splat;
    s.bind();
    const r = aspect() > 1 ? radius * aspect() : radius;
    gl.uniform1f(s.u.aspectRatio, aspect());
    gl.uniform2f(s.u.point, x, y);
    gl.uniform1f(s.u.radius, r);
    gl.uniform1i(s.u.uTarget, velocity.read.attach(0));
    gl.uniform3f(s.u.color, dx, dy, 0);
    blit(velocity.write);
    velocity.swap();
    gl.uniform1i(s.u.uTarget, dye.read.attach(0));
    gl.uniform3f(s.u.color, smoke, green, 0);
    blit(dye.write);
    dye.swap();
  };

  const step = (dt: number) => {
    gl.disable(gl.BLEND);
    const [tx, ty] = simTexel;

    P.curl.bind();
    gl.uniform2f(P.curl.u.texelSize, tx, ty);
    gl.uniform1i(P.curl.u.uVelocity, velocity.read.attach(0));
    blit(curl);

    P.vorticity.bind();
    gl.uniform2f(P.vorticity.u.texelSize, tx, ty);
    gl.uniform1i(P.vorticity.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.vorticity.u.uCurl, curl.attach(1));
    gl.uniform1f(P.vorticity.u.curl, settings.curl);
    gl.uniform1f(P.vorticity.u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    P.divergence.bind();
    gl.uniform2f(P.divergence.u.texelSize, tx, ty);
    gl.uniform1i(P.divergence.u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    P.clear.bind();
    gl.uniform1i(P.clear.u.uTexture, pressure.read.attach(0));
    gl.uniform1f(P.clear.u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    P.pressure.bind();
    gl.uniform2f(P.pressure.u.texelSize, tx, ty);
    gl.uniform1i(P.pressure.u.uDivergence, divergence.attach(0));
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(P.pressure.u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    P.gradient.bind();
    gl.uniform2f(P.gradient.u.texelSize, tx, ty);
    gl.uniform1i(P.gradient.u.uPressure, pressure.read.attach(0));
    gl.uniform1i(P.gradient.u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    P.advection.bind();
    gl.uniform2f(P.advection.u.texelSize, tx, ty);
    const vId = velocity.read.attach(0);
    gl.uniform1i(P.advection.u.uVelocity, vId);
    gl.uniform1i(P.advection.u.uSource, vId);
    gl.uniform1f(P.advection.u.dt, dt);
    gl.uniform1f(P.advection.u.dissipation, 0.25);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(P.advection.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.advection.u.uSource, dye.read.attach(1));
    gl.uniform1f(P.advection.u.dissipation, settings.dissipation);
    blit(dye.write);
    dye.swap();
  };

  const white = getComputedStyle(document.documentElement).getPropertyValue('--white').trim() || '#d7dede';
  const whiteRgb = [1, 3, 5].map((i) => parseInt(white.slice(i, i + 2), 16) / 255);
  let dim = 1;
  let dimTarget = 1;

  const render = () => {
    const d = P.display;
    d.bind();
    gl.uniform1i(d.u.uDye, dye.read.attach(0));
    gl.uniform3f(d.u.uWhite, whiteRgb[0], whiteRgb[1], whiteRgb[2]);
    gl.uniform3f(d.u.uGreen, GREEN[0], GREEN[1], GREEN[2]);
    gl.uniform1f(d.u.uSmoke, settings.smoke);
    gl.uniform1f(d.u.uGreenAmt, settings.green);
    gl.uniform1f(d.u.uTones, settings.tones);
    gl.uniform1f(d.u.uGrain, settings.grain);
    gl.uniform1f(d.u.uGrainSize, settings.grainSize);
    gl.uniform1f(d.u.uDim, dim);
    blit(null);
  };

  /* ---------- Input ---------- */

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, inside: false, moved: false };
  let visible = false;
  let lastScroll = window.scrollY;
  let scrollV = 0; // screens per second, smoothed

  const onPointerMove = (e: PointerEvent) => {
    if (!visible || !settings.cursor || e.pointerType === 'touch') return;
    const x = e.clientX / window.innerWidth;
    const y = 1 - e.clientY / window.innerHeight;
    if (pointer.inside) {
      pointer.dx += (x - pointer.x) * Math.min(1, aspect());
      pointer.dy += (y - pointer.y) / Math.max(1, aspect());
      pointer.moved = true;
      wake();
    }
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
  };
  const onLeave = (e: PointerEvent) => {
    if (!e.relatedTarget) pointer.inside = false;
  };
  const onScroll = () => {
    if (visible && settings.scroll) wake();
  };

  /* ---------- Loop ---------- */

  let raf = 0;
  let last = 0;
  let idle = Infinity;
  const touch = () => (idle = 0);

  const frame = (now: number) => {
    raf = 0;
    resize();
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    idle += dt;
    // Before the stage pins, the opening's wipe is still on screen: no stirring
    const pinned = story.getBoundingClientRect().top <= 1;
    if (!pinned) pointer.moved = false;

    if (pointer.moved) {
      const speed = Math.hypot(pointer.dx, pointer.dy);
      splat(
        pointer.x,
        pointer.y,
        pointer.dx * settings.force,
        pointer.dy * settings.force,
        Math.min(0.5, speed * 12),
        0,
        settings.radius / 100,
      );
      pointer.dx = pointer.dy = 0;
      pointer.moved = false;
      touch();
    }

    // Scroll speed in screens/s, eased so a flick doesn't spike
    const y = window.scrollY;
    const v = dt > 0 ? (y - lastScroll) / window.innerHeight / dt : 0;
    lastScroll = y;
    scrollV += (v - scrollV) * Math.min(1, dt * 10);
    if (settings.scroll && pinned && Math.abs(scrollV) > 0.05) {
      const k = Math.min(1, Math.abs(scrollV) / 1.5);
      const down = scrollV > 0;
      // A plume from a random point along the edge the content comes from
      splat(
        0.08 + Math.random() * 0.84,
        down ? -0.02 : 1.02,
        (Math.random() - 0.5) * 300 * k,
        (down ? 1 : -1) * (500 + 1600 * k),
        0.18 * k,
        0,
        0.0035 + 0.004 * k,
      );
      touch();
    }

    if (Math.abs(dim - dimTarget) > 0.001) {
      dim += (dimTarget - dim) * Math.min(1, dt * 6);
      touch();
    }

    step(dt);
    render();
    if (visible && idle < IDLE_SECONDS) raf = requestAnimationFrame(frame);
  };

  function wake() {
    touch();
    if (raf || document.hidden || !visible) return;
    last = performance.now();
    lastScroll = window.scrollY;
    raf = requestAnimationFrame(frame);
  }

  const park = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
    else park();
  });
  io.observe(story);

  const onVisibility = () => (document.hidden ? park() : wake());
  const onResize = () => wake();

  resize();
  if (finePointer) window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerout', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  /* ---------- Section events ---------- */

  const rectUv = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left / innerWidth, y: 1 - r.bottom / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight };
  };

  /** A green drop blooming at a point (uv), in a few lobes */
  const drop = (x: number, y: number, amount = 1) => {
    const lobes = 6;
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < lobes; i++) {
      const a = turn + (i / lobes) * Math.PI * 2;
      const r = 0.015 + Math.random() * 0.025;
      const push = 500 + Math.random() * 400;
      splat(x + Math.cos(a) * r, y + Math.sin(a) * r * aspect(), Math.cos(a) * push, Math.sin(a) * push, 0.2, 0.6 * amount, 0.0022);
    }
    splat(x, y, 0, 0, 0, 1 * amount, 0.0016);
  };

  /** The section's heading (or first block) drops green as it comes in */
  const sectionIn = (sec: HTMLElement) => {
    if (!settings.drops) return;
    const el = sec.querySelector('[data-ink-anchor]') ?? sec.querySelector('[data-fx]');
    if (!el) return;
    const r = rectUv(el);
    drop(r.x + r.w * 0.5, r.y + r.h * 0.5);
    wake();
  };

  /** Each of the section's blocks bleeds into smoke where it stood */
  const sectionOut = (sec: HTMLElement) => {
    if (!settings.exits) return;
    sec.querySelectorAll('[data-fx]').forEach((el) => {
      const r = rectUv(el);
      if (r.w <= 0) return;
      const n = Math.max(2, Math.round(r.w * 8));
      for (let i = 0; i < n; i++) {
        const x = r.x + (r.w * (i + 0.5)) / n;
        const y = r.y + r.h * Math.random();
        splat(x, y, (Math.random() - 0.5) * 200, 250 + Math.random() * 250, 0.3, 0, 0.002 + 0.002 * Math.random());
      }
    });
    wake();
  };

  const onSection = (e: Event) => {
    const { index, prev } = (e as CustomEvent<{ index: number; prev: number }>).detail;
    const secs = story.querySelectorAll<HTMLElement>('[data-about-section]');
    resize();
    if (prev >= 0 && secs[prev]) sectionOut(secs[prev]);
    if (index >= 0 && secs[index]) sectionIn(secs[index]);
  };
  story.addEventListener('about:section', onSection);

  return {
    settings,
    /** Dim the ink (while a service image is up) */
    quiet(on: boolean) {
      dimTarget = on ? QUIET : 1;
      wake();
    },
    /** A surge of ink from the bottom edge over `seconds` (endings) */
    surge(seconds = 0.8, green = 0.6) {
      const t0 = performance.now();
      const tick = () => {
        const k = (performance.now() - t0) / 1000 / seconds;
        if (k > 1) return;
        for (let i = 0; i < 3; i++) {
          splat(Math.random(), -0.02, (Math.random() - 0.5) * 400, 2200 + 1200 * k, 0.8, green * Math.random(), 0.006);
        }
        wake();
        requestAnimationFrame(tick);
      };
      tick();
    },
    /** Drop green at an element's centre */
    dropAt(el: Element, amount = 1) {
      resize();
      const r = rectUv(el);
      drop(r.x + r.w * 0.5, r.y + r.h * 0.5, amount);
      wake();
    },
    /** Re-render after a settings change */
    refresh() {
      wake();
    },
    destroy() {
      park();
      io.disconnect();
      story.removeEventListener('about:section', onSection);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((f) => gl.deleteFramebuffer(f));
    },
  };
}

export type AboutInk = NonNullable<ReturnType<typeof mountAboutInk>>;
