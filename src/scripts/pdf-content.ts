/*
  Page content engine for PDF Studio: reads a page's content stream (the
  drawing instructions), finds where each piece of text and each image is
  drawn, and rewrites the stream to really remove or move them.

  Why not just cover things up: a white box over old text leaves the text in
  the file (copyable, searchable, readable by anyone). Here the instructions
  that drew it are taken out.

    - Text: each text-showing operator (Tj, TJ, ', ") is located in page
      space by following the graphics and text state (cm, q/Q, BT, Tm, Td,
      Tf, Tc, Tw, Tz, TL, Ts) and the font's glyph widths. Removing one is
      done by swapping it for an empty TJ that advances the same distance,
      so any text drawn after it on the same line stays where it was.
    - Images: XObject images (Do) and inline images (BI…EI) are located from
      the CTM. Deleting drops the operator; moving wraps it in q … cm … Q with
      a matrix that maps the old box onto the new one (or redraws it at the
      end of the page when a clipping path would cut it off).

  Out of scope, handled by the caller with a cover box: text drawn inside
  form XObjects, rotated or vertical text, and Type 3 / unusual CMaps where
  widths can't be trusted (we still try, then verify by position).
*/

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  StandardFontEmbedder,
  StandardFonts,
  decodePDFRawStream,
  type PDFObject,
} from 'pdf-lib';

// ---------- Types ----------

/** Affine matrix [a b c d e f], PDF row-vector convention */
export type Matrix = [number, number, number, number, number, number];

class Name {
  constructor(public v: string) {}
}
class Str {
  /** Raw bytes as a latin-1 string (one char per byte) */
  constructor(public v: string) {}
}
type Val = number | boolean | null | Name | Str | Val[] | { [k: string]: Val };

interface Op {
  op: string;
  args: Val[];
  /** Byte range in the joined, decoded content, operands included */
  start: number;
  end: number;
}

/** A text-showing operator, located in page space */
export interface TextRun {
  op: number;
  /** Baseline start and end, page space */
  x1: number;
  x2: number;
  y: number;
  /** Font size in page space */
  size: number;
  /** False for rotated / skewed / vertical text, which we never touch */
  upright: boolean;
  /** Draws at least one non-space glyph (pure spacing like [-500] TJ doesn't) */
  ink: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageEl {
  op: number;
  /** Bounding box in page space (y up) */
  box: Box;
  /** Inside a clipping path: moving it in place could cut it off */
  clipped: boolean;
}

export interface PageContent {
  texts: TextRun[];
  images: ImageEl[];
  /** Text is (also) drawn inside form XObjects, which we can't edit */
  formText: boolean;
}

/** A line of existing text to remove: baseline span plus the box it occupies */
export interface EraseBox {
  x1: number;
  x2: number;
  y: number;
  size: number;
  /** Cover box used when the text can't be removed (top/bottom in page space) */
  top: number;
  bottom: number;
  bg: [number, number, number];
}

export type ImageEdit = { action: 'delete' } | { action: 'move'; to: Box };

export interface PageEdits {
  erase: EraseBox[];
  images: Map<number, ImageEdit>;
}

// ---------- Matrices ----------

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** A then B */
export function mul(A: Matrix, B: Matrix): Matrix {
  return [
    A[0] * B[0] + A[1] * B[2],
    A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2],
    A[2] * B[1] + A[3] * B[3],
    A[4] * B[0] + A[5] * B[2] + B[4],
    A[4] * B[1] + A[5] * B[3] + B[5],
  ];
}

