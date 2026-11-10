/*
  Image to Layers (/tools/layers/): splits a flat graphic (poster, ad, social
  post, UI shot) into separate layers, in the browser. Nothing is uploaded.

    1. Text: OCR (tesseract.js 7, Apache-2.0) finds each line. The worker, the
       WASM core and the English data are self-hosted in /ocr/ (vetted
       2026-11-10), so nothing is fetched from a CDN. Each line's colour, size,
       weight and tracking are measured from its pixels, so it can come back as
       live text.
    2. The text is lifted out and its hole filled from the colours around it
       (pull-push fill), so a button keeps a solid button behind its label.
    3. Elements: pixels that differ from the background, grouped into
       connected regions. Each region is a transparent layer; its
       anti-aliased edges are un-mixed from the background colour.
    4. Background: what is left, with the element holes filled.

  Export: an SVG (drops into Figma as named layers with editable text) or a
  .zip of full-size PNG layers (text as the original pixels).
*/

import { baseName, buildZip, errorText, saveBlob } from './tool-utils';

const MAX_EDGE = 2400;
const FONT_PREVIEW = '"Archivo Variable", Archivo, sans-serif';
const FONT_EXPORT = 'Archivo';
const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

type RGB = [number, number, number];
type Box = { x: number; y: number; w: number; h: number };

export type TextLayer = {
  kind: 'text';
  id: string;
  name: string;
  text: string;
  box: Box;
  color: RGB;
  size: number;
  weight: number;
  tracking: number;
  x: number;
  baseline: number;
  /** The original pixels of the line on a transparent canvas, for the PNG export */
  pixels: HTMLCanvasElement;
};

export type ImageLayer = {
  kind: 'shape' | 'image' | 'background';
  id: string;
  name: string;
  box: Box;
  canvas: HTMLCanvasElement;
  area: number;
};

export type Layer = TextLayer | ImageLayer;

// ---------- Colour helpers ----------

/** Perceptual-ish RGB distance ("redmean"), 0 – ~765 */
function dist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const hex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Most common colour among the given pixel indices (4-bit bins, then averaged inside the winning bin) */
function modeColor(data: Uint8ClampedArray, indices: Iterable<number>): { color: RGB; share: number } {
  const counts = new Uint32Array(4096);
  const sums = new Float64Array(4096 * 3);
  let total = 0;
  for (const i of indices) {
    const p = i * 4;
    const bin = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
    counts[bin]++;
    sums[bin * 3] += data[p];
    sums[bin * 3 + 1] += data[p + 1];
    sums[bin * 3 + 2] += data[p + 2];
    total++;
  }
  let best = 0;
  for (let b = 1; b < 4096; b++) if (counts[b] > counts[best]) best = b;
  const n = counts[best] || 1;
  return { color: [sums[best * 3] / n, sums[best * 3 + 1] / n, sums[best * 3 + 2] / n], share: counts[best] / (total || 1) };
}

function* ring(W: number, H: number, b: Box, pad: number) {
  const x0 = Math.max(0, Math.floor(b.x - pad));
  const y0 = Math.max(0, Math.floor(b.y - pad));
  const x1 = Math.min(W - 1, Math.ceil(b.x + b.w + pad));
  const y1 = Math.min(H - 1, Math.ceil(b.y + b.h + pad));
  for (let x = x0; x <= x1; x++) {
    yield y0 * W + x;
    yield y1 * W + x;
  }
  for (let y = y0 + 1; y < y1; y++) {
    yield y * W + x0;
    yield y * W + x1;
  }
}

// ---------- Pull-push hole fill ----------

/**
 * Fills masked pixels from the colours around them: averages the known
 * pixels down a pyramid, then blends back up, so holes take on smooth
 * versions of their surroundings (flat colours and gentle gradients).
 */
