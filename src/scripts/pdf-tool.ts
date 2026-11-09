/*
  PDF Studio (/tools/pdf/): a PDF editor that runs entirely in the browser.
  Files are read locally and never uploaded.
    - PDF.js renders the page thumbnails and the page editor
    - pdf-lib writes the result: merge, reorder, rotate, delete, extract
      selected pages, add text / images / signatures, fill form fields
      (filled forms are flattened into the page on download)

  Overlay geometry: each overlay remembers the page rotation it was placed
  at (r0) and its top-left in PDF points in that orientation (top-left
  origin, y down). On download that maps to PDF user space and is drawn
  rotated by r0, so an overlay stays attached to the page content if the
  page is rotated later. Editing text already inside a PDF is out of scope
  (a desktop editor's job).
*/

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

import { compressPdf, type CompressLevel } from './pdf-compress';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// ---------- Constants ----------

/** Inner padding of a text box, in points */
const PAD = 2;
const LINE = 1.2;
/** Longest edge an added image is stored at, in pixels */
const MAX_IMG = 2400;
const THUMB_CSS_W = 260;
const STAGE_MAX_W = 1100;

/*
  Each PDF standard font with the closest common screen font, so what you
  place in the editor lands in the same spot in the PDF. `base` is where the
  first baseline sits below the top of a line box (line-height 1.2), in em,
  from the screen font's ascent/descent.
*/
const FONTS = {
  helvetica: {
    label: 'Sans',
    css: 'Helvetica, Arial, sans-serif',
    base: 0.946,
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
  },
  times: {
    label: 'Serif',
    css: '"Times New Roman", Times, serif',
    base: 0.938,
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
  },
  courier: {
    label: 'Mono',
    css: '"Courier New", Courier, monospace',
    base: 0.866,
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
  },
} as const;

type FontKey = keyof typeof FONTS;
type Rotation = 0 | 90 | 180 | 270;

// ---------- Types ----------

type FieldValue = string | boolean;

interface Field {
  name: string;
  kind: 'text' | 'check' | 'choice';
  options: string[];
  value: FieldValue;
  multiline: boolean;
}

interface Source {
  id: number;
  label: string;
  name: string;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  fields: Field[];
  /** Only the fields the visitor changed */
  edited: Map<string, FieldValue>;
}

interface OverlayBase {
  id: number;
  r0: Rotation;
  x: number;
  y: number;
}

interface TextOverlay extends OverlayBase {
  kind: 'text';
  text: string;
  size: number;
  color: string;
  font: FontKey;
  bold: boolean;
}

