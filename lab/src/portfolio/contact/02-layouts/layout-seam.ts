/*
  Contact layout 3: Ink seam
  --------------------------
  The page is split: black on the left (the question, large), the page
  grey on the right (the contacts as numbered rows). The edge between
  them is a living ink line: it wobbles, and bulges out toward the
  cursor, so pointing at a contact pulls the black over to it. All text
  is one colour in difference mode, so it reads white on the black and
  black on the grey wherever the edge goes. On arrival the ink pours in
  from the left. Phones: the black is on top and the edge runs across.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import {
  NOISE,
  cssVar,
  hexToRgb,
  loop,
  reduced,
  shader,
  smoothMouse,
  type ContactContent,
  type ContactLayout,
  type ContactSettings,
} from './gl';

gsap.registerPlugin(SplitText);

const FRAG = `
precision highp float;
uniform vec2 u_res, u_mouse;
uniform float u_time, u_split, u_wobble, u_bulge, u_speed, u_vertical;
uniform vec3 u_bg, u_ink;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 mu = u_mouse / u_res;
  // Along / across the edge (phones: the edge runs across the screen)
  float along = mix(uv.y, uv.x, u_vertical);
  float across = mix(uv.x, 1.0 - uv.y, u_vertical);
  float mAlong = mix(mu.y, mu.x, u_vertical);
  float mAcross = mix(mu.x, 1.0 - mu.y, u_vertical);

  float t = u_time * u_speed;
  float edge = u_split;
  edge += (fbm(vec2(along * 3.0, t)) - 0.5) * 0.06 * u_wobble;
  // Bulge toward the cursor, strongest level with it
  float near = exp(-pow((along - mAlong) / 0.16, 2.0));
  edge += (mAcross - u_split) * 0.42 * u_bulge * near;
  // Ragged ink fringe
  float fringe = (fbm(uv * vec2(u_res.x / u_res.y, 1.0) * 26.0 + t * 2.0) - 0.5) * 0.012 * u_wobble;
  float k = smoothstep(edge + fringe + 0.0015, edge + fringe - 0.0015, across);
  // A little grain in the ink
  float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.025;
  vec3 col = mix(u_bg, u_ink + grain, k);
  gl_FragColor = vec4(col, 1.0);
}`;

export function mountSeam(root: HTMLElement, c: ContactContent, all: ContactSettings): ContactLayout | null {
  const s = all.seam;
  root.classList.add('cx-seam');
  const rows = [
    { k: 'Email', v: c.email, href: `mailto:${c.email}`, ext: false },
    { k: 'Résumé', v: 'Download the PDF', href: c.resume, ext: true },
    ...c.socials.map((x) => ({ k: x.label, v: x.href.replace(/^https?:\/\/(www\.)?/, ''), href: x.href, ext: true })),
  ];
  root.innerHTML = `
    <canvas class="cx__gl" aria-hidden="true"></canvas>
    <div class="cx-seam__ink">
      <div class="cx-seam__left">
        <p class="cx-seam__lead" data-cx-split>${c.lead}</p>
        <h1 class="cx-seam__title" data-cx-split>GOT<br /><span class="serif-italic">a project</span><br />IN MIND?</h1>
      </div>
      <ol class="cx-seam__rows">
        ${rows
          .map(
            (r, i) => `<li data-cx-row><a href="${r.href}"${r.ext ? ' target="_blank" rel="noopener"' : ''}>
              <span class="cx-seam__num">0${i + 1}</span>
              <span class="cx-seam__k">${r.k}</span>
              <span class="cx-seam__v">${r.v}</span>
              <span class="cx-seam__arrow" aria-hidden="true">→</span>
            </a></li>`,
          )
          .join('')}
      </ol>
      <p class="cx-seam__sign" data-cx-fade>${c.sign}</p>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cx__gl')!;
  const sh = shader(canvas, FRAG);
  if (!sh) return null;
  const gl = sh.gl;
  gl.uniform3fv(sh.u('u_bg'), hexToRgb(cssVar('--bg', '#e1e8e8')));
  gl.uniform3fv(sh.u('u_ink'), hexToRgb(cssVar('--black', '#141918')));

  const mouse = smoothMouse(0.18);
  // k: the pour-in, 0 → 1 (the split itself follows the panel)
  const state = { k: reduced() ? 1 : 0 };
  loop((dt, t) => {
    mouse.step(dt);
    const vertical = sh.width < 1024 ? 1 : 0;
    gl.uniform1f(sh.u('u_vertical'), vertical);
    const split = -0.1 + (s.split + 0.1) * state.k;
    gl.uniform1f(sh.u('u_split'), vertical ? Math.min(split, 0.42) : split);
    gl.uniform1f(sh.u('u_wobble'), s.wobble);
    gl.uniform1f(sh.u('u_bulge'), s.bulge);
    gl.uniform1f(sh.u('u_speed'), reduced() ? 0 : s.speed);
    sh.draw(t, mouse);
  });
  window.addEventListener('resize', () => sh.resize());

  document.fonts.ready.then(() => {
    if (reduced()) return;
    const lines = [...root.querySelectorAll<HTMLElement>('[data-cx-split]')].flatMap(
      (el) => SplitText.create(el, { type: 'lines', mask: 'lines' }).lines,
    );
    gsap
      .timeline({ delay: 0.1 })
      .to(state, { k: 1, duration: 1.6, ease: 'expo.inOut' }, 0)
      .from(lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.6)
      .from(root.querySelectorAll('[data-cx-row]'), { xPercent: 6, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 }, 0.8)
      .from(root.querySelectorAll('[data-cx-fade]'), { opacity: 0, duration: 0.8 }, 1.1);
  });

  return { refresh: () => sh.resize() };
}
