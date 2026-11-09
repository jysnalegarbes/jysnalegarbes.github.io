/*
  Mockup Generator (/tools/mockup/): places a design into an original,
  code-drawn scene and exports a PNG/JPG. Nothing is uploaded.

  Scenes
    screens: browser window, phone, laptop, responsive (laptop + phone)
    print:   business cards, framed poster, paper sheet

  How a frame is drawn
    1. the scene draws its object (device / card / frame) flat, at its own size
    2. that is copied onto a larger canvas with a soft two-layer shadow
    3. it's placed on the background: straight, rotated (print flat-lays), or
       warped in 3D perspective (tilt) by splitting it into small triangles,
       each drawn with its own affine transform

  Without an image, every scene shows a placeholder design so there's
  always something to look at.
*/

import { baseName, formatBytes, saveBlob } from './tool-utils';

type SceneKey = 'browser' | 'phone' | 'laptop' | 'responsive' | 'cards' | 'poster' | 'paper';
type Pt = [number, number];
type Ctx = CanvasRenderingContext2D;
type Img = HTMLCanvasElement | ImageBitmap;

interface State {
  scene: SceneKey;
  image: ImageBitmap | null;
  image2: ImageBitmap | null;
  name: string;
  fit: 'cover' | 'contain';
  pos: 'top' | 'center';
  bg: string;
  texture: boolean;
  theme: 'light' | 'dark';
  tilt: number;
  rotate: number;
  scale: number;
  shadow: number;
  ratio: string;
  url: string;
  frame: 'black' | 'white' | 'oak';
  mat: boolean;
  cardColor: string;
  glare: boolean;
}

const INK = '#141918';
const PAPER = '#fbfbf9';

const BACKGROUNDS: Record<string, string | [string, string]> = {
  mist: '#e1e8e8',
  ink: INK,
  green: '#0fb12a',
  sand: '#e9e2d8',
  clay: '#716558',
  mint: ['#e1e8e8', '#bfe5c6'],
  dusk: ['#141918', '#34433f'],
  transparent: 'transparent',
};

