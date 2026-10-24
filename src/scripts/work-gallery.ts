/*
  Work gallery
  ------------
  The rest layout is the Figma one, laid out by CSS: the current project
  big on the left ("main slot") and the rest stepping down to the right.
  JS measures those slots once, then drives every card along them from a
  single virtual position `current` (0 = first project in the main slot),
  so cards slide and grow into the main slot as you scroll, drag or swipe.
  The strip loops forever: the set is cloned until there are enough cards
  that the wrap point always sits off screen.

  The project details (number, year, name, category) never move: they
  belong to the main slot and melt over to whichever project settles there
  (gooey cross-fade in place, after Codrops' Gooey Text Hover, demo 1).

  Clicking a card outside the main slot glides it in; clicking the card in
  the main slot opens its case study. Keyboard: Tab to a card brings it in,
  Enter opens it; arrows and Page Up/Down step through.

  Without JS the static, horizontally scrollable layout stays as is.
*/
import gsap from 'gsap';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardFrame extends Rect {
  /** 1 in the main slot, 0 one step or more away */
  focus: number;
}

export interface GalleryFrame {
  cards: CardFrame[];
  /** Signed scroll speed, roughly -1..1 (positive = moving forward) */
  velocity: number;
  time: number;
}

interface Options {
  reducedMotion: boolean;
  /** Called every frame while anything moves */
  onFrame?: (frame: GalleryFrame) => void;
  /**
    Called when the card in the main slot is clicked. Return true to take
    over (the link's default navigation is cancelled).
  */
  onOpen?: (index: number, link: HTMLAnchorElement) => boolean;
}

