/*
  Image Converter (/tools/image/): converts images in the browser. Files are
  read locally and never uploaded.
    - decode: createImageBitmap (applies EXIF rotation), <img> for SVG and
      anything createImageBitmap refuses
    - encode: canvas.toBlob for PNG / JPEG / WebP / AVIF (AVIF and WebP only
      where the browser can encode them; checked on load), a hand-written
      ICO container (PNG entries 16–256 px), pdf-lib for one PDF (loaded only
      when PDF is picked)
    - re-encoding through a canvas drops metadata (camera, GPS location)
    - SVG is traced, not converted (imagetracerjs in trace-worker.ts):
      fine for logos and flat art, blotchy and heavy for photos, so photos
      get a warning
    - "Download all" packs the results into a .zip (stored, no compression:
      the images are already compressed)
  Decoded images aren't kept in memory: each conversion decodes the file
  again, so a large batch of photos doesn't exhaust RAM.
*/

import { baseName, buildZip, errorText, formatBytes, saveBlob, sizeChange, uniqueNames } from './tool-utils';

type Format = 'png' | 'jpeg' | 'webp' | 'avif' | 'svg' | 'ico' | 'pdf';
type Detail = 'low' | 'medium' | 'high';
type ResizeMode = 'original' | 'width' | 'height' | 'percent';

const MIME: Record<Exclude<Format, 'svg' | 'ico' | 'pdf'>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};
const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif', svg: 'svg', ico: 'ico', pdf: 'pdf' };
const LOSSY = new Set<Format>(['jpeg', 'webp', 'avif', 'pdf']);
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
/** Largest edge we'll create; bigger canvases fail on many devices */
const MAX_EDGE = 16384;
/** Tracing is slow; larger images are traced at this longest edge (the SVG still scales freely) */
const TRACE_EDGE = 1000;

const TRACE_DETAIL: Record<Detail, Record<string, number | boolean>> = {
  low: { ltres: 2, qtres: 2, pathomit: 24, blurradius: 2, blurdelta: 20 },
  medium: { ltres: 1, qtres: 1, pathomit: 8 },
  high: { ltres: 0.5, qtres: 0.5, pathomit: 2 },
};

interface Settings {
  format: Format;
  quality: number;
  resize: ResizeMode;
  value: number;
  bg: string;
  colors: number;
  detail: Detail;
}

interface Item {
  id: number;
  file: File;
  thumb: string;
  w: number;
  h: number;
  error?: string;
  out?: Blob;
  outW?: number;
  outH?: number;
  /** Looks like a photo (lots of colours): tracing it to SVG won't go well */
  photo?: boolean;
  row: HTMLLIElement;
}

interface Decoded {
  img: CanvasImageSource;
  w: number;
  h: number;
  close(): void;
}

// ---------- Helpers ----------

const isHeic = (f: File) => /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser couldn’t encode this image.'))), type, quality),
  );
}

/** True when this browser's canvas can really write `type` (unsupported types silently fall back to PNG) */
async function canEncode(type: string) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const b = await canvasToBlob(c, type, 0.8);
    return b.type === type;
  } catch {
    return false;
  }
}

async function decodeWithImg(file: File): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      isHeic(file)
        ? 'HEIC photos can’t be opened in this browser. Try Safari, or set your iPhone camera to “Most Compatible”.'
        : 'This file couldn’t be opened as an image.',
    );
  }
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  // SVGs without a width/height: size them from the viewBox, 1024 px wide
  if (isSvg(file) && (!w || !h)) {
    const ratio = h && w ? h / w : 1;
    w = 1024;
    h = Math.round(1024 * ratio);
  }
  if (isSvg(file)) {
    const text = await file.text();
    const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const hasSize = /<svg[^>]*\swidth\s*=/i.test(text) && /<svg[^>]*\sheight\s*=/i.test(text);
    if (!hasSize && vb) {
      const vw = parseFloat(vb[1]);
      const vh = parseFloat(vb[2]);
      if (vw > 0 && vh > 0) {
        w = 1024;
        h = Math.round((1024 * vh) / vw);
      }
    }
  }
  return { img, w, h, close: () => URL.revokeObjectURL(url) };
}