interface ImageOverlay extends OverlayBase {
  kind: 'image';
  w: number;
  h: number;
  bytes: Uint8Array;
  format: 'png' | 'jpg';
  img: HTMLImageElement;
  /** The uncropped image, kept so a crop can be widened again later */
  original?: { bytes: Uint8Array; format: 'png' | 'jpg'; img: HTMLImageElement };
  /** Current crop, in the original image's pixels */
  crop?: CropRect;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A filled box, mainly for covering existing content (it hides it; it doesn't delete it) */
interface RectOverlay extends OverlayBase {
  kind: 'rect';
  w: number;
  h: number;
  color: string;
  /** Re-match the page colour after each move, until a colour is picked by hand */
  auto: boolean;
}

type Overlay = TextOverlay | ImageOverlay | RectOverlay;

interface Page {
  id: number;
  src: Source;
  /** 0-based page index in its source */
  index: number;
  /** Unrotated visible box (PDF.js view), in points */
  vx: number;
  vy: number;
  W: number;
  H: number;
  /** The page's own /Rotate */
  base: number;
  /** Quarter turns added here */
  turn: number;
  selected: boolean;
  overlays: Overlay[];
  thumbKey?: string;
}

class Notice extends Error {}

// ---------- Geometry ----------

const rotationOf = (p: Page) => ((((p.base + p.turn * 90) % 360) + 360) % 360) as Rotation;

const displaySize = (p: Page, r: Rotation): [number, number] => (r % 180 ? [p.H, p.W] : [p.W, p.H]);

/** Display point (top-left origin, points) at rotation r → unrotated user space (relative to the box) */
function toUser(r: Rotation, W: number, H: number, dx: number, dy: number): [number, number] {
  switch (r) {
    case 90:
      return [dy, dx];
    case 180:
      return [W - dx, dy];
    case 270:
      return [W - dy, H - dx];
    default:
      return [dx, H - dy];
  }
}

function fromUser(r: Rotation, W: number, H: number, X: number, Y: number): [number, number] {
  switch (r) {
    case 90:
      return [Y, X];
    case 180:
      return [W - X, Y];
    case 270:
      return [H - Y, W - X];
    default:
      return [X, H - Y];
  }
}

/** Where an overlay's top-left sits on the page as it is displayed now, and its turn relative to that */
function placeOverlay(p: Page, o: Overlay): { x: number; y: number; angle: number } {
  const r = rotationOf(p);
  const [X, Y] = toUser(o.r0, p.W, p.H, o.x, o.y);
  const [x, y] = fromUser(r, p.W, p.H, X, Y);
  return { x, y, angle: (r - o.r0 + 360) % 360 };
}

// ---------- Helpers ----------

const num = (n: number) => String(n).padStart(2, '0');

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const prettyField = (name: string) =>
  name
    .split('.')
    .pop()!
    .replace(/\[\d+\]$/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || name;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function readImage(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  let { width: w, height: h } = bitmap;
  const k = Math.min(1, MAX_IMG / Math.max(w, h));
  let out = blob;
  let format: 'png' | 'jpg' = blob.type === 'image/jpeg' ? 'jpg' : 'png';
  // JPEGs are re-encoded so phone photos keep their EXIF orientation;
  // anything that isn't PNG/JPEG, or is huge, goes through a canvas
  if (k < 1 || blob.type !== 'image/png') {
    w = Math.round(w * k);
    h = Math.round(h * k);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    out = await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92),
    );
  }
  bitmap.close();
  const img = new Image();
  img.src = URL.createObjectURL(out);
  await img.decode();
  return { bytes: new Uint8Array(await out.arrayBuffer()), format, img, w, h };
}

/** Crops a drawing canvas to its ink, with a little margin. Null when empty. */
function trimCanvas(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = c.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x1 = width;
  let y1 = height;
  let x2 = -1;
  let y2 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return null;
  const m = 6;
  x1 = Math.max(0, x1 - m);
  y1 = Math.max(0, y1 - m);
  x2 = Math.min(width - 1, x2 + m);
  y2 = Math.min(height - 1, y2 + m);
  const out = document.createElement('canvas');
  out.width = x2 - x1 + 1;
  out.height = y2 - y1 + 1;
  out.getContext('2d')!.drawImage(c, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function readFields(lib: PDFDocument): Field[] {
  let fields;
  try {
    fields = lib.getForm().getFields();
  } catch {
    return [];
  }
  return fields.flatMap((f): Field[] => {
    try {
      const name = f.getName();
      if (f instanceof PDFTextField)
        return [{ name, kind: 'text', options: [], value: f.getText() ?? '', multiline: f.isMultiline() }];
      if (f instanceof PDFCheckBox) return [{ name, kind: 'check', options: [], value: f.isChecked(), multiline: false }];
      if (f instanceof PDFDropdown)
        return [{ name, kind: 'choice', options: f.getOptions(), value: f.getSelected()[0] ?? '', multiline: false }];
      if (f instanceof PDFRadioGroup)
        return [{ name, kind: 'choice', options: f.getOptions(), value: f.getSelected() ?? '', multiline: false }];
    } catch {}
    return [];
  });
}

function applyForm(lib: PDFDocument, src: Source) {
  if (!src.edited.size) return;
  const form = lib.getForm();
  for (const [name, value] of src.edited) {
    try {
      const f = form.getField(name);
      if (f instanceof PDFTextField) f.setText(String(value));
      else if (f instanceof PDFCheckBox) value ? f.check() : f.uncheck();
      else if (f instanceof PDFDropdown || f instanceof PDFRadioGroup) value ? f.select(String(value)) : f.clear();
    } catch {}
  }
  try {
    form.flatten();
  } catch {
    try {
      form.updateFieldAppearances();
    } catch {}
  }
}

// ---------- Building the PDF ----------

async function buildPdf(list: Page[]): Promise<{ bytes: Uint8Array; replaced: number }> {
  const out = await PDFDocument.create();
  const fonts = new Map<string, PDFFont>();
  let replaced = 0;

  const font = async (key: FontKey, bold: boolean) => {
    const name = bold ? FONTS[key].bold : FONTS[key].regular;
    let f = fonts.get(name);
    if (!f) {
      f = await out.embedFont(name);
      fonts.set(name, f);
    }
    return f;
  };

  // One copyPages call per source, so shared fonts and images are copied once
  const bySource = new Map<Source, number[]>();
  for (const p of list) bySource.set(p.src, [...(bySource.get(p.src) ?? []), p.index]);
  const copied = new Map<string, PDFPage>();
  for (const [src, indices] of bySource) {
    const lib = await PDFDocument.load(src.bytes, { updateMetadata: false });
    applyForm(lib, src);
    const pages = await out.copyPages(lib, indices);
    indices.forEach((index, k) => copied.set(`${src.id}:${index}`, pages[k]));
  }

  for (const p of list) {
    const page = out.addPage(copied.get(`${p.src.id}:${p.index}`)!);
    page.setRotation(degrees(rotationOf(p)));
    const at = (r0: Rotation, dx: number, dy: number) => {
      const [X, Y] = toUser(r0, p.W, p.H, dx, dy);
      return { x: p.vx + X, y: p.vy + Y };
    };

    for (const o of p.overlays) {
      if (o.kind === 'image') {
        const image = o.format === 'jpg' ? await out.embedJpg(o.bytes) : await out.embedPng(o.bytes);
        page.drawImage(image, { ...at(o.r0, o.x, o.y + o.h), width: o.w, height: o.h, rotate: degrees(o.r0) });
        continue;
      }
      if (o.kind === 'rect') {
        page.drawRectangle({
          ...at(o.r0, o.x, o.y + o.h),
          width: o.w,
          height: o.h,
          color: hexToRgb(o.color),
          borderWidth: 0,
          rotate: degrees(o.r0),
        });
        continue;
      }
      const f = await font(o.font, o.bold);
      const charset = new Set(f.getCharacterSet());
      const lines = o.text
        .replace(/\r/g, '')
        .replace(/\t/g, '    ')
        .split('\n')
        .map((line) =>
          [...line]
            .map((ch) => {
              if (charset.has(ch.codePointAt(0)!)) return ch;
              replaced++;
              return '?';
            })
            .join(''),
        );
      lines.forEach((line, i) => {
        if (!line) return;
        const baseline = o.y + PAD + i * o.size * LINE + o.size * FONTS[o.font].base;
        page.drawText(line, {
          ...at(o.r0, o.x + PAD, baseline),
          size: o.size,
          font: f,
          color: hexToRgb(o.color),
          rotate: degrees(o.r0),
        });
      });
    }
  }

  return { bytes: await out.save(), replaced };
}

// ---------- Canvas drawing of overlays (thumbnails) ----------

function drawOverlays(ctx: CanvasRenderingContext2D, p: Page, s: number) {
  for (const o of p.overlays) {
    const { x, y, angle } = placeOverlay(p, o);
    ctx.save();
    ctx.translate(x * s, y * s);
    ctx.rotate((angle * Math.PI) / 180);
    if (o.kind === 'image') {
      ctx.drawImage(o.img, 0, 0, o.w * s, o.h * s);
    } else if (o.kind === 'rect') {
      ctx.fillStyle = o.color;
      ctx.fillRect(0, 0, o.w * s, o.h * s);
    } else {
      ctx.fillStyle = o.color;
      ctx.font = `${o.bold ? 700 : 400} ${o.size * s}px ${FONTS[o.font].css}`;
      o.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, PAD * s, (PAD + i * o.size * LINE + o.size * FONTS[o.font].base) * s);
      });
    }
    ctx.restore();
  }
}

// ---------- Mount ----------