function fillHoles(src: Uint8ClampedArray, W: number, H: number, mask: Uint8Array): Uint8ClampedArray {
  type Level = { w: number; h: number; c: Float32Array; a: Float32Array };
  const base: Level = { w: W, h: H, c: new Float32Array(W * H * 3), a: new Float32Array(W * H) };
  for (let i = 0; i < W * H; i++) {
    const known = mask[i] ? 0 : 1;
    base.a[i] = known;
    base.c[i * 3] = src[i * 4] * known;
    base.c[i * 3 + 1] = src[i * 4 + 1] * known;
    base.c[i * 3 + 2] = src[i * 4 + 2] * known;
  }
  // Pull: premultiplied averages, weight capped at 1
  const levels: Level[] = [base];
  let cur = base;
  while (cur.w > 1 || cur.h > 1) {
    const w = Math.max(1, Math.ceil(cur.w / 2));
    const h = Math.max(1, Math.ceil(cur.h / 2));
    const next: Level = { w, h, c: new Float32Array(w * h * 3), a: new Float32Array(w * h) };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let a = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let dy = 0; dy < 2; dy++) {
          const sy = y * 2 + dy;
          if (sy >= cur.h) continue;
          for (let dx = 0; dx < 2; dx++) {
            const sx = x * 2 + dx;
            if (sx >= cur.w) continue;
            const si = sy * cur.w + sx;
            a += cur.a[si];
            r += cur.c[si * 3];
            g += cur.c[si * 3 + 1];
            b += cur.c[si * 3 + 2];
          }
        }
        const i = y * w + x;
        const k = a > 1 ? 1 / a : 1; // renormalise so weight stays ≤ 1
        next.a[i] = Math.min(1, a);
        next.c[i * 3] = r * k;
        next.c[i * 3 + 1] = g * k;
        next.c[i * 3 + 2] = b * k;
      }
    }
    levels.push(next);
    cur = next;
  }
  // Push: fill each level's missing weight from the bilinear-upsampled coarser level
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l];
    const coarse = levels[l + 1];
    for (let y = 0; y < fine.h; y++) {
      const cy = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const y0 = Math.floor(cy);
      const y1 = Math.min(coarse.h - 1, y0 + 1);
      const fy = cy - y0;
      for (let x = 0; x < fine.w; x++) {
        const i = y * fine.w + x;
        const a = fine.a[i];
        if (a >= 1) continue;
        const cx = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
        const x0 = Math.floor(cx);
        const x1 = Math.min(coarse.w - 1, x0 + 1);
        const fx = cx - x0;
        const i00 = y0 * coarse.w + x0;
        const i01 = y0 * coarse.w + x1;
        const i10 = y1 * coarse.w + x0;
        const i11 = y1 * coarse.w + x1;
        for (let ch = 0; ch < 3; ch++) {
          // coarse levels are fully filled by now, so their colour is premultiplied by a = 1
          const top = coarse.c[i00 * 3 + ch] * (1 - fx) + coarse.c[i01 * 3 + ch] * fx;
          const bot = coarse.c[i10 * 3 + ch] * (1 - fx) + coarse.c[i11 * 3 + ch] * fx;
          fine.c[i * 3 + ch] += (1 - a) * (top * (1 - fy) + bot * fy);
        }
        fine.a[i] = 1;
      }
    }
  }
  const out = new Uint8ClampedArray(src);
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    out[i * 4] = base.c[i * 3];
    out[i * 4 + 1] = base.c[i * 3 + 1];
    out[i * 4 + 2] = base.c[i * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Grows a mask by r pixels (separable square dilation) */
function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    // two sweeps track the nearest set pixel on each side
    let last = -Infinity;
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) last = x;
      if (x - last <= r) tmp[y * W + x] = 1;
    }
    last = Infinity;
    for (let x = W - 1; x >= 0; x--) {
      if (mask[y * W + x]) last = x;
      if (last - x <= r) tmp[y * W + x] = 1;
    }
  }
  const out = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -Infinity;
    for (let y = 0; y < H; y++) {
      if (tmp[y * W + x]) last = y;
      if (y - last <= r) out[y * W + x] = 1;
    }
    last = Infinity;
    for (let y = H - 1; y >= 0; y--) {
      if (tmp[y * W + x]) last = y;
      if (last - y <= r) out[y * W + x] = 1;
    }
  }
  return out;
}

/** Labels the connected regions of `grown` (8-connected); counts and boxes cover only the `fg` pixels in each */
function components(fg: Uint8Array, grown: Uint8Array, W: number, H: number) {
  const N = W * H;
  const label = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  const comps: { x0: number; y0: number; x1: number; y1: number; count: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (!grown[i] || label[i] >= 0) continue;
    const id = comps.length;
    const c = { x0: W, y0: H, x1: 0, y1: 0, count: 0 };
    let sp = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp) {
      const j = stack[--sp];
      const x = j % W;
      const y = (j - x) / W;
      if (fg[j]) {
        c.count++;
        if (x < c.x0) c.x0 = x;
        if (y < c.y0) c.y0 = y;
        if (x > c.x1) c.x1 = x;
        if (y > c.y1) c.y1 = y;
      }
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const n = ny * W + nx;
          if (grown[n] && label[n] < 0) {
            label[n] = id;
            stack[sp++] = n;
          }
        }
      }
    }
    comps.push(c);
  }
  return { label, comps };
}

// ---------- OCR ----------

/** `base`: the colour behind the text when it was read inside a shape */
type OcrLine = { text: string; box: Box; confidence: number; base?: RGB };

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let ocrProgress: (t: string) => void = () => {};

function getWorker() {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    return createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/',
      langPath: '/ocr/',
      gzip: true,
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text') ocrProgress(`Reading the text… ${Math.round(m.progress * 100)}%`);
        else if (m.status.startsWith('loading')) ocrProgress('Loading the text reader…');
      },
    });
  })();
  workerPromise.catch(() => (workerPromise = null));
  return workerPromise;
}

