/*
  Portrait effects (preview)
  --------------------------
  WebGL treatments for the home hero portrait. A canvas draws over the
  figure using whichever image is currently showing (the hero, or a frame
  from the hover cycle), so the cycle keeps working underneath.

    1  Slider dent: after dev_loop's "WebGL Slider Interaction" pen.
       The image is a subdivided plane; hovering pushes a soft dent in
       under the cursor (seen in perspective) with a faint RGB split.
       Holding the mouse button grows the dent across the whole image.
    2  Lens blur: after Codrops' SDF Lens Blur, variation 1 (Guillaume
       Lanier, MIT). A soft circle trails the cursor; inside it the
       photo defocuses and the frame edge feathers out.
*/

export type PortraitEffect = 0 | 1 | 2;

export interface PortraitFxSettings {
  /** 1: dent depth multiplier */
  dentDepth: number;
  /** 1: dent radius (fraction of the image height) */
  dentRadius: number;
  /** 1: RGB split strength */
  rgbSplit: number;
  /** 2: lens size, in units of the viewport's short side */
  lensSize: number;
  /** 2: lens edge softness */
  lensEdge: number;
  /** 2: max blur radius, px */
  blur: number;
  /** 2: how far the frame edge feathers inside the lens, px */
  feather: number;
  /** 2: frame corner radius, px */
  corner: number;
}

export const defaultPortraitFx: PortraitFxSettings = {
  dentDepth: 1,
  dentRadius: 0.08,
  rgbSplit: 0.12,
  lensSize: 0.3,
  lensEdge: 0.5,
  blur: 18,
  feather: 48,
  corner: 0,
};

const PAD = 64; // px of canvas around the figure, so feathered edges can spill
const GRID = 32;

const dentVertex = `
  precision highp float;
  attribute vec2 aPosition; // figure uv, top-left origin
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uAmp;
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
    vWave = z;

    // Perspective from a camera centred on the viewport, 50 units away
    vec2 p = uFig.xy + aPosition * uFig.zw;
    vec2 centre = uViewport * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));

    vec2 ndc = (p - uCanvas.xy) / uCanvas.zw * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`;