// ---------- Drawing helpers ----------

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Draws an image into a box, cropped (cover) or letterboxed (contain) */
function drawFit(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, fit: 'cover' | 'contain', pos: 'top' | 'center', fill = '#fff') {
  const iw = img.width;
  const ih = img.height;
  const k = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  if (fit === 'contain') {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  const dx = x + (w - dw) / 2;
  const dy = pos === 'top' && fit === 'cover' ? y : y + (h - dh) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Paints `img` into a rounded box, clipped */
function screen(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, r: number | number[], s: State, fill = '#fff') {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  drawFit(ctx, img, x, y, w, h, s.fit, s.pos, fill);
  ctx.restore();
}

function glare(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.03)');
  g.addColorStop(0.46, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

let noisePattern: HTMLCanvasElement | null = null;
function noise() {
  if (noisePattern) return noisePattern;
  const c = canvas(160, 160);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  ctx.putImageData(img, 0, 0);
  noisePattern = c;
  return c;
}

// ---------- Placeholder designs ----------

function placeholder(kind: 'desktop' | 'mobile' | 'print' | 'logo', w = 1600, h = 1000) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const u = Math.min(w, h) / 100;
  if (kind === 'logo') {
    ctx.fillStyle = '#0fb12a';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(w / 2 + Math.min(w, h) * 0.12, h / 2, Math.min(w, h) * 0.14, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }
  ctx.fillStyle = kind === 'print' ? '#f4f1ea' : '#e1e8e8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  if (kind === 'desktop') {
    ctx.fillRect(6 * u, 6 * u, 14 * u, 3 * u);
    for (let i = 0; i < 4; i++) ctx.fillRect(w - 6 * u - (i + 1) * 12 * u, 6.5 * u, 8 * u, 2 * u);
    ctx.font = `700 ${11 * u}px "Archivo Variable", Archivo, sans-serif`;
    ctx.fillText('YOUR DESIGN', 6 * u, 34 * u);
    ctx.fillText('GOES HERE', 6 * u, 47 * u);
    ctx.fillStyle = '#0fb12a';
    ctx.fillRect(6 * u, 55 * u, 22 * u, 6 * u);
    ctx.fillStyle = '#c9d2d1';
    for (let i = 0; i < 3; i++) ctx.fillRect(6 * u + i * ((w - 12 * u) / 3), 70 * u, (w - 12 * u) / 3 - 3 * u, h - 76 * u);
  } else if (kind === 'mobile') {
    ctx.fillRect(7 * u, 12 * u, 26 * u, 4 * u);
    ctx.font = `700 ${12 * u}px "Archivo Variable", Archivo, sans-serif`;
    ctx.fillText('YOUR', 7 * u, 45 * u);
    ctx.fillText('DESIGN', 7 * u, 60 * u);
    ctx.fillStyle = '#0fb12a';
    ctx.fillRect(7 * u, 70 * u, 40 * u, 9 * u);
    ctx.fillStyle = '#c9d2d1';
    ctx.fillRect(7 * u, 90 * u, w - 14 * u, h - 100 * u);
  } else {
    ctx.font = `700 ${16 * u}px "Archivo Variable", Archivo, sans-serif`;
    ctx.fillText('YOUR', 8 * u, 26 * u);
    ctx.fillText('DESIGN', 8 * u, 43 * u);
    ctx.fillStyle = '#0fb12a';
    ctx.beginPath();
    ctx.arc(w - 22 * u, h - 22 * u, 14 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(8 * u, h - 14 * u, 30 * u, 2 * u);
  }
  return c;
}

// ---------- Objects (drawn flat, no shadow) ----------

function drawBrowser(w: number, s: State, img: Img) {
  const bar = w * 0.042;
  const h = bar + (w * 10) / 16;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const r = w * 0.014;
  const dark = s.theme === 'dark';
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = dark ? '#1f2423' : '#eef1f1';
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(bar * 0.55 + i * bar * 0.42, bar / 2, bar * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#4a5250' : '#c4cbca';
    ctx.fill();
  }
  const pw = w * 0.4;
  const ph = bar * 0.56;
  roundRect(ctx, (w - pw) / 2, (bar - ph) / 2, pw, ph, ph / 2);
  ctx.fillStyle = dark ? '#2c3230' : '#fff';
  ctx.fill();
  if (s.url) {
    ctx.fillStyle = dark ? '#9aa3a1' : '#7b7f7b';
    ctx.font = `500 ${bar * 0.3}px "Archivo Variable", Archivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.url, w / 2, bar / 2, pw - ph);
  }
  screen(ctx, img, 0, bar, w, h - bar, [0, 0, r, r], s, dark ? '#111' : '#fff');
  // hairline under the bar
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  ctx.fillRect(0, bar - 1, w, 1);
  return c;
}

function drawPhone(w: number, s: State, img: Img) {
  const h = w * 2.05;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const side = w * 0.014; // room for the buttons
  const bw = w - side * 2;
  const r = bw * 0.17;
  const dark = s.theme === 'dark';
  // buttons
  ctx.fillStyle = dark ? '#2a302e' : '#b9c0bf';
  roundRect(ctx, 0, h * 0.2, side * 1.6, h * 0.06, side);
  ctx.fill();
  roundRect(ctx, 0, h * 0.28, side * 1.6, h * 0.06, side);
  ctx.fill();
  roundRect(ctx, w - side * 1.6, h * 0.24, side * 1.6, h * 0.1, side);
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(side, 0, side + bw, 0);
  if (dark) {
    g.addColorStop(0, '#3a403e');
    g.addColorStop(0.5, '#1c201f');
    g.addColorStop(1, '#3a403e');
  } else {
    g.addColorStop(0, '#f3f5f5');
    g.addColorStop(0.5, '#cfd6d5');
    g.addColorStop(1, '#f3f5f5');
  }
  roundRect(ctx, side, 0, bw, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  const edge = bw * 0.012;
  roundRect(ctx, side + edge, edge, bw - edge * 2, h - edge * 2, r - edge);
  ctx.fillStyle = '#0b0d0c';
  ctx.fill();
  const bezel = bw * 0.035;
  const sx = side + bezel;
  const sy = bezel;
  const sw = bw - bezel * 2;
  const sh = h - bezel * 2;
  screen(ctx, img, sx, sy, sw, sh, r - bezel, s, '#fff');
  // camera pill
  const iw = bw * 0.28;
  const ih = bw * 0.08;
  roundRect(ctx, side + (bw - iw) / 2, sy + bw * 0.03, iw, ih, ih / 2);
  ctx.fillStyle = '#050606';
  ctx.fill();
  if (s.glare) glare(ctx, sx, sy, sw, sh, r - bezel);
  return c;
}

function drawLaptop(w: number, s: State, img: Img) {
  const lidW = w / 1.14;
  const lidH = lidW * 0.655;
  const baseH = w * 0.032;
  const h = lidH + baseH;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const dark = s.theme === 'dark';
  const lx = (w - lidW) / 2;
  const r = lidW * 0.03;
  roundRect(ctx, lx, 0, lidW, lidH, [r, r, r * 0.2, r * 0.2]);
  ctx.fillStyle = dark ? '#2b302f' : '#c3cac9';
  ctx.fill();
  const e = lidW * 0.006;
  roundRect(ctx, lx + e, e, lidW - e * 2, lidH - e, [r - e, r - e, 0, 0]);
  ctx.fillStyle = '#0b0d0c';
  ctx.fill();
  const b = lidW * 0.024;
  const sx = lx + b;
  const sy = b * 1.1;
  const sw = lidW - b * 2;
  const sh = lidH - b * 1.1 - b * 1.5;
  screen(ctx, img, sx, sy, sw, sh, r * 0.25, s, '#fff');
  ctx.beginPath();
  ctx.arc(w / 2, sy / 2 + e / 2, b * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = '#1d2221';
  ctx.fill();
  if (s.glare) glare(ctx, sx, sy, sw, sh, r * 0.25);
  // base
  const g = ctx.createLinearGradient(0, lidH, 0, h);
  if (dark) {
    g.addColorStop(0, '#454c4a');
    g.addColorStop(0.5, '#2a2f2e');
    g.addColorStop(1, '#171a19');
  } else {
    g.addColorStop(0, '#e9eded');
    g.addColorStop(0.5, '#c8cfce');
    g.addColorStop(1, '#9ea6a5');
  }
  roundRect(ctx, 0, lidH, w, baseH, [baseH * 0.15, baseH * 0.15, baseH * 0.7, baseH * 0.7]);
  ctx.fillStyle = g;
  ctx.fill();
  const nw = w * 0.13;
  roundRect(ctx, (w - nw) / 2, lidH, nw, baseH * 0.38, [0, 0, baseH * 0.3, baseH * 0.3]);
  ctx.fillStyle = dark ? '#1c201f' : '#aab2b1';
  ctx.fill();
  return c;
}

function drawCard(w: number, s: State, img: Img | null, color?: string, logo?: Img) {
  const h = w / 1.75;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const r = w * 0.018;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = color ?? PAPER;
  ctx.fill();
  if (img) screen(ctx, img, 0, 0, w, h, r, s, PAPER);
  if (logo) {
    ctx.save();
    roundRect(ctx, 0, 0, w, h, r);
    ctx.clip();
    const lw = w * 0.4;
    const lh = h * 0.5;
    drawFit(ctx, logo, (w - lw) / 2, (h - lh) / 2, lw, lh, 'contain', 'center', color ?? PAPER);
    ctx.restore();
  }
  paperLight(ctx, w, h, r);
  return c;
}

/** Soft light falloff and grain, so flat paper reads as paper */
function paperLight(ctx: Ctx, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ctx.createPattern(noise(), 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawPoster(w: number, s: State, img: Img, aspect: number) {
  const f = w * 0.035;
  const mat = s.mat ? w * 0.07 : 0;
  const iw = w - (f + mat) * 2;
  const ih = iw / aspect;
  const h = ih + (f + mat) * 2;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  // frame
  if (s.frame === 'oak') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c2925d');
    g.addColorStop(1, '#9c6f40');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = s.frame === 'white' ? '#f2f2ef' : '#1a1e1d';
  }
  ctx.fillRect(0, 0, w, h);
  if (s.frame === 'oak') {
    ctx.globalAlpha = 0.08;
    for (let y = 0; y < h; y += f * 0.12) {
      ctx.fillStyle = y % (f * 0.36) < f * 0.12 ? '#000' : '#fff';
      ctx.fillRect(0, y, w, f * 0.05);
    }
    ctx.globalAlpha = 1;
  }
  // bevel: light top-left, dark bottom-right
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, w, f * 0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, h - f * 0.15, w, f * 0.15);
  // mat
  ctx.fillStyle = PAPER;
  ctx.fillRect(f, f, w - f * 2, h - f * 2);
  drawFit(ctx, img, f + mat, f + mat, iw, ih, s.fit, s.pos, PAPER);
  // depth: the frame casts a shadow onto the art
  const d = f * 0.9;
  let g = ctx.createLinearGradient(0, f, 0, f + d);
  g.addColorStop(0, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(f, f, w - f * 2, d);
  g = ctx.createLinearGradient(f, 0, f + d, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(f, f, d, h - f * 2);
  if (s.glare) glare(ctx, f, f, w - f * 2, h - f * 2, 0);
  return c;
}

function drawPaper(w: number, s: State, img: Img) {
  const h = w * 1.414;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  drawFit(ctx, img, 0, 0, w, h, s.fit, s.pos, PAPER);
  paperLight(ctx, w, h, 0);
  return c;
}

// ---------- Shadow, placement, perspective ----------

/** Copies an object onto a bigger canvas with a soft two-layer shadow below it */
function withShadow(obj: HTMLCanvasElement, strength: number) {
  const m = Math.max(obj.width, obj.height) * 0.16;
  const c = canvas(obj.width + m * 2, obj.height + m * 2);
  const ctx = c.getContext('2d')!;
  const k = strength / 100;
  const size = Math.max(obj.width, obj.height);
  if (k > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(10,14,13,${0.32 * k})`;
    ctx.shadowBlur = size * 0.07;
    ctx.shadowOffsetY = size * 0.04;
    ctx.drawImage(obj, m, m);
    ctx.shadowColor = `rgba(10,14,13,${0.28 * k})`;
    ctx.shadowBlur = size * 0.012;
    ctx.shadowOffsetY = size * 0.006;
    ctx.drawImage(obj, m, m);
    ctx.restore();
  }
  ctx.drawImage(obj, m, m);
  return { canvas: c, margin: m };
}

function drawTriangle(ctx: Ctx, img: HTMLCanvasElement, s: Pt[], d: Pt[]) {
  const [[s0x, s0y], [s1x, s1y], [s2x, s2y]] = s;
  const [[d0x, d0y], [d1x, d1y], [d2x, d2y]] = d;
  const den = (s1x - s0x) * (s2y - s0y) - (s2x - s0x) * (s1y - s0y);
  if (!den) return;
  const a = ((d1x - d0x) * (s2y - s0y) - (d2x - d0x) * (s1y - s0y)) / den;
  const c = ((d2x - d0x) * (s1x - s0x) - (d1x - d0x) * (s2x - s0x)) / den;
  const b = ((d1y - d0y) * (s2y - s0y) - (d2y - d0y) * (s1y - s0y)) / den;
  const dd = ((d2y - d0y) * (s1x - s0x) - (d1y - d0y) * (s2x - s0x)) / den;
  const e = d0x - a * s0x - c * s0y;
  const f = d0y - b * s0x - dd * s0y;
  // grow the clip a little around the centroid so neighbours overlap (no seams)
  const cx = (d0x + d1x + d2x) / 3;
  const cy = (d0y + d1y + d2y) / 3;
  const grow = (x: number, y: number): Pt => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * 0.9, y + (dy / len) * 0.9];
  };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...grow(d0x, d0y));
  ctx.lineTo(...grow(d1x, d1y));
  ctx.lineTo(...grow(d2x, d2y));
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, dd, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Maps (u, v) in 0–1 on a w×h plane centred at (cx, cy), turned `deg` around the vertical axis, to the screen */
function projector(cx: number, cy: number, w: number, h: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const b = (Math.abs(deg) * 0.35 * Math.PI) / 180; // look down a touch as it turns
  const dist = Math.max(w, h) * 2.4;
  return (u: number, v: number): Pt => {
    const x = (u - 0.5) * w;
    const y = (v - 0.5) * h;
    const x1 = x * Math.cos(a);
    const z1 = -x * Math.sin(a);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b);
    const z2 = y * Math.sin(b) + z1 * Math.cos(b);
    const k = dist / (dist + z2);
    return [cx + x1 * k, cy + y2 * k];
  };
}

