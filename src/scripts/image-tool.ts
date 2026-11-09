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
    - "Download all" packs the results into a .zip (stored, no compression:
      the images are already compressed)
  Decoded images aren't kept in memory: each conversion decodes the file
  again, so a large batch of photos doesn't exhaust RAM.
*/

type Format = 'png' | 'jpeg' | 'webp' | 'avif' | 'ico' | 'pdf';
type ResizeMode = 'original' | 'width' | 'height' | 'percent';

const MIME: Record<Exclude<Format, 'ico' | 'pdf'>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};
const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif', ico: 'ico', pdf: 'pdf' };
const LOSSY = new Set<Format>(['jpeg', 'webp', 'avif', 'pdf']);
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
/** Largest edge we'll create; bigger canvases fail on many devices */
const MAX_EDGE = 16384;

interface Settings {
  format: Format;
  quality: number;
  resize: ResizeMode;
  value: number;
  bg: string;
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
  row: HTMLLIElement;
}

interface Decoded {
  img: CanvasImageSource;
  w: number;
  h: number;
  close(): void;
}

// ---------- Helpers ----------

const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.ceil(n / 1024)} KB` : `${n} B`;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'image';

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

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

// ---------- ZIP (stored) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function buildZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);

    parts.push(local as BlobPart, data as BlobPart);
    central.push(cd);
    offset += local.length + data.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end as BlobPart], { type: 'application/zip' });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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

  const settings: Settings = { format: 'webp', quality: 0.85, resize: 'original', value: 0, bg: '#ffffff' };
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
  }

  function syncControls() {
    qualityRow.hidden = !LOSSY.has(settings.format);
    qualityOut.value = `${Math.round(settings.quality * 100)}`;
    bgRow.hidden = settings.format !== 'jpeg' && settings.format !== 'pdf';
    const resizable = settings.format !== 'ico';
    resizeMode.disabled = !resizable;
    resizeValue.hidden = !resizable || settings.resize === 'original';
    resizeUnit.hidden = resizeValue.hidden;
    resizeUnit.textContent = settings.resize === 'percent' ? '%' : 'px';
    formatNote.textContent =
      settings.format === 'ico'
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

  // ---------- Adding files ----------

  async function addFiles(files: Iterable<File>) {
    const incoming = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|svg|ico|avif|webp|bmp)$/i.test(f.name));
    if (!incoming.length) {
      say('Those weren’t image files.');
      return;
    }
    for (const file of incoming) {
      const row = document.createElement('li');
      row.className = 'img-row';
      const item: Item = { id: nextId++, file, thumb: URL.createObjectURL(file), w: 0, h: 0, row };
      row.innerHTML = `
        <img class="img-row__thumb" alt="" loading="lazy" decoding="async" />
        <div class="img-row__info">
          <p class="img-row__name"></p>
          <p class="img-row__meta"></p>
        </div>
        <p class="img-row__result"></p>
        <div class="img-row__actions">
          <button type="button" class="img-row__dl" data-row="download">Download</button>
          <button type="button" class="img-row__rm" data-row="remove" aria-label="Remove">✕</button>
        </div>`;
      const thumb = row.querySelector<HTMLImageElement>('.img-row__thumb')!;
      thumb.addEventListener('error', () => (thumb.style.visibility = 'hidden'));
      thumb.src = item.thumb;
      row.querySelector('.img-row__name')!.textContent = file.name;
      list.append(row);
      items.push(item);
      try {
        const d = await decode(file);
        item.w = d.w;
        item.h = d.h;
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
    const meta = r.querySelector('.img-row__meta')!;
    const result = r.querySelector('.img-row__result')!;
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
      result.textContent = 'Converting…';
      return;
    }
    const change = Math.round((item.out.size / item.file.size - 1) * 100);
    result.innerHTML = '';
    const size = document.createElement('span');
    size.textContent = `${EXT[settings.format].toUpperCase()} · ${settings.format === 'ico' ? 'up to 256 px' : `${item.outW} × ${item.outH}`} · ${formatBytes(item.out.size)}`;
    const delta = document.createElement('span');
    delta.className = `img-row__delta ${change < 0 ? 'is-smaller' : 'is-larger'}`;
    delta.textContent = change === 0 ? '±0%' : `${change > 0 ? '+' : '−'}${Math.abs(change)}%`;
    result.append(size, delta);
  }

  async function convert(item: Item) {
    const src = await decode(item.file);
    try {
      if (settings.format === 'ico') {
        item.out = await buildIco(src);
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
    const row = btn?.closest('.img-row');
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
        // Same output name twice (photo.png + photo.jpg → photo.webp): number them
        const used = new Map<string, number>();
        const files = ok.map((i) => {
          let name = outName(i);
          const n = used.get(name.toLowerCase()) ?? 0;
          used.set(name.toLowerCase(), n + 1);
          if (n) name = name.replace(/(\.[^.]+)$/, ` (${n + 1})$1`);
          return { name, blob: i.out! };
        });
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