/** Reads the lines in one canvas; boxes come back in the canvas's own pixels */
async function readCanvas(canvas: HTMLCanvasElement, crop = false): Promise<OcrLine[]> {
  const worker = await getWorker();
  // Small images and crops read better enlarged
  const long = Math.max(canvas.width, canvas.height);
  const scale = long < 600 ? 3 : long < 1200 ? 2 : 1;
  let input = canvas;
  if (scale > 1) {
    input = document.createElement('canvas');
    input.width = canvas.width * scale;
    input.height = canvas.height * scale;
    const ctx = input.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, input.width, input.height);
  }
  const { data } = await worker.recognize(input, {}, { blocks: true });
  const iw = input.width;
  const ih = input.height;
  if (input !== canvas) input.width = input.height = 0;
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        let words = line.words.filter((w) => w.confidence >= 50 && /[\p{L}\p{N}]/u.test(w.text));
        // in a crop, a "word" touching the edge is the shape's own outline misread (a rounded end as "C", "4")
        const m = 3 * scale;
        if (crop) words = words.filter((w) => w.bbox.x0 > m && w.bbox.y0 > m && w.bbox.x1 < iw - m && w.bbox.y1 < ih - m);
        // a "word" far taller than the rest of its line is a shape beside it
        if (words.length > 1) {
          const hs = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((p, q) => p - q);
          const med = hs[Math.floor(hs.length / 2)];
          words = words.filter((w) => w.bbox.y1 - w.bbox.y0 < med * 1.7);
        }
        if (!words.length) continue;
        const conf = words.reduce((n, w) => n + w.confidence, 0) / words.length;
        if (conf < 62) continue;
        const x0 = Math.min(...words.map((w) => w.bbox.x0)) / scale;
        const y0 = Math.min(...words.map((w) => w.bbox.y0)) / scale;
        const x1 = Math.max(...words.map((w) => w.bbox.x1)) / scale;
        const y1 = Math.max(...words.map((w) => w.bbox.y1)) / scale;
        if (y1 - y0 < 5) continue;
        // a single 1–2 character "word" with only middling confidence is usually a shape misread as a letter
        const text = words.map((w) => w.text).join(' ').trim();
        if (text.replace(/\s/g, '').length <= 2 && conf < 80) continue;
        lines.push({ text, confidence: conf, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
      }
    }
  }
  return lines;
}

/**
 * A crop redrawn as dark-on-white by distance from its own main colour, so
 * text on any coloured shape (white on a dark button, yellow on red) reads
 * like black text on paper. The OCR's own black-and-white step can't see
 * inside a dark shape; it treats the whole shape as a picture.
 */
function contrastCrop(src: Uint8ClampedArray, W: number, b: Box, base: RGB) {
  const c = document.createElement('canvas');
  c.width = b.w;
  c.height = b.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(b.w, b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const p = ((y + b.y) * W + (x + b.x)) * 4;
      const v = 255 - Math.min(255, dist(src[p], src[p + 1], src[p + 2], base[0], base[1], base[2]) * 2.2);
      const o = (y * b.w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

async function readLines(canvas: HTMLCanvasElement, src: Uint8ClampedArray, bg: RGB, onProgress: (t: string) => void): Promise<OcrLine[]> {
  ocrProgress = onProgress;
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: '11' as never, preserve_interword_spaces: '1' }); // sparse text: posters aren't paragraphs
  const W = canvas.width;
  const H = canvas.height;
  const lines: OcrLine[] = [];
  const add = (found: OcrLine[], dx = 0, dy = 0, base?: RGB) => {
    for (const l of found) {
      const b = { x: l.box.x + dx, y: l.box.y + dy, w: l.box.w, h: l.box.h };
      const taken = lines.some((o) => {
        const ix = Math.min(o.box.x + o.box.w, b.x + b.w) - Math.max(o.box.x, b.x);
        const iy = Math.min(o.box.y + o.box.h, b.y + b.h) - Math.max(o.box.y, b.y);
        return ix > 0 && iy > 0 && ix * iy > 0.4 * Math.min(o.box.w * o.box.h, b.w * b.h);
      });
      if (!taken) lines.push({ ...l, box: b, base });
    }
  };

  // Pass 1: the whole image
  onProgress('Reading the text…');
  add(await readCanvas(canvas));

  // Pass 2: inside each solid shape (buttons, bands, badges), read against the shape's own colour
  const fg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) fg[i] = dist(src[i * 4], src[i * 4 + 1], src[i * 4 + 2], bg[0], bg[1], bg[2]) > 40 ? 1 : 0;
  const { comps } = components(fg, dilate(fg, W, H, 2), W, H);
  const shapes = comps
    .map((c) => ({ ...c, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1 }))
    // big enough to hold a word, and mostly filled: a shape, not a stroke or a word
    .filter((c) => c.w >= 40 && c.h >= 16 && c.count / (c.w * c.h) > 0.45 && c.w * c.h < W * H * 0.9)
    .sort((p, q) => q.count - p.count)
    .slice(0, 16);
  for (const [i, c] of shapes.entries()) {
    onProgress(`Reading the text inside shapes… ${i + 1} of ${shapes.length}`);
    const b = { x: c.x0, y: c.y0, w: c.w, h: c.h };
    const inside: number[] = [];
    for (let y = c.y0; y <= c.y1; y += 2) for (let x = c.x0; x <= c.x1; x += 2) inside.push(y * W + x);
    const { color, share } = modeColor(src, inside);
    if (share < 0.4) continue; // a photo or texture, not a flat shape with a label on it
    const crop = contrastCrop(src, W, b, color);
    add(await readCanvas(crop, true), b.x, b.y, color);
    crop.width = crop.height = 0;
  }
  return lines;
}

