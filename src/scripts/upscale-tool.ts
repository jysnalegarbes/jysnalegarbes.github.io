/*
  Image Upscaler (/tools/upscale/): enlarges images 2× or 4× with an AI
  model that rebuilds detail, in the browser. Images are never uploaded.

  Models (Real-ESRGAN, BSD-3-Clause; ONNX exports from
  huggingface.co/jonathanst29/tinier-upscale-models, pinned):
    - Standard: realesr-general-x4v3 (4.6 MB, self-hosted /models/)
    - Max detail: RealESRGAN_x4plus (64 MB, from Hugging Face, cached)
  Both take RGB 0–1 NCHW and return 4× the size.

  The image is processed in fixed-size tiles (same tensor shape every run,
  so WebGPU compiles once) with an overlap that's cropped off, so there are
  no seams and memory stays flat. For 2×, each 4× tile is scaled down as it
  lands, which is sharper than a plain 2× resize. Transparency is carried
  over by scaling the original alpha.
*/

import { createSession, type Ort, loadOrt } from './ort-models';
import { baseName, errorText, formatBytes, saveBlob } from './tool-utils';

type ModelKey = 'standard' | 'max';

const MODELS: Record<ModelKey, string> = {
  standard: '/models/realesr-general-x4v3.onnx',
  max: 'https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/899dc1e4b22bbf1955c2f1739c085edc080cb366/realesrgan-x4plus.onnx',
};
/** Tile core and overlap, in input pixels */
const TILE = 192;
const PAD = 12;
const SIZE = TILE + PAD * 2;
/** Longest edge we'll produce; bigger canvases fail on many devices */
const MAX_OUT = 8192;

const sessions = new Map<ModelKey, ReturnType<typeof createSession>>();
function getSession(key: ModelKey, onProgress: (t: string) => void) {
  let s = sessions.get(key);
  if (!s) {
    s = createSession(MODELS[key], onProgress);
    s.catch(() => sessions.delete(key));
    sessions.set(key, s);
  }
  return s;
}

