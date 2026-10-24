/*
  Fluid trail
  -----------
  A cursor-driven WebGL fluid (stable-fluids solver, after Pavel Dobryakov's
  MIT-licensed WebGL-Fluid-Simulation), taking the same config keys as the
  FluidTrail reference.

  Adaptive contrast: the simulation draws the same ink mask into two stacked
  layers that sit above the page content.
    1. `canvas` paints white ink and is set to `mix-blend-mode: difference`,
       so everything under the ink inverts (black text turns light).
    2. `tintCanvas` paints the tint (shaded gray) with `mix-blend-mode: lighten`,
       which turns the inverted background into the tint while the inverted
       text stays lighter than it.
  Off the ink both layers are black, which leaves the page untouched.
*/

export interface FluidConfig {
  /** 0 = soft dye, 1 = ink (hard-edged mask) */
  mode: number;
  curl: number;
  densityDissipation: number;
  velocityDissipation: number;
  pressure: number;
  pressureIterations: number;
  splatRadius: number;
  splatForce: number;
  shading: boolean;
  simResolution: number;
  dyeResolution: number;
  intensity: number;
  inkEdge: number;
  inkSoftness: number;
}

interface MountOptions {
  canvas: HTMLCanvasElement;
  tintCanvas: HTMLCanvasElement;
  /** Hex colour the ink shows as */
  tint: string;
  config: FluidConfig;
}

/**
 * Stop rendering after this many seconds of *simulated* time without input.
 * Counted in sim time (not wall clock) so slow devices still run enough
 * steps for the ink to fully dissipate before the loop parks.
 */
const IDLE_SIM_SECONDS = 4;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach(id: number): number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  swap(): void;
}

interface Format {
  internalFormat: number;
  format: number;
}

const baseVertex = `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
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

/* Drops negative ink (left behind by erasing) so new ink isn't cancelled. */
const clampShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
    gl_FragColor = max(texture2D(uTexture, vUv), 0.0);
  }
`;

const clearShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;

  void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

const splatShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;

  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const advectionShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform vec2 dyeTexelSize;
  uniform float dt;
  uniform float dissipation;

  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }

  void main () {
  #ifdef MANUAL_FILTERING
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    vec4 result = bilerp(uSource, coord, dyeTexelSize);
  #else
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
  #endif
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const divergenceShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
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
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const curlShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const vorticityShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;

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
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const pressureShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const gradientSubtractShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

/* Turns dye density into the ink mask, optionally shaded by its slope. */
const displayShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform vec2 texelSize;
  uniform vec3 uColor;
  uniform float uMode;
  uniform float uEdge;
  uniform float uSoftness;
  uniform float uShading;

  void main () {
    float d = texture2D(uTexture, vUv).r;
    float mask = uMode > 0.5
      ? smoothstep(uEdge - uSoftness, uEdge + uSoftness, d)
      : clamp(d, 0.0, 1.0);

    // Shading reads density clamped to 1, so dense interiors stay flat (the
    // true tint) and only the thinning rim picks up a soft bevel.
    float shade = 1.0;
    if (uShading > 0.5) {
      float dx = min(texture2D(uTexture, vR).r, 1.0) - min(texture2D(uTexture, vL).r, 1.0);
      float dy = min(texture2D(uTexture, vT).r, 1.0) - min(texture2D(uTexture, vB).r, 1.0);
      vec3 n = normalize(vec3(dx, dy, length(texelSize)));
      shade = clamp(n.z + 0.7, 0.7, 1.0);
    }

    gl_FragColor = vec4(uColor * mask * shade, 1.0);
  }
`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mountFluidTrail({ canvas, tintCanvas, tint, config }: MountOptions) {
  const params: WebGLContextAttributes = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
  };
  const gl2 = canvas.getContext('webgl2', params);
  const gl: GL | null = gl2 ?? canvas.getContext('webgl', params);
  const tintCtx = tintCanvas.getContext('2d', { alpha: false });
  if (!gl || !tintCtx) return null;
  const isWebGL2 = !!gl2;

  // Half-float render targets
  let halfFloatType: number;
  let supportLinear: boolean;
  if (isWebGL2) {
    (gl as WebGL2RenderingContext).getExtension('EXT_color_buffer_float');
    halfFloatType = (gl as WebGL2RenderingContext).HALF_FLOAT;
    supportLinear = true;
  } else {
    const ext = gl.getExtension('OES_texture_half_float');
    if (!ext) return null;
    halfFloatType = ext.HALF_FLOAT_OES;
    supportLinear = !!gl.getExtension('OES_texture_half_float_linear');
  }

  const supportsRenderFormat = (internalFormat: number, format: number) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, halfFloatType, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    return ok;
  };

  // WebGL2 can use 1- and 2-channel targets; fall back up the chain if a
  // device can't render to them. WebGL1 only has RGBA.
  const pickFormat = (channels: 1 | 2 | 4): Format | null => {
    if (!isWebGL2) {
      return supportsRenderFormat(gl.RGBA, gl.RGBA) ? { internalFormat: gl.RGBA, format: gl.RGBA } : null;
    }
    const g = gl as WebGL2RenderingContext;
    const chain: Format[] = [
      { internalFormat: g.R16F, format: g.RED },
      { internalFormat: g.RG16F, format: g.RG },
      { internalFormat: g.RGBA16F, format: g.RGBA },
    ].slice(channels === 1 ? 0 : channels === 2 ? 1 : 2);
    return chain.find((f) => supportsRenderFormat(f.internalFormat, f.format)) ?? null;
  };

  const formatR = pickFormat(1);
  const formatRG = pickFormat(2);
  if (!formatR || !formatRG) return null;

  // Programs
  const compile = (type: number, source: string, keywords: string[] = []) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, keywords.map((k) => `#define ${k}\n`).join('') + source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, baseVertex);

  const program = (fragmentSource: string, keywords: string[] = []) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vertex);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragmentSource, keywords));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) ?? 'Program link failed');
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { p, u: uniforms, bind: () => gl.useProgram(p) };
  };

  let programs;
  try {
    programs = {
      clear: program(clearShader),
      clamp: program(clampShader),
      splat: program(splatShader),
      advection: program(advectionShader, supportLinear ? [] : ['MANUAL_FILTERING']),
      divergence: program(divergenceShader),
      curl: program(curlShader),
      vorticity: program(vorticityShader),
      pressure: program(pressureShader),
      gradientSubtract: program(gradientSubtractShader),
      display: program(displayShader),
    };
  } catch (err) {
    console.warn('[fluid-trail]', err);
    return null;
  }

  // Full-screen quad on attribute 0
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const blit = (target: FBO | null) => {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];

  const createFBO = (w: number, h: number, { internalFormat, format }: Format, filter: number): FBO => {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, halfFloatType, null);

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
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach(id: number) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  };

  const createDoubleFBO = (w: number, h: number, format: Format, filter: number): DoubleFBO => {
    let a = createFBO(w, h, format, filter);
    let b = createFBO(w, h, format, filter);
    return {
      width: w,
      height: h,
      texelSizeX: a.texelSizeX,
      texelSizeY: a.texelSizeY,
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

  const getResolution = (resolution: number) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const aspect = w > h ? w / h : h / w;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspect);
    return w > h ? { width: max, height: min } : { width: min, height: max };
  };

  let dye!: DoubleFBO;
  let velocity!: DoubleFBO;
  let divergence!: FBO;
  let curl!: FBO;
  let pressure!: DoubleFBO;

  const initFramebuffers = () => {
    textures.splice(0).forEach((t) => gl.deleteTexture(t));
    framebuffers.splice(0).forEach((f) => gl.deleteFramebuffer(f));

    const filter = supportLinear ? gl.LINEAR : gl.NEAREST;
    const shortSide = Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight);
    const sim = getResolution(config.simResolution);
    const dyeRes = getResolution(Math.min(config.dyeResolution, shortSide));

    gl.disable(gl.BLEND);
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatR, filter);
    velocity = createDoubleFBO(sim.width, sim.height, formatRG, filter);
    divergence = createFBO(sim.width, sim.height, formatR, gl.NEAREST);
    curl = createFBO(sim.width, sim.height, formatR, gl.NEAREST);
    pressure = createDoubleFBO(sim.width, sim.height, formatR, gl.NEAREST);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h && dye) return;
    canvas.width = tintCanvas.width = w;
    canvas.height = tintCanvas.height = h;
    initFramebuffers();
  };

  // Simulation
  const aspect = () => canvas.width / canvas.height;

  const splat = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    amount = config.intensity,
    r = config.splatRadius / 100,
  ) => {
    const { splat: s } = programs;
    s.bind();
    gl.uniform1i(s.u.uTarget, velocity.read.attach(0));
    gl.uniform1f(s.u.aspectRatio, aspect());
    gl.uniform2f(s.u.point, x, y);
    gl.uniform3f(s.u.color, dx, dy, 0);
    gl.uniform1f(s.u.radius, aspect() > 1 ? r * aspect() : r);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(s.u.uTarget, dye.read.attach(0));
    const c = amount;
    gl.uniform3f(s.u.color, c, c, c);
    blit(dye.write);
    dye.swap();
  };

  const step = (dt: number) => {
    const p = programs;
    gl.disable(gl.BLEND);

    p.curl.bind();
    gl.uniform2f(p.curl.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(p.curl.u.uVelocity, velocity.read.attach(0));
    blit(curl);

    p.vorticity.bind();
    gl.uniform2f(p.vorticity.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(p.vorticity.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.vorticity.u.uCurl, curl.attach(1));
    gl.uniform1f(p.vorticity.u.curl, config.curl);
    gl.uniform1f(p.vorticity.u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    p.divergence.bind();
    gl.uniform2f(p.divergence.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(p.divergence.u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    p.clear.bind();
    gl.uniform1i(p.clear.u.uTexture, pressure.read.attach(0));
    gl.uniform1f(p.clear.u.value, config.pressure);
    blit(pressure.write);
    pressure.swap();

    p.pressure.bind();
    gl.uniform2f(p.pressure.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(p.pressure.u.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.pressureIterations; i++) {
      gl.uniform1i(p.pressure.u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    p.gradientSubtract.bind();
    gl.uniform2f(p.gradientSubtract.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(p.gradientSubtract.u.uPressure, pressure.read.attach(0));
    gl.uniform1i(p.gradientSubtract.u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    p.advection.bind();
    gl.uniform2f(p.advection.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinear) gl.uniform2f(p.advection.u.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    const velocityId = velocity.read.attach(0);
    gl.uniform1i(p.advection.u.uVelocity, velocityId);
    gl.uniform1i(p.advection.u.uSource, velocityId);
    gl.uniform1f(p.advection.u.dt, dt);
    gl.uniform1f(p.advection.u.dissipation, config.velocityDissipation);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinear) gl.uniform2f(p.advection.u.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(p.advection.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.advection.u.uSource, dye.read.attach(1));
    gl.uniform1f(p.advection.u.dissipation, config.densityDissipation);
    blit(dye.write);
    dye.swap();
  };

  let tintRgb = hexToRgb(tint);

  const drawMask = (color: [number, number, number], shading: boolean) => {
    const { display: d } = programs;
    d.bind();
    gl.uniform2f(d.u.texelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(d.u.uTexture, dye.read.attach(0));
    gl.uniform3f(d.u.uColor, ...color);
    gl.uniform1f(d.u.uMode, config.mode);
    gl.uniform1f(d.u.uEdge, config.inkEdge);
    gl.uniform1f(d.u.uSoftness, config.inkSoftness);
    gl.uniform1f(d.u.uShading, shading ? 1 : 0);
    blit(null);
  };

  const render = () => {
    // Tint pass first, copied out to the lighten layer, then the white
    // mask is what stays on the difference layer.
    drawMask(tintRgb, config.shading);
    tintCtx.drawImage(canvas, 0, 0);
    drawMask([1, 1, 1], false);
  };

  // Input: pointer deltas accumulate between frames, one splat per frame
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, inside: false, moved: false };
  let inputEnabled = true;

  const move = (clientX: number, clientY: number) => {
    if (!inputEnabled) {
      pointer.inside = false; // no jump splat when input resumes
      return;
    }
    const x = clientX / window.innerWidth;
    const y = 1 - clientY / window.innerHeight;
    if (pointer.inside) {
      const a = aspect();
      let dx = x - pointer.x;
      let dy = y - pointer.y;
      if (a < 1) dx *= a;
      if (a > 1) dy /= a;
      pointer.dx += dx;
      pointer.dy += dy;
      pointer.moved = true;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    idleTime = 0;
    wake();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') move(e.clientX, e.clientY);
  };
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) move(t.clientX, t.clientY);
  };
  const onTouchStart = (e: TouchEvent) => {
    pointer.inside = false;
    onTouchMove(e);
  };
  const onLeave = (e: PointerEvent) => {
    if (!e.relatedTarget) pointer.inside = false;
  };

  // Loop: only runs while there is ink to animate
  let raf = 0;
  let last = 0;
  let idleTime = Infinity;

  const frame = (now: number) => {
    raf = 0;
    resize();
    const dt = Math.min((now - last) / 1000, 1 / 60);
    last = now;
    idleTime += dt;

    if (pointer.moved) {
      splat(pointer.x, pointer.y, pointer.dx * config.splatForce, pointer.dy * config.splatForce);
      pointer.dx = pointer.dy = 0;
      pointer.moved = false;
    }

    step(dt);
    render();

    if (idleTime < IDLE_SIM_SECONDS) raf = requestAnimationFrame(frame);
  };

  function wake() {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const onVisibility = () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      wake();
    }
  };

  const onResize = () => wake();

  resize();
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('pointerout', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  return {
    /** Apply new settings live (used by the tweak panel). */
    update(next: Partial<FluidConfig>, nextTint?: string) {
      const resized =
        (next.simResolution !== undefined && next.simResolution !== config.simResolution) ||
        (next.dyeResolution !== undefined && next.dyeResolution !== config.dyeResolution);
      Object.assign(config, next);
      if (nextTint) tintRgb = hexToRgb(nextTint);
      if (resized) initFramebuffers();
      idleTime = 0;
      wake();
    },

    /** Drop a few random splats so changes can be previewed hands-free. */
    splash(count = 5) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        splat(Math.random(), Math.random(), Math.cos(angle) * 1000, Math.sin(angle) * 1000);
      }
      idleTime = 0;
      wake();
    },

    /**
     * Raw splat in uv space (0..1, origin bottom-left). Negative `amount`
     * erases ink. `radius` uses the same units as config.splatRadius / 100.
     */
    splatAt(x: number, y: number, opts: { dx?: number; dy?: number; amount?: number; radius?: number } = {}) {
      splat(x, y, opts.dx ?? 0, opts.dy ?? 0, opts.amount ?? config.intensity, opts.radius ?? config.splatRadius / 100);
      idleTime = 0;
      wake();
    },

    /** Zero out negative ink left by erasing; positive ink is untouched. */
    clampInk() {
      const { clamp } = programs;
      clamp.bind();
      gl.uniform1i(clamp.u.uTexture, dye.read.attach(0));
      blit(dye.write);
      dye.swap();
      idleTime = 0;
      wake();
    },

    /** Cover the whole screen with ink of the given density. */
    flood(amount = 4) {
      splat(0.5, 0.5, 0, 0, amount, 1e4);
      idleTime = 0;
      wake();
    },

    /** Pause/resume the cursor trail (the loader owns the ink meanwhile). */
    setInput(enabled: boolean) {
      inputEnabled = enabled;
    },

    /** Draw the current state in this frame (for seamless DOM hand-offs). */
    renderNow() {
      resize();
      render();
    },

    destroy() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('pointerout', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((f) => gl.deleteFramebuffer(f));
    },
  };
}

export type FluidTrail = NonNullable<ReturnType<typeof mountFluidTrail>>;