export function inv(M: Matrix): Matrix {
  const [a, b, c, d, e, f] = M;
  const det = a * d - b * c || 1e-12;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

const apply = (M: Matrix, x: number, y: number): [number, number] => [x * M[0] + y * M[2] + M[4], x * M[1] + y * M[3] + M[5]];

function boundsOf(M: Matrix): Box {
  const pts = [apply(M, 0, 0), apply(M, 1, 0), apply(M, 0, 1), apply(M, 1, 1)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

// ---------- Tokenizer ----------

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

/**
 * Parses a content stream into operators with their operands and byte ranges.
 * Tolerant: unknown or broken syntax is skipped rather than thrown.
 */
function parseOps(buf: Uint8Array): Op[] {
  const n = buf.length;
  let i = 0;
  const ops: Op[] = [];
  let operands: Val[] = [];
  let opStart = -1;

  const skipWs = () => {
    while (i < n) {
      const c = buf[i];
      if (WS.has(c)) i++;
      else if (c === 37) {
        // % comment to end of line
        while (i < n && buf[i] !== 10 && buf[i] !== 13) i++;
      } else break;
    }
  };

  const readLiteral = (): Str => {
    // at '('
    i++;
    let depth = 1;
    let out = '';
    while (i < n) {
      const c = buf[i++];
      if (c === 92) {
        // backslash escape
        const e = buf[i++];
        if (e === undefined) break;
        const map: Record<number, string> = { 110: '\n', 114: '\r', 116: '\t', 98: '\b', 102: '\f', 40: '(', 41: ')', 92: '\\' };
        if (map[e] !== undefined) out += map[e];
        else if (e >= 48 && e <= 55) {
          let oct = String.fromCharCode(e);
          for (let k = 0; k < 2 && buf[i] >= 48 && buf[i] <= 55; k++) oct += String.fromCharCode(buf[i++]);
          out += String.fromCharCode(parseInt(oct, 8) & 255);
        } else if (e === 13) {
          if (buf[i] === 10) i++;
        } else if (e !== 10) out += String.fromCharCode(e);
      } else if (c === 40) {
        depth++;
        out += '(';
      } else if (c === 41) {
        if (--depth === 0) break;
        out += ')';
      } else out += String.fromCharCode(c);
    }
    return new Str(out);
  };

  const readHex = (): Str => {
    // at '<'
    i++;
    let hex = '';
    while (i < n && buf[i] !== 62) {
      const c = buf[i++];
      if (!WS.has(c)) hex += String.fromCharCode(c);
    }
    i++;
    if (hex.length % 2) hex += '0';
    let out = '';
    for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16) || 0);
    return new Str(out);
  };

  const readName = (): Name => {
    i++;
    let s = '';
    while (i < n && !WS.has(buf[i]) && !DELIM.has(buf[i])) {
      if (buf[i] === 35 && i + 2 < n) {
        s += String.fromCharCode(parseInt(String.fromCharCode(buf[i + 1], buf[i + 2]), 16) || 0);
        i += 3;
      } else s += String.fromCharCode(buf[i++]);
    }
    return new Name(s);
  };

  const readWord = (): string => {
    let s = '';
    while (i < n && !WS.has(buf[i]) && !DELIM.has(buf[i])) s += String.fromCharCode(buf[i++]);
    return s;
  };

  /** Reads one value, or returns an operator keyword as a string */
  const readValue = (): Val | { kw: string } | undefined => {
    skipWs();
    if (i >= n) return undefined;
    const c = buf[i];
    if (c === 40) return readLiteral();
    if (c === 60) {
      if (buf[i + 1] === 60) {
        i += 2;
        const dict: { [k: string]: Val } = {};
        for (;;) {
          skipWs();
          if (i >= n) break;
          if (buf[i] === 62 && buf[i + 1] === 62) {
            i += 2;
            break;
          }
          const k = readValue();
          if (!(k instanceof Name)) {
            if (k === undefined) break;
            continue;
          }
          const v = readValue();
          if (v && typeof v === 'object' && 'kw' in v) continue;
          dict[k.v] = v as Val;
        }
        return dict;
      }
      return readHex();
    }
    if (c === 47) return readName();
    if (c === 91) {
      i++;
      const arr: Val[] = [];
      for (;;) {
        skipWs();
        if (i >= n) break;
        if (buf[i] === 93) {
          i++;
          break;
        }
        const v = readValue();
        if (v === undefined) break;
        if (v && typeof v === 'object' && 'kw' in v) continue;
        arr.push(v as Val);
      }
      return arr;
    }
    if (c === 93 || c === 41 || c === 62 || c === 123 || c === 125) {
      i++; // stray delimiter
      return { kw: '' };
    }
    const w = readWord();
    if (!w) {
      i++;
      return { kw: '' };
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return parseFloat(w);
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    return { kw: w };
  };

  while (i < n) {
    skipWs();
    if (i >= n) break;
    const at = i;
    const v = readValue();
    if (v === undefined) break;
    if (v && typeof v === 'object' && 'kw' in v) {
      if (!v.kw) continue;
      if (v.kw === 'BI') {
        // Inline image: key/value pairs, ID, raw data, EI
        const start = opStart >= 0 ? opStart : at;
        const dict: { [k: string]: Val } = {};
        for (;;) {
          skipWs();
          if (i >= n) break;
          const save = i;
          const k = readValue();
          if (k && typeof k === 'object' && 'kw' in k && k.kw === 'ID') break;
          if (!(k instanceof Name)) {
            if (i === save) i++;
            continue;
          }
          const val = readValue();
          if (!(val && typeof val === 'object' && 'kw' in val)) dict[k.v] = val as Val;
        }
        i++; // single whitespace after ID
        const len = typeof dict.L === 'number' ? dict.L : typeof dict.Length === 'number' ? dict.Length : -1;
        let j = len >= 0 ? i + len : i;
        // EI must be preceded and followed by whitespace (or end of data)
        for (; j < n - 1; j++) {
          if (buf[j] === 69 && buf[j + 1] === 73 && (j === 0 || WS.has(buf[j - 1])) && (j + 2 >= n || WS.has(buf[j + 2]) || DELIM.has(buf[j + 2]))) break;
        }
        i = Math.min(n, j + 2);
        ops.push({ op: 'BI', args: [dict], start, end: i });
      } else {
        ops.push({ op: v.kw, args: operands, start: opStart >= 0 ? opStart : at, end: i });
      }
      operands = [];
      opStart = -1;
    } else {
      if (opStart < 0) opStart = at;
      operands.push(v as Val);
    }
  }
  return ops;
}

// ---------- Fonts ----------

interface FontInfo {
  /** Bytes per character code */
  bytes: 1 | 2;
  /** Glyph advance for a code, in text-space units per 1 unit of font size */
  width: (code: number) => number;
}

const STANDARD = new Set<string>(Object.values(StandardFonts));

/** cp1252 code points 128–159 */
const CP1252: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020, 135: 0x2021, 136: 0x02c6, 137: 0x2030,
  138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018, 146: 0x2019, 147: 0x201c, 148: 0x201d, 149: 0x2022,
  150: 0x2013, 151: 0x2014, 152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153, 158: 0x017e, 159: 0x0178,
};

function standardFor(base: string): string | null {
  const name = base.replace(/^[A-Z]{6}\+/, '');
  if (STANDARD.has(name)) return name;
  const bold = /bold|black|heavy/i.test(name);
  const italic = /italic|oblique/i.test(name);
  const family = /courier|mono/i.test(name) ? 'Courier' : /times|serif|georgia|garamond/i.test(name) && !/sans/i.test(name) ? 'Times' : /arial|helvetica|sans/i.test(name) ? 'Helvetica' : null;
  if (!family) return null;
  if (family === 'Times') return `Times-${bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Roman'}`;
  return `${family}${bold || italic ? '-' : ''}${bold ? 'Bold' : ''}${italic ? 'Oblique' : ''}`;
}

function makeFontInfo(doc: PDFDocument, dict: PDFDict | undefined): FontInfo {
  const fallback: FontInfo = { bytes: 1, width: () => 0.5 };
  if (!dict) return fallback;
  const get = (d: PDFDict, k: string) => doc.context.lookup(d.get(PDFName.of(k)));
  const num = (o: PDFObject | undefined, dflt = 0) => (o instanceof PDFNumber ? o.asNumber() : dflt);
  const subtype = (get(dict, 'Subtype') as PDFName | undefined)?.decodeText?.() ?? '';

  if (subtype === 'Type0') {
    const arr = get(dict, 'DescendantFonts');
    const desc = arr instanceof PDFArray ? (doc.context.lookup(arr.get(0)) as PDFDict | undefined) : undefined;
    const dw = desc ? num(get(desc, 'DW'), 1000) : 1000;
    const widths = new Map<number, number>();
    const W = desc ? get(desc, 'W') : undefined;
    if (W instanceof PDFArray) {
      const items = W.asArray().map((o) => doc.context.lookup(o));
      for (let k = 0; k < items.length; ) {
        const first = num(items[k]);
        const next = items[k + 1];
        if (next instanceof PDFArray) {
          next.asArray().forEach((w, j) => widths.set(first + j, num(doc.context.lookup(w))));
          k += 2;
        } else {
          const last = num(next);
          const w = num(items[k + 2]);
          for (let c = first; c <= last && c - first < 65536; c++) widths.set(c, w);
          k += 3;
        }
      }
    }
    return { bytes: 2, width: (code) => (widths.get(code) ?? dw) / 1000 };
  }

  const first = num(get(dict, 'FirstChar'));
  const W = get(dict, 'Widths');
  const list = W instanceof PDFArray ? W.asArray().map((o) => num(doc.context.lookup(o))) : null;
  const fd = get(dict, 'FontDescriptor');
  const missing = fd instanceof PDFDict ? num(get(fd, 'MissingWidth')) : 0;
  let k = 1 / 1000;
  if (subtype === 'Type3') {
    const fm = get(dict, 'FontMatrix');
    k = fm instanceof PDFArray ? num(doc.context.lookup(fm.get(0)), 0.001) : 0.001;
  }
  if (list) return { bytes: 1, width: (code) => (list[code - first] ?? missing) * k };

  // No /Widths: one of the standard 14 fonts (pdf-lib writes these too)
  const base = (get(dict, 'BaseFont') as PDFName | undefined)?.decodeText?.() ?? '';
  const std = standardFor(base);
  if (std && std !== 'Symbol' && std !== 'ZapfDingbats') {
    try {
      const emb = StandardFontEmbedder.for(std as StandardFonts);
      const cache = new Map<number, number>();
      return {
        bytes: 1,
        width: (code) => {
          let w = cache.get(code);
          if (w === undefined) {
            try {
              w = emb.widthOfTextAtSize(String.fromCodePoint(CP1252[code] ?? code), 1);
            } catch {
              w = 0.5;
            }
            cache.set(code, w);
          }
          return w;
        },
      };
    } catch {}
  }
  return fallback;
}

// ---------- Reading a page ----------

function pageBytes(doc: PDFDocument, index: number): Uint8Array {
  const node = doc.getPage(index).node;
  const contents = node.Contents();
  const streams: PDFObject[] = contents instanceof PDFArray ? contents.asArray().map((o) => doc.context.lookup(o)!) : contents ? [contents] : [];
  const parts: Uint8Array[] = [];
  for (const s of streams) {
    try {
      if (s instanceof PDFRawStream) parts.push(decodePDFRawStream(s).decode());
      else if (s instanceof PDFStream) parts.push((s as unknown as { getUnencodedContents(): Uint8Array }).getUnencodedContents());
    } catch {}
  }
  const total = parts.reduce((t, p) => t + p.length + 1, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
    out[at++] = 10;
  }
  return out;
}

interface GState {
  ctm: Matrix;
  clipped: boolean;
  font: FontInfo | null;
  fs: number;
  tc: number;
  tw: number;
  th: number;
  tl: number;
  ts: number;
}

interface Located extends PageContent {
  ops: Op[];
  /** Per text run: what it advanced, and the state needed to replace it */
  runs: Map<number, { adv: number; fs: number; th: number }>;
  /** Per image op: the CTM it was drawn with */
  ctms: Map<number, Matrix>;
}

function locate(doc: PDFDocument, index: number, bytes: Uint8Array): Located {
  const ops = parseOps(bytes);
  const page = doc.getPage(index);
  const resources = page.node.Resources();
  const lookupDict = (d: PDFDict | undefined, k: string) => {
    const v = d ? doc.context.lookup(d.get(PDFName.of(k))) : undefined;
    return v instanceof PDFDict ? v : undefined;
  };
  const fontsDict = lookupDict(resources, 'Font');
  const xobjDict = lookupDict(resources, 'XObject');
  const fontCache = new Map<string, FontInfo>();
  const fontNamed = (name: string) => {
    let f = fontCache.get(name);
    if (!f) {
      const ref = fontsDict?.get(PDFName.of(name));
      const d = ref ? doc.context.lookup(ref) : undefined;
      f = makeFontInfo(doc, d instanceof PDFDict ? d : undefined);
      fontCache.set(name, f);
    }
    return f;
  };
  const xobjKind = (name: string): 'Image' | 'Form' | '' => {
    const ref = xobjDict?.get(PDFName.of(name));
    const s = ref ? doc.context.lookup(ref) : undefined;
    const dict = s instanceof PDFStream ? s.dict : undefined;
    const st = dict?.get(PDFName.of('Subtype'));
    return st instanceof PDFName ? (st.decodeText() as 'Image' | 'Form') : '';
  };
  const formHasText = (name: string): boolean => {
    // Cheap check: does the form's stream show text?
    try {
      const ref = xobjDict?.get(PDFName.of(name));
      const s = ref ? doc.context.lookup(ref) : undefined;
      if (!(s instanceof PDFRawStream)) return false;
      const raw = decodePDFRawStream(s).decode();
      const text = new TextDecoder('latin1').decode(raw);
      return /\b(Tj|TJ)\b/.test(text);
    } catch {
      return false;
    }
  };

  let g: GState = { ctm: IDENTITY, clipped: false, font: null, fs: 0, tc: 0, tw: 0, th: 1, tl: 0, ts: 0 };
  const stack: GState[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let pendingClip = false;
  const texts: TextRun[] = [];
  const images: ImageEl[] = [];
  const runs = new Map<number, { adv: number; fs: number; th: number }>();
  const ctms = new Map<number, Matrix>();
  let formText = false;

  const N = (v: Val | undefined) => (typeof v === 'number' ? v : 0);
  const td = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  const show = (k: number, parts: Val[]) => {
    const start = tm;
    const font = g.font ?? { bytes: 1 as const, width: () => 0.5 };
    let adv = 0;
    let ink = false;
    for (const part of parts) {
      if (typeof part === 'number') {
        adv += (-part / 1000) * g.fs * g.th;
        continue;
      }
      if (!(part instanceof Str)) continue;
      const s = part.v;
      for (let c = 0; c + font.bytes <= s.length; c += font.bytes) {
        const code = font.bytes === 2 ? (s.charCodeAt(c) << 8) | s.charCodeAt(c + 1) : s.charCodeAt(c);
        const space = font.bytes === 1 && code === 32 ? g.tw : 0;
        // Two-byte (CID) codes have no fixed space code, so any glyph counts
        if (font.bytes === 2 || code !== 32) ink = true;
        adv += (font.width(code) * g.fs + g.tc + space) * g.th;
      }
    }
    const M = mul(start, g.ctm);
    const [x1, y] = apply(M, 0, g.ts);
    const [x2, y2] = apply(M, adv, g.ts);
    const size = Math.abs(g.fs) * Math.hypot(M[2], M[3]);
    const scaleX = Math.hypot(M[0], M[1]);
    const upright = Math.abs(M[1]) < 1e-3 * scaleX && Math.abs(M[2]) < 1e-3 * scaleX && M[0] > 0 && M[3] > 0 && Math.abs(y2 - y) < 0.01;
    texts.push({ op: k, x1, x2, y, size, upright, ink });
    runs.set(k, { adv, fs: g.fs, th: g.th });
    tm = mul([1, 0, 0, 1, adv, 0], start);
  };

  ops.forEach((o, k) => {
    const a = o.args;
    switch (o.op) {
      case 'q':
        stack.push({ ...g });
        break;
      case 'Q':
        if (stack.length) g = stack.pop()!;
        break;
      case 'cm':
        if (a.length >= 6) g = { ...g, ctm: mul(a.slice(0, 6).map(N) as Matrix, g.ctm) };
        break;
      case 'W':
      case 'W*':
        pendingClip = true;
        break;
      case 'n':
      case 'f':
      case 'F':
      case 'f*':
      case 'S':
      case 's':
      case 'B':
      case 'B*':
      case 'b':
      case 'b*':
        if (pendingClip) g = { ...g, clipped: true };
        pendingClip = false;
        break;
      case 'BT':
        tm = tlm = IDENTITY;
        break;
      case 'Tf':
        g = { ...g, font: a[0] instanceof Name ? fontNamed(a[0].v) : null, fs: N(a[1]) };
        break;
      case 'Tc':
        g = { ...g, tc: N(a[0]) };
        break;
      case 'Tw':
        g = { ...g, tw: N(a[0]) };
        break;
      case 'Tz':
        g = { ...g, th: N(a[0]) / 100 };
        break;
      case 'TL':
        g = { ...g, tl: N(a[0]) };
        break;
      case 'Ts':
        g = { ...g, ts: N(a[0]) };
        break;
      case 'Td':
        td(N(a[0]), N(a[1]));
        break;
      case 'TD':
        g = { ...g, tl: -N(a[1]) };
        td(N(a[0]), N(a[1]));
        break;
      case 'Tm':
        if (a.length >= 6) tm = tlm = a.slice(0, 6).map(N) as Matrix;
        break;
      case 'T*':
        td(0, -g.tl);
        break;
      case 'Tj':
        show(k, [a[0]]);
        break;
      case 'TJ':
        show(k, Array.isArray(a[0]) ? a[0] : []);
        break;
      case "'":
        td(0, -g.tl);
        show(k, [a[0]]);
        break;
      case '"':
        g = { ...g, tw: N(a[0]), tc: N(a[1]) };
        td(0, -g.tl);
        show(k, [a[2]]);
        break;
      case 'Do': {
        const name = a[0] instanceof Name ? a[0].v : '';
        const kind = xobjKind(name);
        if (kind === 'Image') {
          images.push({ op: k, box: boundsOf(g.ctm), clipped: g.clipped });
          ctms.set(k, g.ctm);
        } else if (kind === 'Form' && !formText && formHasText(name)) formText = true;
        break;
      }
      case 'BI':
        images.push({ op: k, box: boundsOf(g.ctm), clipped: g.clipped });
        ctms.set(k, g.ctm);
        break;
    }
  });

  return { ops, texts, images, formText, runs, ctms };
}

/** Where the text and images on a page are drawn. Read-only. */
export function analyzePage(doc: PDFDocument, index: number): PageContent {
  const { texts, images, formText } = locate(doc, index, pageBytes(doc, index));
  return { texts, images, formText };
}

// ---------- Lines of text (from PDF.js text content) ----------

/** The subset of a PDF.js text item we use (page space, y up) */
export interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}

export interface TextLine {
  id: string;
  text: string;
  /** Baseline span and position, page space */
  x1: number;
  x2: number;
  y: number;
  size: number;
  /** Top and bottom of the line box, page space */
  top: number;
  bottom: number;
  fontName: string;
}

/**
 * Groups PDF.js text items into editable lines: same baseline, similar size,
 * no wide gap (a wide gap starts a new line, so columns stay separate).
 * Rotated and vertical text are left out.
 */
export function groupLines(items: TextItemLike[], ascentOf: (fontName: string) => [number, number] = () => [0.9, -0.22]): TextLine[] {
  type It = { s: string; x: number; y: number; w: number; size: number; font: string };
  const list: It[] = [];
  for (const it of items) {
    const t = it.transform;
    // Whitespace-only items are skipped: PDF.js emits one wide " " across a
    // column gap, which would glue two columns into one line. Word spaces
    // are put back from the gaps when the line's text is joined.
    if (!it.str?.trim() || t.length < 6) continue;
    const size = Math.hypot(t[2], t[3]);
    const upright = t[0] > 0 && t[3] > 0 && Math.abs(t[1]) < 1e-3 * t[0] && Math.abs(t[2]) < 1e-3 * t[3];
    if (!upright || size < 1) continue;
    list.push({ s: it.str, x: t[4], y: t[5], w: it.width, size, font: it.fontName });
  }
  list.sort((a, b) => b.y - a.y || a.x - b.x);

  // Rows: items whose baselines are within a fraction of their size
  const rows: It[][] = [];
  for (const it of list) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) < 0.25 * Math.min(row[0].size, it.size)) row.push(it);
    else rows.push([it]);
  }

  const lines: TextLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let cur: { items: It[]; x2: number } | null = null;
    const flush = () => {
      if (!cur) return;
      let text = '';
      let end = -Infinity;
      for (const it of cur.items) {
        const gap = it.x - end;
        if (text && gap > 0.15 * it.size && !/\s$/.test(text) && !/^\s/.test(it.s)) text += ' ';
        text += it.s;
        end = Math.max(end, it.x + it.w);
      }
      const first = cur.items[0];
      const size = Math.max(...cur.items.map((i) => i.size));
      const [asc, desc] = ascentOf(first.font);
      if (text.trim()) {
        lines.push({
          id: `${Math.round(first.y * 10)}:${Math.round(first.x * 10)}`,
          text: text.replace(/\s+$/, ''),
          x1: first.x,
          x2: cur.x2,
          y: first.y,
          size,
          top: first.y + asc * size,
          bottom: first.y + desc * size,
          fontName: first.font,
        });
      }
      cur = null;
    };
    for (const it of row) {
      const sameSize = cur && it.size / cur.items[0].size < 1.3 && cur.items[0].size / it.size < 1.3;
      // A gap wider than about an em starts a new target: word spaces are far
      // narrower, while a bullet's indent, a tab stop or a column is wider,
      // and retyping across one would collapse it into a single space
      if (cur && sameSize && it.x - cur.x2 < 1.0 * it.size) {
        cur.items.push(it);
        cur.x2 = Math.max(cur.x2, it.x + it.w);
      } else {
        flush();
        cur = { items: [it], x2: it.x + it.w };
      }
    }
    flush();
  }
  return lines;
}