/*
  The shadow of a tilted object, drawn as one blurred shape (not warped
  piece by piece, which would leave seams in the soft shadow). The shape
  is drawn far off-canvas and only its shadow is offset back into view.
*/
function tiltedShadow(ctx: Ctx, project: (u: number, v: number) => Pt, w: number, h: number, radius: number, strength: number) {
  const k = strength / 100;
  if (!k) return;
  const size = Math.max(w, h);
  const far = 20000;
  // The object's outline as a rounded rectangle, corner arcs in 8 steps, projected
  const r = Math.min(radius, w / 2, h / 2);
  const corners: [number, number, number][] = [
    [w - r, r, -90],
    [w - r, h - r, 0],
    [r, h - r, 90],
    [r, r, 180],
  ];
  const quad: Pt[] = [];
  for (const [x, y, start] of corners) {
    for (let i = 0; i <= 8; i++) {
      const t = ((start + (i / 8) * 90) * Math.PI) / 180;
      quad.push(project((x + Math.cos(t) * r) / w, (y + Math.sin(t) * r) / h));
    }
  }
  const layers: [number, number, number][] = [
    [0.32 * k, size * 0.07, size * 0.04],
    [0.28 * k, size * 0.012, size * 0.006],
  ];
  for (const [alpha, blur, dy] of layers) {
    ctx.save();
    ctx.shadowColor = `rgba(10,14,13,${alpha})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = far;
    ctx.shadowOffsetY = dy;
    ctx.beginPath();
    quad.forEach(([x, y], i) => (i ? ctx.lineTo(x - far, y) : ctx.moveTo(x - far, y)));
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }
}

/** Draws `img` along a projection, as small triangles each with its own affine transform */
function drawTilted(ctx: Ctx, img: HTMLCanvasElement, project: (u: number, v: number) => Pt, steps: number) {
  const iw = img.width;
  const ih = img.height;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps;
      const u1 = (i + 1) / steps;
      const v0 = j / steps;
      const v1 = (j + 1) / steps;
      const s00: Pt = [u0 * iw, v0 * ih];
      const s10: Pt = [u1 * iw, v0 * ih];
      const s11: Pt = [u1 * iw, v1 * ih];
      const s01: Pt = [u0 * iw, v1 * ih];
      const d00 = project(u0, v0);
      const d10 = project(u1, v0);
      const d11 = project(u1, v1);
      const d01 = project(u0, v1);
      drawTriangle(ctx, img, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(ctx, img, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

/** Places a shadowed object so the object itself fits a w×h box centred at (cx, cy) */
function place(ctx: Ctx, obj: HTMLCanvasElement, cx: number, cy: number, s: State, opts: { tilt?: number; rotate?: number; steps: number; radius?: number }) {
  if (opts.tilt) {
    const project = projector(cx, cy, obj.width, obj.height, opts.tilt);
    tiltedShadow(ctx, project, obj.width, obj.height, opts.radius ?? 0, s.shadow);
    drawTilted(ctx, obj, project, opts.steps);
    return 0;
  }
  const { canvas: sh, margin } = withShadow(obj, s.shadow);
  {
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.rotate) ctx.rotate((opts.rotate * Math.PI) / 180);
    ctx.drawImage(sh, -sh.width / 2, -sh.height / 2);
    ctx.restore();
  }
  return margin;
}

/** Largest w×h of the given aspect that fits the box */
function fitBox(aspect: number, bw: number, bh: number): [number, number] {
  return bw / bh > aspect ? [bh * aspect, bh] : [bw, bw / aspect];
}

// ---------- Scenes ----------

export const SCENES: Record<SceneKey, { label: string; group: 'screen' | 'print'; tilt: boolean; rotate: boolean; second?: string }> = {
  browser: { label: 'Browser', group: 'screen', tilt: true, rotate: false },
  phone: { label: 'Phone', group: 'screen', tilt: true, rotate: false },
  laptop: { label: 'Laptop', group: 'screen', tilt: true, rotate: false },
  responsive: { label: 'Laptop + phone', group: 'screen', tilt: false, rotate: false, second: 'Phone screenshot' },
  cards: { label: 'Business cards', group: 'print', tilt: false, rotate: true, second: 'Card back (logo)' },
  poster: { label: 'Framed poster', group: 'print', tilt: true, rotate: false },
  paper: { label: 'Paper sheet', group: 'print', tilt: false, rotate: true },
};

function background(ctx: Ctx, W: number, H: number, s: State) {
  const bg = BACKGROUNDS[s.bg] ?? s.bg;
  if (bg === 'transparent') return;
  if (Array.isArray(bg)) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg[0]);
    g.addColorStop(1, bg[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, W, H);
  // soft light from the top
  const r = ctx.createRadialGradient(W * 0.5, -H * 0.2, 0, W * 0.5, -H * 0.2, Math.max(W, H) * 1.1);
  r.addColorStop(0, 'rgba(255,255,255,0.10)');
  r.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
  if (s.texture) {
    ctx.fillStyle = ctx.createPattern(noise(), 'repeat')!;
    ctx.fillRect(0, 0, W, H);
  }
}

export function renderMockup(ctx: Ctx, W: number, H: number, s: State, quality: 'preview' | 'export') {
  ctx.clearRect(0, 0, W, H);
  background(ctx, W, H, s);
  const steps = quality === 'export' ? 26 : 14;
  const boxW = W * (s.scale / 100);
  const boxH = H * (s.scale / 100);
  const cx = W / 2;
  const cy = H / 2;
  const scene = SCENES[s.scene];
  const tilt = scene.tilt ? s.tilt : 0;
  // Tilted objects get a little smaller so their near edge stays in frame
  const tk = 1 - Math.abs(tilt) / 140;

  const main = (kind: 'desktop' | 'mobile' | 'print') => s.image ?? placeholder(kind, kind === 'mobile' ? 750 : 1600, kind === 'mobile' ? 1624 : kind === 'print' ? 1130 : 1000);

  switch (s.scene) {
    case 'browser': {
      const [w] = fitBox(1 / (0.042 + 10 / 16), boxW * tk, boxH * tk);
      place(ctx, drawBrowser(w, s, main('desktop')), cx, cy, s, { tilt, steps, radius: w * 0.014 });
      break;
    }
    case 'phone': {
      const [w] = fitBox(1 / 2.05, boxW * tk, boxH * tk);
      place(ctx, drawPhone(w, s, main('mobile')), cx, cy, s, { tilt, steps, radius: w * 0.16 });
      break;
    }
    case 'laptop': {
      const [w] = fitBox(1 / (0.655 / 1.14 + 0.032), boxW * tk, boxH * tk);
      place(ctx, drawLaptop(w, s, main('desktop')), cx, cy, s, { tilt, steps, radius: w * 0.02 });
      break;
    }
    case 'responsive': {
      // laptop left, phone overlapping its right corner
      const groupAspect = 1.32;
      const [gw, gh] = fitBox(groupAspect, boxW, boxH);
      const lw = gw * 0.86;
      const laptop = drawLaptop(lw, s, main('desktop'));
      const pw = gw * 0.2;
      const phone = drawPhone(pw, s, s.image2 ?? s.image ?? placeholder('mobile', 750, 1624));
      const gx = cx - gw / 2;
      const gy = cy - gh / 2;
      place(ctx, laptop, gx + lw / 2, gy + laptop.height / 2 + (gh - laptop.height) * 0.3, s, { steps });
      place(ctx, phone, gx + gw - pw / 2, gy + gh - phone.height / 2, s, { steps });
      break;
    }
    case 'cards': {
      const [gw] = fitBox(1.45, boxW, boxH);
      const cw = gw * 0.62;
      const back = drawCard(cw, s, null, s.cardColor, s.image2 ?? (s.image ? undefined : placeholder('logo', 600, 600)));
      const front = drawCard(cw, s, s.image ?? placeholder('print', 1750, 1000));
      place(ctx, back, cx - gw * 0.16, cy - gw * 0.1, s, { rotate: s.rotate - 9, steps });
      place(ctx, front, cx + gw * 0.12, cy + gw * 0.09, s, { rotate: s.rotate, steps });
      break;
    }
    case 'poster': {
      const art = main('print');
      const aspect = s.image ? art.width / art.height : 1 / 1.414;
      // frame width from the box, then shrink if it's too tall
      const f = 0.035 + (s.mat ? 0.07 : 0);
      const toH = (w: number) => (w - w * f * 2) / aspect + w * f * 2;
      let w = boxW * tk;
      if (toH(w) > boxH * tk) w *= (boxH * tk) / toH(w);
      place(ctx, drawPoster(w, s, art, aspect), cx, cy, s, { tilt, steps });
      break;
    }
    case 'paper': {
      const [w] = fitBox(1 / 1.414, boxW * 0.9, boxH * 0.9);
      place(ctx, drawPaper(w, s, main('print')), cx, cy, s, { rotate: s.rotate, steps });
      break;
    }
  }
}

// ---------- Mount ----------

const RATIOS: Record<string, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 };

export function mountMockupTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const preview = $<HTMLCanvasElement>('[data-preview]');
  const previewWrap = $<HTMLElement>('[data-preview-wrap]');
  const statusEl = $<HTMLElement>('[data-status]');
  const file1 = $<HTMLInputElement>('[data-file="1"]');
  const file2 = $<HTMLInputElement>('[data-file="2"]');
  const slot2 = $<HTMLElement>('[data-slot="2"]');
  const slot2Label = $<HTMLElement>('[data-slot2-label]');

  const s: State = {
    scene: 'browser',
    image: null,
    image2: null,
    name: 'mockup',
    fit: 'cover',
    pos: 'top',
    bg: 'mist',
    texture: false,
    theme: 'light',
    tilt: 0,
    rotate: -6,
    scale: 80,
    shadow: 60,
    ratio: '16:9',
    url: 'yourdesign.com',
    frame: 'black',
    mat: true,
    cardColor: '#141918',
    glare: true,
  };

  const say = (t: string) => (statusEl.textContent = t);

  // ---------- Controls ----------

  function syncVisibility() {
    const scene = SCENES[s.scene];
    root.querySelectorAll<HTMLElement>('[data-show]').forEach((el) => {
      const rule = el.dataset.show!;
      const show = rule.split(' ').some((r) => r === s.scene || r === scene.group || (r === 'tilt' && scene.tilt) || (r === 'rotate' && scene.rotate));
      el.hidden = !show;
    });
    slot2.hidden = !scene.second;
    slot2Label.textContent = scene.second ?? '';
  }

  function read(el: HTMLInputElement | HTMLSelectElement) {
    const key = el.dataset.key as keyof State;
    if (!key) return;
    let value: unknown = el.value;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
    else if (el instanceof HTMLInputElement && el.type === 'range') value = Number(el.value);
    else if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) return;
    (s as unknown as Record<string, unknown>)[key] = value;
    const out = root.querySelector<HTMLOutputElement>(`[data-out="${key}"]`);
    if (out) out.value = String(value);
  }

  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]').forEach((el) => {
    read(el);
    el.addEventListener('input', () => {
      read(el);
      if (el.dataset.key === 'scene') syncVisibility();
      // A custom colour switches the background to it
      if (el.dataset.key === 'customBg') {
        s.bg = el.value;
        root.querySelectorAll<HTMLInputElement>('[data-key="bg"]').forEach((r) => (r.checked = false));
      }
      schedule();
    });
  });
  $<HTMLInputElement>('[data-custom-bg]').addEventListener('input', (e) => {
    s.bg = (e.target as HTMLInputElement).value;
    root.querySelectorAll<HTMLInputElement>('[data-key="bg"]').forEach((r) => (r.checked = false));
    schedule();
  });

  // ---------- Images ----------

  async function setImage(slot: 1 | 2, f: File) {
    if (!f.type.startsWith('image/')) return say('That isn’t an image file.');
    try {
      const bmp = await createImageBitmap(f);
      if (slot === 1) {
        s.image?.close();
        s.image = bmp;
        s.name = baseName(f.name);
      } else {
        s.image2?.close();
        s.image2 = bmp;
      }
      const label = root.querySelector(`[data-slot="${slot}"] [data-slot-name]`);
      if (label) label.textContent = f.name;
      root.querySelector(`[data-slot="${slot}"]`)!.classList.add('has-image');
      say('');
      schedule();
    } catch {
      say('This image couldn’t be opened. HEIC photos only open in Safari.');
    }
  }

  file1.addEventListener('change', () => file1.files?.[0] && setImage(1, file1.files[0]));
  file2.addEventListener('change', () => file2.files?.[0] && setImage(2, file2.files[0]));
  root.querySelectorAll<HTMLButtonElement>('[data-clear-slot]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const slot = btn.dataset.clearSlot;
      if (slot === '1') {
        s.image?.close();
        s.image = null;
      } else {
        s.image2?.close();
        s.image2 = null;
      }
      const el = root.querySelector(`[data-slot="${slot}"]`)!;
      el.classList.remove('has-image');
      el.querySelector('[data-slot-name]')!.textContent = '';
      schedule();
    }),
  );

  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  root.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    root.classList.add('is-over');
  });
  root.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget as Node)) root.classList.remove('is-over');
  });
  root.addEventListener('drop', (e) => {
    root.classList.remove('is-over');
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = [...e.dataTransfer!.files];
    const onSlot2 = (e.target as HTMLElement).closest('[data-slot="2"]');
    if (files[0]) setImage(onSlot2 ? 2 : 1, files[0]);
    if (files[1] && SCENES[s.scene].second) setImage(2, files[1]);
  });
  window.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    setImage(1, f);
  });

  // ---------- Rendering ----------

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function draw() {
    const ratio = RATIOS[s.ratio] ?? 16 / 9;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = previewWrap.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.72, 900);
    const [cw, ch] = fitBox(ratio, maxW, maxH);
    preview.style.width = `${cw}px`;
    preview.style.height = `${ch}px`;
    preview.width = Math.round(cw * dpr);
    preview.height = Math.round(ch * dpr);
    previewWrap.classList.toggle('is-transparent', s.bg === 'transparent');
    renderMockup(preview.getContext('2d')!, preview.width, preview.height, s, 'preview');
  }

  window.addEventListener('resize', schedule);

  root.querySelector('[data-act="download"]')!.addEventListener('click', async () => {
    const ratio = RATIOS[s.ratio] ?? 16 / 9;
    const long = Number(root.querySelector<HTMLSelectElement>('[data-size]')!.value);
    const W = ratio >= 1 ? long : Math.round(long * ratio);
    const H = ratio >= 1 ? Math.round(long / ratio) : long;
    const type = root.querySelector<HTMLSelectElement>('[data-type]')!.value;
    say('Rendering…');
    await new Promise((r) => setTimeout(r, 30));
    const c = canvas(W, H);
    const ctx = c.getContext('2d')!;
    if (type === 'jpg' && s.bg === 'transparent') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    renderMockup(ctx, W, H, s, 'export');
    c.toBlob(
      (blob) => {
        if (!blob) return say('Couldn’t export the mockup.');
        const name = `${s.name}-${s.scene}.${type}`;
        saveBlob(blob, name);
        say(`Downloaded ${name} (${W} × ${H}, ${formatBytes(blob.size)}).`);
        c.width = c.height = 0;
      },
      type === 'jpg' ? 'image/jpeg' : 'image/png',
      0.92,
    );
  });

  syncVisibility();
  document.fonts.ready.then(schedule);
  schedule();
}