async function decode(file: File): Promise<Decoded> {
  if (!isSvg(file)) {
    try {
      const bmp = await createImageBitmap(file);
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {}
  }
  return decodeWithImg(file);
}

function targetSize(w: number, h: number, s: Settings): [number, number] {
  let k = 1;
  if (s.resize === 'width' && s.value > 0) k = s.value / w;
  else if (s.resize === 'height' && s.value > 0) k = s.value / h;
  else if (s.resize === 'percent' && s.value > 0) k = s.value / 100;
  k = Math.min(k, MAX_EDGE / w, MAX_EDGE / h);
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

function draw(src: Decoded, w: number, h: number, bg?: string) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('This image is too large for the browser to convert.');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.img, 0, 0, w, h);
  return c;
}

// ---------- ICO ----------

/** A multi-size .ico: the image centred on transparent squares, stored as PNGs */
async function buildIco(src: Decoded): Promise<Blob> {
  const longest = Math.max(src.w, src.h);
  // Never upscale beyond the next size up; always include 16 and 32
  const sizes = ICO_SIZES.filter((s) => s <= 32 || s <= longest * 1.5);
  const pngs: Uint8Array[] = [];
  for (const size of sizes) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const k = size / longest;
    const w = src.w * k;
    const h = src.h * k;
    ctx.drawImage(src.img, (size - w) / 2, (size - h) / 2, w, h);
    pngs.push(new Uint8Array(await (await canvasToBlob(c, 'image/png')).arrayBuffer()));
  }
  const header = 6 + 16 * sizes.length;
  const total = header + pngs.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  const v = new DataView(buf.buffer);
  v.setUint16(2, 1, true); // type: icon
  v.setUint16(4, sizes.length, true);
  let offset = header;
  sizes.forEach((size, i) => {
    const e = 6 + i * 16;
    buf[e] = size >= 256 ? 0 : size;
    buf[e + 1] = size >= 256 ? 0 : size;
    v.setUint16(e + 4, 1, true); // planes
    v.setUint16(e + 6, 32, true); // bits per pixel
    v.setUint32(e + 8, pngs[i].length, true);
    v.setUint32(e + 12, offset, true);
    buf.set(pngs[i], offset);
    offset += pngs[i].length;
  });
  return new Blob([buf], { type: 'image/x-icon' });
}

// ---------- SVG tracing ----------

let tracer: Worker | null = null;
let traceId = 0;
const traceJobs = new Map<number, { resolve: (svg: string) => void; reject: (e: Error) => void }>();

function trace(image: ImageData, options: Record<string, number | boolean>) {
  if (!tracer) {
    tracer = new Worker(new URL('./trace-worker.ts', import.meta.url), { type: 'module' });
    tracer.onmessage = (e: MessageEvent<{ id: number; svg?: string; error?: string }>) => {
      const job = traceJobs.get(e.data.id);
      traceJobs.delete(e.data.id);
      if (e.data.svg) job?.resolve(e.data.svg);
      else job?.reject(new Error(e.data.error ?? 'Tracing failed.'));
    };
  }
  const id = ++traceId;
  return new Promise<string>((resolve, reject) => {
    traceJobs.set(id, { resolve, reject });
    tracer!.postMessage({ id, image, options });
  });
}

/** Counts colours on a small sample: photos have thousands, flat art a handful */
function looksLikePhoto(src: Decoded) {
  const c = document.createElement('canvas');
  const k = Math.min(1, 96 / Math.max(src.w, src.h));
  c.width = Math.max(1, Math.round(src.w * k));
  c.height = Math.max(1, Math.round(src.h * k));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src.img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const seen = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    seen.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
  }
  return seen.size > 1200;
}

// ---------- Mount ----------

