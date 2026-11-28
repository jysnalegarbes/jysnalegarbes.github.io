/*
  In Progress layouts: shared pieces
  ----------------------------------
  Items, tiles, the cursor label, the focus view (click an image: it grows
  from where it was into a large view with its title) and a smoothed value
  for wheel / drag input. Used by the five layout options in this folder.
*/
import gsap from 'gsap';
import settingsJson from '../../config/in-progress-layouts.json';

export type LayoutSettings = typeof settingsJson;

export interface IpItem {
  src: string | null;
  title: string;
}

export interface Layout {
  /** Re-place everything after a settings change or resize */
  refresh(): void;
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Exponential approach that never snaps on dt = 0 */
export const ease = (lag: number, dt: number) => (lag <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / lag));

export function readItems(root: HTMLElement): IpItem[] {
  try {
    return JSON.parse(root.dataset.items ?? '[]');
  } catch {
    return [];
  }
}

/** Cycle the items to at least n entries */
export function repeat<T>(items: T[], n: number): T[] {
  if (!items.length) return [];
  return Array.from({ length: Math.max(n, items.length) }, (_, i) => items[i % items.length]);
}

/** Width / height of each loaded image, by src (the focus view sizes to it) */
export const aspects = new Map<string, number>();

/** An image tile (or the brown placeholder when the entry has no image) */
export function tile(item: IpItem, className = 'ipx-tile'): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.dataset.title = item.title;
  if (item.src) {
    const img = document.createElement('img');
    img.addEventListener('load', () => aspects.set(item.src!, img.naturalWidth / img.naturalHeight), { once: true });
    img.src = item.src;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    el.append(img);
  } else {
    el.classList.add('is-empty');
  }
  return el;
}

/** Pill that follows the cursor with the hovered item's title */
export function cursorLabel(stage: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'ipx-label';
  el.setAttribute('aria-hidden', 'true');
  stage.append(el);
  let text = '';
  return {
    move(x: number, y: number) {
      el.style.translate = `${x}px ${y}px`;
    },
    show(t: string | null) {
      if (t === text) return;
      text = t ?? '';
      if (t) el.textContent = t;
      el.classList.toggle('is-on', !!t);
    },
  };
}

/* ---------- Focus view ---------- */

let focusEl: HTMLElement | null = null;

/** Grow an item from `from` (screen rect) into a large view; click or Escape closes */
export function openFocus(item: IpItem, from: DOMRect | null) {
  focusEl?.remove();
  const el = document.createElement('div');
  el.className = 'ipx-focus';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', item.title);
  el.setAttribute('data-ip-ignore', '');
  const media = tile(item, 'ipx-tile ipx-focus__media');
  // The whole image, at its own proportions
  const ar = item.src ? aspects.get(item.src) : undefined;
  if (ar) el.style.setProperty('--ar', ar.toFixed(4));
  const cap = document.createElement('div');
  cap.className = 'ipx-focus__cap';
  cap.innerHTML = `<p class="ipx-focus__title"></p><button type="button" class="ipx-focus__close">Close</button>`;
  cap.querySelector('p')!.textContent = item.title;
  const back = document.createElement('div');
  back.className = 'ipx-focus__back';
  el.append(back, media, cap);
  document.body.append(el);
  focusEl = el;

  const to = media.getBoundingClientRect();
  const d = reduced() ? 0 : 0.8;
  const tl = gsap.timeline();
  tl.fromTo(back, { opacity: 0 }, { opacity: 1, duration: d * 0.6, ease: 'power2.out' }, 0);
  if (from && to.width) {
    tl.fromTo(
      media,
      {
        x: from.left + from.width / 2 - (to.left + to.width / 2),
        y: from.top + from.height / 2 - (to.top + to.height / 2),
        scaleX: from.width / to.width,
        scaleY: from.height / to.height,
      },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: d, ease: 'expo.out' },
      0,
    );
  }
  tl.fromTo(cap, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: d * 0.6, ease: 'power3.out' }, d * 0.3);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    gsap.to(el, { opacity: 0, duration: d * 0.4, ease: 'power2.out', onComplete: () => el.remove() });
    if (focusEl === el) focusEl = null;
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', close);
  cap.querySelector<HTMLButtonElement>('button')!.focus({ preventScroll: true });
}

export const focusOpen = () => !!focusEl;

/* ---------- Input ---------- */

interface DragHandlers {
  /** Wheel / trackpad, in px */
  wheel?(dx: number, dy: number, e: WheelEvent): void;
  down?(x: number, y: number, e: PointerEvent): boolean | void;
  move?(dx: number, dy: number, x: number, y: number, e: PointerEvent): void;
  /** vx, vy: release speed, px/s; moved: whether it was a drag rather than a click */
  up?(vx: number, vy: number, moved: boolean, e: PointerEvent): void;
  hover?(x: number, y: number, e: PointerEvent): void;
}

/** Wheel + pointer drag on `el`, ignoring the header and the tweak panel */
export function bindInput(el: HTMLElement, h: DragHandlers) {
  const ignored = (t: EventTarget | null) =>
    !!(t as Element | null)?.closest?.('[data-ip-ignore], .site-header') || focusOpen();
  let drag: { id: number; x: number; y: number; sx: number; sy: number; vx: number; vy: number; t: number; moved: boolean } | null =
    null;

  window.addEventListener(
    'wheel',
    (e) => {
      if (ignored(e.target)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      h.wheel?.(e.deltaX * unit, e.deltaY * unit, e);
    },
    { passive: false },
  );

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || ignored(e.target)) return;
    if (h.down?.(e.clientX, e.clientY, e) === false) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: false };
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) {
      if (!drag) h.hover?.(e.clientX, e.clientY, e);
      return;
    }
    const now = performance.now();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const dt = Math.max(1, now - drag.t) / 1000;
    // Smoothed release speed
    drag.vx += (dx / dt - drag.vx) * 0.5;
    drag.vy += (dy / dt - drag.vy) * 0.5;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.t = now;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    h.move?.(dx, dy, e.clientX, e.clientY, e);
    h.hover?.(e.clientX, e.clientY, e);
  });

  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    // A pause before letting go means no flick
    const still = performance.now() - drag.t > 90;
    h.up?.(still ? 0 : drag.vx, still ? 0 : drag.vy, drag.moved, e);
    drag = null;
    el.classList.remove('is-dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** A rAF loop with dt in seconds (clamped, never negative) */
export function loop(fn: (dt: number, now: number) => void) {
  let last = performance.now();
  const tick = (now: number) => {
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    fn(dt, now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
