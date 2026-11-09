/*
  PDF compression in the browser, shared by PDF Studio and the PDF
  Compressor page.

  'balanced' / 'strong' keep the PDF as it is (text stays selectable) and
  re-encode the photos inside it as smaller JPEGs:
    - JPEG images (DCTDecode) and 8-bit RGB / grey Flate images, including
      PNG-predicted ones, are decoded, scaled down to a longest edge and
      re-encoded; an image is only replaced when the new one is smaller
    - CMYK, indexed, 16-bit, masks, JPEG 2000 and fax images are left alone
    - the file is re-saved with object streams, which also drops unused
      objects
  'flatten' turns every page into one JPEG (PDF.js render). Smallest for
  scans, but text is no longer selectable and links stop working.
*/

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFObject } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type CompressLevel = 'balanced' | 'strong' | 'flatten';

const LEVELS = {
  balanced: { edge: 2000, quality: 0.72 },
  strong: { edge: 1300, quality: 0.55 },
  flatten: { dpi: 120, quality: 0.6 },
} as const;

export interface CompressResult {
  bytes: Uint8Array;
  images: number;
  recompressed: number;
}

// ---------- Decoding image streams ----------

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Undo PNG row predictors (Predictor ≥ 10) */
function unpredict(data: Uint8Array, colors: number, width: number): Uint8Array {
  const bpp = colors;
  const rowLen = colors * width;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let y = 0; y < rows; y++) {
    const type = data[y * (rowLen + 1)];
    const src = y * (rowLen + 1) + 1;
    const dst = y * rowLen;
    const prev = dst - rowLen;
    for (let x = 0; x < rowLen; x++) {
      const raw = data[src + x];
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;
      let v = raw;
      if (type === 1) v = raw + a;
      else if (type === 2) v = raw + b;
      else if (type === 3) v = raw + ((a + b) >> 1);
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[dst + x] = v & 255;
    }
  }
  return out;
}

/** 1 = grey, 3 = RGB, 0 = something we leave alone */
function channels(cs: PDFObject | undefined, lookup: (o: PDFObject | undefined) => PDFObject | undefined): number {
  const v = lookup(cs);
  if (v instanceof PDFName) {
    if (v === PDFName.of('DeviceRGB') || v === PDFName.of('CalRGB')) return 3;
    if (v === PDFName.of('DeviceGray') || v === PDFName.of('CalGray')) return 1;
    return 0;
  }
  if (v instanceof PDFArray && v.size() >= 2) {
    const kind = v.lookup(0);
    if (kind === PDFName.of('ICCBased')) {
      const icc = lookup(v.get(1));
      const n = icc instanceof PDFRawStream ? icc.dict.lookup(PDFName.of('N')) : undefined;
      const count = n instanceof PDFNumber ? n.asNumber() : 0;
      return count === 3 || count === 1 ? count : 0;
    }
    if (kind === PDFName.of('CalRGB')) return 3;
    if (kind === PDFName.of('CalGray')) return 1;
  }
  return 0;
}

const filterNames = (f: PDFObject | undefined): string[] =>
  f instanceof PDFName ? [f.asString()] : f instanceof PDFArray ? f.asArray().map((x) => (x instanceof PDFName ? x.asString() : '?')) : [];

