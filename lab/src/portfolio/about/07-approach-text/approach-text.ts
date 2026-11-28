/*
  About "my APPROACH" paragraph intros, standalone (the site runs them from
  about-sections.ts, cued by scroll; this file is the same motion on its own).
    1 Masked words   Osmo Masked Text Reveal: words rise out of line masks
                     (0.6s, CustomEase 0.625, 0.05, 0, 1, 0.06s apart)
    2 Cascade Reveal characters drop in from above (y -80px on the 40px
                     paragraph, i.e. -2em), tilted -15°, back.out(1.4),
                     0.5s each, left to right. The brief's snippet staggers
                     0.04s per character; over a paragraph that is 6-9s, so
                     the site spreads it over 1.6s instead.
  play(el, kind) splits once and replays the intro from the start.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(SplitText, CustomEase);

const OSMO_EASE = CustomEase.create('osmo-ease', '0.625, 0.05, 0, 1');
const CASCADE_DROP = 2; // em
const CASCADE_TOTAL = 1.6; // s, first to last character

export type ApproachIntro = 1 | 2;

const splits = new WeakMap<HTMLElement, HTMLElement[]>();

function pieces(el: HTMLElement, kind: ApproachIntro) {
  let p = splits.get(el);
  if (!p) {
    const split = SplitText.create(el, {
      type: kind === 1 ? 'lines,words' : 'words,chars',
      mask: kind === 1 ? 'lines' : undefined,
      // Classes the page's CSS uses to keep the paragraph indent off the pieces
      wordsClass: 'split-word',
      charsClass: 'split-char',
    });
    p = (kind === 1 ? split.words : split.chars) as HTMLElement[];
    splits.set(el, p);
  }
  return p;
}

export function play(el: HTMLElement, kind: ApproachIntro, delay = 0) {
  const p = pieces(el, kind);
  const em = parseFloat(getComputedStyle(el).fontSize);
  gsap.killTweensOf(p);
  gsap.set(el, { opacity: 1 });
  if (kind === 1) {
    return gsap.fromTo(p, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: OSMO_EASE, stagger: 0.06, delay });
  }
  return gsap.fromTo(
    p,
    { opacity: 0, y: -CASCADE_DROP * em, rotation: -15 },
    { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: 'back.out(1.4)', stagger: { amount: CASCADE_TOTAL, from: 'start' }, delay },
  );
}
