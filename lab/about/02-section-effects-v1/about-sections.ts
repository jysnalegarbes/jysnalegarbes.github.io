/*
  About text sections (Figma 1:384 → 1:711). Each section pins its own
  screen (a sticky stage inside a taller section), so the Figma layout
  holds while it's read. Everything is driven by scroll:

    entry  while the section scrolls in: words (chars for big headings)
           condense out of ink, through the same goo filter as the case
           pages, in a wave that sweeps each line left to right
    hold   pinned, readable
    exit   as it scrolls away: the words melt upward, like the case
           outro, while the next section condenses in below

  On top, a velocity bend: scrolling bends the lines into a travelling
  sine (a text cousin of the Work page's Flag ripple) that settles flat
  when the scroll stops.

  Scroll position is eased time-based (no stepping on wheel notches); the
  loop only runs while something moves. Reduced motion: plain fades, no
  movement, no filter.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const SVG_NS = 'http://www.w3.org/2000/svg';

const SMOOTHING = 0.08; // s, scroll easing
const VEL_SMOOTHING = 0.14; // s
const SPREAD = 0.55; // share of a phase taken by the left-to-right stagger
const ENTER_FROM = 0.3; // section progress (screens scrolled in) where entry starts…
const ENTER_TO = 1.1; // …and ends (just after the pin starts)
const EXIT_LEAD = 0.1; // exit starts this many screens before the pin ends…
const EXIT_LEN = 0.7; // …and lasts this long
const RISE = 0.6; // em, entry offset
const LIFT = 0.5; // em, exit offset
const WAVE_AMP = 0.14; // em at full speed
const WAVE_ROT = 2.4; // deg at full speed
const WAVE_SPEED = 2200; // px/s for the full bend
const WAVE_LEN = 0.85; // waves per text-block width

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;

interface Piece {
  el: HTMLElement;
  x: number; // 0..1 across the block
  line: number;
  order: number; // 0..1 stagger position
}

interface Target {
  el: HTMLElement;
  delay: number;
  em: number;
  pieces: Piece[];
  blur: SVGFEGaussianBlurElement;
  filter: string;
}

interface Photo {
  el: HTMLElement;
  rot: number;
  order: number;
}

interface Section {
  el: HTMLElement;
  top: number;
  height: number;
  exit: boolean;
  targets: Target[];
  photos: Photo[];
  parked: boolean;
}

export function mountAboutSections(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-about-section]')];
  if (!els.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 1024px)');

  // Loop state (declared first: SplitText's onSplit can request a render
  // while the sections are still being set up)
  let H = window.innerHeight;
  let shownY = window.scrollY;
  let vel = 0;
  let time = 0;
  let raf = 0;
  let last = 0;

  // One goo filter per text block: the blur peak depends on its size
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);
  let filterCount = 0;
  function makeFilter() {
    const id = `about-goo-${filterCount++}`;
    const f = document.createElementNS(SVG_NS, 'filter');
    f.id = id;
    f.setAttribute('x', '-10%');
    f.setAttribute('y', '-40%');
    f.setAttribute('width', '120%');
    f.setAttribute('height', '180%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -6" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />`;
    svg.append(f);
    return { blur: f.querySelector('feGaussianBlur')!, filter: `url(#${id})` };
  }

  // Stagger order: line by line, left to right, lines overlapping
  function collect(target: Target, nodes: HTMLElement[]) {
    const box = target.el.getBoundingClientRect();
    target.em = parseFloat(getComputedStyle(target.el).fontSize);
    const raw = nodes.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: box.width ? (r.left + r.width / 2 - box.left) / box.width : 0, top: r.top - box.top };
    });
    const tops: number[] = [];
    raw.forEach((p) => {
      if (!tops.some((t) => Math.abs(t - p.top) < target.em * 0.5)) tops.push(p.top);
    });
    tops.sort((a, b) => a - b);
    const lineOf = (top: number) => tops.findIndex((t) => Math.abs(t - top) < target.em * 0.5);
    const ranked = raw.map((p) => ({ ...p, line: lineOf(p.top), rank: lineOf(p.top) * 0.45 + p.x }));
    const max = Math.max(...ranked.map((p) => p.rank), 0.0001);
    target.pieces = ranked.map((p) => ({ el: p.el, x: p.x, line: p.line, order: p.rank / max }));
  }

  const sections: Section[] = els.map((el) => {
    const section: Section = {
      el,
      top: 0,
      height: 0,
      exit: !el.hasAttribute('data-no-exit'),
      targets: [],
      photos: [],
      parked: false,
    };
    el.querySelectorAll<HTMLElement>('[data-reveal]').forEach((node) => {
      const chars = node.dataset.reveal === 'chars';
      const target: Target = {
        el: node,
        delay: parseFloat(node.dataset.revealDelay ?? '0'),
        em: 16,
        pieces: [],
        ...makeFilter(),
      };
      SplitText.create(node, {
        type: chars ? 'words,chars' : 'words',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        autoSplit: true,
        onSplit(self) {
          collect(target, (chars ? self.chars : self.words) as HTMLElement[]);
          section.parked = false;
          requestRender();
        },
      });
      section.targets.push(target);
    });
    const photos = [...el.querySelectorAll<HTMLElement>('[data-reveal-photo]')];
    section.photos = photos.map((p, i) => ({
      el: p,
      rot: parseFloat(p.dataset.revealPhoto ?? '0'),
      order: photos.length > 1 ? i / (photos.length - 1) : 0,
    }));
    return section;
  });

  function measure() {
    H = window.innerHeight;
    sections.forEach((s) => {
      s.top = s.el.getBoundingClientRect().top + window.scrollY;
      s.height = s.el.offsetHeight;
      s.parked = false;
    });
  }

  function renderSection(sec: Section, amp: number) {
    // Screens scrolled into the section: 0 = its top at the bottom edge,
    // 1 = pinned, height/H = pin ends
    const s = (shownY + H - sec.top) / H;
    const end = sec.height / H;
    const active = s > -0.05 && s < end + EXIT_LEN + 0.05;
    if (!active && sec.parked) return;
    sec.parked = !active;

    const qIn = seg(s, ENTER_FROM, ENTER_TO);
    const qOut = sec.exit ? seg(s, end - EXIT_LEAD, end - EXIT_LEAD + EXIT_LEN) : 0;
    const goo = desktop.matches && !reduced;

    sec.targets.forEach((t) => {
      const tIn = clamp((qIn - t.delay) / (1 - t.delay));
      const tOut = clamp((qOut - t.delay * 0.5) / (1 - t.delay * 0.5));
      const melting = goo && ((tIn > 0 && tIn < 1) || (tOut > 0 && tOut < 1));
      t.el.style.filter = melting ? t.filter : '';
      if (melting) {
        const peak = 0.4 + t.em * 0.03;
        t.blur.setAttribute('stdDeviation', String(peak * Math.max(1 - tIn, tOut)));
      }
      const phaseT = time * 2.4;
      t.pieces.forEach((p) => {
        const eIn = easeOut(clamp((tIn - p.order * SPREAD) / (1 - SPREAD)));
        const eOut = easeIn(clamp((tOut - p.order * SPREAD) / (1 - SPREAD)));
        const opacity = eIn * (1 - eOut);
        p.el.style.opacity = String(opacity);
        if (reduced) return;
        const phase = p.x * Math.PI * 2 * WAVE_LEN + p.line * 0.7 - phaseT;
        const y = ((1 - eIn) * RISE - eOut * LIFT + amp * WAVE_AMP * Math.sin(phase)) * t.em;
        const rot = amp * WAVE_ROT * Math.cos(phase);
        p.el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      });
    });

    // Photo stack: dealt in one by one from below, bottom photo first
    sec.photos.forEach((ph, i) => {
      const eIn = easeOut(clamp((qIn - ph.order * 0.45) / 0.55));
      const eOut = easeIn(qOut);
      ph.el.style.opacity = String(eIn * (1 - eOut));
      if (reduced) return;
      const y = (1 - eIn) * H * 0.22 - eOut * H * 0.1;
      const rot = ph.rot + (1 - eIn) * (i % 2 ? 7 : -7);
      ph.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    });
  }

  function renderAll() {
    const amp = reduced ? 0 : clamp(vel / WAVE_SPEED, -1, 1);
    sections.forEach((s) => renderSection(s, amp));
  }

  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000) || 1 / 60;
    last = now;
    time += dt;
    const prev = shownY;
    const target = window.scrollY;
    shownY = reduced ? target : shownY + (target - shownY) * (1 - Math.exp(-dt / SMOOTHING));
    if (Math.abs(target - shownY) < 0.3) shownY = target;
    vel += ((shownY - prev) / dt - vel) * (1 - Math.exp(-dt / VEL_SMOOTHING));
    if (shownY === target && Math.abs(vel) < 4) vel = 0;
    renderAll();
    raf = shownY === target && vel === 0 ? 0 : requestAnimationFrame(frame);
  }

  function requestRender() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  measure();
  renderAll();
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    shownY = window.scrollY;
    renderAll();
  });
  desktop.addEventListener('change', () => {
    measure();
    renderAll();
  });
  document.fonts?.ready.then(() => {
    measure();
    renderAll();
  });
}
