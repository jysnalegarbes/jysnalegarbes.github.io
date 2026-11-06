/*
  Portrait dent
  -------------
  WebGL treatment for the home hero portrait, after dev_loop's "WebGL Slider
  Interaction" pen. The image is a subdivided plane: hovering pushes a soft
  dent in under the cursor (seen in perspective) with a faint RGB split, and
  holding the mouse button grows the dent across the whole image. `ripple()`
  plays the pen's intro wave (used by the page loader).

  A canvas draws over the figure using whichever image is currently showing
  (the hero, or a frame from the hover cycle), so the cycle keeps working.
*/

export interface PortraitFxSettings {
  /** Dent depth multiplier */
  dentDepth: number;
  /** Dent radius (fraction of the image height) */
  dentRadius: number;
  /** RGB split strength */
  rgbSplit: number;
}

export const defaultPortraitFx: PortraitFxSettings = {
  dentDepth: 1,
  dentRadius: 0.08,
  rgbSplit: 0.12,
};

const PAD = 64; // canvas margin around the figure, for perspective spill
const GRID = 32;
const RIPPLE_IN = 0.8; // s, expo.out up
const RIPPLE_OUT = 0.8; // s, sine.out back down

const vertexShader = `
  precision highp float;
  attribute vec2 aPosition; // figure uv, top-left origin
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uAmp;
  uniform float uRipple;
  uniform float uTime;
  uniform vec4 uFig;     // figure rect in viewport px (x, y, w, h)
  uniform vec4 uCanvas;  // canvas rect in viewport px
  uniform vec2 uViewport;
  varying vec2 vUv;
  varying float vWave;

  void main () {
    vUv = aPosition;
    vec2 c = aPosition - uMouse;
    c.x *= uFig.z / uFig.w;
    float mask = smoothstep(uRadius, uRadius * 5.0, length(c));
    float z = (mask - 1.0) * 0.5 * uAmp * 15.0;

    // Intro wave travelling down the plane (the pen's uTranslating)
    z += sin((aPosition.y - 0.5) * 6.0 + uTime * 10.0) * uRipple * 3.5;
    vWave = z;

    // Perspective from a camera centred on the viewport, 50 units away
    vec2 p = uFig.xy + aPosition * uFig.zw;
    vec2 centre = uViewport * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));

    vec2 ndc = (p - uCanvas.xy) / uCanvas.zw * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec4 uSrc; // where the image sits in figure uv (x, y, w, h)
  uniform float uSplit;
  varying vec2 vUv;
  varying float vWave;

  void main () {
    vec2 t = (vUv - uSrc.xy) / uSrc.zw;
    float w = vWave;
    vec3 base = texture2D(uTex, t).rgb;
    vec3 split = vec3(
      texture2D(uTex, t + w * 0.04).r,
      texture2D(uTex, t + w * 0.01).g,
      texture2D(uTex, t - w * 0.03).b
    );
    gl_FragColor = vec4(mix(base, split, uSplit), 1.0);
  }
`;

const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const sineOut = (t: number) => Math.sin((Math.min(t, 1) * Math.PI) / 2);

