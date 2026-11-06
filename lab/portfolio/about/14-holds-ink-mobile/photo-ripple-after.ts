/*
  Photo ripple
  ------------
  The home portrait's intro wave (portrait-fx.ts ripple(), after dev_loop's
  "WebGL Slider Interaction" pen) for one of About's beyond DESIGN photos:
  a wave runs down the image in perspective with a faint RGB split, 0.8s
  expo.out up and 0.8s sine.out back down.

  The canvas sits inside the photo, so it takes the photo's rotation and
  clip reveal with it; the perspective is worked out in the photo's own
  pixels (not the viewport's, as on home) for that reason. It only shows
  while a ripple plays; the img is the photo the rest of the time.

  The photo also comes in as black ink halftone dots and resolves back
  into itself under the wave (ink-halftone.ts, 2026-11-06).
*/
import { INK_DONE, inkAt, inkGlsl, setInkColors } from './ink-halftone';

const PAD = 32; // canvas margin around the photo, for the wave's spill
const GRID = 32;
const RIPPLE_IN = 0.8; // s, expo.out up
const RIPPLE_OUT = 0.8; // s, sine.out back down
const SPLIT = 0.12; // home's rgbSplit

const vertexShader = `
  precision highp float;
  attribute vec2 aPosition; // photo uv, top-left origin
  uniform vec2 uSize;       // photo, CSS px
  uniform float uRipple;
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;

  void main () {
    vUv = aPosition;
    float z = sin((aPosition.y - 0.5) * 6.0 + uTime * 10.0) * uRipple * 3.5;
    vWave = z;
    // Perspective from a camera centred on the photo, 50 units away
    vec2 c = uSize * 0.5;
    vec2 p = c + (aPosition * uSize - c) * (50.0 / (50.0 - z));
    vec2 ndc = (p + ${PAD}.0) / (uSize + ${PAD * 2}.0) * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uCover; // object-fit: cover, as a uv scale
  uniform float uSplit;
  uniform vec2 uSize;
  uniform float uInk;
  varying vec2 vUv;
  varying float vWave;
  ${inkGlsl}

  void main () {
    vec2 t = 0.5 + (vUv - 0.5) * uCover;
    float w = vWave;
    vec3 base = texture2D(uTex, t).rgb;
    vec3 split = vec3(
      texture2D(uTex, t + w * 0.04).r,
      texture2D(uTex, t + w * 0.01).g,
      texture2D(uTex, t - w * 0.03).b
    );
    vec3 color = mix(base, split, uSplit);
    float ink = inkFront(uInk, vUv.y);
    vec2 g = inkGrid(vUv, uSize, uInk);
    vec3 c = texture2D(uTex, 0.5 + (inkCentre(g, uSize, uInk) - 0.5) * uCover).rgb;
    gl_FragColor = vec4(mix(color, inkDots(g, uInk, c), smoothstep(0., 1., ink)), 1.0);
  }
`;

const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const sineOut = (t: number) => Math.sin((Math.min(t, 1) * Math.PI) / 2);

export function mountPhotoRipple(photo: HTMLElement) {
  const img = photo.querySelector('img');
  if (!img) return null;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    top: `-${PAD}px`,
    left: `-${PAD}px`,
    width: `calc(100% + ${PAD * 2}px)`,
    height: `calc(100% + ${PAD * 2}px)`,
    pointerEvents: 'none',
    visibility: 'hidden',
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
    console.warn('[photo-ripple]', err);
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
  gl.uniform1f(u('uSplit'), SPLIT);
  setInkColors(gl, program);

  let uploaded = '';
  let raf = 0;
  let last = 0;
  let time = 0;
  let at = -1; // seconds into the ripple, -1 when idle

  const amount = () =>
    at < RIPPLE_IN ? expoOut(at / RIPPLE_IN) : at < RIPPLE_IN + RIPPLE_OUT ? 1 - sineOut((at - RIPPLE_IN) / RIPPLE_OUT) : 0;

  const setPlaying = (on: boolean) => {
    canvas.style.visibility = on ? 'visible' : 'hidden';
    img.style.visibility = on ? 'hidden' : '';
  };

  const tick = (now: number) => {
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.25); // rAF stamps can predate ripple()
    last = now;
    time += dt;
    at += dt;
    if (at >= Math.max(RIPPLE_IN + RIPPLE_OUT, INK_DONE)) {
      at = -1;
      raf = 0;
      setPlaying(false);
      return;
    }
    const [w, h] = [photo.offsetWidth, photo.offsetHeight];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round((w + PAD * 2) * dpr);
    const ch = Math.round((h + PAD * 2) * dpr);
    if (canvas.width !== cw || canvas.height !== ch) [canvas.width, canvas.height] = [cw, ch];
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u('uSize'), w, h);
    const [ia, pa] = [img.naturalWidth / img.naturalHeight, w / h];
    gl.uniform2f(u('uCover'), ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
    gl.uniform1f(u('uRipple'), amount());
    gl.uniform1f(u('uInk'), inkAt(at));
    gl.uniform1f(u('uTime'), time);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    setPlaying(true); // swapped in once drawn, so the photo never blinks
    raf = requestAnimationFrame(tick);
  };

  photo.append(canvas);

  return {
    /** Play the wave and the halftone once; skipped until the photo has loaded. */
    ripple() {
      if (!img.complete || !img.naturalWidth) return;
      if (img.currentSrc !== uploaded) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        uploaded = img.currentSrc;
      }
      at = 0;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    },
  };
}
