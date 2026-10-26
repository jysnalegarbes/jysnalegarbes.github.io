/*
  Effects library page (/lab/):
    - previews: each [data-preview] gets its demo in an iframe drawn at
      1440×900 and scaled to the card, mounted only near the viewport and
      removed again when it leaves (WebGL contexts are limited per page)
    - filters by page and status, plus text search, hide cards and rounds
    - pause posts { lab: 'pause' | 'play' } to every preview; remembered
    - Copy fetches the raw source (/lab/src/...) onto the clipboard
*/

const FRAME_W = 1440;
const PAUSE_KEY = 'lab-paused';

export function mountLab(root: HTMLElement) {
  const frames = [...root.querySelectorAll<HTMLElement>('[data-preview]')];
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-pause]');
  let paused = false;
  try {
    paused = localStorage.getItem(PAUSE_KEY) === '1';
  } catch {}

  // ---------- Previews ----------

  const post = (iframe: HTMLIFrameElement) =>
    iframe.contentWindow?.postMessage({ lab: paused ? 'pause' : 'play' }, location.origin);

  const sizer = new ResizeObserver((entries) => {
    for (const e of entries) {
      (e.target as HTMLElement).style.setProperty('--s', String(e.contentRect.width / FRAME_W));
    }
  });

  const viewer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const slot = e.target as HTMLElement;
        const current = slot.querySelector('iframe');
        if (e.isIntersecting && !current) {
          const iframe = document.createElement('iframe');
          iframe.src = slot.dataset.preview!;
          iframe.title = 'Preview';
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          iframe.addEventListener('load', () => post(iframe));
          slot.append(iframe);
        } else if (!e.isIntersecting && current) {
          current.remove();
        }
      }
    },
    { rootMargin: '200px 0px' },
  );

  for (const f of frames) {
    sizer.observe(f);
    viewer.observe(f);
  }

  function setPaused(value: boolean) {
    paused = value;
    try {
      localStorage.setItem(PAUSE_KEY, value ? '1' : '0');
    } catch {}
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', String(value));
      pauseBtn.textContent = value ? 'Play previews' : 'Pause previews';
    }
    root.querySelectorAll('iframe').forEach(post);
  }
  setPaused(paused);
  pauseBtn?.addEventListener('click', () => setPaused(!paused));

  // ---------- Filters and search ----------

  const state = { page: '', status: '', text: '' };
  const empty = root.querySelector<HTMLElement>('[data-empty]');

  function apply() {
    let shown = 0;
    root.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
      let pageShown = 0;
      page.querySelectorAll<HTMLElement>('[data-round]').forEach((round) => {
        const pageOk = !state.page || page.dataset.page === state.page;
        // Text matches the round (all its options) or a single option
        const roundText = !state.text || round.dataset.searchText!.includes(state.text);
        let roundShown = 0;
        round.querySelectorAll<HTMLElement>('.lab-card').forEach((card) => {
          const textOk = roundText || card.dataset.searchText!.includes(state.text);
          const ok = pageOk && textOk && (!state.status || card.dataset.status === state.status);
          card.hidden = !ok;
          if (ok) roundShown++;
        });
        round.hidden = roundShown === 0;
        pageShown += roundShown;
      });
      page.hidden = pageShown === 0;
      shown += pageShown;
    });
    root.querySelectorAll<HTMLElement>('.lab-project').forEach((p) => {
      p.hidden = !p.querySelector('[data-page]:not([hidden])');
    });
    if (empty) empty.hidden = shown > 0;
  }

  root.querySelectorAll<HTMLElement>('[data-filter]').forEach((group) => {
    const key = group.dataset.filter as 'page' | 'status';
    group.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      state[key] = btn.dataset.value ?? '';
      apply();
    });
  });

  root.querySelector<HTMLInputElement>('[data-search]')?.addEventListener('input', (e) => {
    state.text = (e.target as HTMLInputElement).value.trim().toLowerCase();
    apply();
  });

  // ---------- Copy source ----------

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
    if (!btn) return;
    const label = btn.textContent;
    try {
      const res = await fetch(btn.dataset.copy!);
      if (!res.ok) throw new Error(String(res.status));
      await navigator.clipboard.writeText(await res.text());
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Failed';
    }
    setTimeout(() => (btn.textContent = label), 1400);
  });
}
