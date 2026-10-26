/*
  Page length indicator (components/PageProgress.astro). Writes the numbers
  every variant draws from:
    root      --p (0..1 down the page), --active (chapter index)
    chapter   --at / --len (its start and length, 0..1 of the page),
              --cp (0..1 through it), .is-active / .is-past
  Chapters start at the scroll positions getStarts() returns.

  DEMO: also wires the temporary style switcher (?indicator=1-4 or the
  buttons; the pick is remembered in this browser).
*/
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const STORE = 'about-indicator';

export function mountPageProgress(root: HTMLElement, getStarts: () => number[]) {
  const chapters = [...root.querySelectorAll<HTMLElement>('[data-pp-chapter]')];
  const pcts = [...root.querySelectorAll<HTMLElement>('[data-pp-pct]')];
  let starts: number[] = [0];
  let max = 1;
  let shownActive = -1;
  let shownPct = '';

  function measure() {
    max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    starts = getStarts();
    chapters.forEach((el) => {
      const i = Number(el.dataset.ppChapter);
      const end = starts[i + 1] ?? max;
      el.style.setProperty('--at', String(starts[i] / max));
      el.style.setProperty('--len', String((end - starts[i]) / max));
    });
    render();
  }

  function render() {
    const y = window.scrollY;
    root.style.setProperty('--p', clamp(y / max).toFixed(4));

    let active = 0;
    starts.forEach((s, i) => y >= s - 1 && (active = i));
    if (active !== shownActive) {
      shownActive = active;
      root.style.setProperty('--active', String(active));
    }
    chapters.forEach((el) => {
      const i = Number(el.dataset.ppChapter);
      const end = starts[i + 1] ?? max;
      el.style.setProperty('--cp', clamp((y - starts[i]) / (end - starts[i])).toFixed(4));
      el.classList.toggle('is-active', i === active);
      el.classList.toggle('is-past', i <= active);
    });

    const pct = String(Math.round(clamp(y / max) * 100)).padStart(2, '0');
    if (pct !== shownPct) {
      shownPct = pct;
      pcts.forEach((el) => (el.textContent = pct));
    }
  }

  measure();
  window.addEventListener('scroll', render, { passive: true });
  window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);

  // DEMO switcher
  const demo = document.querySelector<HTMLElement>('[data-pp-demo]');
  const buttons = [...(demo?.querySelectorAll<HTMLButtonElement>('[data-pp-pick]') ?? [])];
  function pick(v: string) {
    root.dataset.variant = v;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ppPick === v)));
    try {
      localStorage.setItem(STORE, v);
    } catch {}
  }
  let initial = new URLSearchParams(location.search).get('indicator');
  if (!initial) {
    try {
      initial = localStorage.getItem(STORE);
    } catch {}
  }
  pick(initial && /^[1-4]$/.test(initial) ? initial : '1');
  buttons.forEach((b) => b.addEventListener('click', () => pick(b.dataset.ppPick!)));
}