/** The erase box for a line: what rewritePage needs to take it out */
export const eraseFor = (l: TextLine, bg: [number, number, number]): EraseBox => ({
  x1: l.x1,
  x2: l.x2,
  y: l.y,
  size: l.size,
  top: l.top,
  bottom: l.bottom,
  bg,
});

// ---------- Rewriting a page ----------

/** Text runs that belong to an erase box: same baseline, inside its span */
function runsIn(texts: TextRun[], e: EraseBox) {
  const inside: TextRun[] = [];
  let partial = false;
  const tolY = Math.max(1, e.size * 0.35);
  const tolX = Math.max(1, e.size * 0.6);
  for (const t of texts) {
    if (!t.upright || !t.ink) continue;
    if (Math.abs(t.y - e.y) > tolY) continue;
    const overlaps = t.x2 > e.x1 - tolX && t.x1 < e.x2 + tolX;
    if (!overlaps) continue;
    if (t.x1 >= e.x1 - tolX && t.x2 <= e.x2 + tolX) inside.push(t);
    else partial = true;
  }
  return { inside, partial };
}

/**
 * Applies edits to one page of `doc` in place. Returns the indices of erase
 * boxes whose text couldn't be (fully) removed: those got a cover box instead.
 */
export function rewritePage(doc: PDFDocument, index: number, edits: PageEdits): { covered: number[] } {
  if (!edits.erase.length && !edits.images.size) return { covered: [] };
  const bytes = pageBytes(doc, index);
  const L = locate(doc, index, bytes);
  const replace = new Map<number, string>();
  const tail: string[] = [];
  const covered: number[] = [];

  edits.erase.forEach((e, k) => {
    const { inside, partial } = runsIn(L.texts, e);
    for (const t of inside) {
      const o = L.ops[t.op];
      const r = L.runs.get(t.op)!;
      const scale = r.fs * r.th;
      const n = scale ? (-r.adv * 1000) / scale : 0;
      const keepPos = scale ? `[${fmt(n)}] TJ` : '';
      let out = keepPos;
      if (o.op === "'") out = `T* ${keepPos}`;
      else if (o.op === '"') out = `${fmt(Number(o.args[0]) || 0)} Tw ${fmt(Number(o.args[1]) || 0)} Tc T* ${keepPos}`;
      replace.set(t.op, out);
    }
    if (!inside.length || partial) {
      covered.push(k);
      const [r, g, b] = e.bg.map((v) => v / 255);
      const pad = Math.max(0.5, e.size * 0.08);
      tail.push(`q ${fmt(r)} ${fmt(g)} ${fmt(b)} rg ${fmt(e.x1 - pad)} ${fmt(e.bottom)} ${fmt(e.x2 - e.x1 + 2 * pad)} ${fmt(e.top - e.bottom)} re f Q`);
    }
  });

  for (const [op, edit] of edits.images) {
    const o = L.ops[op];
    const el = L.images.find((im) => im.op === op);
    const ctm = L.ctms.get(op);
    if (!o || !el || !ctm) continue;
    if (edit.action === 'delete') {
      replace.set(op, '');
      continue;
    }
    const from = el.box;
    const to = edit.to;
    const kx = from.w ? to.w / from.w : 1;
    const ky = from.h ? to.h / from.h : 1;
    const S: Matrix = [kx, 0, 0, ky, to.x - from.x * kx, to.y - from.y * ky];
    // The operator with its operands, e.g. "/Im1 Do" or a whole BI … EI
    const src = new TextDecoder('latin1').decode(bytes.subarray(o.start, o.end));
    if (el.clipped) {
      // A clip would cut it off where it lands: draw it again at the end, unclipped
      replace.set(op, '');
      tail.push(`q ${mul(ctm, S).map(fmt).join(' ')} cm ${src} Q`);
    } else {
      // In place: p·N·CTM = p·CTM·S  ⇒  N = CTM·S·CTM⁻¹
      const N = mul(mul(ctm, S), inv(ctm));
      replace.set(op, `q ${N.map(fmt).join(' ')} cm ${src} Q`);
    }
  }

  // Splice: copy the original bytes, swapping replaced operator ranges
  const enc = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 255);
  // The original content may leave a transform active or q's unclosed, so when
  // something is drawn after it, it's wrapped in q … Q (closing any it left open)
  const chunks: Uint8Array[] = tail.length ? [enc('q\n')] : [];
  let at = 0;
  for (const k of [...replace.keys()].sort((a, b) => L.ops[a].start - L.ops[b].start)) {
    const o = L.ops[k];
    chunks.push(bytes.subarray(at, o.start), enc(` ${replace.get(k)} `));
    at = o.end;
  }
  chunks.push(bytes.subarray(at));
  if (tail.length) chunks.push(enc(`\n${'Q '.repeat(depthAtEnd(L.ops) + 1)}\n${tail.join('\n')}\n`));

  const total = chunks.reduce((t, c) => t + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  const node = doc.getPage(index).node;
  const ref: PDFRef = doc.context.register(doc.context.flateStream(out));
  node.set(PDFName.of('Contents'), ref);
  return { covered };
}

function depthAtEnd(ops: Op[]) {
  let d = 0;
  for (const o of ops) {
    if (o.op === 'q') d++;
    else if (o.op === 'Q' && d > 0) d--;
  }
  return d;
}
