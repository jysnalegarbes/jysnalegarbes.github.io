/*
  About text sections (Figma 1:384 → 1:711). Transition brief: 67:107;
  sequence: 92:43. The five sections share one pinned screen: the text
  never scrolls, scroll only cues what is showing. Each section is a run of
  cues followed by an empty breather:

    data-len    screens from the section's start to its exit
    data-rest   screens of empty breather after the exit
    data-cue    screens into the section where a block appears
    data-fx-at  extra delay (s) once its cue is reached

  Crossing a cue plays the block's intro (time-based); scrolling back above
  it, or past the section's end, plays the exit. Intros, from data-fx:

    spotlight   chars sharpen in from the centre out (blur 4px, scale .8)
    bleed       the block sharpens in from an ink blur (blur 20px, scale .9)
    goo-1/2     Codrops Gooey Text Hover demo 1 (fade through goo) and demo
                2 (the same, sliding in from the left)
    mask-words  Osmo Masked Text Reveal: words rise out of line masks
    words-rise  words fade up 0.75em, one after another
    stack       scrubbed: rises from below the screen into place

  Exit, everywhere: the Ink Bleed reversed, the text dissolves into blur.

  Section 5 also scrubs: its [data-highlight] text lights up word by word,
  and the word in each photo's data-photo-trigger brings that photo in: it
  rises from below with the home hero's clip reveal while the previous one
  flies off the top (scrolling back plays it in reverse).

  Reduced motion: short fades, no movement, blur or filter.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(SplitText, CustomEase);

const SVG_NS = 'http://www.w3.org/2000/svg';
const OSMO_EASE = CustomEase.create('osmo-ease', '0.625, 0.05, 0, 1');

const REST = 0.6; // screens, default breather
const BLEED = 1.5; // s, Ink Bleed in and out
const GOO_2_SHIFT = 0.5; // em; demo 2 shifts 8 units on ~16-unit text
const WORDS_RISE = 0.75; // em; the brief's 15px on 20px text
const FADE = 0.4; // s, reduced motion

// Codrops goo variants: blur peak (em, from 1 / 1.5 units on ~16-unit
// text), duration, alpha threshold. Their red-into-blue matrix row is left
// out: it would tint the off-white.
const GOO = {
  'goo-1': { blur: 0.0625, duration: 1.6, matrix: '15 -8' },
  'goo-2': { blur: 0.094, duration: 1, matrix: '16 -7' },
} as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const easeOut = (t: number) => 1 - (1 - t) ** 2;

type Fx = 'spotlight' | 'bleed' | 'goo-1' | 'goo-2' | 'mask-words' | 'words-rise' | 'stack';

interface Block {
  el: HTMLElement;
  fx: Fx;
  cue: number;
  at: number;
  span: number; // stack: screens of scrub
  em: number;
  pieces: HTMLElement[]; // what the intro animates, if split
  goo: { blur: SVGFEGaussianBlurElement; filter: string } | null;
  shown: boolean;
  tl: gsap.core.Timeline | null;
}

interface Photo {
  el: HTMLElement;
  rot: number;
  trigger: string;
  word: number; // index in the highlight's words, -1 until split
}

interface Section {
  el: HTMLElement;
  start: number; // screens into the pin
  len: number;
  last: boolean;
  blocks: Block[];
  highlight: { block: Block; words: HTMLElement[]; tl: gsap.core.Timeline } | null;
  photos: Photo[];
  photoBox: HTMLElement | null;
  shownPhoto: number;
}

export function mountAboutSections(story: HTMLElement) {
  const stage = story.querySelector<HTMLElement>('[data-about-stage-story]');
  const els = [...story.querySelectorAll<HTMLElement>('[data-about-section]')];
  if (!stage || !els.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const white = getComputedStyle(document.documentElement).getPropertyValue('--white').trim() || '#fff';
  story.classList.add('is-story'); // final layout before anything is split

  // Declared first: SplitText's onSplit runs during setup
  let H = window.innerHeight;
  let storyTop = 0;
  let photoZ = 1;
  let ready = false;

  // One goo filter per goo block: the blur peak depends on its size
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);
  let filterCount = 0;
  function makeFilter(matrix: string) {
    const id = `about-goo-${filterCount++}`;
    const f = document.createElementNS(SVG_NS, 'filter');
    f.id = id;
    f.setAttribute('x', '-20%');
    f.setAttribute('y', '-40%');
    f.setAttribute('width', '140%');
    f.setAttribute('height', '180%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${matrix}" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />`;
    svg.append(f);
    return { blur: f.querySelector('feGaussianBlur')!, filter: `url(#${id})` };
  }

  // Intro start / end states of a block's pieces
  function pieceFrom(b: Block): gsap.TweenVars {
    if (b.fx === 'spotlight') return { opacity: 0.1, scale: 0.8, filter: 'blur(4px)' };
    if (b.fx === 'words-rise') return { opacity: 0, y: WORDS_RISE * b.em };
    return { yPercent: 110 };
  }
  function pieceTo(b: Block): gsap.TweenVars {
    if (b.fx === 'spotlight') return { opacity: 1, scale: 1, filter: 'blur(0px)' };
    if (b.fx === 'words-rise') return { opacity: 1, y: 0 };
    return { yPercent: 0 };
  }

  // Static copies (section 2's ghost) split like the text over them, so the two line up
  story.querySelectorAll<HTMLElement>('[data-split-words]').forEach((node) =>
    SplitText.create(node, { type: 'words', wordsClass: 'split-word', autoSplit: true }),
  );

  let start = 0;
  const sections: Section[] = els.map((el) => {
    const len = parseFloat(el.dataset.len ?? '1');
    const last = el.hasAttribute('data-no-exit');
    const section: Section = {
      el,
      start,
      len,
      last,
      blocks: [],
      highlight: null,
      photos: [],
      photoBox: el.querySelector<HTMLElement>('[data-photos]'),
      shownPhoto: -1,
    };
    start += len + (last ? 0 : parseFloat(el.dataset.rest ?? String(REST)));

    section.photos = [...el.querySelectorAll<HTMLElement>('[data-photo-trigger]')].map((p) => ({
      el: p,
      rot: parseFloat(p.dataset.rot ?? '0'),
      trigger: p.dataset.photoTrigger!.toLowerCase(),
      word: -1,
    }));

    el.querySelectorAll<HTMLElement>('[data-fx]').forEach((node) => {
      const fx = node.dataset.fx as Fx;
      const block: Block = {
        el: node,
        fx,
        cue: parseFloat(node.dataset.cue ?? '0'),
        at: parseFloat(node.dataset.fxAt ?? '0'),
        span: parseFloat(node.dataset.span ?? '0.5'),
        em: parseFloat(getComputedStyle(node).fontSize),
        pieces: [],
        goo: fx === 'goo-1' || fx === 'goo-2' ? makeFilter(GOO[fx].matrix) : null,
        shown: false,
        tl: null,
      };
      section.blocks.push(block);

      const highlight = node.hasAttribute('data-highlight');
      const masked = fx === 'mask-words';
      const chars = fx === 'spotlight';
      const words = masked || fx === 'words-rise';
      if (!chars && !words && !highlight) return;

      SplitText.create(node, {
        type: masked ? 'lines,words' : chars ? 'words,chars' : 'words',
        mask: masked ? 'lines' : undefined,
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        autoSplit: true,
        onSplit(self) {
          block.em = parseFloat(getComputedStyle(node).fontSize);
          if (chars || words) {
            block.pieces = (chars ? self.chars : self.words) as HTMLElement[];
            gsap.set(block.pieces, block.shown ? pieceTo(block) : pieceFrom(block));
          }
          if (highlight) buildHighlight(section, block, self.words as HTMLElement[]);
        },
      });
    });
    return section;
  });

  // Words light up in order as the section scrolls (the brief's scrub: stagger 0.1)
  function buildHighlight(sec: Section, block: Block, words: HTMLElement[]) {
    sec.highlight?.tl.kill();
    const tl = gsap.timeline({ paused: true }).to(words, { color: white, stagger: 0.1 });
    sec.highlight = { block, words, tl };
    const key = (w: HTMLElement) => (w.textContent ?? '').toLowerCase().replace(/[^a-z]/g, '');
    sec.photos.forEach((p) => (p.word = words.findIndex((w) => key(w) === p.trigger)));
    if (ready) update();
  }

  /* ---------- Block intro / exit ---------- */

  function stop(b: Block) {
    b.tl?.kill();
    b.tl = null;
    b.el.style.filter = '';
  }

  // Codrops goo: blur up then down through the threshold while the block fades in
  function gooIn(tl: gsap.core.Timeline, b: Block, fx: 'goo-1' | 'goo-2') {
    const { blur: peak, duration } = GOO[fx];
    const half = duration / 2;
    const blur = { v: 0 };
    const setBlur = () => b.goo!.blur.setAttribute('stdDeviation', blur.v.toFixed(2));
    tl.fromTo(
      blur,
      { v: 0 },
      { v: peak * b.em, duration: half, ease: 'none', onStart: () => (b.el.style.filter = b.goo!.filter), onUpdate: setBlur },
      0,
    );
    tl.to(blur, { v: 0, duration: half, ease: 'none', onUpdate: setBlur, onComplete: () => (b.el.style.filter = '') }, half);
    tl.fromTo(b.el, { opacity: 0 }, { opacity: 1, duration, ease: 'none' }, 0);
    if (fx === 'goo-2') {
      tl.fromTo(b.el, { '--fx-x': `${-GOO_2_SHIFT * b.em}px` }, { '--fx-x': '0px', duration, ease: 'power2.inOut' }, 0);
    }
  }

  function show(b: Block) {
    stop(b);
    b.shown = true;
    gsap.set(b.el, { '--fx-x': '0px', '--fx-s': 1 });
    const tl = gsap.timeline({ delay: b.at });
    b.tl = tl;
    if (reduced) {
      gsap.set(b.pieces, pieceTo(b));
      tl.fromTo(b.el, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' });
      return;
    }
    switch (b.fx) {
      case 'bleed':
        tl.fromTo(
          b.el,
          { opacity: 0, filter: 'blur(20px)', '--fx-s': 0.9 },
          { opacity: 1, filter: 'blur(0px)', '--fx-s': 1, duration: BLEED, ease: 'power2.out', clearProps: 'filter' },
        );
        break;
      case 'goo-1':
      case 'goo-2':
        gooIn(tl, b, b.fx);
        break;
      case 'stack':
        gsap.set(b.el, { opacity: 1 }); // the rise is scrubbed in update()
        break;
      default: {
        gsap.set(b.el, { opacity: 1 });
        const vars: gsap.TweenVars =
          b.fx === 'spotlight'
            ? { duration: 0.4, ease: 'power2.out', stagger: { each: 0.06, from: 'center' }, clearProps: 'filter' }
            : b.fx === 'words-rise'
              ? { duration: 0.5, ease: 'power2.out', stagger: 0.06 }
              : { duration: 0.6, ease: OSMO_EASE, stagger: 0.06 }; // Osmo words
        tl.fromTo(b.pieces, pieceFrom(b), { ...pieceTo(b), ...vars });
      }
    }
  }

  // The Ink Bleed reversed: power2.out played backwards is power2.in
  function hide(b: Block) {
    stop(b);
    b.shown = false;
    const tl = gsap.timeline();
    b.tl = tl;
    if (reduced) {
      tl.to(b.el, { opacity: 0, duration: FADE, ease: 'none' });
      return;
    }
    tl.fromTo(
      b.el,
      { filter: 'blur(0px)' },
      { opacity: 0, filter: 'blur(20px)', '--fx-s': 0.9, duration: BLEED, ease: 'power2.in' },
    );
  }

  /* ---------- Photos (section 5) ---------- */

  // Distance that takes a photo fully above the screen
  const flyOff = (sec: Section) => -((sec.photoBox?.getBoundingClientRect().bottom ?? H) + 80);

  function photoIn(sec: Section, p: Photo, fromBelow: boolean) {
    gsap.killTweensOf(p.el);
    p.el.style.zIndex = String(++photoZ);
    if (reduced) {
      gsap.fromTo(p.el, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' });
      return;
    }
    if (fromBelow) {
      // The home hero's reveal: clip opens upward (expo.inOut 1.1s), here while rising
      gsap.fromTo(
        p.el,
        { opacity: 1, y: 0, yPercent: 40, rotation: p.rot, clipPath: 'inset(100% 0% 0% 0%)' },
        { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut' },
      );
    } else {
      gsap.fromTo(
        p.el,
        { opacity: 1, y: flyOff(sec), yPercent: 0, rotation: p.rot - 8, clipPath: 'inset(0% 0% 0% 0%)' },
        { y: 0, rotation: p.rot, duration: 1, ease: 'expo.out' },
      );
    }
  }

  function photoOut(sec: Section, p: Photo, upward: boolean) {
    gsap.killTweensOf(p.el);
    if (reduced) {
      gsap.to(p.el, { opacity: 0, duration: FADE, ease: 'none' });
      return;
    }
    if (upward) {
      gsap.to(p.el, { y: flyOff(sec), rotation: p.rot - 8, duration: 0.9, ease: 'power3.in' });
    } else {
      gsap.to(p.el, { yPercent: 40, clipPath: 'inset(100% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' });
    }
  }

  function setPhoto(sec: Section, want: number) {
    if (want === sec.shownPhoto) return;
    const forward = want > sec.shownPhoto || want < 0;
    if (sec.shownPhoto >= 0) photoOut(sec, sec.photos[sec.shownPhoto], forward);
    if (want >= 0) photoIn(sec, sec.photos[want], forward);
    sec.shownPhoto = want;
  }

  /* ---------- Scroll ---------- */

  function measure() {
    H = stage!.offsetHeight || window.innerHeight;
    storyTop = story.getBoundingClientRect().top + window.scrollY;
  }

  function update() {
    const pos = (window.scrollY - storyTop) / H; // screens into the pin

    sections.forEach((s) => {
      const local = pos - s.start;
      const active = local >= 0 && (s.last || local < s.len);
      s.el.classList.toggle('is-active', active);

      s.blocks.forEach((b) => {
        const want = active && local >= b.cue;
        if (want !== b.shown) (want ? show : hide)(b);
        if (b.fx === 'stack' && !reduced) {
          // Holds below the screen until its cue, then rises into place
          const y = (1 - easeOut(seg(local, b.cue, b.cue + b.span))) * H;
          b.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        }
      });

      const hl = s.highlight;
      if (!hl) return;
      hl.tl.progress(seg(local, hl.block.cue + 0.1, s.len - 0.4));
      if (!s.photos.length) return;
      // A trigger word counts once its colour tween is halfway (0.5s tweens, 0.1 apart)
      const t = hl.tl.time();
      let want = -1;
      if (active && hl.block.shown) s.photos.forEach((p, j) => p.word >= 0 && t >= p.word * 0.1 + 0.25 && (want = j));
      setPhoto(s, want);
    });
  }

  story.style.setProperty('--story-len', String(start));
  ready = true;
  measure();
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    update();
  });
  document.fonts?.ready.then(() => {
    measure();
    update();
  });
}