// ---------- Text measuring ----------

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, weight: number, size: number, tracking = 0) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = `${weight} ${size}px ${FONT_PREVIEW}`;
  (measureCtx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking}px`;
  return measureCtx.measureText(text);
}

/** Ink coverage (0–1) of the text drawn into its box, for weight matching */
function renderedCoverage(t: Pick<TextLayer, 'text' | 'size' | 'weight' | 'tracking' | 'x' | 'baseline' | 'box'>) {
  const w = Math.max(1, Math.ceil(t.box.w));
  const h = Math.max(1, Math.ceil(t.box.h));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `${t.weight} ${t.size}px ${FONT_PREVIEW}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${t.tracking}px`;
  ctx.fillStyle = '#000';
  ctx.fillText(t.text, t.x - t.box.x, t.baseline - t.box.y);
  const d = ctx.getImageData(0, 0, w, h).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s += d[i];
  return s / 255 / (w * h);
}

/** Re-fits size and tracking for a given weight, keeping the box */
function refit(t: TextLayer, weight: number) {
  const m100 = measure(t.text, weight, 100);
  const inkH = m100.actualBoundingBoxAscent + m100.actualBoundingBoxDescent || 70;
  const ink = { x: t.x, y: 0, w: 0, h: 0 };
  // the measured ink box of the original line: recover it from the current fit
  const cur = measure(t.text, t.weight, t.size, t.tracking);
  ink.x = t.x - cur.actualBoundingBoxLeft;
  ink.y = t.baseline - cur.actualBoundingBoxAscent;
  ink.w = cur.actualBoundingBoxLeft + cur.actualBoundingBoxRight;
  ink.h = cur.actualBoundingBoxAscent + cur.actualBoundingBoxDescent;
  const size = (ink.h / inkH) * 100;
  const m = measure(t.text, weight, size);
  const gaps = Math.max(1, [...t.text].length - 1);
  const tracking = Math.max(-0.12 * size, Math.min(0.5 * size, (ink.w - (m.actualBoundingBoxLeft + m.actualBoundingBoxRight)) / gaps));
  const mt = measure(t.text, weight, size, tracking);
  return { weight, size, tracking, x: ink.x + mt.actualBoundingBoxLeft, baseline: ink.y + ink.h - mt.actualBoundingBoxDescent };
}

/** Fits size, tracking and weight so the live text covers the same box as the original */
function fitText(text: string, box: Box, coverage: number) {
  let best: { size: number; weight: number; tracking: number; x: number; baseline: number; err: number } | null = null;
  for (const weight of WEIGHTS) {
    const m100 = measure(text, weight, 100);
    const inkH = m100.actualBoundingBoxAscent + m100.actualBoundingBoxDescent || 70;
    const size = (box.h / inkH) * 100;
    const m = measure(text, weight, size);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const gaps = Math.max(1, [...text].length - 1);
    const tracking = Math.max(-0.12 * size, Math.min(0.5 * size, (box.w - inkW) / gaps));
    const mt = measure(text, weight, size, tracking);
    const x = box.x + mt.actualBoundingBoxLeft;
    const baseline = box.y + box.h - mt.actualBoundingBoxDescent;
    const cov = renderedCoverage({ text, size, weight, tracking, x, baseline, box });
    // prefer the weight whose ink coverage matches, and tracking close to zero
    const err = Math.abs(cov - coverage) / Math.max(coverage, 0.05) + Math.abs(tracking / size) * 0.6;
    if (!best || err < best.err) best = { size, weight, tracking, x, baseline, err };
  }
  return best!;
}

// ---------- Analysis ----------

export type Analysis = {
  W: number;
  H: number;
  scaled: boolean;
  source: Uint8ClampedArray;
  lines: OcrLine[];
  bg: RGB;
  bgShare: number;
};

export async function analyse(bitmap: ImageBitmap, readText: boolean, onProgress: (t: string) => void): Promise<Analysis> {
  const k = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const W = Math.round(bitmap.width * k);
  const H = Math.round(bitmap.height * k);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff'; // transparent PNGs flatten onto white
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, W, H);
  const source = ctx.getImageData(0, 0, W, H).data;

  // Background colour: the most common colour in a frame around the edges
  const frame = Math.max(2, Math.round(Math.min(W, H) * 0.02));
  const edge: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < frame || y < frame || x >= W - frame || y >= H - frame) edge.push(y * W + x);
    }
  }
  const { color: bg, share: bgShare } = modeColor(source, edge);

  const lines = readText ? await readLines(c, source, bg, onProgress) : [];
  c.width = c.height = 0;
  return { W, H, scaled: k < 1, source, lines, bg, bgShare };
}

export type Settings = { sensitivity: number; grouping: number };

export function buildLayers(a: Analysis, s: Settings): Layer[] {
  const { W, H, source } = a;
  const N = W * H;

  // ---- 1. Text ----
  const textMask = new Uint8Array(N);
  const texts: TextLayer[] = [];
  a.lines.forEach((line, li) => {
    const b = line.box;
    const pad = Math.max(2, Math.round(b.h * 0.18));
    const around = modeColor(source, ring(W, H, b, pad));
    const localBg = line.base ?? around.color;
    // on a busy surround (a photo, a texture) only trust a confident, real-looking read
    if (!line.base && around.share < 0.3 && (line.confidence < 85 || line.text.replace(/\W/g, '').length < 3)) return;
    const x0 = Math.max(0, Math.floor(b.x - 1));
    const y0 = Math.max(0, Math.floor(b.y - 1));
    const x1 = Math.min(W, Math.ceil(b.x + b.w + 1));
    const y1 = Math.min(H, Math.ceil(b.y + b.h + 1));
    const bw = x1 - x0;
    const bh = y1 - y0;
    const d = new Float32Array(bw * bh);
    const sorted: number[] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = (y * W + x) * 4;
        const v = dist(source[p], source[p + 1], source[p + 2], localBg[0], localBg[1], localBg[2]);
        d[(y - y0) * bw + (x - x0)] = v;
        sorted.push(v);
      }
    }
    sorted.sort((p, q) => p - q);
    const inkD = sorted[Math.floor(sorted.length * 0.92)];
    if (inkD < 18) return; // no contrast: not really text
    const lo = Math.max(10, inkD * 0.18);
    const hi = Math.max(lo + 4, inkD * 0.7);

    // Ink colour: the strongest pixels; coverage and the original pixels for the PNG
    let cr = 0;
    let cg = 0;
    let cb = 0;
    let cn = 0;
    let cov = 0;
    const px = document.createElement('canvas');
    px.width = bw;
    px.height = bh;
    const pctx = px.getContext('2d')!;
    const img = pctx.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const v = d[y * bw + x];
        const al = smooth(lo, hi, v);
        if (!al) continue;
        const gi = (y + y0) * W + (x + x0);
        const p = gi * 4;
        textMask[gi] = 1;
        cov += al;
        if (v >= inkD * 0.8) {
          cr += source[p];
          cg += source[p + 1];
          cb += source[p + 2];
          cn++;
        }
        const o = (y * bw + x) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = localBg[ch] + (source[p + ch] - localBg[ch]) / Math.max(al, 0.1);
        img.data[o + 3] = Math.round(al * 255);
      }
    }
    pctx.putImageData(img, 0, 0);
    const color: RGB = cn ? [cr / cn, cg / cn, cb / cn] : [0, 0, 0];
    const fit = fitText(line.text, b, cov / (b.w * b.h));
    // the pixel layer sits at (x0, y0)
    texts.push({
      kind: 'text',
      id: `text-${li + 1}`,
      name: line.text.length > 32 ? line.text.slice(0, 31) + '…' : line.text,
      text: line.text,
      box: { x: x0, y: y0, w: bw, h: bh },
      color,
      size: fit.size,
      weight: fit.weight,
      tracking: fit.tracking,
      x: fit.x,
      baseline: fit.baseline,
      pixels: px,
    });
  });

  // Lines set in the same style (size within 8 %, same colour) share one weight, the most common among them
  for (const tl of texts) {
    const peers = texts.filter(
      (o) => Math.abs(o.size - tl.size) < tl.size * 0.08 && dist(...o.color, ...tl.color) < 24,
    );
    if (peers.length < 2) continue;
    const votes = new Map<number, number>();
    for (const o of peers) votes.set(o.weight, (votes.get(o.weight) ?? 0) + o.text.length);
    const weight = [...votes].sort((p, q) => q[1] - p[1])[0][0];
    if (weight !== tl.weight) Object.assign(tl, refit(tl, weight));
  }

  // Lift the text out, so whatever is behind it reads as one piece
  const textHoles = dilate(textMask, W, H, 2);
  const clean = a.lines.length ? fillHoles(source, W, H, textHoles) : source;

  // ---- 2. Elements ----
  const T = s.sensitivity;
  const [br, bgG, bb] = a.bg;
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = dist(clean[i * 4], clean[i * 4 + 1], clean[i * 4 + 2], br, bgG, bb);

  // Second pass: compare against a smooth background plate, so gentle gradients aren't "elements"
  let fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg[i] = d[i] > T ? 1 : 0;
  const plate0 = fillHoles(clean, W, H, dilate(fg, W, H, 2));
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    d[i] = Math.min(d[i], dist(clean[p], clean[p + 1], clean[p + 2], plate0[p], plate0[p + 1], plate0[p + 2]));
    fg[i] = d[i] > T ? 1 : 0;
  }

  // Group: parts closer than `grouping` px join one element
  const r = Math.max(1, Math.round((Math.max(W, H) * s.grouping) / 1000));
  const grown = dilate(fg, W, H, r);
  const { label, comps } = components(fg, grown, W, H);

  const minArea = Math.max(30, N * 0.00004);
  const lo = T * 0.45;
  const hi = T * 1.5;
  const holes = new Uint8Array(N);
  const elements: ImageLayer[] = [];
  let shapes = 0;
  let images = 0;
  comps.forEach((c, id) => {
    if (c.count < minArea) return;
    // the edge ring (anti-aliasing) sits just outside the fg pixels
    const x0 = Math.max(0, c.x0 - 2);
    const y0 = Math.max(0, c.y0 - 2);
    const x1 = Math.min(W - 1, c.x1 + 2);
    const y1 = Math.min(H - 1, c.y1 + 2);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    // A flat shape, logo or icon is mostly a few colours (plus edge blends);
    // a photo or illustration needs many to cover most of its pixels
    const bins = new Map<number, number>();
    let solid = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (label[i] !== id || !fg[i]) continue;
        const p = i * 4;
        const bin = ((clean[p] >> 3) << 10) | ((clean[p + 1] >> 3) << 5) | (clean[p + 2] >> 3);
        bins.set(bin, (bins.get(bin) ?? 0) + 1);
        solid++;
      }
    }
    const counts = [...bins.values()].sort((p, q) => q - p);
    let covered = 0;
    let needed = 0;
    while (needed < counts.length && covered < solid * 0.85) covered += counts[needed++];
    const isImage = needed > 24;

    // In a photo, pixels that happen to match the background are still part of it:
    // everything the photo encloses counts. (Shapes keep their holes: a ring stays a ring.)
    const enclosed = new Uint8Array(w * h);
    if (isImage) {
      const core = (lx: number, ly: number) => {
        const i = (ly + y0) * W + lx + x0;
        return label[i] === id && fg[i] === 1;
      };
      const outside = new Uint8Array(w * h);
      const q: number[] = [];
      for (let lx = 0; lx < w; lx++) q.push(lx, (h - 1) * w + lx);
      for (let ly = 0; ly < h; ly++) q.push(ly * w, ly * w + w - 1);
      while (q.length) {
        const j = q.pop()!;
        if (outside[j]) continue;
        const lx = j % w;
        const ly = (j - lx) / w;
        if (core(lx, ly)) continue;
        outside[j] = 1;
        if (lx > 0) q.push(j - 1);
        if (lx < w - 1) q.push(j + 1);
        if (ly > 0) q.push(j - w);
        if (ly < h - 1) q.push(j + w);
      }
      for (let j = 0; j < w * h; j++) enclosed[j] = outside[j] ? 0 : 1;
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        const o = (y - y0) * w + (x - x0);
        const p = i * 4;
        if (enclosed[o]) {
          holes[i] = 1;
          for (let ch = 0; ch < 3; ch++) img.data[o * 4 + ch] = clean[p + ch];
          img.data[o * 4 + 3] = 255;
          continue;
        }
        if (label[i] !== id) continue;
        const al = smooth(lo, hi, d[i]);
        if (!al) continue;
        holes[i] = 1;
        for (let ch = 0; ch < 3; ch++) img.data[o * 4 + ch] = plate0[p + ch] + (clean[p + ch] - plate0[p + ch]) / Math.max(al, 0.1);
        img.data[o * 4 + 3] = Math.round(al * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    elements.push({
      kind: isImage ? 'image' : 'shape',
      id: '',
      name: '',
      box: { x: x0, y: y0, w, h },
      canvas: cv,
      area: c.count,
    });
  });
  // bigger elements sit lower, so small ones on top of them stay visible
  elements.sort((p, q) => q.area - p.area);
  elements.forEach((e, i) => {
    e.id = `${e.kind}-${i + 1}`;
    e.name = e.kind === 'image' ? `Image ${++images}` : `Shape ${++shapes}`;
  });

  // ---- 3. Background ----
  const bgPixels = fillHoles(clean, W, H, dilate(holes, W, H, 2));
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  bgCanvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(bgPixels), W, H), 0, 0);
  const background: ImageLayer = { kind: 'background', id: 'background', name: 'Background', box: { x: 0, y: 0, w: W, h: H }, canvas: bgCanvas, area: N };

  return [background, ...elements, ...texts];
}

// ---------- Export ----------

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = (n: number) => Math.round(n * 100) / 100;

function textAttrs(t: TextLayer, family: string) {
  return (
    `x="${r2(t.x)}" y="${r2(t.baseline)}" font-family="${family}" font-size="${r2(t.size)}" font-weight="${t.weight}" ` +
    `letter-spacing="${r2(t.tracking)}" fill="${hex(t.color)}" xml:space="preserve"`
  );
}

/** The layered SVG. `forExport` embeds the PNGs and names the font as Figma knows it. */
export function toSvg(layers: Layer[], W: number, H: number, forExport: boolean, urls: Map<string, string>) {
  const family = forExport ? FONT_EXPORT : esc(FONT_PREVIEW);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  ];
  const image = (l: ImageLayer) =>
    `<image id="${esc(l.name)}" data-layer="${l.id}" x="${l.box.x}" y="${l.box.y}" width="${l.box.w}" height="${l.box.h}" href="${urls.get(l.id)}"/>`;
  const bg = layers.find((l) => l.kind === 'background') as ImageLayer | undefined;
  if (bg) out.push(image(bg));
  const els = layers.filter((l): l is ImageLayer => l.kind === 'shape' || l.kind === 'image');
  if (els.length) out.push(`<g id="Elements">`, ...els.map(image), `</g>`);
  const texts = layers.filter((l): l is TextLayer => l.kind === 'text');
  if (texts.length)
    out.push(`<g id="Text">`, ...texts.map((t) => `<text id="${esc(t.name)}" data-layer="${t.id}" ${textAttrs(t, family)}>${esc(t.text)}</text>`), `</g>`);
  out.push('</svg>');
  return out.join('\n');
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t encode a layer.'))), 'image/png'));

async function dataUrls(layers: Layer[]) {
  const urls = new Map<string, string>();
  for (const l of layers) {
    if (l.kind === 'text') continue;
    const blob = await toBlob(l.canvas);
    urls.set(
      l.id,
      await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(blob);
      }),
    );
  }
  return urls;
}

/** Each layer as a full-size transparent PNG, numbered bottom to top, so they restack anywhere */
async function pngZip(layers: Layer[], W: number, H: number) {
  const files: { name: string; blob: Blob }[] = [];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  let n = 0;
  for (const l of layers) {
    ctx.clearRect(0, 0, W, H);
    if (l.kind === 'text') ctx.drawImage(l.pixels, l.box.x, l.box.y);
    else ctx.drawImage(l.canvas, l.box.x, l.box.y);
    const slug = l.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || l.kind;
    files.push({ name: `${String(n++).padStart(2, '0')}-${l.kind === 'text' ? 'text-' : ''}${slug}.png`, blob: await toBlob(c) });
  }
  c.width = c.height = 0;
  return buildZip(files);
}

// ---------- Mount ----------

export function mountLayersTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const statusEl = $<HTMLElement>('[data-status]');
  const stage = $<HTMLElement>('[data-stage]');
  const preview = $<HTMLElement>('[data-preview]');
  const originalImg = $<HTMLImageElement>('[data-original]');
  const list = $<HTMLElement>('[data-layer-list]');
  const countEl = $<HTMLElement>('[data-layer-count]');
  const sensitivity = $<HTMLInputElement>('[data-sensitivity]');
  const grouping = $<HTMLInputElement>('[data-grouping]');
  const readText = $<HTMLInputElement>('[data-read-text]');
  const showOriginal = $<HTMLInputElement>('[data-show-original]');
  const svgBtn = $<HTMLButtonElement>('[data-act="svg"]');
  const zipBtn = $<HTMLButtonElement>('[data-act="zip"]');
  const meta = $<HTMLElement>('[data-meta]');

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  let analysis: Analysis | null = null;
  let layers: Layer[] = [];
  const hidden = new Set<string>();
  let previewUrls = new Map<string, string>();
  let gen = 0;
  let busy = false;
  let originalUrl = '';

  const say = (t: string) => (statusEl.textContent = t);
  const settings = (): Settings => ({ sensitivity: Number(sensitivity.value), grouping: Number(grouping.value) });

  function setBusy(on: boolean) {
    busy = on;
    root.classList.toggle('is-busy', on);
    stage.classList.toggle('is-working', on);
    svgBtn.disabled = zipBtn.disabled = on || !layers.length;
  }

  const visible = () => layers.filter((l) => !hidden.has(l.id));

  function renderPreview() {
    if (!analysis) return;
    preview.innerHTML = toSvg(visible(), analysis.W, analysis.H, false, previewUrls);
    const svg = preview.querySelector('svg')!;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');
  }

  function renderList() {
    countEl.textContent = `${layers.length} layers`;
    list.replaceChildren(
      // top of the stack first, like a layers panel
      ...[...layers].reverse().map((l) => {
        const li = document.createElement('li');
        li.className = 'layers-row';
        li.dataset.layer = l.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'layers-row__eye';
        btn.setAttribute('aria-pressed', String(!hidden.has(l.id)));
        btn.setAttribute('aria-label', `Show ${l.name}`);
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
        btn.addEventListener('click', () => {
          if (hidden.has(l.id)) hidden.delete(l.id);
          else hidden.add(l.id);
          btn.setAttribute('aria-pressed', String(!hidden.has(l.id)));
          renderPreview();
        });
        const kind = document.createElement('span');
        kind.className = 'layers-row__kind';
        kind.textContent = l.kind === 'text' ? 'T' : l.kind === 'image' ? 'Img' : l.kind === 'shape' ? 'Shp' : 'Bg';
        const name = document.createElement('span');
        name.className = 'layers-row__name';
        name.textContent = l.name;
        name.title = l.kind === 'text' ? l.text : l.name;
        li.append(btn, kind, name);
        if (l.kind === 'text') {
          const info = document.createElement('span');
          info.className = 'layers-row__info';
          info.textContent = `${Math.round(l.size)} px · ${l.weight}`;
          li.append(info);
        }
        li.addEventListener('pointerenter', () => highlight(l));
        li.addEventListener('pointerleave', () => highlight(null));
        btn.addEventListener('focus', () => highlight(l));
        btn.addEventListener('blur', () => highlight(null));
        return li;
      }),
    );
  }

  const outline = $<HTMLElement>('[data-outline]');
  function highlight(l: Layer | null) {
    if (!l || !analysis || l.kind === 'background') {
      outline.hidden = true;
      return;
    }
    const { W, H } = analysis;
    outline.hidden = false;
    outline.style.left = `${(l.box.x / W) * 100}%`;
    outline.style.top = `${(l.box.y / H) * 100}%`;
    outline.style.width = `${(l.box.w / W) * 100}%`;
    outline.style.height = `${(l.box.h / H) * 100}%`;
  }

  async function rebuild() {
    if (!analysis) return;
    const g = gen;
    say('Separating the layers…');
    await new Promise((r) => setTimeout(r, 20)); // let the status paint
    if (g !== gen) return;
    const t0 = performance.now();
    layers = buildLayers(analysis, settings());
    hidden.clear();
    previewUrls = new Map(layers.filter((l) => l.kind !== 'text').map((l) => [l.id, (l as ImageLayer).canvas.toDataURL()]));
    renderPreview();
    renderList();
    const nText = layers.filter((l) => l.kind === 'text').length;
    const nEl = layers.length - nText - 1;
    say(
      `Found ${nText} text ${nText === 1 ? 'line' : 'lines'} and ${nEl} ${nEl === 1 ? 'element' : 'elements'} in ${((performance.now() - t0) / 1000).toFixed(1)} s.` +
        (analysis.bgShare < 0.35 ? ' The background isn’t one flat colour, so some of it may come out as elements; raise Sensitivity if so.' : ''),
    );
    svgBtn.disabled = zipBtn.disabled = !layers.length;
  }

  async function process() {
    if (!bitmap) return;
    const g = ++gen;
    setBusy(true);
    try {
      say(readText.checked ? 'Loading the text reader…' : 'Looking at the image…');
      const a = await analyse(bitmap, readText.checked, (t) => g === gen && say(t));
      if (g !== gen) return;
      analysis = a;
      if (a.scaled) meta.textContent += ` · worked at ${a.W} × ${a.H}`;
      await rebuild();
    } catch (err) {
      if (g === gen) say(`Couldn’t split this image: ${errorText(err)}`);
    }
    if (g === gen) setBusy(false);
  }

  async function open(f: File) {
    if (!f.type.startsWith('image/')) return say('That isn’t an image file.');
    try {
      const bmp = await createImageBitmap(f);
      bitmap?.close();
      bitmap = bmp;
    } catch {
      return say('This image couldn’t be opened. HEIC photos only open in Safari.');
    }
    file = f;
    layers = [];
    analysis = null;
    preview.innerHTML = '';
    list.replaceChildren();
    countEl.textContent = '';
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = URL.createObjectURL(f);
    originalImg.src = originalUrl;
    stage.style.aspectRatio = `${bitmap.width} / ${bitmap.height}`;
    stage.style.setProperty('--ratio', (bitmap.width / bitmap.height).toFixed(4));
    meta.textContent = `${f.name} · ${bitmap.width} × ${bitmap.height}`;
    workspace.hidden = false;
    drop.classList.add('is-compact');
    process();
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) open(f);
    fileInput.value = '';
  });

  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  root.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    drop.classList.add('is-over');
  });
  root.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget as Node)) drop.classList.remove('is-over');
  });
  root.addEventListener('drop', (e) => {
    drop.classList.remove('is-over');
    if (!hasFiles(e)) return;
    e.preventDefault();
    const f = e.dataTransfer!.files[0];
    if (f) open(f);
  });
  window.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    open(f);
  });

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!busy) rebuild();
    }, 250);
  };
  sensitivity.addEventListener('input', later);
  grouping.addEventListener('input', later);
  readText.addEventListener('change', process);
  showOriginal.addEventListener('change', () => stage.classList.toggle('is-original', showOriginal.checked));

  svgBtn.addEventListener('click', async () => {
    if (!analysis || !file || busy) return;
    const ls = visible();
    const svg = toSvg(ls, analysis.W, analysis.H, true, await dataUrls(ls));
    const name = `${baseName(file.name)}-layers.svg`;
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), name);
    say(`Downloaded ${name}. Drag it into Figma: each layer arrives separately, and the text stays editable.`);
  });

  zipBtn.addEventListener('click', async () => {
    if (!analysis || !file || busy) return;
    zipBtn.disabled = true;
    say('Packing the layers…');
    try {
      const zip = await pngZip(visible(), analysis.W, analysis.H);
      const name = `${baseName(file.name)}-layers.zip`;
      saveBlob(zip, name);
      say(`Downloaded ${name}: one full-size PNG per layer, numbered bottom to top.`);
    } catch (err) {
      say(`Couldn’t pack the layers: ${errorText(err)}`);
    }
    zipBtn.disabled = false;
  });
}
