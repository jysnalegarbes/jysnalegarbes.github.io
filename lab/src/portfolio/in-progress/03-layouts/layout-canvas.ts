/*
  Layout 2: Infinite canvas
  -------------------------
  An endless wall of images in every direction (after jobenetuk.dev):
  drag it anywhere (it keeps gliding after a flick), or scroll / swipe
  with the trackpad. While it moves, the plane bends with the speed (the
  middle leads, the edges trail) and the colours split along the motion,
  then settle. Odd columns sit half a row down. Hover: the title follows
  the cursor. Click: focus view. Hand-written WebGL, one draw per tile.
*/
import {
  aspects,
  bindInput,
  clamp,
  cursorLabel,
  ease,
  loop,
  mod,
  openFocus,
  reduced,
  type IpItem,
  type Layout,
  type LayoutSettings,
} from './common';

const VERT = `
attribute vec2 a_uv;
uniform vec4 u_rect;
uniform vec2 u_res;
uniform vec2 u_vel;
varying vec2 v_uv;
void main() {
  vec2 px = u_rect.xy + a_uv * u_rect.zw;
  vec2 ndc = px / u_res * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float r = dot(ndc, ndc);
  // The middle leads, the edges trail: a bulge along the motion
  ndc += u_vel * (1.0 - 0.45 * r);
  // ...and the plane curves away a little while it moves
  ndc *= 1.0 - length(u_vel) * r * 0.12;
  v_uv = a_uv;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec4 u_cover;
uniform vec2 u_ab;
uniform float u_hover;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv * u_cover.xy + u_cover.zw;
  float r = texture2D(u_tex, uv + u_ab).r;
  float g = texture2D(u_tex, uv).g;
  float b = texture2D(u_tex, uv - u_ab).b;
  vec3 c = vec3(r, g, b);
  c = mix(c, c * 0.82, u_hover);
  gl_FragColor = vec4(c, 1.0);
}`;

const GRID = 16; // mesh subdivisions per side

interface Tex {
  tex: WebGLTexture;
  aspect: number;
}

