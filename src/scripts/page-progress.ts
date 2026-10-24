/*
  Page length indicator (components/PageProgress.astro): writes --p (0..1
  down the page) and --active (the chapter you're in) on the root, and the
  percentage. Chapters start at the scroll positions getStarts() returns.
*/
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function mountPageProgress(root: HTMLElement, getStarts: () => number[]) {
  const pct = root.querySelector<HTMLElement>('[data-pp-pct]');
  let starts: number[] = [0];
  let max = 1;
  let shownActive = -1;
  let shownPct = '';

  function measure() {
    max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    starts = getStarts();
    render();
  }

  function render() {
    const y = window.scrollY;
    const p = clamp(y / max);
    root.style.setProperty('--p', p.toFixed(4));

    let active = 0;
    starts.forEach((s, i) => y >= s - 1 && (active = i));
    if (active !== shownActive) {
      shownActive = active;
      root.style.setProperty('--active', String(active));
    }

    const text = String(Math.round(p * 100)).padStart(2, '0');
    if (pct && text !== shownPct) {
      shownPct = text;
      pct.textContent = text;
    }
  }

  measure();
  window.addEventListener('scroll', render, { passive: true });
  window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
}
