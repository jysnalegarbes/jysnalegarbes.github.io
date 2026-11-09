/*
  /tools/ index (lab round tools/01, option 1 "Index"): the hovered tool's
  real screenshot follows the cursor, eased and kept on screen. Fine
  pointers only; touch shows a thumbnail in each row instead (CSS).
*/

export function mountToolsIndex(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[data-index-list]');
  const preview = root.querySelector<HTMLElement>('[data-index-preview]');
  if (!list || !preview || !matchMedia('(pointer: fine)').matches) return;
  const imgs = [...preview.querySelectorAll('img')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAP = 72;
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let raf = 0;

  const target = () => {
    const w = preview.offsetWidth;
    const h = preview.offsetHeight;
    // Right of the cursor, flipping left near the edge, always on screen
    let px = tx + GAP;
    if (px + w > innerWidth - 16) px = tx - w - GAP;
    const py = Math.min(Math.max(16, ty - h / 2), innerHeight - h - 16);
    return [px, py];
  };

  const step = () => {
    const [px, py] = target();
    x += (px - x) * (reduce ? 1 : 0.16);
    y += (py - y) * (reduce ? 1 : 0.16);
    preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.abs(px - x) > 0.5 || Math.abs(py - y) > 0.5 ? requestAnimationFrame(step) : 0;
  };

  list.addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    // First frame: start at the cursor instead of flying in from the corner
    if (!preview.classList.contains('is-on')) [x, y] = target();
    if (!raf) raf = requestAnimationFrame(step);
  });

  list.querySelectorAll<HTMLElement>('[data-shot]').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      const i = Number(row.dataset.shot);
      imgs.forEach((img, k) => img.classList.toggle('is-on', k === i));
      preview.classList.add('is-on');
    });
  });
  list.addEventListener('pointerleave', () => preview.classList.remove('is-on'));
  // Leaving through a page transition or a scroll shouldn't strand it on screen
  addEventListener('scroll', () => preview.classList.remove('is-on'), { passive: true });
}
