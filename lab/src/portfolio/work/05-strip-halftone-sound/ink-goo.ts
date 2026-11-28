/*
  Ink goo
  -------
  The site's gooey text filter (after Codrops' Gooey Text Hover): blur,
  then an alpha threshold that pulls the blur back into hard-edged blobs.
  Before the threshold, noise pushes the blurred edge about (inkEdge), so
  the blobs come out ragged like comic ink; how far scales with the blur,
  so the text is clean again at rest.

  One filter per element group (the blur peak depends on the type size).
  Settings live in src/config/about-motion.json, tuned in /about/?tweak:
    gooTitles  section titles, Work's project details, transition words
    gooFade    the About greeting and ending
    gooEnding  the ending's longer, stronger run
    inkEdge    the edge noise
  Used by about-sections.ts, work-gallery.ts and page-transition.ts.
*/
import motionDefaults from '../config/about-motion.json';

export type Motion = typeof motionDefaults;
export const motion: Motion = motionDefaults;

export interface GooStyle {
  blur: number; // em at the peak
  contrast: number;
  threshold: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let svg: SVGSVGElement | null = null;
let count = 0;

export type InkGoo = ReturnType<typeof makeInkGoo>;

/** A new goo filter; apply `filter` as the element's CSS filter while it runs */
export function makeInkGoo(name = 'goo') {
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
    document.body.append(svg);
  }
  const id = `${name}-${count++}`;
  const f = document.createElementNS(SVG_NS, 'filter');
  f.id = id;
  f.setAttribute('x', '-20%');
  f.setAttribute('y', '-40%');
  f.setAttribute('width', '140%');
  f.setAttribute('height', '180%');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  f.innerHTML = `
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="noise" />
    <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
    <feDisplacementMap in="blur" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="rough" />
    <feColorMatrix in="rough" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -7" result="goo" />
    <feComposite in="SourceGraphic" in2="goo" operator="atop" />`;
  svg.append(f);
  const blurEl = f.querySelector('feGaussianBlur')!;
  const matrix = f.querySelector('feColorMatrix')!;
  const noise = f.querySelector('feTurbulence')!;
  const rough = f.querySelector('feDisplacementMap')!;

  return {
    filter: `url(#${id})`,
    /**
      blur: px now; em: the type size (px); style: blur peak (em), contrast,
      threshold; edge: the noise (defaults to the config's)
    */
    set(blur: number, em: number, style: GooStyle, edge = motion.inkEdge) {
      blurEl.setAttribute('stdDeviation', blur.toFixed(2));
      matrix.setAttribute('values', `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${style.contrast} ${style.threshold}`);
      noise.setAttribute('baseFrequency', (edge.grain / em).toFixed(4));
      noise.setAttribute('numOctaves', String(Math.round(edge.octaves)));
      noise.setAttribute('seed', String(Math.round(edge.seed)));
      const k = style.blur > 0 ? blur / (style.blur * em) : 0;
      rough.setAttribute('scale', (edge.roughness * em * k).toFixed(2));
    },
  };
}