export function mountPortraitFx(figure: HTMLElement, settings: PortraitFxSettings) {
  const hero = figure.querySelector<HTMLImageElement>('.home__hero');
  const frame = figure.querySelector<HTMLImageElement>('[data-portrait-frame]');
  if (!hero || !frame) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'portrait-fx';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    top: `-${PAD}px`,
    left: `-${PAD}px`,
    width: `calc(100% + ${PAD * 2}px)`,
    height: `calc(100% + ${PAD * 2}px)`,
    pointerEvents: 'none',
  });

  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
    return s;
  };

  const program = gl.createProgram()!;
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
  } catch (err) {
    console.warn('[portrait-fx]', err);
    return null;
  }
  const u = (name: string) => gl.getUniformLocation(program, name);

  // Subdivided plane
  const verts: number[] = [];
  for (let y = 0; y <= GRID; y++) for (let x = 0; x <= GRID; x++) verts.push(x / GRID, y / GRID);
  const indices: number[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * (GRID + 1) + x;
      indices.push(i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1);
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.useProgram(program);
  gl.uniform1i(u('uTex'), 0);

  // State
  let uploadedKey = '';
  const src = { x: 0, y: 0, w: 1, h: 1 };
  const pointer = { x: 0, y: 0, over: false, down: false };
  const mouse = { x: 0.5, y: 0.5 };
  let amp = 0;
  let radius = settings.dentRadius;
  let time = 0;
  let rippleAt = -1; // seconds into the ripple, -1 when idle

  /** Upload whichever image is showing; returns false until it can be drawn. */
  const syncTexture = (fig: DOMRect) => {
    const img = frame.hidden ? hero : frame;
    if (!img.complete || !img.naturalWidth) return uploadedKey !== '';
    const r = img.getBoundingClientRect();
    const key = `${img.currentSrc}|${Math.round(r.left - fig.left)}|${Math.round(r.width)}`;
    if (key !== uploadedKey) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      src.x = (r.left - fig.left) / fig.width;
      src.y = (r.top - fig.top) / fig.height;
      src.w = r.width / fig.width;
      src.h = r.height / fig.height;
      uploadedKey = key;
    }
    return true;
  };

  /** Advance easing (same rates as the pen at 60fps); true while moving. */
  const update = (dt: number, realDt: number, fig: DOMRect) => {
    const ease = (rate: number) => 1 - Math.pow(1 - rate, dt * 60);
    let busy = false;

    if (pointer.over) {
      const tx = (pointer.x - fig.left) / fig.width;
      const ty = (pointer.y - fig.top) / fig.height;
      mouse.x += (tx - mouse.x) * ease(0.1);
      mouse.y += (ty - mouse.y) * ease(0.1);
      busy ||= Math.abs(tx - mouse.x) + Math.abs(ty - mouse.y) > 1e-4;
    }

    const ampTarget = pointer.over ? 1 : 0;
    amp += (ampTarget - amp) * ease(0.08);
    const pressing = pointer.over && pointer.down;
    const rTarget = pressing ? 1 : settings.dentRadius;
    radius += (rTarget - radius) * ease(pressing ? 0.01 : 0.08);
    busy ||= Math.abs(ampTarget - amp) > 1e-3 || Math.abs(rTarget - radius) > 1e-3;

    if (rippleAt >= 0) {
      rippleAt += realDt; // wall-clock, so the intro always lasts 1.6s
      if (rippleAt >= RIPPLE_IN + RIPPLE_OUT) rippleAt = -1;
      else busy = true;
    }
    return busy;
  };

  const rippleAmount = () => {
    if (rippleAt < 0) return 0;
    if (rippleAt < RIPPLE_IN) return expoOut(rippleAt / RIPPLE_IN);
    return 1 - sineOut((rippleAt - RIPPLE_IN) / RIPPLE_OUT);
  };

  const draw = (fig: DOMRect) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = fig.width + PAD * 2;
    const ch = fig.height + PAD * 2;
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(u('uSrc'), src.x, src.y, src.w, src.h);
    gl.uniform1f(u('uSplit'), settings.rgbSplit);
    gl.uniform2f(u('uMouse'), mouse.x, mouse.y);
    gl.uniform1f(u('uRadius'), radius);
    gl.uniform1f(u('uAmp'), amp * settings.dentDepth);
    gl.uniform1f(u('uRipple'), rippleAmount());
    gl.uniform1f(u('uTime'), time);
    gl.uniform4f(u('uFig'), fig.left, fig.top, fig.width, fig.height);
    gl.uniform4f(u('uCanvas'), fig.left - PAD, fig.top - PAD, cw, ch);
    gl.uniform2f(u('uViewport'), window.innerWidth, window.innerHeight);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  };

  let raf = 0;
  let last = 0;
  let shown = false;

  const tick = (now: number) => {
    raf = 0;
    const realDt = Math.min((now - last) / 1000, 0.25);
    const dt = Math.min(realDt, 1 / 30);
    last = now;
    time += realDt;
    const fig = figure.getBoundingClientRect();
    if (!syncTexture(fig)) {
      raf = requestAnimationFrame(tick); // wait for the image to decode
      return;
    }
    const busy = update(dt, realDt, fig);
    draw(fig);
    if (!shown) {
      shown = true;
      figure.classList.add('has-fx');
    }
    if (busy) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (pointer.over) wake();
  };
  const onEnter = () => ((pointer.over = true), wake());
  const onLeave = () => ((pointer.over = false), (pointer.down = false), wake());
  const onDown = () => ((pointer.down = true), wake());
  const onUp = () => ((pointer.down = false), wake());

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('resize', wake);
  window.addEventListener('scroll', wake, { passive: true });
  figure.addEventListener('pointerenter', onEnter);
  figure.addEventListener('pointerleave', onLeave);
  figure.addEventListener('pointerdown', onDown);
  frame.addEventListener('load', wake);
  hero.addEventListener('load', wake);
  // The hover cycle toggles/retargets the frame image
  const observer = new MutationObserver(wake);
  observer.observe(frame, { attributes: true, attributeFilter: ['hidden', 'src'] });

  figure.append(canvas);
  wake();

  return {
    /** Play the intro wave once. */
    ripple() {
      rippleAt = 0;
      wake();
    },
    /** Settings are read live; this re-syncs the resting radius and redraws. */
    refresh() {
      radius = settings.dentRadius;
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', wake);
      window.removeEventListener('scroll', wake);
      figure.removeEventListener('pointerenter', onEnter);
      figure.removeEventListener('pointerleave', onLeave);
      figure.removeEventListener('pointerdown', onDown);
      frame.removeEventListener('load', wake);
      hero.removeEventListener('load', wake);
      figure.classList.remove('has-fx');
      canvas.remove();
    },
  };
}

export type PortraitFx = NonNullable<ReturnType<typeof mountPortraitFx>>;
