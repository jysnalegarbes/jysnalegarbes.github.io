/*
  PDF Compressor page (/tools/pdf-compress/): drop PDFs, pick a level, see
  each file's size before and after, download one by one or as a .zip.
  The work happens in pdf-compress.ts; files never leave the browser.
*/

import { PDFDocument } from 'pdf-lib';
import { compressPdf, type CompressLevel } from './pdf-compress';
import { baseName, buildZip, errorText, formatBytes, saveBlob, sizeChange, uniqueNames } from './tool-utils';

interface Item {
  file: File;
  bytes?: Uint8Array;
  out?: Uint8Array;
  error?: string;
  note?: string;
  row: HTMLLIElement;
}

export function mountPdfCompress(root: HTMLElement) {
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const drop = $<HTMLElement>('[data-drop]');
  const workspace = $<HTMLElement>('[data-workspace]');
  const list = $<HTMLUListElement>('[data-list]');
  const statusEl = $<HTMLElement>('[data-status]');
  const summary = $<HTMLElement>('[data-summary]');
  const levelNote = $<HTMLElement>('[data-level-note]');
  const downloadAll = $<HTMLButtonElement>('[data-act="download-all"]');

  const NOTES: Record<CompressLevel, string> = {
    balanced: 'Shrinks the photos inside the PDF. Text stays sharp and selectable.',
    strong: 'Smaller photos at lower quality. Text stays sharp and selectable.',
    flatten: 'Turns every page into an image. Smallest for scans, but text can’t be selected or searched and links stop working.',
  };

  let items: Item[] = [];
  let gen = 0;
  const level = () => (root.querySelector<HTMLInputElement>('[name="level"]:checked')?.value ?? 'balanced') as CompressLevel;
  const say = (t: string) => (statusEl.textContent = t);

  function renderRow(item: Item) {
    const r = item.row;
    const result = r.querySelector('.tool-row__result')!;
    const dl = r.querySelector<HTMLButtonElement>('[data-row="download"]')!;
    r.classList.toggle('is-error', !!item.error);
    r.querySelector('.tool-row__meta')!.textContent = formatBytes(item.file.size);
    dl.hidden = !!item.error;
    dl.disabled = !item.out;
    result.replaceChildren();
    if (item.error) {
      result.textContent = item.error;
      return;
    }
    if (!item.out) {
      result.textContent = item.note ?? 'Compressing…';
      return;
    }
    const { change, label } = sizeChange(item.file.size, item.out.length);
    const size = document.createElement('span');
    size.textContent = change < 0 ? formatBytes(item.out.length) : 'Already as small as it gets';
    result.append(size);
    if (change < 0) {
      const delta = document.createElement('span');
      delta.className = 'tool-row__delta is-smaller';
      delta.textContent = label;
      result.append(delta);
    }
  }

  function updateSummary() {
    const ok = items.filter((i) => !i.error);
    const done = ok.filter((i) => i.out);
    downloadAll.disabled = !ok.length || done.length < ok.length;
    downloadAll.textContent = ok.length > 1 ? 'Download all (.zip)' : 'Download';
    if (!ok.length) {
      summary.textContent = '';
      return;
    }
    const before = ok.reduce((n, i) => n + i.file.size, 0);
    const after = done.reduce((n, i) => n + i.out!.length, 0);
    summary.textContent =
      done.length < ok.length
        ? `Compressing ${done.length + 1} of ${ok.length}…`
        : `${ok.length} file${ok.length === 1 ? '' : 's'} · ${formatBytes(before)} → ${formatBytes(after)} (${sizeChange(before, after).label})`;
  }

  async function runAll() {
    const g = ++gen;
    const lv = level();
    levelNote.textContent = NOTES[lv];
    for (const item of items) {
      item.out = undefined;
      item.note = undefined;
      renderRow(item);
    }
    updateSummary();
    for (const item of items) {
      if (g !== gen) return;
      if (item.error || !items.includes(item)) continue;
      try {
        item.bytes ??= new Uint8Array(await item.file.arrayBuffer());
        const result = await compressPdf(item.bytes, lv, (done, total) => {
          if (g !== gen || item.out) return;
          item.note = lv === 'flatten' ? `Page ${Math.min(done + 1, total)} of ${total}…` : `Image ${Math.min(done + 1, total)} of ${total}…`;
          renderRow(item);
        });
        if (g !== gen) return;
        item.out = result.bytes;
      } catch (err) {
        if (g !== gen) return;
        item.error = /encrypt/i.test(errorText(err))
          ? 'This PDF is password-protected. Remove the protection first.'
          : `Couldn’t compress this file (${errorText(err)}).`;
      }
      renderRow(item);
      updateSummary();
    }
  }

  async function addFiles(files: Iterable<File>) {
    const incoming = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!incoming.length) {
      say('Those weren’t PDF files.');
      return;
    }
    say('');
    for (const file of incoming) {
      const row = document.createElement('li');
      row.className = 'tool-row tool-row--pdf';
      row.innerHTML = `
        <span class="tool-row__icon" aria-hidden="true">PDF</span>
        <div class="tool-row__info">
          <p class="tool-row__name"></p>
          <p class="tool-row__meta"></p>
        </div>
        <p class="tool-row__result"></p>
        <div class="tool-row__actions">
          <button type="button" data-row="download">Download</button>
          <button type="button" class="tool-row__rm" data-row="remove" aria-label="Remove">✕</button>
        </div>`;
      row.querySelector('.tool-row__name')!.textContent = file.name;
      list.append(row);
      const item: Item = { file, row };
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        if (doc.isEncrypted) item.error = 'This PDF is password-protected. Remove the protection first.';
        item.bytes = bytes;
      } catch {
        item.error = 'This file couldn’t be read. It may be damaged.';
      }
      items.push(item);
      renderRow(item);
    }
    workspace.hidden = false;
    drop.classList.add('is-compact');
    runAll();
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

  root.querySelectorAll('[name="level"]').forEach((el) => el.addEventListener('change', runAll));

  const outName = (item: Item) => `${baseName(item.file.name)}-compressed.pdf`;

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-row]');
    const item = items.find((i) => i.row === btn?.closest('.tool-row'));
    if (!btn || !item) return;
    if (btn.dataset.row === 'download' && item.out) saveBlob(new Blob([item.out as BlobPart], { type: 'application/pdf' }), outName(item));
    if (btn.dataset.row === 'remove') {
      item.row.remove();
      items = items.filter((i) => i !== item);
      if (!items.length) {
        workspace.hidden = true;
        drop.classList.remove('is-compact');
      }
      updateSummary();
    }
  });

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'clear') {
      gen++;
      items = [];
      list.replaceChildren();
      workspace.hidden = true;
      drop.classList.remove('is-compact');
      say('Cleared.');
      return;
    }
    const ok = items.filter((i) => i.out);
    if (!ok.length) return;
    if (ok.length === 1) {
      saveBlob(new Blob([ok[0].out as BlobPart], { type: 'application/pdf' }), outName(ok[0]));
      return;
    }
    const names = uniqueNames(ok.map(outName));
    const zip = await buildZip(ok.map((i, k) => ({ name: names[k], blob: new Blob([i.out as BlobPart]) })));
    saveBlob(zip, 'compressed-pdfs.zip');
    say(`Downloaded ${ok.length} PDFs as a .zip (${formatBytes(zip.size)}).`);
  });

  levelNote.textContent = NOTES[level()];
}
