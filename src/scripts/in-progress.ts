/*
  In Progress: pinned text, endless cards
  ---------------------------------------
  The page holds still (the intro text stays where it is) and the three
  card columns scroll by themselves, each wrapping around so the cards never
  run out. Wheel, touch drag (with a flick) and the keyboard move them;
  the shown position eases after the input like Lenis.

  Each column repeats its cards as many times as it takes to cover the
  screen, and every card is placed at
      y = mod(rest − low, T) + low − scroll,  low = max(0, scroll − A)
  (T: the column's repeated length, A: how far above the screen a card may
  go before it comes back in at the bottom). The loop runs downward without
  end; scrolling back up stops at the rest layout (the Figma composition,
  nothing above the stepped first row).

  Scroll effects on test (scrollFx, ?sfx=1..3):
    1 Velocity Skew  cards lean and stretch with the scroll speed, and
                     straighten as it settles
    2 Drum Roll      cards tilt away (rotateX) and shrink toward the top and
                     bottom of the screen, as if on a turning drum
    3 Column Drift   the columns travel at different speeds and catch up
                     with different lags (left slow, right fast)
  Hover effects live in in-progress-hover.ts. Settings:
  src/config/in-progress.json; /in-progress/?tweak opens their panel.
  Reduced motion: no easing, no effects.
*/
import defaults from '../config/in-progress.json';
import { mountInProgressHover, type InProgressHover } from './in-progress-hover';

export type InProgressSettings = typeof defaults;

export const SCROLL_FX = { 'Velocity Skew': 1, 'Drum Roll': 2, 'Column Drift': 3 };
export const HOVER_FX = { 'Halftone Lens': 1, 'Pixel Trail': 2, 'Liquid RGB': 3 };