const dentFragment = `
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

const quadVertex = `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main () {
    vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const lensFragment = `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec4 uSrc;
  uniform vec4 uFig;      // figure rect in viewport px
  uniform float uPad;
  uniform vec2 uMouse;    // damped, viewport px
  uniform float uVmin;
  uniform float uLensSize;
  uniform float uLensEdge;
  uniform float uBlur;
  uniform float uFeather;
  uniform float uCorner;
  varying vec2 vUv;

  vec3 sampleFigure (vec2 px) {
    vec2 uv = clamp(px / uFig.zw, 0.0, 1.0);
    return texture2D(uTex, (uv - uSrc.xy) / uSrc.zw).rgb;
  }

  float sdRoundBox (vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main () {
    vec2 px = vUv * (uFig.zw + 2.0 * uPad) - uPad; // figure-space px

    // Lens: soft circle around the cursor (sdCircle + fill from the demo)
    float x = length(uFig.xy + px - uMouse) / uVmin * 2.0;
    float lens = 1.0 - smoothstep(uLensSize - uLensEdge, uLensSize + uLensEdge, x);

    // Defocus: Vogel disk, radius driven by the lens
    float r = lens * uBlur;
    vec3 col = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float rr = sqrt((fi + 0.5) / 32.0) * r;
      float a = fi * 2.39996323;
      col += sampleFigure(px + vec2(cos(a), sin(a)) * rr);
    }
    col /= 32.0;

    // Frame: rounded rect whose edge softness is the lens (variation 1)
    float d = sdRoundBox(px - uFig.zw * 0.5, uFig.zw * 0.5, uCorner);
    float e = max(lens * uFeather, 0.75);
    float alpha = 1.0 - smoothstep(-e, e, d);

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export function mountPortraitFx(figure: HTMLElement, initial: PortraitEffect, settings: PortraitFxSettings) {
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
  const program = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
    const u = (name: string) => gl.getUniformLocation(p, name);
    return { p, u };
  };

  let dent: ReturnType<typeof program>;
  let lens: ReturnType<typeof program>;
  try {
    dent = program(dentVertex, dentFragment);
    lens = program(quadVertex, lensFragment);
  } catch (err) {
    console.warn('[portrait-fx]', err);
    return null;
  }

  // Geometry: a subdivided plane for the dent, a quad for the lens
  const gridVerts: number[] = [];
  for (let y = 0; y <= GRID; y++) for (let x = 0; x <= GRID; x++) gridVerts.push(x / GRID, y / GRID);
  const gridIdx: number[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * (GRID + 1) + x;
      gridIdx.push(i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1);
    }
  }
  const gridVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVerts), gl.STATIC_DRAW);
  const gridIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gridIdx), gl.STATIC_DRAW);

  const quadVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // State
  let effect: PortraitEffect = initial;
  let uploadedKey = '';
  const src = { x: 0, y: 0, w: 1, h: 1 };
  const pointer = { x: -1e5, y: -1e5, over: false, down: false };
  const lensMouse = { x: -1e5, y: -1e5 };
  const dentMouse = { x: 0.5, y: 0.5 };
  let amp = 0;
  let radius = settings.dentRadius;

  /** Upload whichever image is showing; returns false until it can be drawn. */
  const syncTexture = (figRect: DOMRect) => {
    const img = frame.hidden ? hero : frame;
    if (!img.complete || !img.naturalWidth) return uploadedKey !== '';
    const r = img.getBoundingClientRect();
    const key = `${img.currentSrc}|${Math.round(r.left - figRect.left)}|${Math.round(r.width)}`;
    if (key !== uploadedKey) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      src.x = (r.left - figRect.left) / figRect.width;
      src.y = (r.top - figRect.top) / figRect.height;
      src.w = r.width / figRect.width;
      src.h = r.height / figRect.height;
      uploadedKey = key;
    }
    return true;
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (effect === 1) {
      const { p, u } = dent;
      gl.useProgram(p);
      gl.uniform1i(u('uTex'), 0);
      gl.uniform4f(u('uSrc'), src.x, src.y, src.w, src.h);
      gl.uniform1f(u('uSplit'), settings.rgbSplit);
      gl.uniform2f(u('uMouse'), dentMouse.x, dentMouse.y);
      gl.uniform1f(u('uRadius'), radius);
      gl.uniform1f(u('uAmp'), amp * settings.dentDepth);
      gl.uniform4f(u('uFig'), fig.left, fig.top, fig.width, fig.height);
      gl.uniform4f(u('uCanvas'), fig.left - PAD, fig.top - PAD, cw, ch);
      gl.uniform2f(u('uViewport'), window.innerWidth, window.innerHeight);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridVbo);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIbo);
      gl.drawElements(gl.TRIANGLES, gridIdx.length, gl.UNSIGNED_SHORT, 0);
    } else {
      const { p, u } = lens;
      gl.useProgram(p);
      gl.uniform1i(u('uTex'), 0);
      gl.uniform4f(u('uSrc'), src.x, src.y, src.w, src.h);
      gl.uniform4f(u('uFig'), fig.left, fig.top, fig.width, fig.height);
      gl.uniform1f(u('uPad'), PAD);
      gl.uniform2f(u('uMouse'), lensMouse.x, lensMouse.y);
      gl.uniform1f(u('uVmin'), Math.min(window.innerWidth, window.innerHeight));
      gl.uniform1f(u('uLensSize'), settings.lensSize);
      gl.uniform1f(u('uLensEdge'), settings.lensEdge);
      gl.uniform1f(u('uBlur'), settings.blur);
      gl.uniform1f(u('uFeather'), settings.feather);
      gl.uniform1f(u('uCorner'), settings.corner);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  /** Advance easing; returns true while anything is still moving. */
  const update = (dt: number, fig: DOMRect) => {
    let busy = false;
    if (effect === 1) {
      // Same easing as the pen: lerp per frame at ~60fps
      const k = 1 - Math.pow(1 - 0.1, dt * 60);
      if (pointer.over) {
        const tx = (pointer.x - fig.left) / fig.width;
        const ty = (pointer.y - fig.top) / fig.height;
        dentMouse.x += (tx - dentMouse.x) * k;
        dentMouse.y += (ty - dentMouse.y) * k;
        busy ||= Math.abs(tx - dentMouse.x) + Math.abs(ty - dentMouse.y) > 1e-4;
      }
      const ampTarget = pointer.over ? 1 : 0;
      amp += (ampTarget - amp) * (1 - Math.pow(1 - 0.08, dt * 60));
      const rTarget = pointer.over && pointer.down ? 1 : settings.dentRadius;
      const rRate = pointer.over && pointer.down ? 0.01 : 0.08;
      radius += (rTarget - radius) * (1 - Math.pow(1 - rRate, dt * 60));
      busy ||= Math.abs(ampTarget - amp) > 1e-3 || Math.abs(rTarget - radius) > 1e-3;
    } else {
      // THREE.MathUtils.damp(…, 8, dt) as in the demo
      const k = 1 - Math.exp(-8 * dt);
      lensMouse.x += (pointer.x - lensMouse.x) * k;
      lensMouse.y += (pointer.y - lensMouse.y) * k;
      busy ||= Math.abs(pointer.x - lensMouse.x) + Math.abs(pointer.y - lensMouse.y) > 0.5;
    }
    return busy;
  };

  let raf = 0;
  let last = 0;
  let shown = false;

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (effect === 0) return;
    const fig = figure.getBoundingClientRect();
    if (!syncTexture(fig)) {
      raf = requestAnimationFrame(tick); // wait for the image to decode
      return;
    }
    const busy = update(dt, fig);
    draw(fig);
    if (!shown) {
      shown = true;
      figure.classList.add('has-fx');
    }
    if (busy) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf || effect === 0) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (lensMouse.x === -1e5) {
      // first move: start the lens at the cursor instead of sweeping in from afar
      lensMouse.x = e.clientX;
      lensMouse.y = e.clientY;
    }
    wake();
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
    setEffect(next: PortraitEffect) {
      effect = next;
      if (next === 0) {
        figure.classList.remove('has-fx');
        shown = false;
        canvas.hidden = true;
      } else {
        canvas.hidden = false;
        wake();
      }
    },
    /** Re-read settings (they're read live; this just redraws). */
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