export function mountImageTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const list = $<HTMLUListElement>('[data-list]');
  const statusEl = $<HTMLElement>('[data-status]');
  const summary = $<HTMLElement>('[data-summary]');
  const qualityRow = $<HTMLElement>('[data-quality-row]');
  const quality = $<HTMLInputElement>('[data-quality]');
  const qualityOut = $<HTMLOutputElement>('[data-quality-out]');
  const resizeMode = $<HTMLSelectElement>('[data-resize]');
  const resizeValue = $<HTMLInputElement>('[data-resize-value]');
  const resizeUnit = $<HTMLElement>('[data-resize-unit]');
  const bgRow = $<HTMLElement>('[data-bg-row]');
  const bg = $<HTMLInputElement>('[data-bg]');
  const formatNote = $<HTMLElement>('[data-format-note]');
  const downloadAll = $<HTMLButtonElement>('[data-act="download-all"]');
  const traceRow = $<HTMLElement>('[data-trace-row]');
  const traceColors = $<HTMLInputElement>('[data-trace-colors]');
  const traceColorsOut = $<HTMLOutputElement>('[data-trace-colors-out]');
  const traceDetail = $<HTMLSelectElement>('[data-trace-detail]');

  const settings: Settings = { format: 'webp', quality: 0.85, resize: 'original', value: 0, bg: '#ffffff', colors: 16, detail: 'medium' };
  let items: Item[] = [];
  let nextId = 1;
  let gen = 0;
  let busy = false;

  const say = (t: string) => (statusEl.textContent = t);

  // Formats this browser can't encode are hidden; WebP falls back to PNG
  (async () => {
    for (const f of ['webp', 'avif'] as const) {
      if (!(await canEncode(MIME[f]))) {
        const radio = root.querySelector<HTMLInputElement>(`[name="format"][value="${f}"]`);
        radio?.closest('label')?.remove();
        if (settings.format === f) {
          settings.format = 'png';
          root.querySelector<HTMLInputElement>('[name="format"][value="png"]')!.checked = true;
        }
      }
    }
    syncControls();
  })();

  // ---------- Settings ----------

  function readSettings() {
    const checked = root.querySelector<HTMLInputElement>('[name="format"]:checked');
    settings.format = (checked?.value ?? 'png') as Format;
    settings.quality = Number(quality.value) / 100;
    settings.resize = resizeMode.value as ResizeMode;
    settings.value = Number(resizeValue.value);
    settings.bg = bg.value;
    settings.colors = Number(traceColors.value);
    settings.detail = traceDetail.value as Detail;
  }

  function syncControls() {
    qualityRow.hidden = !LOSSY.has(settings.format);
    qualityOut.value = `${Math.round(settings.quality * 100)}`;
    bgRow.hidden = settings.format !== 'jpeg' && settings.format !== 'pdf';
    traceRow.hidden = settings.format !== 'svg';
    traceColorsOut.value = String(settings.colors);
    const resizable = settings.format !== 'ico';
    resizeMode.disabled = !resizable;
    resizeValue.hidden = !resizable || settings.resize === 'original';
    resizeUnit.hidden = resizeValue.hidden;
    resizeUnit.textContent = settings.resize === 'percent' ? '%' : 'px';
    formatNote.textContent =
      settings.format === 'svg'
        ? 'Traced into shapes, like Image Trace. Great for logos, icons and flat art; photos turn blotchy and heavy.'
        : settings.format === 'ico'
        ? 'Favicon with sizes 16 to 256 px in one file. Non-square images are centred on a transparent square.'
        : settings.format === 'pdf'
          ? 'All images go into one PDF, one page each, in the order listed.'
          : settings.format === 'jpeg'
            ? 'JPG has no transparency: see-through areas get the background colour.'
            : '';
    downloadAll.textContent =
      settings.format === 'pdf' ? 'Download PDF' : items.filter((i) => !i.error).length > 1 ? 'Download all (.zip)' : 'Download';
  }

  let timer = 0;
  function onSettingsChange() {
    const prevResize = settings.resize;
    readSettings();
    // Sensible starting value when switching resize mode
    if (settings.resize !== prevResize) {
      const first = items.find((i) => !i.error);
      resizeValue.value =
        settings.resize === 'percent' ? '50' : settings.resize === 'width' ? String(first ? Math.round(first.w / 2) : 1200) : String(first ? Math.round(first.h / 2) : 800);
      settings.value = Number(resizeValue.value);
    }
    syncControls();
    clearTimeout(timer);
    timer = window.setTimeout(convertAll, 250);
  }

  root.querySelectorAll('[name="format"]').forEach((el) => el.addEventListener('change', onSettingsChange));
  quality.addEventListener('input', () => {
    qualityOut.value = quality.value;
  });
  quality.addEventListener('change', onSettingsChange);
  resizeMode.addEventListener('change', onSettingsChange);
  resizeValue.addEventListener('input', onSettingsChange);
  bg.addEventListener('change', onSettingsChange);
  traceColors.addEventListener('input', () => (traceColorsOut.value = traceColors.value));
  traceColors.addEventListener('change', onSettingsChange);
  traceDetail.addEventListener('change', onSettingsChange);

  // ---------- Adding files ----------

  async function addFiles(files: Iterable<File>) {
    const incoming = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|svg|ico|avif|webp|bmp)$/i.test(f.name));
    if (!incoming.length) {
      say('Those weren’t image files.');
      return;
    }
    for (const file of incoming) {
      const row = document.createElement('li');
      row.className = 'tool-row';
      const item: Item = { id: nextId++, file, thumb: URL.createObjectURL(file), w: 0, h: 0, row };
      row.innerHTML = `
        <img class="tool-row__thumb" alt="" loading="lazy" decoding="async" />
        <div class="tool-row__info">
          <p class="tool-row__name"></p>
          <p class="tool-row__meta"></p>
        </div>
        <p class="tool-row__result"></p>
        <div class="tool-row__actions">
          <button type="button" class="tool-row__dl" data-row="download">Download</button>
          <button type="button" class="tool-row__rm" data-row="remove" aria-label="Remove">✕</button>
        </div>`;
      const thumb = row.querySelector<HTMLImageElement>('.tool-row__thumb')!;
      thumb.addEventListener('error', () => (thumb.style.visibility = 'hidden'));
      thumb.src = item.thumb;
      row.querySelector('.tool-row__name')!.textContent = file.name;
      list.append(row);
      items.push(item);
      try {
        const d = await decode(file);
        item.w = d.w;
        item.h = d.h;
        item.photo = looksLikePhoto(d);
        d.close();
      } catch (err) {
        item.error = errorText(err);
      }
      renderRow(item);
    }
    workspace.hidden = false;
    drop.classList.add('is-compact');
    syncControls();
    convertAll();
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
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
    addFiles(e.dataTransfer!.files);
  });

  // Paste an image (e.g. a screenshot) straight in
  window.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    addFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${Date.now()}-${i + 1}.png`, { type: f.type }))));
  });

  // ---------- Converting ----------

  const outName = (item: Item) => `${baseName(item.file.name)}.${EXT[settings.format]}`;

  function renderRow(item: Item) {
    const r = item.row;
    const meta = r.querySelector('.tool-row__meta')!;
    const result = r.querySelector('.tool-row__result')!;
    const dl = r.querySelector<HTMLButtonElement>('[data-row="download"]')!;
    r.classList.toggle('is-error', !!item.error);
    meta.textContent = item.error ? '' : `${item.w} × ${item.h} · ${formatBytes(item.file.size)}`;
    dl.hidden = settings.format === 'pdf' || !!item.error;
    dl.disabled = !item.out;
    if (item.error) {
      result.textContent = item.error;
      return;
    }
    if (settings.format === 'pdf') {
      result.textContent = 'Goes into the PDF';
      return;
    }
    if (!item.out) {
      result.textContent = settings.format === 'svg' ? 'Tracing…' : 'Converting…';
      return;
    }
    const { change, label } = sizeChange(item.file.size, item.out.size);
    result.innerHTML = '';
    const size = document.createElement('span');
    size.textContent = `${EXT[settings.format].toUpperCase()} · ${settings.format === 'ico' ? 'up to 256 px' : `${item.outW} × ${item.outH}`} · ${formatBytes(item.out.size)}`;
    const delta = document.createElement('span');
    delta.className = `tool-row__delta ${change < 0 ? 'is-smaller' : 'is-larger'}`;
    delta.textContent = label;
    result.append(size, delta);
    if (settings.format === 'svg' && item.photo) {
      const warn = document.createElement('span');
      warn.className = 'tool-row__warn';
      warn.textContent = 'Looks like a photo: the SVG will be blotchy. Fewer colours helps.';
      result.append(warn);
    }
  }

  async function convert(item: Item) {
    const src = await decode(item.file);
    try {
      if (settings.format === 'ico') {
        item.out = await buildIco(src);
        return;
      }
      if (settings.format === 'svg') {
        const [fw, fh] = targetSize(src.w, src.h, settings);
        const k = Math.min(1, TRACE_EDGE / Math.max(fw, fh));
        const tw = Math.max(1, Math.round(fw * k));
        const th = Math.max(1, Math.round(fh * k));
        const c = draw(src, tw, th);
        const image = c.getContext('2d')!.getImageData(0, 0, tw, th);
        c.width = c.height = 0;
        let svg = await trace(image, { numberofcolors: settings.colors, colorsampling: 2, colorquantcycles: 3, roundcoords: 1, viewbox: true, ...TRACE_DETAIL[settings.detail] });
        // Keep the requested size as the SVG's width/height (the viewBox is the traced grid)
        svg = svg.replace('<svg ', `<svg width="${fw}" height="${fh}" `);
        item.out = new Blob([svg], { type: 'image/svg+xml' });
        item.outW = fw;
        item.outH = fh;
        return;
      }
      const [w, h] = targetSize(src.w, src.h, settings);
      const c = draw(src, w, h, settings.format === 'jpeg' ? settings.bg : undefined);
      item.out = await canvasToBlob(c, MIME[settings.format as keyof typeof MIME], LOSSY.has(settings.format) ? settings.quality : undefined);
      item.outW = w;
      item.outH = h;
      c.width = c.height = 0; // free the memory now
    } finally {
      src.close();
    }
  }

  function updateSummary() {
    const ok = items.filter((i) => !i.error);
    const done = ok.filter((i) => i.out);
    downloadAll.disabled = busy || !ok.length || (settings.format !== 'pdf' && done.length < ok.length);
    if (!items.length) {
      summary.textContent = '';
      return;
    }
    const before = ok.reduce((n, i) => n + i.file.size, 0);
    if (settings.format === 'pdf') {
      summary.textContent = `${ok.length} image${ok.length === 1 ? '' : 's'} · ${formatBytes(before)}`;
      return;
    }
    const after = done.reduce((n, i) => n + (i.out?.size ?? 0), 0);
    summary.textContent =
      done.length < ok.length
        ? `Converting ${done.length + 1} of ${ok.length}…`
        : `${ok.length} image${ok.length === 1 ? '' : 's'} · ${formatBytes(before)} → ${formatBytes(after)}`;
  }

  async function convertAll() {
    const g = ++gen;
    for (const item of items) {
      item.out = undefined;
      renderRow(item);
    }
    updateSummary();
    if (settings.format === 'pdf') return;
    for (const item of items) {
      if (g !== gen) return;
      if (item.error || !items.includes(item)) continue;
      try {
        await convert(item);
      } catch (err) {
        item.out = undefined;
        item.error = errorText(err);
      }
      if (g !== gen) return;
      renderRow(item);
      updateSummary();
    }
    syncControls();
  }

  async function buildPdf(ok: Item[]) {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    for (const item of ok) {
      const src = await decode(item.file);
      try {
        const [w, h] = targetSize(src.w, src.h, settings);
        const c = draw(src, w, h, settings.bg);
        const jpg = new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', settings.quality)).arrayBuffer());
        c.width = c.height = 0;
        const image = await pdf.embedJpg(jpg);
        // 96 px per inch, so the page prints at the image's on-screen size
        const page = pdf.addPage([w * 0.75, h * 0.75]);
        page.drawImage(image, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
      } finally {
        src.close();
      }
    }
    return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' });
  }

  // ---------- Actions ----------

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-row]');
    const row = btn?.closest('.tool-row');
    const item = items.find((i) => i.row === row);
    if (!btn || !item) return;
    if (btn.dataset.row === 'download' && item.out) saveBlob(item.out, outName(item));
    if (btn.dataset.row === 'remove') {
      URL.revokeObjectURL(item.thumb);
      item.row.remove();
      items = items.filter((i) => i !== item);
      if (!items.length) {
        workspace.hidden = true;
        drop.classList.remove('is-compact');
      }
      syncControls();
      updateSummary();
    }
  });

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    const ok = items.filter((i) => !i.error);
    if (btn.dataset.act === 'clear') {
      gen++;
      items.forEach((i) => URL.revokeObjectURL(i.thumb));
      items = [];
      list.replaceChildren();
      workspace.hidden = true;
      drop.classList.remove('is-compact');
      say('Cleared.');
      return;
    }
    if (btn.dataset.act !== 'download-all' || !ok.length) return;
    busy = true;
    updateSummary();
    try {
      if (settings.format === 'pdf') {
        say('Building the PDF…');
        const blob = await buildPdf(ok);
        const name = `${ok.length === 1 ? baseName(ok[0].file.name) : 'images'}.pdf`;
        saveBlob(blob, name);
        say(`Downloaded ${name} (${formatBytes(blob.size)}).`);
      } else if (ok.length === 1) {
        saveBlob(ok[0].out!, outName(ok[0]));
      } else {
        say('Zipping…');
        const names = uniqueNames(ok.map(outName));
        const files = ok.map((i, k) => ({ name: names[k], blob: i.out! }));
        const zip = await buildZip(files);
        saveBlob(zip, `converted-${EXT[settings.format]}.zip`);
        say(`Downloaded ${files.length} images as a .zip (${formatBytes(zip.size)}).`);
      }
    } catch (err) {
      say(`Couldn’t finish: ${errorText(err)}`);
    }
    busy = false;
    updateSummary();
  });

  readSettings();
  syncControls();
}
