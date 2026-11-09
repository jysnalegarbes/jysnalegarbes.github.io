/*
  Background Remover (/tools/background/): cuts the subject out of a photo
  in the browser with an AI model run by onnxruntime-web. Images are never
  uploaded; only the model file is downloaded.

  Models (both free for commercial use):
    - Fast: U²-Netp (Apache-2.0), 4.6 MB, self-hosted at /models/u2netp.onnx
      (from rembg's release, md5 8e83ca70e441ab06c318d82300c84806). 320 px
      input, output min-max normalised.
    - High quality: BiRefNet-lite 512 (MIT), 98 MB from Hugging Face, pinned
      to a revision and kept in the Cache API after the first download.
      512 px input, output is logits → sigmoid. fp16 on WebGPU; without
      WebGPU the fp32 file (183 MB) runs on WebAssembly instead.

  The model gives a low-res matte; it's scaled up to the photo with
  smoothing and used as the alpha channel of the full-resolution original.
  "Edge" sharpens the matte without running the model again.
*/

import { createSession, hasWebGpu, loadOrt, type Ort } from './ort-models';
import { baseName, errorText, formatBytes, saveBlob } from './tool-utils';

type ModelKey = 'fast' | 'quality';

const HF = 'https://huggingface.co/studioludens/birefnet-lite-512/resolve/962e67969ec6acec9c19fab76acee4f5e22e990c/onnx/';
const MODELS = {
  fast: { size: 320, mode: 'minmax' as const },
  quality: { size: 512, mode: 'sigmoid' as const },
};
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const sessions = new Map<ModelKey, Promise<{ session: Ort.InferenceSession; fp16: boolean; device: string }>>();

function getSession(key: ModelKey, onProgress: (text: string) => void) {
  let s = sessions.get(key);
  if (!s) {
    s = (async () => {
      // BiRefNet in fp16 on WebGPU; without WebGPU the fp32 file runs on the CPU
      const fp16 = key === 'quality' && (await hasWebGpu());
      const url = key === 'quality' ? HF + (fp16 ? 'model_fp16.onnx' : 'model.onnx') : '/models/u2netp.onnx';
      const { session, device } = await createSession(url, onProgress);
      return { session, fp16, device };
    })();
    s.catch(() => sessions.delete(key));
    sessions.set(key, s);
  }
  return s;
}

/** float32 → IEEE half, for fp16 models that want half-precision input */
function toHalf(src: Float32Array) {
  const out = new Uint16Array(src.length);
  const f = new Float32Array(1);
  const u = new Uint32Array(f.buffer);
  for (let i = 0; i < src.length; i++) {
    f[0] = src[i];
    const x = u[0];
    const sign = (x >>> 16) & 0x8000;
    let exp = ((x >>> 23) & 0xff) - 127 + 15;
    let mant = x & 0x7fffff;
    if (exp <= 0) {
      out[i] = sign;
    } else if (exp >= 31) {
      out[i] = sign | 0x7c00;
    } else {
      mant >>= 13;
      out[i] = sign | (exp << 10) | mant;
    }
  }
  return out;
}

function fromHalf(h: number) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

async function runModel(key: ModelKey, bitmap: ImageBitmap, onProgress: (t: string) => void): Promise<{ matte: Float32Array; device: string }> {
  const { size, mode } = MODELS[key];
  const { session, fp16, device } = await getSession(key, onProgress);
  const ort = await loadOrt();
  onProgress('Finding the subject…');

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const n = size * size;
  const input = new Float32Array(3 * n);
  let max = 255;
  if (mode === 'minmax') {
    // rembg divides by the brightest value in the image
    max = 1;
    for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
  }
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 3; ch++) input[ch * n + i] = (data[i * 4 + ch] / max - MEAN[ch]) / STD[ch];
  }

  const name = session.inputNames[0];
  const run = (half: boolean) =>
    session.run({ [name]: half ? new ort.Tensor('float16', toHalf(input), [1, 3, size, size]) : new ort.Tensor('float32', input, [1, 3, size, size]) });
  let out: Ort.InferenceSession.OnnxValueMapType;
  try {
    out = await run(false);
  } catch (err) {
    if (!fp16) throw err;
    out = await run(true);
  }
  const outName = session.outputNames.includes('logits') ? 'logits' : session.outputNames[0];
  const tensor = out[outName] as Ort.Tensor;
  const raw = tensor.data as Float32Array | Uint16Array;
  const values = new Float32Array(n);
  const isHalf = tensor.type === 'float16' && !(raw instanceof Float32Array);
  for (let i = 0; i < n; i++) values[i] = isHalf ? fromHalf((raw as Uint16Array)[i]) : Number(raw[i]);

  if (mode === 'sigmoid') {
    for (let i = 0; i < n; i++) values[i] = 1 / (1 + Math.exp(-values[i]));
  } else {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const range = hi - lo || 1;
    for (let i = 0; i < n; i++) values[i] = (values[i] - lo) / range;
  }
  return { matte: values, device };
}

// ---------- Mount ----------