export function mountPdfTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel)!;

  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const grid = $<HTMLUListElement>('[data-grid]');
  const countEl = $<HTMLElement>('[data-count]');
  const statusEl = $<HTMLElement>('[data-status]');
  const outputName = $<HTMLInputElement>('[data-output-name]');
  const compressSelect = $<HTMLSelectElement>('[data-compress]');
  const formsEl = $<HTMLElement>('[data-forms]');
  const formsList = $<HTMLElement>('[data-forms-list]');
  const undoBtn = $<HTMLButtonElement>('[data-act="undo"]');

  const editor = document.querySelector<HTMLDialogElement>('[data-editor]')!;
  const stageWrap = $<HTMLElement>('[data-stage-wrap]', editor);
  const stage = $<HTMLElement>('[data-stage]', editor);
  const layer = $<HTMLElement>('[data-layer]', editor);
  const edTitle = $<HTMLElement>('[data-ed-title]', editor);
  const imageInput = $<HTMLInputElement>('[data-image-input]', editor);
  const props = $<HTMLElement>('[data-props]', editor);
  const propSize = $<HTMLInputElement>('[data-prop="size"]', editor);
  const propFont = $<HTMLSelectElement>('[data-prop="font"]', editor);
  const propBold = $<HTMLButtonElement>('[data-prop="bold"]', editor);
  const propColor = $<HTMLInputElement>('[data-prop="color"]', editor);
  const removeBtn = $<HTMLButtonElement>('[data-ed="remove"]', editor);
  const cropBtn = $<HTMLButtonElement>('[data-ed="crop"]', editor);
  const coverProps = $<HTMLElement>('[data-cover-props]', editor);
  const coverColor = $<HTMLInputElement>('[data-cover-color]', editor);

  const signDialog = document.querySelector<HTMLDialogElement>('[data-sign]')!;
  const signPad = $<HTMLCanvasElement>('[data-sign-pad]', signDialog);

  const sources: Source[] = [];
  let pages: Page[] = [];
  const cards = new Map<number, HTMLLIElement>();
  let nextId = 1;
  let busy = false;
  let lastDeleted: { page: Page; at: number }[] = [];

  const say = (text: string) => {
    statusEl.textContent = text;
  };

  // ---------- Loading ----------

  async function addFiles(files: Iterable<File>) {
    const list = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!list.length) {
      say('Those weren’t PDF files.');
      return;
    }
    setBusy(true);
    const problems: string[] = [];
    let added = 0;
    for (const file of list) {
      say(`Opening ${file.name}…`);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let lib: PDFDocument;
        try {
          lib = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        } catch {
          throw new Notice(`${file.name} couldn’t be read. It may be damaged.`);
        }
        if (lib.isEncrypted) throw new Notice(`${file.name} is password-protected. Remove the protection first, then add it again.`);
        // PDF.js takes ownership of the buffer it gets, so it gets a copy
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        const src: Source = {
          id: nextId++,
          label: String.fromCharCode(65 + (sources.length % 26)),
          name: file.name,
          bytes,
          doc,
          fields: readFields(lib),
          edited: new Map(),
        };
        sources.push(src);
        for (let i = 0; i < doc.numPages; i++) {
          const pg = await doc.getPage(i + 1);
          const [x1, y1, x2, y2] = pg.view;
          pages.push({
            id: nextId++,
            src,
            index: i,
            vx: x1,
            vy: y1,
            W: x2 - x1,
            H: y2 - y1,
            base: pg.rotate,
            turn: 0,
            selected: false,
            overlays: [],
          });
        }
        added += doc.numPages;
        if (!outputName.value) outputName.value = file.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      } catch (err) {
        problems.push(err instanceof Notice ? err.message : `${file.name} couldn’t be opened (${errorText(err)}).`);
      }
    }
    setBusy(false);
    render();
    renderForms();
    say([added && `Added ${added} page${added === 1 ? '' : 's'}.`, ...problems].filter(Boolean).join(' '));
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
    fileInput.value = '';
  });

  // Files can be dropped anywhere on the page
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

  // ---------- Thumbnails ----------

  const thumbQueue = new Set<Page>();
  let thumbRunning = false;

  async function runThumbs() {
    if (thumbRunning) return;
    thumbRunning = true;
    while (thumbQueue.size) {
      const p = thumbQueue.values().next().value!;
      thumbQueue.delete(p);
      if (!cards.has(p.id)) continue;
      try {
        await drawThumb(p);
      } catch {}
    }
    thumbRunning = false;
  }

  async function drawThumb(p: Page) {
    const r = rotationOf(p);
    const key = `${r}:${p.overlays.length}:${JSON.stringify(p.overlays, (k, v) => (k === 'bytes' || k === 'img' ? undefined : v))}`;
    if (p.thumbKey === key) return;
    const pg = await p.src.doc.getPage(p.index + 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [dw] = displaySize(p, r);
    const s = (THUMB_CSS_W * dpr) / dw;
    const viewport = pg.getViewport({ scale: s, rotation: r });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await pg.render({ canvas, viewport }).promise;
    drawOverlays(canvas.getContext('2d')!, p, s);
    p.thumbKey = key;
    const box = cards.get(p.id)?.querySelector('.pdf-card__thumb');
    box?.replaceChildren(canvas);
  }

  const queueThumb = (p: Page) => {
    thumbQueue.add(p);
    runThumbs();
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const p = pages.find((pg) => pg.id === Number((e.target as HTMLElement).dataset.id));
        if (p) queueThumb(p);
      }
    },
    { rootMargin: '600px 0px' },
  );

  // ---------- Grid ----------

  function makeCard(p: Page) {
    const li = document.createElement('li');
    li.className = 'pdf-card';
    li.dataset.id = String(p.id);
    li.draggable = true;
    li.innerHTML = `
      <button type="button" class="pdf-card__thumb" data-c="edit" aria-label="Edit page"><span class="pdf-card__loading">Loading</span></button>
      <div class="pdf-card__bar">
        <label class="pdf-card__check">
          <input type="checkbox" data-c="select" />
          <span class="pdf-card__num"></span>
        </label>
        <span class="pdf-card__src"></span>
        <span class="pdf-card__edits"></span>
      </div>
      <div class="pdf-card__tools">
        <button type="button" data-c="left" aria-label="Move page earlier">←</button>
        <button type="button" data-c="right" aria-label="Move page later">→</button>
        <button type="button" data-c="rotate" aria-label="Rotate page clockwise">↻</button>
        <button type="button" data-c="edit">Edit</button>
        <button type="button" data-c="delete" aria-label="Delete page">✕</button>
      </div>`;
    cards.set(p.id, li);
    io.observe(li);
    return li;
  }

  function render() {
    const ids = new Set(pages.map((p) => p.id));
    for (const [id, el] of cards) {
      if (!ids.has(id)) {
        io.unobserve(el);
        el.remove();
        cards.delete(id);
      }
    }
    pages.forEach((p, i) => {
      const el = cards.get(p.id) ?? makeCard(p);
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] ?? null);
      el.classList.toggle('is-selected', p.selected);
      el.querySelector<HTMLInputElement>('[data-c="select"]')!.checked = p.selected;
      el.querySelector('.pdf-card__num')!.textContent = num(i + 1);
      const srcEl = el.querySelector<HTMLElement>('.pdf-card__src')!;
      srcEl.textContent = sources.length > 1 ? `${p.src.label} · ${p.index + 1}` : '';
      srcEl.title = p.src.name;
      const n = p.overlays.length;
      el.querySelector('.pdf-card__edits')!.textContent = n ? `+${n} added` : '';
      el.querySelector<HTMLElement>('[data-c="edit"]')!.setAttribute('aria-label', `Edit page ${i + 1}`);
      el.querySelector<HTMLButtonElement>('[data-c="left"]')!.disabled = i === 0;
      el.querySelector<HTMLButtonElement>('[data-c="right"]')!.disabled = i === pages.length - 1;
      // Re-render when rotation or overlays changed since the last thumbnail
      if (p.thumbKey) queueThumb(p);
    });

    const selected = pages.filter((p) => p.selected).length;
    workspace.hidden = !pages.length;
    drop.classList.toggle('is-compact', pages.length > 0);
    countEl.textContent = pages.length
      ? `${pages.length} page${pages.length === 1 ? '' : 's'}${sources.length > 1 ? ` from ${sources.length} files` : ''}${selected ? ` · ${selected} selected` : ''}`
      : '';
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-needs="selection"]')) btn.disabled = busy || !selected;
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-needs="pages"]')) btn.disabled = busy || !pages.length;
    undoBtn.hidden = !lastDeleted.length;
  }

  function setBusy(on: boolean) {
    busy = on;
    root.classList.toggle('is-busy', on);
    render();
  }

  function move(p: Page, to: number) {
    const from = pages.indexOf(p);
    if (from < 0 || to < 0 || to >= pages.length || from === to) return;
    pages.splice(from, 1);
    pages.splice(to, 0, p);
    render();
  }

  function remove(list: Page[]) {
    lastDeleted = list.map((page) => ({ page, at: pages.indexOf(page) })).sort((a, b) => a.at - b.at);
    pages = pages.filter((p) => !list.includes(p));
    render();
    say(`Deleted ${list.length} page${list.length === 1 ? '' : 's'}.`);
  }

  grid.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
    const card = target?.closest<HTMLElement>('.pdf-card');
    if (!target || !card || busy) return;
    const p = pages.find((pg) => pg.id === Number(card.dataset.id));
    if (!p) return;
    const i = pages.indexOf(p);
    switch (target.dataset.c) {
      case 'select':
        p.selected = (target as HTMLInputElement).checked;
        render();
        break;
      case 'left':
        move(p, i - 1);
        break;
      case 'right':
        move(p, i + 1);
        break;
      case 'rotate':
        p.turn = (p.turn + 1) % 4;
        render();
        break;
      case 'delete':
        remove([p]);
        break;
      case 'edit':
        openEditor(p);
        break;
    }
  });

  // Drag to reorder (mouse); the arrow buttons cover touch and keyboard
  let dragId: number | null = null;
  const clearDropMarks = () => grid.querySelectorAll<HTMLElement>('[data-drop]').forEach((el) => delete el.dataset.drop);

  grid.addEventListener('dragstart', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.pdf-card');
    if (!card || busy) return;
    dragId = Number(card.dataset.id);
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', card.dataset.id!);
    card.classList.add('is-dragging');
  });

  grid.addEventListener('dragover', (e) => {
    if (dragId === null) return;
    e.preventDefault();
    const card = (e.target as HTMLElement).closest<HTMLElement>('.pdf-card');
    clearDropMarks();
    if (!card || Number(card.dataset.id) === dragId) return;
    const rect = card.getBoundingClientRect();
    card.dataset.drop = e.clientX > rect.left + rect.width / 2 ? 'after' : 'before';
  });

  grid.addEventListener('drop', (e) => {
    if (dragId === null) return;
    e.preventDefault();
    e.stopPropagation();
    const card = grid.querySelector<HTMLElement>('[data-drop]');
    const p = pages.find((pg) => pg.id === dragId);
    if (card && p) {
      const after = card.dataset.drop === 'after';
      const target = pages.find((pg) => pg.id === Number(card.dataset.id))!;
      pages.splice(pages.indexOf(p), 1);
      pages.splice(pages.indexOf(target) + (after ? 1 : 0), 0, p);
    }
    clearDropMarks();
    render();
  });

  grid.addEventListener('dragend', () => {
    dragId = null;
    clearDropMarks();
    grid.querySelector('.is-dragging')?.classList.remove('is-dragging');
  });

  // ---------- Toolbar ----------

  async function download(list: Page[], suffix = '') {
    if (!list.length || busy) return;
    setBusy(true);
    say('Building your PDF…');
    try {
      const built = await buildPdf(list);
      const { replaced } = built;
      let bytes = built.bytes;
      const level = compressSelect.value as CompressLevel | 'none';
      if (level !== 'none') {
        say('Compressing…');
        bytes = (await compressPdf(bytes, level)).bytes;
      }
      let name = (outputName.value.trim() || 'document.pdf').replace(/[\\/:*?"<>|]+/g, '-');
      if (!/\.pdf$/i.test(name)) name += '.pdf';
      if (suffix) name = name.replace(/\.pdf$/i, `${suffix}.pdf`);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const kb = bytes.length / 1024;
      say(
        `Downloaded ${name} (${list.length} page${list.length === 1 ? '' : 's'}, ${kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.ceil(kb)} KB`}).` +
          (replaced ? ` ${replaced} character${replaced === 1 ? '' : 's'} the PDF fonts can’t show became “?”.` : ''),
      );
    } catch (err) {
      say(`Couldn’t build the PDF: ${errorText(err)}`);
    }
    setBusy(false);
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    const selected = pages.filter((p) => p.selected);
    switch (btn.dataset.act) {
      case 'select-all':
        pages.forEach((p) => (p.selected = true));
        render();
        break;
      case 'select-none':
        pages.forEach((p) => (p.selected = false));
        render();
        break;
      case 'rotate-selected':
        selected.forEach((p) => (p.turn = (p.turn + 1) % 4));
        render();
        break;
      case 'delete-selected':
        remove(selected);
        break;
      case 'undo':
        for (const { page, at } of lastDeleted) pages.splice(Math.min(at, pages.length), 0, page);
        say(`Restored ${lastDeleted.length} page${lastDeleted.length === 1 ? '' : 's'}.`);
        lastDeleted = [];
        render();
        break;
      case 'download':
        download(pages);
        break;
      case 'download-selected':
        download(selected, '-pages');
        break;
      case 'clear':
        if (!confirm('Remove all files and start over?')) return;
        for (const s of sources) s.doc.loadingTask.destroy();
        sources.length = 0;
        pages = [];
        lastDeleted = [];
        outputName.value = '';
        render();
        renderForms();
        say('Cleared.');
        break;
    }
  });

  // ---------- Forms ----------

  function renderForms() {
    const withFields = sources.filter((s) => s.fields.length);
    formsEl.hidden = !withFields.length;
    formsList.replaceChildren(
      ...withFields.map((src) => {
        const set = document.createElement('fieldset');
        set.className = 'pdf-form';
        const legend = document.createElement('legend');
        legend.textContent = sources.length > 1 ? `${src.label} · ${src.name}` : src.name;
        set.append(legend);
        src.fields.forEach((field, i) => {
          const id = `f-${src.id}-${i}`;
          const row = document.createElement('div');
          row.className = `pdf-form__row pdf-form__row--${field.kind}`;
          const label = document.createElement('label');
          label.htmlFor = id;
          label.textContent = prettyField(field.name);
          label.title = field.name;
          let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          if (field.kind === 'check') {
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = field.value === true;
            box.addEventListener('change', () => src.edited.set(field.name, box.checked));
            input = box;
          } else if (field.kind === 'choice') {
            const sel = document.createElement('select');
            sel.append(new Option('—', ''), ...field.options.map((o) => new Option(o, o)));
            sel.value = String(field.value);
            sel.addEventListener('change', () => src.edited.set(field.name, sel.value));
            input = sel;
          } else {
            const text = field.multiline ? document.createElement('textarea') : document.createElement('input');
            text.value = String(field.value);
            text.addEventListener('input', () => src.edited.set(field.name, text.value));
            input = text;
          }
          input.id = id;
          row.append(label, input);
          set.append(row);
        });
        return set;
      }),
    );
  }

  // ---------- Page editor ----------

  const ed: { page: Page | null; scale: number; selected: Overlay | null; task: RenderTask | null; token: number } = {
    page: null,
    scale: 1,
    selected: null,
    task: null,
    token: 0,
  };
  /** New text boxes reuse the last style picked */
  const textStyle: Pick<TextOverlay, 'size' | 'color' | 'font' | 'bold'> = {
    size: 14,
    color: '#141918',
    font: 'helvetica',
    bold: false,
  };

  function openEditor(p: Page) {
    ed.page = p;
    ed.selected = null;
    if (!editor.open) editor.showModal();
    drawStage();
  }

  editor.addEventListener('close', () => {
    ed.task?.cancel();
    ed.page = null;
    ed.selected = null;
    layer.replaceChildren();
    render();
  });

  async function drawStage() {
    const p = ed.page;
    if (!p) return;
    const token = ++ed.token;
    const i = pages.indexOf(p);
    edTitle.textContent = `Page ${i + 1} of ${pages.length}`;
    $<HTMLButtonElement>('[data-ed="prev"]', editor).disabled = i <= 0;
    $<HTMLButtonElement>('[data-ed="next"]', editor).disabled = i >= pages.length - 1;

    const r = rotationOf(p);
    const [dw, dh] = displaySize(p, r);
    const styles = getComputedStyle(stageWrap);
    const avail = stageWrap.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    ed.scale = Math.min(avail, STAGE_MAX_W) / dw;
    stage.style.width = `${dw * ed.scale}px`;
    stage.style.height = `${dh * ed.scale}px`;
    renderLayer();
    syncProps();

    const pg = await p.src.doc.getPage(p.index + 1);
    if (token !== ed.token) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pg.getViewport({ scale: ed.scale * dpr, rotation: r });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-stage__canvas';
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    ed.task?.cancel();
    const task = pg.render({ canvas, viewport });
    ed.task = task;
    try {
      await task.promise;
    } catch {
      return; // cancelled by a newer draw
    }
    if (token !== ed.token) return;
    stage.querySelector('.pdf-stage__canvas')?.replaceWith(canvas);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!editor.open) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawStage, 150);
  });

  function styleOverlay(el: HTMLElement, o: Overlay) {
    const p = ed.page!;
    const s = ed.scale;
    const { x, y, angle } = placeOverlay(p, o);
    el.style.left = `${x * s}px`;
    el.style.top = `${y * s}px`;
    el.style.transform = angle ? `rotate(${angle}deg)` : '';
    el.classList.toggle('is-selected', ed.selected === o);
    if (o.kind === 'image' || o.kind === 'rect') {
      el.style.width = `${o.w * s}px`;
      el.style.height = `${o.h * s}px`;
      if (o.kind === 'rect') el.style.background = o.color;
    } else {
      const t = el.querySelector<HTMLElement>('.pdf-ov__text')!;
      t.style.fontSize = `${o.size * s}px`;
      t.style.padding = `${PAD * s}px`;
      t.style.fontFamily = FONTS[o.font].css;
      t.style.fontWeight = o.bold ? '700' : '400';
      t.style.color = o.color;
    }
  }

  function renderLayer() {
    const p = ed.page!;
    layer.replaceChildren(
      ...p.overlays.map((o) => {
        const el = document.createElement('div');
        el.className = `pdf-ov pdf-ov--${o.kind}`;
        el.dataset.id = String(o.id);
        if (o.kind === 'rect') {
          el.tabIndex = 0;
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', 'Cover box. Arrow keys move it, Delete removes it.');
          el.addEventListener('pointerdown', (e) => startDrag(e, o, 'move'));
          el.addEventListener('focus', () => select(o));
        } else if (o.kind === 'image') {
          el.tabIndex = 0;
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', 'Added image. Arrow keys move it, Delete removes it.');
          const img = document.createElement('img');
          img.src = o.img.src;
          img.alt = '';
          img.draggable = false;
          el.append(img);
          el.addEventListener('pointerdown', (e) => startDrag(e, o, 'move'));
          el.addEventListener('focus', () => select(o));
          el.addEventListener('dblclick', () => openCrop(o));
        } else {
          const grip = document.createElement('span');
          grip.className = 'pdf-ov__grip';
          grip.title = 'Drag to move';
          grip.addEventListener('pointerdown', (e) => startDrag(e, o, 'move'));
          const t = document.createElement('div');
          t.className = 'pdf-ov__text';
          try {
            t.contentEditable = 'plaintext-only';
          } catch {
            t.contentEditable = 'true';
          }
          t.spellcheck = false;
          t.setAttribute('role', 'textbox');
          t.setAttribute('aria-multiline', 'true');
          t.setAttribute('aria-label', 'Added text');
          t.textContent = o.text;
          t.addEventListener('focus', () => select(o));
          t.addEventListener('input', () => {
            o.text = t.innerText.replace(/\n$/, '');
          });
          t.addEventListener('paste', (e) => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
          });
          el.append(grip, t);
        }
        const handle = document.createElement('span');
        handle.className = 'pdf-ov__resize';
        handle.title = o.kind === 'text' ? 'Drag to change the size' : 'Drag to resize';
        handle.addEventListener('pointerdown', (e) => startDrag(e, o, 'resize'));
        el.append(handle);
        styleOverlay(el, o);
        return el;
      }),
    );
  }

  const overlayEl = (o: Overlay) => layer.querySelector<HTMLElement>(`[data-id="${o.id}"]`);

  function select(o: Overlay | null) {
    ed.selected = o;
    for (const el of layer.children) el.classList.toggle('is-selected', o !== null && (el as HTMLElement).dataset.id === String(o.id));
    syncProps();
  }

  function syncProps() {
    const o = ed.selected;
    removeBtn.disabled = !o;
    cropBtn.disabled = o?.kind !== 'image';
    props.hidden = o?.kind === 'image' || o?.kind === 'rect';
    coverProps.hidden = o?.kind !== 'rect';
    if (o?.kind === 'rect') coverColor.value = o.color;
    const t = o?.kind === 'text' ? o : textStyle;
    propSize.value = String(Math.round(t.size * 10) / 10);
    propFont.value = t.font;
    propBold.setAttribute('aria-pressed', String(t.bold));
    propColor.value = t.color;
  }

  function updateText(change: Partial<Pick<TextOverlay, 'size' | 'color' | 'font' | 'bold'>>) {
    Object.assign(textStyle, change);
    const o = ed.selected;
    if (o?.kind !== 'text') return syncProps();
    Object.assign(o, change);
    const el = overlayEl(o);
    if (el) styleOverlay(el, o);
    syncProps();
  }

  propSize.addEventListener('input', () => {
    const v = parseFloat(propSize.value);
    if (v >= 4 && v <= 400) updateText({ size: v });
  });
  propFont.addEventListener('change', () => updateText({ font: propFont.value as FontKey }));
  propBold.addEventListener('click', () => updateText({ bold: propBold.getAttribute('aria-pressed') !== 'true' }));
  propColor.addEventListener('input', () => updateText({ color: propColor.value }));

  coverColor.addEventListener('input', () => {
    const o = ed.selected;
    if (o?.kind !== 'rect') return;
    o.color = coverColor.value;
    o.auto = false;
    const el = overlayEl(o);
    if (el) styleOverlay(el, o);
  });

  /*
    Sets a cover box to the page colour around it: samples a ring of pixels
    just outside the box on the rendered page and takes the most common
    colour, so text the box sits on doesn't tint it.
  */
  function matchCover(o: RectOverlay) {
    const el = overlayEl(o);
    const canvas = stage.querySelector<HTMLCanvasElement>('.pdf-stage__canvas');
    if (!el || !canvas || !canvas.width) return;
    const c = canvas.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const k = canvas.width / c.width;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const ring = 3;
    const left = (b.left - c.left - ring) * k;
    const top = (b.top - c.top - ring) * k;
    const right = (b.right - c.left + ring) * k;
    const bottom = (b.bottom - c.top + ring) * k;
    const points: [number, number][] = [];
    const step = 3 * k;
    for (let x = left; x <= right; x += step) points.push([x, top], [x, bottom]);
    for (let y = top; y <= bottom; y += step) points.push([left, y], [right, y]);
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const [r, g, bl, a] = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      if (a < 200) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (bl >> 4);
      const s = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      s.n++;
      s.r += r;
      s.g += g;
      s.b += bl;
      buckets.set(key, s);
    }
    let best: { n: number; r: number; g: number; b: number } | undefined;
    for (const s of buckets.values()) if (!best || s.n > best.n) best = s;
    if (!best) return;
    const hex = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, '0');
    o.color = `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
    styleOverlay(el, o);
    if (ed.selected === o) coverColor.value = o.color;
  }

  /** Pointer position on the stage, as a point in the overlay's own orientation */
  function pointIn(o: Overlay, e: PointerEvent): [number, number] {
    const p = ed.page!;
    const rect = stage.getBoundingClientRect();
    const [X, Y] = toUser(rotationOf(p), p.W, p.H, (e.clientX - rect.left) / ed.scale, (e.clientY - rect.top) / ed.scale);
    return fromUser(o.r0, p.W, p.H, X, Y);
  }

  function startDrag(e: PointerEvent, o: Overlay, mode: 'move' | 'resize') {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    select(o);
    const el = overlayEl(o)!;
    if (o.kind === 'image') el.focus({ preventScroll: true });
    const [sx, sy] = pointIn(o, e);
    const start = { ...o };
    const startW = el.offsetWidth / ed.scale;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const [x, y] = pointIn(o, ev);
      const dx = x - sx;
      const dy = y - sy;
      if (mode === 'move') {
        o.x = start.x + dx;
        o.y = start.y + dy;
      } else if (o.kind === 'rect' && start.kind === 'rect') {
        o.w = Math.max(2, start.w + dx);
        o.h = Math.max(2, start.h + dy);
      } else if (o.kind === 'image' && start.kind === 'image') {
        o.w = Math.max(8, start.w + dx);
        o.h = (o.w * start.h) / start.w;
      } else if (o.kind === 'text' && start.kind === 'text') {
        o.size = Math.min(400, Math.max(4, start.size * ((startW + dx) / Math.max(startW, 10))));
        textStyle.size = o.size;
        syncProps();
      }
      styleOverlay(el, o);
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      if (o.kind === 'rect' && o.auto) matchCover(o);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function addOverlay(o: Overlay) {
    ed.page!.overlays.push(o);
    ed.selected = o;
    renderLayer();
    syncProps();
    const el = overlayEl(o)!;
    if (o.kind === 'text') {
      const t = el.querySelector<HTMLElement>('.pdf-ov__text')!;
      t.focus();
      getSelection()?.selectAllChildren(t);
    } else {
      el.focus();
    }
  }

  function centred(w: number, h: number) {
    const p = ed.page!;
    const r = rotationOf(p);
    const [dw, dh] = displaySize(p, r);
    // Start in view: centred horizontally, near the visible top of the page
    const rect = stage.getBoundingClientRect();
    const wrapRect = stageWrap.getBoundingClientRect();
    const visibleTop = Math.max(0, (wrapRect.top - rect.top) / ed.scale);
    const y = Math.min(dh - h, visibleTop + Math.min(dh, wrapRect.height / ed.scale) / 3);
    return { r0: r, x: (dw - w) / 2, y: Math.max(0, y) };
  }

  function removeSelected() {
    const p = ed.page;
    const o = ed.selected;
    if (!p || !o) return;
    p.overlays = p.overlays.filter((ov) => ov !== o);
    select(null);
    renderLayer();
  }

  editor.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ed]');
    if (!btn || !ed.page) return;
    const i = pages.indexOf(ed.page);
    switch (btn.dataset.ed) {
      case 'text':
        addOverlay({ id: nextId++, kind: 'text', text: 'Text', ...textStyle, ...centred(60, textStyle.size * LINE) });
        break;
      case 'image':
        imageInput.click();
        break;
      case 'sign':
        openSignPad();
        break;
      case 'cover': {
        const o: RectOverlay = { id: nextId++, kind: 'rect', ...centred(140, 22), w: 140, h: 22, color: '#ffffff', auto: true };
        addOverlay(o);
        matchCover(o);
        break;
      }
      case 'match':
        if (ed.selected?.kind === 'rect') {
          ed.selected.auto = true;
          matchCover(ed.selected);
        }
        break;
      case 'remove':
        removeSelected();
        break;
      case 'crop':
        if (ed.selected?.kind === 'image') openCrop(ed.selected);
        break;
      case 'prev':
        if (i > 0) openEditor(pages[i - 1]);
        break;
      case 'next':
        if (i < pages.length - 1) openEditor(pages[i + 1]);
        break;
      case 'done':
        editor.close();
        break;
    }
  });

  // Click on the page itself clears the selection
  stage.addEventListener('pointerdown', (e) => {
    if (e.target === stage || (e.target as HTMLElement).classList.contains('pdf-stage__canvas') || e.target === layer) {
      (document.activeElement as HTMLElement | null)?.blur?.();
      select(null);
    }
  });

  editor.addEventListener('keydown', (e) => {
    const o = ed.selected;
    if (!o) return;
    const typing = (e.target as HTMLElement).isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target as HTMLElement).tagName);
    if (typing) return;
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    } else if (moves[e.key]) {
      e.preventDefault();
      // Arrow keys move in screen directions, whatever the overlay's orientation
      const p = ed.page!;
      const r = rotationOf(p);
      const { x, y } = placeOverlay(p, o);
      const [X, Y] = toUser(r, p.W, p.H, x + moves[e.key][0], y + moves[e.key][1]);
      [o.x, o.y] = fromUser(o.r0, p.W, p.H, X, Y);
      styleOverlay(overlayEl(o)!, o);
    }
  });

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file || !ed.page) return;
    try {
      const image = await readImage(file);
      const p = ed.page;
      const [dw] = displaySize(p, rotationOf(p));
      // 96 dpi → points, but never wider than 40% of the page
      const w = Math.min(dw * 0.4, image.w * 0.75);
      const h = (w * image.h) / image.w;
      addOverlay({ id: nextId++, kind: 'image', ...centred(w, h), w, h, bytes: image.bytes, format: image.format, img: image.img });
    } catch (err) {
      say(`Couldn’t add that image: ${errorText(err)}`);
    }
  });

  // ---------- Image crop ----------

  /*
    The crop window shows the uncropped image with a box over it. The box is
    kept in the original image's pixels; the screen only scales it. Applying
    re-encodes just that region (original kept for later), and moves the
    overlay so the part you kept stays where it was on the page.
  */
  const cropDialog = document.querySelector<HTMLDialogElement>('[data-crop]')!;
  const cropFrame = $<HTMLElement>('[data-crop-frame]', cropDialog);
  const cropImg = $<HTMLImageElement>('[data-crop-img]', cropDialog);
  const cropBox = $<HTMLElement>('[data-crop-box]', cropDialog);
  const cropSize = $<HTMLElement>('[data-crop-size]', cropDialog);
  const MIN_CROP = 16;
  const crop: { o: ImageOverlay | null; src: HTMLImageElement | null; rect: CropRect; ratio: number | null } = {
    o: null,
    src: null,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    ratio: null,
  };

  const cropScale = () => (crop.src ? cropImg.getBoundingClientRect().width / crop.src.naturalWidth : 1);

  function drawCropBox() {
    const s = cropScale();
    const { x, y, w, h } = crop.rect;
    cropBox.style.left = `${x * s}px`;
    cropBox.style.top = `${y * s}px`;
    cropBox.style.width = `${w * s}px`;
    cropBox.style.height = `${h * s}px`;
    cropSize.textContent = `${Math.round(w)} × ${Math.round(h)} px`;
    cropDialog.querySelectorAll<HTMLElement>('.pdf-crop__handle--edge').forEach((el) => (el.hidden = crop.ratio !== null));
  }

  /** Largest rect of the chosen ratio inside the current one, same centre */
  function applyRatio(r: number | null) {
    crop.ratio = r;
    cropDialog.querySelectorAll<HTMLElement>('[data-ratio]').forEach((b) => {
      const v = b.dataset.ratio!;
      const br = v === 'free' ? null : v === 'original' ? crop.src!.naturalWidth / crop.src!.naturalHeight : Number(v);
      b.setAttribute('aria-pressed', String(br === r || (v === 'free' && r === null)));
    });
    if (r) {
      const { x, y, w, h } = crop.rect;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const nw = w / h > r ? h * r : w;
      const nh = nw / r;
      crop.rect = { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    }
    drawCropBox();
  }

  function openCrop(o: ImageOverlay) {
    crop.o = o;
    crop.src = o.original?.img ?? o.img;
    crop.rect = o.crop ? { ...o.crop } : { x: 0, y: 0, w: crop.src.naturalWidth, h: crop.src.naturalHeight };
    crop.ratio = null;
    cropImg.src = crop.src.src;
    cropDialog.showModal();
    // The image has to be loaded and laid out before the box can be scaled to it
    cropImg
      .decode()
      .catch(() => {})
      .then(() => requestAnimationFrame(() => applyRatio(null)));
  }

  function startCropDrag(e: PointerEvent, handle: string) {
    if (e.button !== 0 || !crop.src) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const W = crop.src.naturalWidth;
    const H = crop.src.naturalHeight;
    const s = cropScale();
    const start = { ...crop.rect };
    const sx = e.clientX;
    const sy = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      if (handle === 'move') {
        crop.rect.x = Math.min(Math.max(0, start.x + dx), W - start.w);
        crop.rect.y = Math.min(Math.max(0, start.y + dy), H - start.h);
      } else {
        let L = start.x;
        let T = start.y;
        let R = start.x + start.w;
        let B = start.y + start.h;
        if (handle.includes('w')) L = Math.min(Math.max(0, L + dx), R - MIN_CROP);
        if (handle.includes('e')) R = Math.max(Math.min(W, R + dx), L + MIN_CROP);
        if (handle.includes('n')) T = Math.min(Math.max(0, T + dy), B - MIN_CROP);
        if (handle.includes('s')) B = Math.max(Math.min(H, B + dy), T + MIN_CROP);
        if (crop.ratio) {
          // Width leads; height follows the ratio, then both shrink to fit the image
          let w = R - L;
          let h = w / crop.ratio;
          const roomH = handle.includes('n') ? B : H - T;
          if (h > roomH) {
            h = roomH;
            w = h * crop.ratio;
          }
          if (handle.includes('w')) L = R - w;
          else R = L + w;
          if (handle.includes('n')) T = B - h;
          else B = T + h;
        }
        crop.rect = { x: L, y: T, w: R - L, h: B - T };
      }
      drawCropBox();
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  cropBox.addEventListener('pointerdown', (e) => startCropDrag(e, 'move'));
  cropDialog.querySelectorAll<HTMLElement>('[data-h]').forEach((h) => h.addEventListener('pointerdown', (e) => startCropDrag(e, h.dataset.h!)));

  // Arrow keys move the box; with Shift they resize it (from the bottom-right)
  cropBox.addEventListener('keydown', (e) => {
    if (!crop.src || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const W = crop.src.naturalWidth;
    const H = crop.src.naturalHeight;
    const step = Math.max(1, 4 / cropScale());
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    const r = crop.rect;
    if (e.shiftKey) {
      r.w = Math.min(Math.max(MIN_CROP, r.w + dx), W - r.x);
      r.h = crop.ratio ? r.w / crop.ratio : Math.min(Math.max(MIN_CROP, r.h + dy), H - r.y);
      if (r.y + r.h > H) {
        r.h = H - r.y;
        if (crop.ratio) r.w = r.h * crop.ratio;
      }
    } else {
      r.x = Math.min(Math.max(0, r.x + dx), W - r.w);
      r.y = Math.min(Math.max(0, r.y + dy), H - r.h);
    }
    drawCropBox();
  });

  async function applyCrop() {
    const o = crop.o;
    const src = crop.src;
    if (!o || !src) return;
    const W = src.naturalWidth;
    const H = src.naturalHeight;
    const r = {
      x: Math.round(crop.rect.x),
      y: Math.round(crop.rect.y),
      w: Math.max(1, Math.round(crop.rect.w)),
      h: Math.max(1, Math.round(crop.rect.h)),
    };
    const prev = o.crop ?? { x: 0, y: 0, w: W, h: H };
    const full = r.x === 0 && r.y === 0 && r.w === W && r.h === H;
    o.original ??= { bytes: o.bytes, format: o.format, img: o.img };
    const old = o.img;

    if (full) {
      // Back to the whole image: no re-encode
      o.bytes = o.original.bytes;
      o.format = o.original.format;
      o.img = o.original.img;
      o.crop = undefined;
    } else {
      const c = document.createElement('canvas');
      c.width = r.w;
      c.height = r.h;
      c.getContext('2d')!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const format = o.original.format;
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
      if (!blob) return say('Couldn’t crop that image.');
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
      o.bytes = new Uint8Array(await blob.arrayBuffer());
      o.format = format;
      o.img = img;
      o.crop = r;
    }
    if (old !== o.img && old !== o.original.img) URL.revokeObjectURL(old.src);

    // Same size per pixel as before, and what you kept stays put on the page
    const k = o.w / prev.w;
    o.x += (r.x - prev.x) * k;
    o.y += (r.y - prev.y) * k;
    o.w = r.w * k;
    o.h = r.h * k;
    cropDialog.close();
    renderLayer();
    select(o);
    overlayEl(o)?.focus({ preventScroll: true });
  }

  cropDialog.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cr], [data-ratio]');
    if (!btn || !crop.src) return;
    if (btn.dataset.ratio) {
      const v = btn.dataset.ratio;
      applyRatio(v === 'free' ? null : v === 'original' ? crop.src.naturalWidth / crop.src.naturalHeight : Number(v));
      return;
    }
    switch (btn.dataset.cr) {
      case 'reset':
        crop.rect = { x: 0, y: 0, w: crop.src.naturalWidth, h: crop.src.naturalHeight };
        applyRatio(null);
        break;
      case 'cancel':
        cropDialog.close();
        break;
      case 'apply':
        applyCrop();
        break;
    }
  });

  window.addEventListener('resize', () => cropDialog.open && drawCropBox());

  // ---------- Signature pad ----------

  let inkColor = '#141918';

  function openSignPad() {
    signDialog.showModal();
    const rect = signPad.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    signPad.width = Math.round(rect.width * dpr);
    signPad.height = Math.round(rect.height * dpr);
    const ctx = signPad.getContext('2d')!;
    ctx.clearRect(0, 0, signPad.width, signPad.height);
  }

  signPad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    signPad.setPointerCapture(e.pointerId);
    const ctx = signPad.getContext('2d')!;
    const k = signPad.width / signPad.getBoundingClientRect().width;
    const rect = signPad.getBoundingClientRect();
    const pt = (ev: PointerEvent) => [(ev.clientX - rect.left) * k, (ev.clientY - rect.top) * k] as const;
    ctx.strokeStyle = inkColor;
    ctx.fillStyle = inkColor;
    ctx.lineWidth = 2.6 * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let [lx, ly] = pt(e);
    let [mx, my] = [lx, ly];
    ctx.beginPath();
    ctx.arc(lx, ly, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    const onMove = (ev: PointerEvent) => {
      for (const c of ev.getCoalescedEvents?.() ?? [ev]) {
        const [x, y] = pt(c);
        // Smooth through midpoints
        const nx = (lx + x) / 2;
        const ny = (ly + y) / 2;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.quadraticCurveTo(lx, ly, nx, ny);
        ctx.stroke();
        [mx, my, lx, ly] = [nx, ny, x, y];
      }
    };
    const onUp = () => {
      signPad.removeEventListener('pointermove', onMove);
      signPad.removeEventListener('pointerup', onUp);
      signPad.removeEventListener('pointercancel', onUp);
    };
    signPad.addEventListener('pointermove', onMove);
    signPad.addEventListener('pointerup', onUp);
    signPad.addEventListener('pointercancel', onUp);
  });

  signDialog.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sg]');
    if (!btn) return;
    switch (btn.dataset.sg) {
      case 'clear':
        signPad.getContext('2d')!.clearRect(0, 0, signPad.width, signPad.height);
        break;
      case 'ink':
        inkColor = btn.dataset.color!;
        signDialog.querySelectorAll('[data-sg="ink"]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        break;
      case 'cancel':
        signDialog.close();
        break;
      case 'use': {
        const trimmed = trimCanvas(signPad);
        if (!trimmed) {
          signDialog.close();
          break;
        }
        const blob = await new Promise<Blob | null>((resolve) => trimmed.toBlob(resolve, 'image/png'));
        signDialog.close();
        if (!blob || !ed.page) break;
        const image = await readImage(blob);
        const p = ed.page;
        const [dw] = displaySize(p, rotationOf(p));
        const w = Math.min(dw * 0.3, image.w * 0.5);
        const h = (w * image.h) / image.w;
        addOverlay({ id: nextId++, kind: 'image', ...centred(w, h), w, h, bytes: image.bytes, format: 'png', img: image.img });
        break;
      }
    }
  });

  render();
}
