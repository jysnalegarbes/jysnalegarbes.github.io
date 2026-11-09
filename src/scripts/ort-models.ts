/*
  Shared loader for the AI tools (Background Remover, Image Upscaler):
  onnxruntime-web (MIT), loaded only when a tool first needs it, plus model
  downloads that are kept in the Cache API so each model downloads once.
  Images never leave the browser; only code and model files come in.
*/

import type * as Ort from 'onnxruntime-web';
import { formatBytes } from './tool-utils';

export type { Ort };

const CACHE = 'tools-models-v1';

let ortPromise: Promise<typeof Ort> | null = null;
export function loadOrt() {
  ortPromise ??= import('onnxruntime-web/webgpu').then((ort) => {
    // The WebAssembly files come from the CDN, pinned to this package's version
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    ort.env.logLevel = 'error';
    return ort as unknown as typeof Ort;
  });
  return ortPromise;
}

let gpuPromise: Promise<boolean> | null = null;
/** True when this browser has a usable WebGPU adapter */
export function hasWebGpu() {
  gpuPromise ??= (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      return !!(gpu && (await gpu.requestAdapter()));
    } catch {
      return false;
    }
  })();
  return gpuPromise;
}

/** Fetches a model, from the Cache API when we have it, reporting download progress */
export async function fetchModel(url: string, onProgress: (loaded: number, total: number) => void): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {}
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`The model couldn’t be downloaded (${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  try {
    await cache?.put(url, new Response(bytes as BlobPart, { headers: { 'content-type': 'application/octet-stream' } }));
  } catch {}
  return bytes;
}

export const downloadText = (loaded: number, total: number) =>
  total ? `Downloading the model… ${Math.round((loaded / total) * 100)}% of ${formatBytes(total)}` : `Downloading the model… ${formatBytes(loaded)}`;

/** Downloads (or reuses) a model and starts a session on WebGPU when available, else on the CPU */
export async function createSession(url: string, onProgress: (text: string) => void) {
  const ort = await loadOrt();
  const gpu = await hasWebGpu();
  const bytes = await fetchModel(url, (loaded, total) => onProgress(downloadText(loaded, total)));
  onProgress('Starting the model…');
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
    logSeverityLevel: 3,
  });
  return { session, device: gpu ? 'WebGPU' : 'CPU', gpu };
}
