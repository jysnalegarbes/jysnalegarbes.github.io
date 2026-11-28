/*
  About text sections (Figma 1:384 → 1:711). Transition brief: 67:107;
  sequence: 92:43. The five sections share one pinned screen: the text
  never scrolls, scroll only cues what is showing. Each section is a run of
  cues followed by an empty breather:

    data-len    screens from the section's start to its exit
    data-rest   screens of empty breather after the exit
    data-cue    screens into the section where a block appears
    data-fx-at  extra delay (s) once its cue is reached
    data-span   screens a scrubbed block takes to come in

  Crossing a cue plays the block's intro (time-based); scrolling back above
  it, or past the section's end, plays the exit. Intros, from data-fx:

    goo-1        Codrops Gooey Text Hover demo 1, adapted to one text: it
                 condenses once out of goo blobs while fading in (the demo's
                 0 → peak → 0 blur is a crossfade between two texts; on one
                 it reads as arriving twice)
    goo-2        demo 2: the same goo, sliding in from the left
    mask-words   Osmo Masked Text Reveal: words rise out of line masks
    cascade-chars  Cascade Reveal: characters drop in from above, tilted
                 -15° and settling with back.out(1.4), left to right
    words-rise   words fade up 0.75em, one after another
    stack        scrubbed: rises from below the screen into place
    scrub-lines  scrubbed: lines slide in and fade up, alternating from the
                 left and right, eased 1s behind the scroll (scrub: 1)

  Exit, everywhere: the Ink Bleed reversed, the text dissolves into blur.

  Section 5 also scrubs: its [data-highlight] text lights up word by word,
  and the word in each photo's data-photo-trigger lays that photo on the
  pile: it rises from below with the home hero's clip reveal (scrolling
  back lifts it off again).

  Flow sections ([data-flow], 2026-11-02): after the pinned greeting the
  page scrolls on continuously. A flow section sits in the normal page
  below the pin and stays active once its top has come up past the bottom
  of the screen. There data-cue is how far up the screen (0..1) a block's
  own top must be for it to come in, so it holds at any section height.
  Its title keeps its intro, its content just scrolls in (fx "plain" shows
  a block as is, for the highlight). data-hl="from to" runs the highlight
  while the highlighted block's top goes from / to those shares of the way
  up the screen.

  Pinned titles ([data-pin], 2026-11-04; mobile too since 2026-11-06): the
  title holds in its Figma place on the screen (CSS makes it fixed) while
  its section goes by. It comes in once the previous section's
  [data-content] has left the top of the screen and goes out once its own
  has, through the same goo run the other way, so one title hands over to
  the next in the same slot.

  Held sections (data-hold="<key>", 2026-11-04; mobile and approach since
  2026-11-06): CSS makes the section --hold screens taller and its frame
  sticky, so its content holds in place once its top reaches the top of the
  screen. What runs during the hold, in shares of it:
    - a highlight inside, from highlightFrom to highlightTo (instead of data-hl)
    - scrub-mask paragraphs, one after another over revealFrom → revealTo
      (instead of their own height of scroll), then the section moves on

  Timing and goo live in src/config/about-motion.json; ?tweak opens a panel
  for them (about-tweaks.ts) next to the portrait's. Goo intros: gooFade
  (goo-1), gooTitles (goo-2), gooEnding (a [data-goo="ending"] block's
  duration and × blur). inkEdge.roughness > 0 roughens the goo's edge with
  noise while it's blurred, for a comic ink look (0 = Codrops' clean goo).

  magnetic: Magnetic Pull, characters fly in from random offsets and turns
  (Jayson's snippet, ±200px as ±5em).

  scrub-mask (GreenSock's SplitText + ScrollTrigger lines pen, GggpRoB):
  lines rise out of their masks (yPercent 120, stagger 0.1), scrubbed
  straight to the scroll from the block's top reaching the middle of the
  screen (data-cue 0.5) to its bottom doing so ("top center" → "bottom
  center"). It's on screen whole while its section is: the masks hide it.

  Returns where each section starts (scroll px), for the page indicator.

  Reduced motion: short fades, no movement, blur or filter.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { mountPhotoRipple } from './photo-ripple';
import motionDefaults from '../config/about-motion.json';

export type AboutMotion = typeof motionDefaults;

gsap.registerPlugin(SplitText, CustomEase);

const SVG_NS = 'http://www.w3.org/2000/svg';
const OSMO_EASE = CustomEase.create('osmo-ease', '0.625, 0.05, 0, 1');

const REST = 0.6; // screens, default breather
const BLEED = 1.5; // s, Ink Bleed exit
const WORDS_RISE = 0.75; // em; the brief's 15px on 20px text
const LINE_SHIFT = 200 / 70; // em; the brief's x: -200 on the 70px paragraph
const LINE_WINDOW = 0.5; // share of the scrub each line takes
const FADE = 0.4; // s, reduced motion
// Cascade Reveal (the brief's snippet): y -80px on the 40px paragraph, 0.5s
// per character. The snippet staggers 0.04s per character, made for a short
// heading; over a paragraph that's 6-9s, so the stagger is spread over a
// fixed total instead. Set CASCADE_EACH to a number to use a per-character
// stagger again (it wins over CASCADE_TOTAL).
const CASCADE_DROP = 2; // em
const CASCADE_TOTAL = 1.6; // s, first to last character
const CASCADE_EACH: number | null = null;
const MAGNET = 5; // em, the snippet's ±200px on 40px text

// Codrops goo variants (about-motion.json gooFade / gooTitles): blur peak
// (em, from 1 / 1.5 units on ~16-unit text), duration, alpha contrast and
// threshold. Their red-into-blue matrix row is left out: it would tint the
// off-white.

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const easeOut = (t: number) => 1 - (1 - t) ** 2;

type Fx =
  | 'goo-1'
  | 'goo-2'
  | 'mask-words'
  | 'cascade-chars'
  | 'magnetic'
  | 'words-rise'
  | 'stack'
  | 'scrub-lines'
  | 'scrub-mask'
  | 'plain';

interface Block {
  el: HTMLElement;
  fx: Fx;
  cue: number;
  view: number; // flow: data-cue as given (share of the screen), cue is derived
  at: number;
  span: number; // scrubbed blocks: screens to come in
  em: number;
  pieces: HTMLElement[]; // what the intro animates, if split
  goo: {
    blur: SVGFEGaussianBlurElement;
    matrix: SVGFEColorMatrixElement;
    noise: SVGFETurbulenceElement;
    rough: SVGFEDisplacementMapElement;
    filter: string;
    ending: boolean;
  } | null;
  holdAt: [number, number] | null; // scrub-mask in a held section: shares of the hold
  scrub: { p: number; to: number }; // scrub-lines: eased progress and its target
  scrubTl: gsap.core.Timeline | null; // scrub-mask: the lines' rise, set by progress
  pin: { from: number; to: number } | null; // data-pin: screens into the story it shows between
  shown: boolean;
  tl: gsap.core.Timeline | null;
}

interface Photo {
  el: HTMLElement;
  rot: number;
  trigger: string;
  word: number; // index in the highlight's words, -1 until split
  fx: ReturnType<typeof mountPhotoRipple>; // the home portrait's wave, on entrance
}

interface Section {
  el: HTMLElement;
  start: number; // screens into the pin (flow: measured from the page)
  len: number;
  last: boolean;
  flow: boolean;
  hl: [number, number] | null; // flow: highlight from / to, shares of the screen
  key: 'approach' | 'beyond' | null; // data-hold: its timing in about-motion.json
  hold: number; // data-hold: screens the content holds in place, else 0
  hlAt: number; // flow: screens from the section's top to the highlight's
  content: HTMLElement[]; // [data-content]: what a pinned title waits on
  blocks: Block[];
  highlight: { block: Block; words: HTMLElement[]; tl: gsap.core.Timeline } | null;
  photos: Photo[];
  shownPhoto: number;
}

export function mountAboutSections(story: HTMLElement, motion: AboutMotion = structuredClone(motionDefaults)) {
  const stage = story.querySelector<HTMLElement>('[data-about-stage-story]');
  const els = [...story.querySelectorAll<HTMLElement>('[data-about-section]')];
  if (!stage || !els.length) return null;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const white = getComputedStyle(document.documentElement).getPropertyValue('--white').trim() || '#fff';
  story.classList.add('is-story'); // final layout before anything is split

  // Declared first: SplitText's onSplit runs during setup
  let H = window.innerHeight;
  let storyTop = 0;
  let ready = false;

  // One goo filter per goo block: the blur peak depends on its size
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);
  let filterCount = 0;
  function makeFilter() {
    const id = `about-goo-${filterCount++}`;
    const f = document.createElementNS(SVG_NS, 'filter');
    f.id = id;
    f.setAttribute('x', '-20%');
    f.setAttribute('y', '-40%');
    f.setAttribute('width', '140%');
    f.setAttribute('height', '180%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    // The blur's edge is pushed about by noise (inkEdge) before the threshold
    f.innerHTML = `
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="noise" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feDisplacementMap in="blur" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feColorMatrix in="rough" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -7" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />`;
    svg.append(f);
    return {
      blur: f.querySelector('feGaussianBlur')!,
      matrix: f.querySelector('feColorMatrix')!,
      noise: f.querySelector('feTurbulence')!,
      rough: f.querySelector('feDisplacementMap')!,
      filter: `url(#${id})`,
    };
  }

  // A goo block's settings, read live from the config
  const gooOf = (b: Block) => {
    const base = b.fx === 'goo-1' ? motion.gooFade : motion.gooTitles;
    const end = b.goo?.ending ? motion.gooEnding : null;
    return {
      duration: end ? end.duration : base.duration,
      peak: base.blur * (end ? end.blur : 1),
      contrast: base.contrast,
      threshold: base.threshold,
      slide: 'slide' in base ? base.slide : 0,
    };
  };

  // Sets the goo's blur (px) and, with it, how far the noise roughens the edge
  function setGoo(b: Block, blur: number) {
    const g = b.goo!;
    const { peak, contrast, threshold } = gooOf(b);
    const { roughness, grain, octaves, seed } = motion.inkEdge;
    g.blur.setAttribute('stdDeviation', blur.toFixed(2));
    g.matrix.setAttribute('values', `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${threshold}`);
    g.noise.setAttribute('baseFrequency', (grain / b.em).toFixed(4));
    g.noise.setAttribute('numOctaves', String(Math.round(octaves)));
    g.noise.setAttribute('seed', String(Math.round(seed)));
    const k = peak > 0 ? blur / (peak * b.em) : 0;
    g.rough.setAttribute('scale', (roughness * b.em * k).toFixed(2));
  }

  // Intro start / end states of a block's pieces
  const pieceFrom = (b: Block): gsap.TweenVars =>
    b.fx === 'words-rise'
      ? { opacity: 0, y: WORDS_RISE * b.em }
      : b.fx === 'cascade-chars'
        ? { opacity: 0, y: -CASCADE_DROP * b.em, rotation: -15 }
        : b.fx === 'magnetic'
          ? {
              opacity: 0,
              x: () => gsap.utils.random(-MAGNET, MAGNET) * b.em,
              y: () => gsap.utils.random(-MAGNET, MAGNET) * b.em,
              rotation: () => gsap.utils.random(-90, 90),
            }
          : { yPercent: 110 };
  const pieceTo = (b: Block): gsap.TweenVars =>
    b.fx === 'words-rise'
      ? { opacity: 1, y: 0 }
      : b.fx === 'cascade-chars' || b.fx === 'magnetic'
        ? { opacity: 1, x: 0, y: 0, rotation: 0 }
        : { yPercent: 0 };

  let start = 0;
  const sections: Section[] = els.map((el) => {
    const len = parseFloat(el.dataset.len ?? '1');
    const flow = el.hasAttribute('data-flow');
    const last = flow || el.hasAttribute('data-no-exit');
    const pair = (v: string | undefined) => {
      const n = v?.split(' ').map(Number);
      return n?.length === 2 ? (n as [number, number]) : null;
    };
    const section: Section = {
      el,
      start,
      len,
      last,
      flow,
      hl: pair(el.querySelector<HTMLElement>('[data-hl]')?.dataset.hl),
      key: el.dataset.hold === 'approach' || el.dataset.hold === 'beyond' ? el.dataset.hold : null,
      hold: 0,
      hlAt: 0,
      content: [...el.querySelectorAll<HTMLElement>('[data-content]')],
      blocks: [],
      highlight: null,
      photos: [],
      shownPhoto: -1,
    };
    if (!flow) start += len + (last ? 0 : parseFloat(el.dataset.rest ?? String(REST)));

    section.photos = [...el.querySelectorAll<HTMLElement>('[data-photo-trigger]')].map((p) => ({
      el: p,
      rot: parseFloat(p.dataset.rot ?? '0'),
      trigger: p.dataset.photoTrigger!.toLowerCase(),
      word: -1,
      fx: reduced ? null : mountPhotoRipple(p),
    }));

    el.querySelectorAll<HTMLElement>('[data-fx]').forEach((node) => {
      const fx = node.dataset.fx as Fx;
      const block: Block = {
        el: node,
        fx,
        cue: parseFloat(node.dataset.cue ?? '0'),
        view: parseFloat(node.dataset.cue ?? '0'),
        at: parseFloat(node.dataset.fxAt ?? '0'),
        span: parseFloat(node.dataset.span ?? '0.5'),
        em: parseFloat(getComputedStyle(node).fontSize),
        pieces: [],
        goo: fx === 'goo-1' || fx === 'goo-2' ? { ...makeFilter(), ending: node.dataset.goo === 'ending' } : null,
        holdAt: null,
        scrub: { p: 0, to: 0 },
        scrubTl: null,
        pin: null,
        shown: false,
        tl: null,
      };
      section.blocks.push(block);

      const highlight = node.hasAttribute('data-highlight');
      const masked = fx === 'mask-words';
      const lines = fx === 'scrub-lines';
      const maskLines = fx === 'scrub-mask';
      const chars = fx === 'cascade-chars' || fx === 'magnetic';
      const words = masked || fx === 'words-rise';
      if (!lines && !maskLines && !words && !chars && !highlight) return;

      SplitText.create(node, {
        // Chars inside words, so a word never breaks across lines
        type: lines ? 'lines' : masked || maskLines ? 'lines,words' : chars ? 'words,chars' : 'words',
        mask: masked || maskLines ? 'lines' : undefined,
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        autoSplit: true,
        onSplit(self) {
          block.em = parseFloat(getComputedStyle(node).fontSize);
          if (lines) {
            block.pieces = self.lines as HTMLElement[];
            renderLines(block);
          } else if (maskLines) {
            // The pen's gsap.from: 0.5s per line with its default power1.out
            const p = block.scrubTl?.progress() ?? 0;
            block.scrubTl?.kill();
            block.pieces = self.lines as HTMLElement[];
            block.scrubTl = gsap
              .timeline({ paused: true })
              .from(block.pieces, { yPercent: 120, stagger: 0.1, duration: 0.5, ease: 'power1.out' })
              .progress(p);
          } else if (words || chars) {
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

  // Lines take turns: odd lines from the left, even from the right, one after another
  function renderLines(b: Block) {
    const n = b.pieces.length;
    b.pieces.forEach((line, i) => {
      const from = n > 1 ? (i * (1 - LINE_WINDOW)) / (n - 1) : 0;
      const e = easeOut(seg(b.scrub.p, from, from + LINE_WINDOW)); // the brief's default power1.out
      const x = reduced ? 0 : (1 - e) * LINE_SHIFT * b.em * (i % 2 ? 1 : -1);
      line.style.opacity = String(e);
      line.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    });
  }

  /* ---------- Block intro / exit ---------- */

  function stop(b: Block) {
    b.tl?.kill();
    b.tl = null;
    b.el.style.filter = '';
  }

  // Codrops goo while the block fades in (demo 1 condenses, demo 2 also slides)
  function gooIn(tl: gsap.core.Timeline, b: Block, fx: 'goo-1' | 'goo-2') {
    const { peak, duration, slide } = gooOf(b);
    const blur = { v: 0 };
    const setBlur = () => setGoo(b, blur.v);
    const onStart = () => (b.el.style.filter = b.goo!.filter);
    const onComplete = () => (b.el.style.filter = '');
    if (fx === 'goo-1') {
      tl.fromTo(blur, { v: peak * b.em }, { v: 0, duration, ease: 'power1.out', onStart, onUpdate: setBlur, onComplete }, 0);
    } else {
      const half = duration / 2;
      tl.fromTo(blur, { v: 0 }, { v: peak * b.em, duration: half, ease: 'none', onStart, onUpdate: setBlur }, 0);
      tl.to(blur, { v: 0, duration: half, ease: 'none', onUpdate: setBlur, onComplete }, half);
      tl.fromTo(b.el, { '--fx-x': `${-slide * b.em}px` }, { '--fx-x': '0px', duration, ease: 'power2.inOut' }, 0);
    }
    tl.fromTo(b.el, { opacity: 0 }, { opacity: 1, duration, ease: 'none' }, 0);
  }

  // A pinned title leaves the way it came: back into goo while fading, demo 2
  // sliding on to the right as the next title slides in from the left
  function gooOut(tl: gsap.core.Timeline, b: Block, fx: 'goo-1' | 'goo-2') {
    const { peak, duration, slide } = gooOf(b);
    const blur = { v: 0 };
    b.el.style.filter = b.goo!.filter;
    tl.fromTo(blur, { v: 0 }, { v: peak * b.em, duration, ease: 'power1.in', onUpdate: () => setGoo(b, blur.v) }, 0);
    if (fx === 'goo-2') tl.to(b.el, { '--fx-x': `${slide * b.em}px`, duration, ease: 'power2.inOut' }, 0);
    tl.to(b.el, { opacity: 0, duration, ease: 'none', onComplete: () => (b.el.style.filter = '') }, 0);
  }

  function show(b: Block) {
    stop(b);
    b.shown = true;
    gsap.set(b.el, { '--fx-x': '0px', '--fx-s': 1 });
    const tl = gsap.timeline({ delay: b.at });
    b.tl = tl;
    if (reduced) {
      if (b.pieces.length && b.fx !== 'scrub-lines') gsap.set(b.pieces, pieceTo(b));
      tl.fromTo(b.el, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' });
      return;
    }
    switch (b.fx) {
      case 'goo-1':
      case 'goo-2':
        gooIn(tl, b, b.fx);
        break;
      case 'stack':
      case 'scrub-lines':
      case 'scrub-mask':
      case 'plain':
        gsap.set(b.el, { opacity: 1 }); // the movement is scrubbed in update(), or none
        break;
      default: {
        gsap.set(b.el, { opacity: 1 });
        const vars: gsap.TweenVars =
          b.fx === 'words-rise'
            ? { duration: 0.5, ease: 'power2.out', stagger: 0.06 }
            : b.fx === 'cascade-chars'
              ? {
                  duration: 0.5,
                  ease: 'back.out(1.4)',
                  stagger: CASCADE_EACH !== null ? { each: CASCADE_EACH, from: 'start' } : { amount: CASCADE_TOTAL, from: 'start' },
                }
              : b.fx === 'magnetic'
                ? { duration: 1, ease: 'power3.out', stagger: 0.02 } // the snippet's
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
    if (b.pin && (b.fx === 'goo-1' || b.fx === 'goo-2')) {
      gooOut(tl, b, b.fx);
      return;
    }
    tl.fromTo(
      b.el,
      { filter: 'blur(0px)' },
      { opacity: 0, filter: 'blur(20px)', '--fx-s': 0.9, duration: BLEED, ease: 'power2.in' },
    );
  }

  /* ---------- Photos (section 5) ---------- */

  // The home hero's reveal: clip opens upward (expo.inOut 1.1s), here while
  // rising, as the home portrait's wave runs through it. Once open the clip
  // comes off, so the wave's tail can spill past the edges.
  function photoIn(p: Photo) {
    gsap.killTweensOf(p.el);
    if (reduced) {
      gsap.fromTo(p.el, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' });
      return;
    }
    gsap.fromTo(
      p.el,
      { opacity: 1, yPercent: 40, rotation: p.rot, clipPath: 'inset(100% 0% 0% 0%)' },
      {
        yPercent: 0,
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.1,
        ease: 'expo.inOut',
        onComplete: () => (p.el.style.clipPath = 'none'),
      },
    );
    p.fx?.ripple();
  }

  // The same, reversed: lifted back off the pile
  function photoOut(p: Photo) {
    gsap.killTweensOf(p.el);
    if (reduced) {
      gsap.to(p.el, { opacity: 0, duration: FADE, ease: 'none' });
      return;
    }
    gsap.fromTo(
      p.el,
      { clipPath: p.el.style.clipPath === 'none' ? 'inset(0% 0% 0% 0%)' : p.el.style.clipPath },
      { yPercent: 40, clipPath: 'inset(100% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' },
    );
  }

  // The photos pile up: each trigger lays one on top, scrolling back lifts them off
  function setPhoto(sec: Section, want: number) {
    for (let i = sec.shownPhoto + 1; i <= want; i++) photoIn(sec.photos[i]);
    for (let i = sec.shownPhoto; i > want; i--) photoOut(sec.photos[i]);
    sec.shownPhoto = want;
  }

  /* ---------- Scroll ---------- */

  function measure() {
    H = stage!.offsetHeight || window.innerHeight;
    storyTop = story.getBoundingClientRect().top + window.scrollY;
    // Flow sections: local 0 when their top reaches the bottom of the screen.
    // Offsets are taken from the frame, which a held section may have stuck
    // to the top of the screen right now; at rest it sits at the section's top.
    const frameOf = (s: Section) => s.el.querySelector<HTMLElement>('.about-sec__frame') ?? s.el;
    // Hold lengths from the config, before anything is measured
    sections.forEach((s) => s.key && s.el.style.setProperty('--hold', String(motion[s.key].hold)));
    sections.forEach((s) => {
      if (!s.flow) return;
      const top = s.el.getBoundingClientRect().top + window.scrollY;
      const frame = frameOf(s);
      s.start = (top - storyTop - H) / H;
      s.len = s.el.offsetHeight / H + 1;
      s.hold = s.el.hasAttribute('data-hold') ? Math.max(0, s.el.offsetHeight - frame.offsetHeight) / H : 0;
      // A block's cue counts from its own top, so it holds at any section height
      const frameTop = frame.getBoundingClientRect().top;
      const below = (el: Element) => (el.getBoundingClientRect().top - frameTop) / H;
      s.blocks.forEach((b) => (b.cue = below(b.el) + b.view));
      if (s.hl && s.highlight) s.hlAt = below(s.highlight.block.el);
      // Held paragraphs take turns over the reveal share of the hold
      const masks = s.blocks.filter((b) => b.fx === 'scrub-mask');
      const { revealFrom: a, revealTo: z } = motion.approach;
      masks.forEach((b, i) => {
        const step = (z - a) / masks.length;
        b.holdAt = s.key === 'approach' && s.hold > 0 ? [a + i * step, a + (i + 1) * step] : null;
      });
    });
    // Pinned titles: from the previous section's content leaving the top of
    // the screen to their own section's (a held section's, once released)
    const bottom = (s: Section | undefined) => {
      if (!s?.content.length) return null;
      const frameTop = frameOf(s).getBoundingClientRect().top;
      const top = s.el.getBoundingClientRect().top + window.scrollY;
      const most = Math.max(...s.content.map((el) => el.getBoundingClientRect().bottom - frameTop));
      return (top + s.hold * H + most - storyTop) / H;
    };
    sections.forEach((s, i) => {
      const from = bottom(sections[i - 1]);
      const to = bottom(s);
      s.blocks.forEach((b) => {
        b.pin = b.el.hasAttribute('data-pin') && from !== null && to !== null ? { from, to } : null;
      });
    });
  }

  function update() {
    const pos = (window.scrollY - storyTop) / H; // screens into the pin

    sections.forEach((s) => {
      const local = pos - s.start;
      const active = local >= 0 && (s.last || local < s.len);
      s.el.classList.toggle('is-active', active);

      s.blocks.forEach((b) => {
        const want = b.pin
          ? pos >= b.pin.from && pos < b.pin.to
          : active && (b.fx === 'scrub-mask' || local >= b.cue);
        if (want !== b.shown) (want ? show : hide)(b);
        if (b.fx === 'stack' && !reduced) {
          // Holds below the screen until its cue, then rises into place
          const y = (1 - easeOut(seg(local, b.cue, b.cue + b.span))) * H;
          b.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        }
        if (b.fx === 'scrub-mask' && b.scrubTl) {
          // scrub: true, straight to the scroll; span = the block's own height,
          // or its turn in the hold (which starts at local 1)
          const [from, to] = b.holdAt
            ? [1 + b.holdAt[0] * s.hold, 1 + b.holdAt[1] * s.hold]
            : [b.cue, b.cue + b.el.offsetHeight / H];
          b.scrubTl.progress(reduced ? 1 : seg(local, from, to));
        }
        if (b.fx === 'scrub-lines') {
          const p = seg(local, b.cue, b.cue + b.span);
          if (p !== b.scrub.to) {
            // scrub: 1 — the shown progress catches up over a second
            b.scrub.to = p;
            gsap.to(b.scrub, { p, duration: reduced ? 0 : 1, ease: 'power3', overwrite: true, onUpdate: () => renderLines(b) });
          }
        }
      });

      const hl = s.highlight;
      if (!hl) return;
      // Held: over the hold, which starts as the section's top meets the screen's (local 1)
      const [hlFrom, hlTo] =
        s.hold > 0 && s.key === 'beyond'
          ? [1 + motion.beyond.highlightFrom * s.hold, 1 + motion.beyond.highlightTo * s.hold]
          : s.hl
            ? [s.hlAt + s.hl[0], s.hlAt + s.hl[1]]
            : [hl.block.cue + 0.1, s.len - 0.4];
      hl.tl.progress(seg(local, hlFrom, hlTo));
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
  // Flow sections move as images load above them
  window.addEventListener('load', () => {
    measure();
    update();
  });

  const api = {
    starts: () => sections.map((s) => storyTop + s.start * H),
    motion,
    /** Re-read the config: hold lengths, highlight and reveal ranges */
    refresh() {
      measure();
      update();
    },
    /** Replay every goo block showing now, to try new goo settings */
    replayGoo() {
      sections.forEach((s) =>
        s.blocks.forEach((b) => {
          if (b.goo && b.shown) show(b);
        }),
      );
    },
  };

  if (new URLSearchParams(location.search).has('tweak')) {
    import('./about-tweaks').then(({ mountAboutTweaks }) =>
      mountAboutTweaks(api, motionDefaults, import.meta.env.DEV ? '/__about-motion' : null),
    );
  }

  return api;
}

export type AboutSections = NonNullable<ReturnType<typeof mountAboutSections>>;