const LAST_PROJECT_KEY = 'work-project';
export const RETURN_KEY = 'work-return';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Cards needed so the loop's wrap point never shows (2 left of the main slot, 4 right) */
const MIN_CARDS = 7;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function mountWorkGallery(root: HTMLElement, { reducedMotion, onFrame, onOpen }: Options) {
  const track = root.querySelector<HTMLElement>('.work__track');
  const originals = [...root.querySelectorAll<HTMLElement>('[data-work-item]')];
  const details = root.querySelector<HTMLElement>('[data-work-details]');
  const scroller = root.querySelector<HTMLElement>('[data-work-scroller]');
  const projects = originals.length;
  if (!projects || !details || !track) return null;

  // Clone the set for the loop. Clones are presentation only: hidden from
  // assistive tech and out of the tab order.
  const copies = projects > 1 ? Math.ceil(MIN_CARDS / projects) : 1;
  for (let c = 1; c < copies; c++) {
    originals.forEach((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.classList.remove('is-active', 'is-current');
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelector('a')?.setAttribute('tabindex', '-1');
      clone.querySelectorAll('[data-field-src]').forEach((el) => el.removeAttribute('data-field-src'));
      track.append(clone);
    });
  }

  const items = [...track.querySelectorAll<HTMLElement>('[data-work-item]')];
  const medias = items.map((item) => item.querySelector<HTMLElement>('[data-work-media]')!);
  const links = items.map((item) => item.querySelector<HTMLAnchorElement>('a')!);
  const count = items.length;
  const looping = projects > 1;

  let slots: Rect[] = [];
  let pitch = 0; // main-slot width + gap: one drag of this = one project
  let wheelStep = 400;

  // Work opens on project 01, except when coming back (Back button, or the
  // bfcache reload) from a case study opened here: then it reopens on the
  // project that was opened (RETURN_KEY is set by case-transition.ts)
  let saved = 0;
  try {
    const returning = sessionStorage.getItem(RETURN_KEY) === '1';
    sessionStorage.removeItem(RETURN_KEY);
    const type = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    if (returning && type !== 'navigate') saved = Number(sessionStorage.getItem(LAST_PROJECT_KEY)) || 0;
  } catch {}
  let target = saved > 0 && saved < projects ? saved : 0;
  let current = target;
  let locked = false;
  let lastFrame: GalleryFrame | null = null;
  let velocity = 0;
  let shownProject = -1;
  let lastInput = 0;
  let lastDir = 1;
  let snapped = true;
  let running = false;
  let last = performance.now();

  /** Card i's signed distance from the main slot, wrapped into the loop */
  const offset = (i: number, at: number) => {
    const d = i - at;
    if (!looping) return d;
    return ((((d + 2) % count) + count) % count) - 2;
  };
  const projectAt = (at: number) => ((Math.round(at) % projects) + projects) % projects;

  /* ---------- Layout ---------- */

  const rel = (r: DOMRect, base: DOMRect): Rect => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });

  function measure() {
    root.classList.remove('is-live');
    if (scroller) scroller.scrollLeft = 0;
    items.forEach((item, i) => item.classList.toggle('is-active', i === 0));
    medias.forEach((m) => m.removeAttribute('style'));
    items.forEach((it) => it.removeAttribute('style'));

    const base = root.getBoundingClientRect();
    slots = medias.slice(0, Math.min(4, count)).map((m) => rel(m.getBoundingClientRect(), base));

    // Each detail sits exactly where the first card's own copy rests;
    // year and category hold their right edge
    fields.forEach((field) => {
      const src = items[0].querySelector<HTMLElement>(`[data-field-src="${field}"]`);
      if (!src) return;
      const r = rel(src.getBoundingClientRect(), base);
      const el = fieldEls[field];
      const right = el.hasAttribute('data-align-end');
      el.style.left = `${right ? r.x + r.w : r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.height = `${r.h}px`;
    });

    const gap = slots.length > 2 ? slots[2].x - (slots[1].x + slots[1].w) : 24;
    pitch = slots[0].w + gap;
    wheelStep = clamp(window.innerHeight * 0.45, 280, 520);

    root.classList.add('is-live');
    render(true);
  }

  /** Rest rect for slot k (k may run past the measured ones, or below 0) */
  function slot(k: number): Rect {
    const s0 = slots[0];
    // Leaving cards clear the screen edge fully (one gap past it), then
    // keep a card's pitch apart
    if (k < 0) {
      const gap = pitch - s0.w;
      return { ...s0, x: -s0.w - gap + (k + 1) * pitch };
    }
    if (k < slots.length) return slots[k];
    const lastS = slots[slots.length - 1];
    const prev = slots[slots.length - 2] ?? { ...lastS, x: lastS.x - lastS.w - 24 };
    return { ...lastS, x: lastS.x + (k - slots.length + 1) * (lastS.x - prev.x) };
  }

  function slotAt(d: number): Rect {
    const k = Math.floor(d);
    const a = slot(k);
    const b = slot(k + 1);
    const t = d - k;
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
  }

  /* ---------- Details: gooey cross-fade ---------- */

  const fields = ['index', 'year', 'title', 'category'] as const;
  type Field = (typeof fields)[number];
  const fieldEls = Object.fromEntries(
    fields.map((f) => [f, details.querySelector<HTMLElement>(`[data-field="${f}"]`)!]),
  ) as Record<Field, HTMLElement>;

  // One blur + alpha-threshold filter per field, pulsed during a swap
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);
  const goo = Object.fromEntries(
    fields.map((field) => {
      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.id = `work-goo-${field}`;
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '200%');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
      blur.setAttribute('in', 'SourceGraphic');
      blur.setAttribute('stdDeviation', '0');
      blur.setAttribute('result', 'blur');
      const matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
      matrix.setAttribute('in', 'blur');
      matrix.setAttribute('type', 'matrix');
      // Lower threshold than Codrops' 18 -8: mid-fade both copies sit near
      // 50% opacity, and Playfair hairlines / 14px strokes would vanish
      matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -6');
      matrix.setAttribute('result', 'goo');
      const composite = document.createElementNS(SVG_NS, 'feComposite');
      composite.setAttribute('in', 'SourceGraphic');
      composite.setAttribute('in2', 'goo');
      composite.setAttribute('operator', 'atop');
      filter.append(blur, matrix, composite);
      svg.append(filter);
      return [field, { id: filter.id, blur, tl: null as gsap.core.Timeline | null }];
    }),
  ) as Record<Field, { id: string; blur: SVGFEGaussianBlurElement; tl: gsap.core.Timeline | null }>;

  function showDetails(project: number) {
    const data = items[project].dataset;
    fields.forEach((field) => {
      const box = fieldEls[field];
      const text = data[field] ?? '';
      const texts = [...box.querySelectorAll<HTMLElement>('.work-detail__text')];
      const old = texts[texts.length - 1];
      if (old?.textContent === text) return;

      const next = document.createElement('span');
      next.className = 'work-detail__text';
      next.textContent = text;
      box.append(next);

      const g = goo[field];
      g.tl?.progress(1);
      if (!old || reducedMotion || shownProject < 0) {
        box.querySelectorAll('.work-detail__text').forEach((el) => el !== next && el.remove());
        return;
      }

      // Demo 1: the copies cross-fade in place (opacity linear; 0.9s rather
      // than Codrops' 1.6s so the text lands with the card) while
      // the blur pulses 0 → peak → 0, so the old text melts into the new.
      // Peak blur: ~0.6px on 14px text, ~1.6px on the 80px number; more
      // breaks Playfair's hairlines apart at the threshold
      const peak = 0.4 + parseFloat(getComputedStyle(box).fontSize) * 0.015;
      const state = { blur: 0 };
      box.style.filter = `url(#${g.id})`;
      g.tl = gsap
        .timeline({
          onUpdate: () => g.blur.setAttribute('stdDeviation', String(state.blur)),
          onComplete: () => {
            box.style.filter = '';
            g.blur.setAttribute('stdDeviation', '0');
            old.remove();
            g.tl = null;
          },
        })
        .to(state, { blur: peak, duration: 0.45, ease: 'none' }, 0)
        .to(state, { blur: 0, duration: 0.45, ease: 'none' }, 0.45)
        .to(old, { opacity: 0, duration: 0.9, ease: 'none' }, 0)
        .fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'none' }, 0);
    });
    items.forEach((item, i) => item.classList.toggle('is-current', i % projects === project && Math.abs(offset(i, current)) < 0.5));
    shownProject = project;
    try {
      sessionStorage.setItem(LAST_PROJECT_KEY, String(project));
    } catch {}
  }

  /* ---------- Frame ---------- */

  function render(force = false) {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    // Once input goes quiet, settle on a project, leaning the way the
    // input went so a single wheel notch still moves one project
    if (!dragging && !snapped && now - lastInput > 140) {
      target = lastDir > 0 ? Math.ceil(target - 0.15) : Math.floor(target + 0.15);
      if (!looping) target = clamp(target, 0, count - 1);
      snapped = true;
    }

    const prev = current;
    current = reducedMotion ? target : current + (target - current) * (1 - Math.exp(-dt * 6.5));
    if (Math.abs(target - current) < 0.0005) current = target;
    const raw = dt > 0 ? (current - prev) / dt : 0;
    velocity += (clamp(raw / 3, -1, 1) - velocity) * (1 - Math.exp(-dt * 8));
    if (Math.abs(velocity) < 0.001 && current === target) velocity = 0;

    const project = projectAt(current);
    if (project !== shownProject) showDetails(project);

    const cards: CardFrame[] = items.map((item, i) => {
      const d = offset(i, current);
      const r = slotAt(d);
      item.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      medias[i].style.width = `${r.w}px`;
      medias[i].style.height = `${r.h}px`;
      return { ...r, focus: clamp(1 - Math.abs(d), 0, 1) };
    });

    lastFrame = { cards, velocity, time: now / 1000 };
    onFrame?.(lastFrame);

    const settled = current === target && velocity === 0 && snapped && !dragging;
    if (settled && !force) stop();
  }

  const tick = () => render();
  function wake() {
    if (running || locked) return;
    running = true;
    last = performance.now();
    gsap.ticker.add(tick);
  }
  function stop() {
    running = false;
    gsap.ticker.remove(tick);
  }

  /** Bring card i into the main slot the short way round */
  function bring(i: number) {
    target = Math.round(current + offset(i, current));
    snapped = true;
    wake();
  }

  function step(by: number) {
    target = Math.round(target) + by;
    if (!looping) target = clamp(target, 0, count - 1);
    snapped = true;
    wake();
  }

  function nudge(delta: number) {
    if (delta) lastDir = Math.sign(delta);
    target += delta;
    if (!looping) target = clamp(target, -0.15, count - 0.85);
    lastInput = performance.now();
    snapped = false;
    wake();
  }

  /* ---------- Input ---------- */

  const onWheel = (e: WheelEvent) => {
    if ((e.target as Element).closest('.site-header')) return;
    e.preventDefault();
    if (locked) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    nudge((d * (e.deltaMode === 1 ? 16 : 1)) / wheelStep);
  };

  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let start = { x: 0, y: 0, target: 0 };
  let flick = { v: 0, x: 0, t: 0 };

  const onDown = (e: PointerEvent) => {
    if (locked || e.button !== 0 || !(e.target as Element).closest('[data-work-stage]')) return;
    dragging = true;
    moved = false;
    start = { x: e.clientX, y: e.clientY, target };
    flick = { v: 0, x: e.clientX, t: performance.now() };
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Touch can swipe either way; a mouse drags sideways
    const vertical = e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx);
    const d = vertical ? dy : dx;
    if (!moved && Math.abs(d) < 6) return;
    if (!moved) root.classList.add('is-dragging');
    moved = true;
    target = start.target - d / pitch;
    if (!looping) target = clamp(target, -0.3, count - 0.7);
    lastInput = performance.now();
    snapped = false;

    const now = performance.now();
    const pos = vertical ? e.clientY : e.clientX;
    if (now > flick.t) flick = { v: (pos - flick.x) / (now - flick.t), x: pos, t: now };
    wake();
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      // Carry a flick into the next project or two
      target = Math.round(target - (flick.v * 180) / pitch);
      if (!looping) target = clamp(target, 0, count - 1);
      snapped = true;
      wake();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
    const by: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
    if (!(e.key in by)) return;
    e.preventDefault();
    step(by[e.key]);
  };

  links.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      if (suppressClick || locked) {
        e.preventDefault();
        return;
      }
      // Outside the main slot a click only brings the project in
      if (Math.abs(offset(i, current)) > 0.5 || Math.abs(offset(i, target)) > 0.01) {
        e.preventDefault();
        bring(i);
        return;
      }
      // Modified clicks (new tab etc.) keep the plain link behaviour
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (onOpen?.(i, link)) e.preventDefault();
    });
    link.addEventListener('focus', () => {
      if (!locked && link.matches(':focus-visible')) bring(i);
    });
  });

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measure, 120);
  };
  window.addEventListener('resize', onResize);

  measure();

  return {
    wake,
    /** Every card's image, clones included, in render order */
    images: medias.map((m) => m.querySelector('img')!),
    medias,
    /** Stop reacting to input and stop the loop (a page transition owns the screen) */
    lock() {
      locked = true;
      stop();
    },
    /** The last frame drawn: card rects in render order */
    frame: () => lastFrame,
    /** The project (0-based, original order) a card index shows */
    projectOf: (i: number) => i % projects,
    destroy() {
      stop();
      svg.remove();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    },
  };
}

export type WorkGallery = NonNullable<ReturnType<typeof mountWorkGallery>>;
