/*
  Tools page layout round (frozen). One script for the three options:
    - ?pfx=1..3 shows one option (all three are in the page; 1 without JS)
    - Index: the hovered tool's screenshot follows the cursor (fine pointer
      only), eased, kept inside the viewport
    - Workbench: a dropped or chosen file lights up the tools that take it
*/

export function mountToolsLayout(root: HTMLElement) {
  const pfx = new URLSearchParams(location.search).get('pfx') ?? '1';
  root.dataset.show = ['1', '2', '3'].includes(pfx) ? pfx : '1';
  mountIndex(root);
  mountBench(root);
}

function mountIndex(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[data-index-list]');
  const preview = root.querySelector<HTMLElement>('[data-index-preview]');
  if (!list || !preview || !matchMedia('(pointer: fine)').matches) return;
  const imgs = [...preview.querySelectorAll('img')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let raf = 0;

  const place = () => {
    const w = preview.offsetWidth;
    const h = preview.offsetHeight;
    // Sits to the right of the cursor, flips left near the edge, stays on screen
    let px = tx + 72;
    if (px + w > innerWidth - 16) px = tx - w - 72;
    const py = Math.min(Math.max(16, ty - h / 2), innerHeight - h - 16);
    x += (px - x) * (reduce ? 1 : 0.16);
    y += (py - y) * (reduce ? 1 : 0.16);
    preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.abs(px - x) > 0.5 || Math.abs(py - y) > 0.5) raf = requestAnimationFrame(place);
    else raf = 0;
  };

  list.addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!preview.classList.contains('is-on')) {
      // First frame: jump straight to the cursor instead of flying in from 0,0
      x = tx + 72;
      y = ty - preview.offsetHeight / 2;
    }
    if (!raf) raf = requestAnimationFrame(place);
  });

  list.querySelectorAll<HTMLElement>('[data-shot]').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      const i = Number(row.dataset.shot);
      imgs.forEach((img, k) => img.classList.toggle('is-on', k === i));
      preview.classList.add('is-on');
    });
  });
  list.addEventListener('pointerleave', () => preview.classList.remove('is-on'));
}

function mountBench(root: HTMLElement) {
  const bench = root.querySelector<HTMLElement>('.tv-bench');
  const drop = root.querySelector<HTMLElement>('[data-bench-drop]');
  const input = root.querySelector<HTMLInputElement>('[data-bench-input]');
  const ask = root.querySelector<HTMLElement>('[data-bench-ask]');
  const hint = root.querySelector<HTMLElement>('[data-bench-hint]');
  if (!bench || !drop || !input || !ask || !hint) return;
  const hintHtml = hint.innerHTML;

  const kind = (f: File) =>
    f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
      ? 'pdf'
      : f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico|heic)$/i.test(f.name)
        ? 'image'
        : null;

  const pick = (f: File) => {
    const k = kind(f);
    const tools = [...bench.querySelectorAll<HTMLElement>('[data-tool-input]')];
    tools.forEach((t) => t.classList.toggle('is-match', t.dataset.toolInput === k));
    const n = tools.filter((t) => t.dataset.toolInput === k).length;
    bench.classList.toggle('has-file', true);
    drop.classList.add('has-file');
    ask.textContent = k ? `${f.name}: ${n} tools can work with it` : `Nothing here takes ${f.name.split('.').pop()?.toUpperCase() ?? 'that'} files yet`;
    hint.innerHTML = 'Pick one below, or <span class="tv-bench__link">choose another file</span>';
  };

  input.addEventListener('change', () => input.files?.[0] && pick(input.files[0]));
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  drop.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    drop.classList.remove('is-over');
    if (!hasFiles(e)) return;
    e.preventDefault();
    const f = e.dataTransfer!.files[0];
    if (f) pick(f);
  });
  // Escape clears the selection
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !bench.classList.contains('has-file')) return;
    bench.classList.remove('has-file');
    drop.classList.remove('has-file');
    bench.querySelectorAll('.is-match').forEach((t) => t.classList.remove('is-match'));
    ask.textContent = 'Drop a file to see what you can do with it';
    hint.innerHTML = hintHtml;
  });
}