export function mountCanvas(stage: HTMLElement, items: IpItem[], all: LayoutSettings): Layout | null {
  const s = all.canvas;
  stage.classList.add('ipx-canvas');
  const canvas = document.createElement('canvas');
  canvas.className = 'ipx-canvas__gl';
  stage.append(canvas);
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl || !items.length) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    rect: u('u_rect'),
    res: u('u_res'),
    vel: u('u_vel'),
    cover: u('u_cover'),
    ab: u('u_ab'),
    hover: u('u_hover'),
  };

  // Subdivided unit quad, so the bend shows as a curve
  const verts: number[] = [];
  for (let y = 0; y <= GRID; y++) for (let x = 0; x <= GRID; x++) verts.push(x / GRID, y / GRID);
  const idx: number[] = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const a = y * (GRID + 1) + x;
      idx.push(a, a + 1, a + GRID + 1, a + 1, a + GRID + 2, a + GRID + 1);
    }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_uv');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#e1e8e8';
  const brown = getComputedStyle(document.documentElement).getPropertyValue('--brown').trim() || '#716558';

  const upload = (src: TexImageSource, t: Tex) => {
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };

  // Brown placeholder (with the title) until / unless an image loads
  const textures: Tex[] = items.map((item) => {
    const t: Tex = { tex: gl.createTexture()!, aspect: 0.88 };
    const c = document.createElement('canvas');
    c.width = 352;
    c.height = 400;
    const g = c.getContext('2d')!;
    g.fillStyle = brown;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = bg;
    g.font = '700 22px "Archivo Variable", Archivo, sans-serif';
    g.fillText(item.title.toUpperCase(), 20, c.height - 24);
    upload(c, t);
    if (item.src) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        t.aspect = img.naturalWidth / img.naturalHeight;
        aspects.set(item.src!, t.aspect);
        upload(img, t);
      };
      img.src = item.src;
    }
    return t;
  });

  const label = cursorLabel(stage);
  const off = { x: 0, y: 0, tx: 0, ty: 0 };
  const glide = { x: 0, y: 0 }; // free velocity after a flick, px/s
  const vel = { x: 0, y: 0 }; // shown speed, px/s, smoothed
  let dragging = false;
  let W = 0;
  let H = 0;
  let w = 0;
  let h = 0;
  let gap = 0;
  let dpr = 1;
  const mouse = { x: -1e4, y: -1e4 };
  const hoverK = new Map<string, number>();

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    h = Math.min(H * s.size, W * 0.55);
    w = h * 0.88;
    gap = H * s.gap;
  }

  const px = () => w + gap;
  const py = () => h + gap;
  const indexOf = (col: number, row: number) => mod(col * 5 + row * 2, items.length);

  /** The cell under a screen point (ignoring the bend) */
  function cellAt(x: number, y: number) {
    const col = Math.floor((x - off.x) / px());
    const shift = mod(col, 2) ? py() / 2 : 0;
    const row = Math.floor((y - off.y - shift) / py());
    const cx = col * px() + off.x;
    const cy = row * py() + shift + off.y;
    if (x - cx > w || y - cy > h) return null; // in the gap
    return { col, row, rect: new DOMRect(cx, cy, w, h) };
  }

  function draw(dt: number) {
    gl!.viewport(0, 0, canvas.width, canvas.height);
    const c = parseInt(bg.slice(1), 16);
    gl!.clearColor(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform2f(U.res, W, H);

    // Bend and colour split from the speed
    const k = reduced() ? 0 : 1;
    const vx = clamp(vel.x / W, -3, 3) * s.bend * 0.05 * k;
    const vy = clamp(vel.y / H, -3, 3) * s.bend * 0.05 * k;
    gl!.uniform2f(U.vel, vx, -vy);
    const ax = clamp(vel.x / W, -3, 3) * s.aberration * 0.006 * k;
    const ay = clamp(vel.y / H, -3, 3) * s.aberration * 0.006 * k;
    gl!.uniform2f(U.ab, ax, ay);

    const hit = dragging || mouse.x < -1e3 ? null : cellAt(mouse.x, mouse.y);
    const hitKey = hit ? `${hit.col}:${hit.row}` : '';
    label.show(hit ? items[indexOf(hit.col, hit.row)].title : null);

    // Every cell that can show, with a margin for the bend
    const m = Math.max(w, h);
    const c0 = Math.floor((-m - off.x) / px());
    const c1 = Math.ceil((W + m - off.x) / px());
    for (let col = c0; col <= c1; col++) {
      const shift = mod(col, 2) ? py() / 2 : 0;
      const r0 = Math.floor((-m - off.y - shift) / py());
      const r1 = Math.ceil((H + m - off.y - shift) / py());
      for (let row = r0; row <= r1; row++) {
        const key = `${col}:${row}`;
        const goal = key === hitKey ? 1 : 0;
        const hk = (hoverK.get(key) ?? 0) + (goal - (hoverK.get(key) ?? 0)) * ease(0.18, dt);
        if (hk < 0.001 && goal === 0) hoverK.delete(key);
        else hoverK.set(key, hk);

        const t = textures[indexOf(col, row)];
        const grow = hk * 0.03;
        const x = col * px() + off.x - w * grow;
        const y = row * py() + shift + off.y - h * grow;
        gl!.uniform4f(U.rect, x, y, w * (1 + 2 * grow), h * (1 + 2 * grow));
        // object-fit: cover
        const ta = w / h;
        const sx = t.aspect > ta ? ta / t.aspect : 1;
        const sy = t.aspect > ta ? 1 : t.aspect / ta;
        gl!.uniform4f(U.cover, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
        gl!.uniform1f(U.hover, 0); // grow only; the shader's dim is unused for now
        gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
        gl!.drawElements(gl!.TRIANGLES, idx.length, gl!.UNSIGNED_SHORT, 0);
      }
    }
  }

  bindInput(stage, {
    wheel: (dx, dy) => {
      off.tx -= dx;
      off.ty -= dy;
    },
    down: () => {
      dragging = true;
      glide.x = glide.y = 0;
    },
    move: (dx, dy) => {
      off.tx += dx;
      off.ty += dy;
    },
    up: (vx, vy, moved, e) => {
      dragging = false;
      if (moved) {
        glide.x = vx;
        glide.y = vy;
      } else {
        const hit = cellAt(e.clientX, e.clientY);
        if (hit) openFocus(items[indexOf(hit.col, hit.row)], hit.rect);
      }
    },
    hover: (x, y) => {
      mouse.x = x;
      mouse.y = y;
      label.move(x, y);
    },
  });
  stage.addEventListener('pointerleave', () => {
    mouse.x = mouse.y = -1e4;
  });
  window.addEventListener('keydown', (e) => {
    const by: Record<string, [number, number]> = {
      ArrowDown: [0, -1],
      ArrowUp: [0, 1],
      ArrowRight: [-1, 0],
      ArrowLeft: [1, 0],
    };
    if (!(e.key in by)) return;
    e.preventDefault();
    off.tx += by[e.key][0] * px();
    off.ty += by[e.key][1] * py();
  });

  const still = reduced();
  loop((dt) => {
    // Flick: the target keeps gliding, slowing by `friction` per 1/60 s
    off.tx += glide.x * dt;
    off.ty += glide.y * dt;
    const f = Math.pow(s.friction, dt * 60);
    glide.x *= f;
    glide.y *= f;
    const k = still ? 1 : ease(s.smoothing, dt);
    const nx = off.x + (off.tx - off.x) * k;
    const ny = off.y + (off.ty - off.y) * k;
    if (dt > 0) {
      vel.x += ((nx - off.x) / dt - vel.x) * ease(0.08, dt);
      vel.y += ((ny - off.y) / dt - vel.y) * ease(0.08, dt);
    }
    off.x = nx;
    off.y = ny;
    draw(dt);
  });

  layout();
  // Start with the composition centred on a tile
  off.x = off.tx = W / 2 - w / 2;
  off.y = off.ty = H / 2 - h / 2;
  window.addEventListener('resize', layout);
  return { refresh: layout };
}