export function mountUpscaleTool(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const statusEl = $<HTMLElement>('[data-status]');
  const stage = $<HTMLElement>('[data-stage]');
  const viewport = $<HTMLElement>('[data-viewport]');
  const before = $<HTMLCanvasElement>('[data-before]');
  const after = $<HTMLCanvasElement>('[data-after]');
  const compare = $<HTMLInputElement>('[data-compare]');
  const meta = $<HTMLElement>('[data-meta]');
  const progress = $<HTMLProgressElement>('[data-progress]');
  const runBtn = $<HTMLButtonElement>('[data-act="run"]');
  const downloadBtn = $<HTMLButtonElement>('[data-act="download"]');
  const zoomBtn = $<HTMLButtonElement>('[data-act="zoom"]');
  const scaleNote = $<HTMLElement>('[data-scale-note]');
  const strength = $<HTMLInputElement>('[data-strength]');
  const strengthOut = $<HTMLOutputElement>('[data-strength-out]');

  // Strength blends the AI result over the plain resize (the "before" layer)
  strength.addEventListener('input', () => {
    strengthOut.value = strength.value;
    after.style.opacity = String(Number(strength.value) / 100);
  });

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  let result: { scale: number; model: ModelKey } | null = null;
  let gen = 0;
  let busy = false;
  let zoomed = false;

  const model = () => (root.querySelector<HTMLInputElement>('[name="model"]:checked')?.value ?? 'standard') as ModelKey;
  const scale = () => Number(root.querySelector<HTMLInputElement>('[name="scale"]:checked')?.value ?? 4);
  const say = (t: string) => (statusEl.textContent = t);

  /** Output size for the current settings, capped at MAX_OUT */
  function outSize() {
    if (!bitmap) return { w: 0, h: 0, k: 1, capped: false };
    let k = scale();
    const longest = Math.max(bitmap.width, bitmap.height);
    const capped = longest * k > MAX_OUT;
    if (capped) k = MAX_OUT / longest;
    return { w: Math.round(bitmap.width * k), h: Math.round(bitmap.height * k), k, capped };
  }

  function syncInfo() {
    if (!bitmap) return;
    const { w, h, capped } = outSize();
    scaleNote.textContent = `${bitmap.width} × ${bitmap.height} → ${w} × ${h} px` + (capped ? ` (capped at ${MAX_OUT} px on the long edge)` : '');
    runBtn.disabled = busy;
    downloadBtn.disabled = busy || !result;
    const isCurrent = result && result.scale === scale() && result.model === model();
    runBtn.textContent = result && !isCurrent ? 'Upscale again' : 'Upscale';
  }

  function setBusy(on: boolean) {
    busy = on;
    root.classList.toggle('is-busy', on);
    progress.hidden = !on;
    syncInfo();
  }

  /** Shows the preview at fit, or at the output's real pixels */
  function layout() {
    if (!bitmap) return;
    const { w, h } = outSize();
    const s = zoomed ? 1 / (window.devicePixelRatio || 1) : 1;
    stage.style.aspectRatio = `${w} / ${h}`;
    stage.style.width = zoomed ? `${w * s}px` : `min(100%, calc(70vh * ${(w / h).toFixed(4)}))`;
    viewport.classList.toggle('is-zoomed', zoomed);
    zoomBtn.textContent = zoomed ? 'Fit to screen' : 'Actual pixels';
  }

  /** "Before" is the plain resize, so the comparison shows what the AI adds */
  function drawBefore() {
    if (!bitmap) return;
    const { w, h } = outSize();
    before.width = w;
    before.height = h;
    const ctx = before.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
  }

  async function run() {
    if (!bitmap || busy) return;
    const g = ++gen;
    const key = model();
    setBusy(true);
    stage.classList.remove('has-result');
    compare.value = '100';
    stage.style.setProperty('--split', '100%');
    say('Upscaling…');
    try {
      const { session, device } = await getSession(key, (t) => g === gen && say(t));
      if (g !== gen) return;
      const ort = await loadOrt();
      const { w: outW, h: outH, k } = outSize();
      const W = bitmap.width;
      const H = bitmap.height;

      // Source pixels, read once
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      const sctx = src.getContext('2d', { willReadFrequently: true })!;
      sctx.drawImage(bitmap, 0, 0);
      const px = sctx.getImageData(0, 0, W, H).data;
      let hasAlpha = false;
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] < 255) {
          hasAlpha = true;
          break;
        }
      }

      after.width = outW;
      after.height = outH;
      const actx = after.getContext('2d')!;
      actx.imageSmoothingQuality = 'high';
      const tile = document.createElement('canvas');
      const tctx = tile.getContext('2d')!;

      const cols = Math.ceil(W / TILE);
      const rows = Math.ceil(H / TILE);
      const total = cols * rows;
      const input = new Float32Array(3 * SIZE * SIZE);
      const n = SIZE * SIZE;
      const t0 = performance.now();
      let done = 0;
      progress.max = total;

      for (let ty = 0; ty < H; ty += TILE) {
        for (let tx = 0; tx < W; tx += TILE) {
          if (g !== gen) return;
          // Tile with overlap; edges repeat the border pixels
          for (let y = 0; y < SIZE; y++) {
            const sy = Math.min(H - 1, Math.max(0, ty - PAD + y));
            for (let x = 0; x < SIZE; x++) {
              const sx = Math.min(W - 1, Math.max(0, tx - PAD + x));
              const si = (sy * W + sx) * 4;
              const di = y * SIZE + x;
              input[di] = px[si] / 255;
              input[n + di] = px[si + 1] / 255;
              input[2 * n + di] = px[si + 2] / 255;
            }
          }
          const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
          const data = (out[session.outputNames[0]] as Ort.Tensor).data as Float32Array;
          const O = SIZE * 4;
          const on = O * O;
          // Keep only the core (drop the overlap)
          const cw = Math.min(TILE, W - tx) * 4;
          const ch = Math.min(TILE, H - ty) * 4;
          const img = tctx.createImageData(cw, ch);
          for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
              const si = (y + PAD * 4) * O + (x + PAD * 4);
              const di = (y * cw + x) * 4;
              img.data[di] = Math.min(255, Math.max(0, data[si] * 255));
              img.data[di + 1] = Math.min(255, Math.max(0, data[on + si] * 255));
              img.data[di + 2] = Math.min(255, Math.max(0, data[2 * on + si] * 255));
              img.data[di + 3] = 255;
            }
          }
          tile.width = cw;
          tile.height = ch;
          tctx.putImageData(img, 0, 0);
          // Lands at the output scale (4×, or scaled down for 2× / capped sizes)
          actx.drawImage(tile, tx * k, ty * k, (cw / 4) * k, (ch / 4) * k);
          done++;
          progress.value = done;
          const left = ((performance.now() - t0) / done) * (total - done);
          say(`Upscaling… ${done} of ${total} tiles` + (done > 2 && left > 4000 ? ` · about ${Math.ceil(left / 1000)} s left` : ''));
        }
      }

      if (hasAlpha) {
        actx.globalCompositeOperation = 'destination-in';
        actx.drawImage(bitmap, 0, 0, outW, outH);
        actx.globalCompositeOperation = 'source-over';
      }
      src.width = src.height = 0;
      result = { scale: scale(), model: key };
      say(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s on ${device}. Drag across the image to compare with a plain resize.`);
      compare.value = '50';
      stage.style.setProperty('--split', '50%');
      stage.classList.add('has-result');
    } catch (err) {
      if (g === gen) say(`Couldn’t upscale: ${errorText(err)}`);
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
    gen++;
    busy = false;
    file = f;
    result = null;
    stage.classList.remove('has-result');
    after.width = after.height = 0;
    compare.value = '100';
    stage.style.setProperty('--split', '100%');
    meta.textContent = `${f.name} · ${bitmap.width} × ${bitmap.height} · ${formatBytes(f.size)}`;
    workspace.hidden = false;
    drop.classList.add('is-compact');
    progress.hidden = true;
    say('');
    drawBefore();
    layout();
    syncInfo();
    run();
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

  // Changing settings shows the new size; the AI runs again on "Upscale again"
  root.querySelectorAll('[name="model"], [name="scale"]').forEach((el) =>
    el.addEventListener('change', () => {
      if (!result) {
        drawBefore();
        layout();
      }
      syncInfo();
    }),
  );

  runBtn.addEventListener('click', () => {
    drawBefore();
    layout();
    run();
  });
  compare.addEventListener('input', () => stage.style.setProperty('--split', `${compare.value}%`));
  zoomBtn.addEventListener('click', () => {
    zoomed = !zoomed;
    layout();
  });

  downloadBtn.addEventListener('click', () => {
    if (!result || !file || busy) return;
    const type = root.querySelector<HTMLSelectElement>('[data-type]')!.value;
    const mime = type === 'jpg' ? 'image/jpeg' : type === 'webp' ? 'image/webp' : 'image/png';
    const s = Number(strength.value) / 100;
    let canvas = after;
    if (type === 'jpg' || s < 1) {
      canvas = document.createElement('canvas');
      canvas.width = after.width;
      canvas.height = after.height;
      const ctx = canvas.getContext('2d')!;
      if (type === 'jpg') {
        // JPG has no transparency
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (s < 1) {
        // Same blend as the preview: plain resize, AI result on top at the chosen strength
        ctx.drawImage(before, 0, 0);
        ctx.globalAlpha = s;
      }
      ctx.drawImage(after, 0, 0);
      ctx.globalAlpha = 1;
    }
    say('Saving…');
    canvas.toBlob(
      (blob) => {
        if (!blob) return say('Couldn’t save the image. It may be too large for this browser.');
        const name = `${baseName(file!.name)}-${result!.scale}x.${type}`;
        saveBlob(blob, name);
        say(`Downloaded ${name} (${after.width} × ${after.height}, ${formatBytes(blob.size)}).`);
      },
      mime,
      0.92,
    );
  });

  window.addEventListener('resize', layout);
}