export interface InProgressApi {
  settings: InProgressSettings;
  /** Re-render after a settings change */
  refresh(): void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

interface Column {
  el: HTMLElement;
  originals: HTMLElement[];
  cards: HTMLElement[];
  top: number; // rest top of the first card, from the top of the screen
  span: number; // T
  above: number; // A
  shown: number; // eased scroll position, px
  last: number;
  speed: number; // px/s, smoothed
}

export function mountInProgress(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('[data-ip-grid]');
  const colEls = [...root.querySelectorAll<HTMLElement>('[data-ip-col]')];
  if (!grid || !colEls.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 1024px)');
  const settings: InProgressSettings = structuredClone(defaults);
  const params = new URLSearchParams(location.search);
  const pick = (key: string, list: Record<string, number>) => {
    const n = Number(params.get(key));
    return Object.values(list).includes(n) ? n : null;
  };
  settings.scrollFx = pick('sfx', SCROLL_FX) ?? settings.scrollFx;
  settings.hoverFx = pick('hfx', HOVER_FX) ?? settings.hoverFx;

  const columns: Column[] = colEls.map((el) => ({
    el,
    originals: [...el.children] as HTMLElement[],
    cards: [],
    top: 0,
    span: 1,
    above: 0,
    shown: 0,
    last: 0,
    speed: 0,
  }));

  root.classList.add('is-live');

  let H = 0;
  let cardH = 0;
  let step = 1;
  let target = 0;

  // Drift (3): each column's share of the scroll and its extra lag
  const driftSpeed = (i: number) =>
    settings.scrollFx === 3 ? [settings.drift.slow, 1, settings.drift.fast][i] ?? 1 : 1;
  const lagOf = (i: number) =>
    settings.scroll.smoothing + (settings.scrollFx === 3 ? settings.drift.lag * ([0.5, 0, 1][i] ?? 0) : 0);

  function build() {
    H = window.innerHeight;
    // Clones out; measure the rest layout from the originals
    columns.forEach((c) => {
      c.el.replaceChildren(...c.originals);
      c.originals.forEach((card) => (card.style.transform = ''));
    });
    grid!.style.removeProperty('--ip-grid-h');
    const gridTop = grid!.getBoundingClientRect().top;
    if (!desktop.matches) grid!.style.setProperty('--ip-grid-h', `${Math.max(0, H - gridTop)}px`);

    cardH = columns[0].originals[0]?.offsetHeight ?? 0;
    const gap = parseFloat(getComputedStyle(columns[0].el).rowGap) || 0;
    step = Math.max(1, cardH + gap);

    columns.forEach((c) => {
      const n = c.originals.length;
      if (!n) return;
      c.top = c.el.getBoundingClientRect().top;
      c.above = c.top + step;
      const copies = Math.max(1, Math.ceil((H + c.above + step) / (n * step)));
      c.span = n * copies * step;
      const cards = [...c.originals];
      for (let k = 1; k < copies; k++) {
        c.originals.forEach((o) => {
          const clone = o.cloneNode(true) as HTMLElement;
          clone.setAttribute('aria-hidden', 'true');
          cards.push(clone);
        });
      }
      c.el.replaceChildren(...cards);
      c.cards = cards;
      // Drum Roll: vanishing point at the middle of the screen
      c.el.style.perspective = `${settings.drum.perspective}px`;
      c.el.style.perspectiveOrigin = `50% ${H / 2 - c.top}px`;
    });
    hover?.cardsChanged();
  }

  function place(c: Column) {
    const fx = reduced ? 0 : settings.scrollFx;
    const { maxDeg, perSpeed, stretch } = settings.skew;
    const lean = clamp(c.speed * perSpeed, -maxDeg, maxDeg);
    const squash = 1 + (Math.abs(lean) / Math.max(0.01, maxDeg)) * stretch;
    // Window the cards may sit in: from `above` over the top of the screen,
    // but never above the rest layout, so the top stays the Figma composition
    const low = Math.max(0, c.shown - c.above);
    c.cards.forEach((card, j) => {
      const y = mod(j * step - low, c.span) + low - c.shown;
      let t = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      if (fx === 1) {
        t += ` skewY(${(-lean).toFixed(3)}deg) scaleY(${squash.toFixed(4)})`;
      } else if (fx === 2) {
        const mid = c.top + y + cardH / 2;
        const d = clamp((mid - H / 2) / (H / 2), -1.4, 1.4);
        t += ` rotateX(${(-d * settings.drum.angle).toFixed(3)}deg) scale(${(1 - Math.abs(d) * settings.drum.shrink).toFixed(4)})`;
      }
      card.style.transform = t;
    });
  }

  let raf = 0;
  let lastT = 0;

  function frame(now: number) {
    // rAF stamps can be a hair before the performance.now() that asked for them
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));
    lastT = now;
    let busy = false;
    columns.forEach((c, i) => {
      const goal = target * driftSpeed(i);
      const lag = reduced ? 0 : lagOf(i);
      c.shown = lag > 0 && dt > 0 ? c.shown + (goal - c.shown) * (1 - Math.exp(-dt / lag)) : goal;
      if (Math.abs(goal - c.shown) < 0.05) c.shown = goal;
      const v = dt > 0 ? (c.shown - c.last) / dt : 0;
      c.speed += (v - c.speed) * Math.min(1, dt / 0.08);
      if (Math.abs(c.speed) < 2 && c.shown === goal) c.speed = 0;
      c.last = c.shown;
      place(c);
      if (c.shown !== goal || c.speed !== 0) busy = true;
    });
    hover?.frame(busy);
    raf = busy ? requestAnimationFrame(frame) : 0;
  }

  function wake() {
    target = Math.max(0, target); // the loop runs downward from the rest layout
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Input ---------- */

  const ignored = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('[data-ip-ignore], .site-header');

  const onWheel = (e: WheelEvent) => {
    if (ignored(e.target)) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    target += d * unit * settings.scroll.wheel;
    wake();
  };

  let drag: { id: number; y: number; target: number; v: number; at: number; lastY: number } | null = null;

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || ignored(e.target)) return;
    drag = { id: e.pointerId, y: e.clientY, target, v: 0, at: performance.now(), lastY: e.clientY };
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    target = drag.target - (e.clientY - drag.y);
    const now = performance.now();
    if (now > drag.at) {
      drag.v = (e.clientY - drag.lastY) / (now - drag.at); // px/ms
      drag.at = now;
      drag.lastY = e.clientY;
    }
    wake();
  };

  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    // Carry the flick on (a released swipe keeps going a little)
    if (performance.now() - drag.at < 80) target -= drag.v * 320;
    drag = null;
    wake();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
    const page = H * 0.8;
    const by: Record<string, number> = {
      ArrowDown: 120,
      ArrowUp: -120,
      PageDown: page,
      PageUp: -page,
      ' ': e.shiftKey ? -page : page,
    };
    if (!(e.key in by)) return;
    e.preventDefault();
    target += by[e.key];
    wake();
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);

  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      build();
      columns.forEach(place);
    });
  };
  window.addEventListener('resize', onResize);
  desktop.addEventListener('change', onResize);

  const api: InProgressApi = {
    settings,
    refresh() {
      build();
      columns.forEach((c, i) => (c.shown = target * driftSpeed(i)));
      columns.forEach(place);
      hover?.refresh();
    },
  };

  const hover: InProgressHover | null = reduced ? null : mountInProgressHover(root, settings);

  build();
  columns.forEach(place);
  document.fonts?.ready.then(onResize);

  if (params.has('tweak')) {
    import('./in-progress-tweaks').then(({ mountInProgressTweaks }) =>
      mountInProgressTweaks(api, defaults, import.meta.env.DEV ? '/__in-progress' : null),
    );
  }
}