export function mountBgTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const statusEl = $<HTMLElement>('[data-status]');
  const stage = $<HTMLElement>('[data-stage]');
  const resultCanvas = $<HTMLCanvasElement>('[data-result]');
  const originalImg = $<HTMLImageElement>('[data-original]');
  const compare = $<HTMLInputElement>('[data-compare]');
  const edge = $<HTMLInputElement>('[data-edge]');
  const bgColor = $<HTMLInputElement>('[data-bg-color]');
  const downloadBtn = $<HTMLButtonElement>('[data-act="download"]');
  const meta = $<HTMLElement>('[data-meta]');

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  let matte: { values: Float32Array; size: number } | null = null;
  let originalUrl = '';
  let gen = 0;
  let busy = false;

  const model = () => (root.querySelector<HTMLInputElement>('[name="model"]:checked')?.value ?? 'fast') as ModelKey;
  const background = () => root.querySelector<HTMLInputElement>('[name="bg"]:checked')?.value ?? 'transparent';
  const say = (t: string) => (statusEl.textContent = t);

  function setBusy(on: boolean) {
    busy = on;
    root.classList.toggle('is-busy', on);
    stage.classList.toggle('is-working', on);
    downloadBtn.disabled = on || !matte;
  }

  /** Builds the cut-out at full size from the matte and the current settings */
  function compose(target: HTMLCanvasElement) {
    if (!bitmap || !matte) return;
    const { values, size } = matte;
    const w = bitmap.width;
    const h = bitmap.height;

    // Edge: 0 keeps the model's soft matte, 1 makes a hard cut
    const hard = Number(edge.value) / 100;
    const half = 0.5 * (1 - hard) + 0.02;
    const m = document.createElement('canvas');
    m.width = m.height = size;
    const mctx = m.getContext('2d')!;
    const img = mctx.createImageData(size, size);
    for (let i = 0; i < values.length; i++) {
      let a = (values[i] - (0.5 - half)) / (2 * half);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      a = a * a * (3 - 2 * a);
      img.data[i * 4 + 3] = Math.round(a * 255);
    }
    mctx.putImageData(img, 0, 0);

    target.width = w;
    target.height = h;
    const ctx = target.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(m, 0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-over';
    const bg = background();
    if (bg === 'color') {
      ctx.fillStyle = bgColor.value;
      ctx.fillRect(0, 0, w, h);
    } else if (bg === 'blur') {
      ctx.filter = `blur(${Math.round(Math.max(w, h) / 80)}px)`;
      ctx.drawImage(bitmap, 0, 0);
      ctx.filter = 'none';
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function redraw() {
    if (!matte) return;
    compose(resultCanvas);
    stage.classList.toggle('is-transparent', background() === 'transparent');
  }

  async function process() {
    if (!bitmap) return;
    const g = ++gen;
    setBusy(true);
    try {
      const t0 = performance.now();
      const { matte: values, device } = await runModel(model(), bitmap, (t) => g === gen && say(t));
      if (g !== gen) return;
      matte = { values, size: MODELS[model()].size };
      redraw();
      say(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s on ${device}.`);
    } catch (err) {
      if (g === gen) say(`Couldn’t remove the background: ${errorText(err)}`);
    }
    if (g === gen) setBusy(false);
  }

  async function open(f: File) {
    if (!f.type.startsWith('image/')) {
      say('That isn’t an image file.');
      return;
    }
    try {
      const bmp = await createImageBitmap(f);
      bitmap?.close();
      bitmap = bmp;
    } catch {
      say('This image couldn’t be opened. HEIC photos only open in Safari.');
      return;
    }
    file = f;
    matte = null;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = URL.createObjectURL(f);
    originalImg.src = originalUrl;
    resultCanvas.width = bitmap.width;
    resultCanvas.height = bitmap.height;
    resultCanvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    stage.style.aspectRatio = `${bitmap.width} / ${bitmap.height}`;
    // Full width, but never taller than most of the screen
    stage.style.width = `min(100%, calc(78vh * ${(bitmap.width / bitmap.height).toFixed(4)}))`;
    meta.textContent = `${f.name} · ${bitmap.width} × ${bitmap.height}`;
    compare.value = '100';
    stage.style.setProperty('--split', '100%');
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

  root.querySelectorAll('[name="model"]').forEach((el) => el.addEventListener('change', process));
  root.querySelectorAll('[name="bg"]').forEach((el) => el.addEventListener('change', redraw));
  bgColor.addEventListener('input', () => {
    root.querySelector<HTMLInputElement>('[name="bg"][value="color"]')!.checked = true;
    redraw();
  });
  edge.addEventListener('input', redraw);
  compare.addEventListener('input', () => stage.style.setProperty('--split', `${compare.value}%`));

  downloadBtn.addEventListener('click', () => {
    if (!matte || !file || busy) return;
    const solid = background() !== 'transparent';
    const c = document.createElement('canvas');
    compose(c);
    c.toBlob(
      (blob) => {
        if (!blob) return say('Couldn’t save the image.');
        const name = `${baseName(file!.name)}-${solid ? 'new-bg.jpg' : 'cutout.png'}`;
        saveBlob(blob, name);
        say(`Downloaded ${name} (${formatBytes(blob.size)}).`);
        c.width = c.height = 0;
      },
      solid ? 'image/jpeg' : 'image/png',
      0.92,
    );
  });
}