/** Decodes an image stream into something a canvas can draw, or null if we don't handle it */
async function decodeImage(stream: PDFRawStream, lookup: (o: PDFObject | undefined) => PDFObject | undefined) {
  const d = stream.dict;
  if (d.lookup(PDFName.of('ImageMask')) || d.lookup(PDFName.of('Decode'))) return null;
  const filters = filterNames(d.lookup(PDFName.of('Filter')));
  const n = channels(d.get(PDFName.of('ColorSpace')), lookup);
  const width = (d.lookup(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const height = (d.lookup(PDFName.of('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
  if (!n || !width || !height) return null;

  if (filters.length === 1 && filters[0] === '/DCTDecode') {
    const bmp = await createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }));
    return { source: bmp as CanvasImageSource, width: bmp.width, height: bmp.height, grey: n === 1, close: () => bmp.close() };
  }

  if (filters.length === 1 && filters[0] === '/FlateDecode') {
    const bpc = (d.lookup(PDFName.of('BitsPerComponent')) as PDFNumber | undefined)?.asNumber();
    if (bpc !== 8) return null;
    let raw = await inflate(stream.contents);
    const parms = d.lookup(PDFName.of('DecodeParms'));
    if (parms instanceof PDFDict) {
      const predictor = (parms.lookup(PDFName.of('Predictor')) as PDFNumber | undefined)?.asNumber() ?? 1;
      if (predictor >= 10) raw = unpredict(raw, n, width);
      else if (predictor !== 1) return null;
    }
    if (raw.length < width * height * n) return null;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < width * height; i++, j += n) {
      rgba[i * 4] = raw[j];
      rgba[i * 4 + 1] = n === 3 ? raw[j + 1] : raw[j];
      rgba[i * 4 + 2] = n === 3 ? raw[j + 2] : raw[j];
      rgba[i * 4 + 3] = 255;
    }
    const bmp = await createImageBitmap(new ImageData(rgba, width, height));
    return { source: bmp as CanvasImageSource, width, height, grey: n === 1, close: () => bmp.close() };
  }
  return null;
}

function toJpeg(source: CanvasImageSource, w: number, h: number, quality: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise<Uint8Array>((resolve, reject) =>
    c.toBlob(async (b) => {
      c.width = c.height = 0;
      if (!b) return reject(new Error('Could not encode an image.'));
      resolve(new Uint8Array(await b.arrayBuffer()));
    }, 'image/jpeg', quality),
  );
}

// ---------- Levels ----------

async function recompressImages(bytes: Uint8Array, level: 'balanced' | 'strong', onProgress?: (done: number, total: number) => void) {
  const { edge, quality } = LEVELS[level];
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const lookup = (o: PDFObject | undefined) => (o instanceof PDFRef ? ctx.lookup(o) : o);
  const images = ctx
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')) as [
    PDFRef,
    PDFRawStream,
  ][];

  let recompressed = 0;
  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length);
    const [ref, stream] = images[i];
    let decoded;
    try {
      decoded = await decodeImage(stream, lookup);
    } catch {
      decoded = null;
    }
    if (!decoded) continue;
    try {
      const k = Math.min(1, edge / Math.max(decoded.width, decoded.height));
      const w = Math.max(1, Math.round(decoded.width * k));
      const h = Math.max(1, Math.round(decoded.height * k));
      const jpg = await toJpeg(decoded.source, w, h, quality);
      if (jpg.length >= stream.contents.length * 0.95) continue;
      const dict = stream.dict.clone(ctx);
      dict.set(PDFName.of('Width'), PDFNumber.of(w));
      dict.set(PDFName.of('Height'), PDFNumber.of(h));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      dict.delete(PDFName.of('DecodeParms'));
      dict.set(PDFName.of('Length'), PDFNumber.of(jpg.length));
      ctx.assign(ref, PDFRawStream.of(dict, jpg));
      recompressed++;
    } finally {
      decoded.close();
    }
  }
  onProgress?.(images.length, images.length);
  return { bytes: await doc.save({ useObjectStreams: true }), images: images.length, recompressed };
}

async function flattenPages(bytes: Uint8Array, onProgress?: (done: number, total: number) => void) {
  const { dpi, quality } = LEVELS.flatten;
  const src = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      onProgress?.(i - 1, src.numPages);
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 }); // points, rotation applied
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const c2d = canvas.getContext('2d')!;
      c2d.fillStyle = '#fff';
      c2d.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
      const jpg = await toJpeg(canvas, canvas.width, canvas.height, quality);
      const image = await out.embedJpg(jpg);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
    }
  } finally {
    await src.loadingTask.destroy();
  }
  onProgress?.(1, 1);
  return { bytes: await out.save(), images: 0, recompressed: 0 };
}

export async function compressPdf(
  bytes: Uint8Array,
  level: CompressLevel,
  onProgress?: (done: number, total: number) => void,
): Promise<CompressResult> {
  const result = level === 'flatten' ? await flattenPages(bytes, onProgress) : await recompressImages(bytes, level, onProgress);
  // Never hand back a bigger file
  return result.bytes.length < bytes.length ? result : { ...result, bytes };
}
