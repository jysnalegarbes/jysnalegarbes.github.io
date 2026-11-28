/*
  Contact layout 2: Halftone field
  --------------------------------
  The whole page is a field of ink dots (the site's halftone). The
  question, "GOT A PROJECT IN MIND?", is spelled by the big dots; the rest
  of the field breathes in a slow wave. Near the cursor the dots swell,
  scatter away from it and turn green. On arrival the dots grow out from
  the centre. Below, the contacts are four big cells in a row that fill
  black on hover.
*/
import gsap from 'gsap';
import {
  cssVar,
  font,
  hexToRgb,
  loop,
  reduced,
  shader,
  smoothMouse,
  textCanvas,
  type ContactContent,
  type ContactLayout,
  type ContactSettings,
} from './gl';

const FRAG = `
precision highp float;
uniform vec2 u_res, u_mouse;
uniform float u_time, u_dpr, u_intro, u_cell, u_push, u_radius, u_wave, u_green;
uniform vec3 u_bg, u_ink, u_greenCol;
uniform sampler2D u_text;
void main() {
  float cell = u_cell * u_dpr;
  vec2 g = gl_FragCoord.xy;
  vec2 id = floor(g / cell);
  vec2 c = (id + 0.5) * cell;

  // The cursor pushes the dots away and swells them
  vec2 toM = c - u_mouse;
  float dm = length(toM) / u_res.y;
  float inf = exp(-dm * dm / (u_radius * u_radius));
  vec2 pushed = c + normalize(toM + 1e-4) * inf * cell * 0.9 * u_push;

  float v = texture2D(u_text, c / u_res).a;
  float base = 0.12 + 0.1 * u_wave * sin(id.x * 0.32 + id.y * 0.21 - u_time * 1.6);
  float size = mix(base, 1.0, v) + inf * 0.35 * u_push;

  // Arrival: a ring grows out from the centre
  float r0 = length((c / u_res - 0.5) * vec2(u_res.x / u_res.y, 1.0));
  size *= smoothstep(r0 - 0.15, r0, u_intro * 1.2);

  float rad = clamp(size, 0.0, 1.15) * cell * 0.5;
  float d = length(g - pushed);
  float a = 1.0 - smoothstep(rad - 1.0, rad + 1.0, d);
  vec3 ink = mix(u_ink, u_greenCol, inf * u_green);
  gl_FragColor = vec4(mix(u_bg, ink, a), 1.0);
}`;

export function mountDots(root: HTMLElement, c: ContactContent, all: ContactSettings): ContactLayout | null {
  const s = all.dots;
  root.classList.add('cx-dots');
  const social = (label: string) => c.socials.find((x) => x.label === label);
  const cells = [
    { k: 'Email', v: c.email, href: `mailto:${c.email}`, ext: false },
    { k: 'Résumé', v: 'Download PDF', href: c.resume, ext: true },
    // Socials show their address without the protocol
    ...['Behance', 'LinkedIn'].map((l) => ({
      k: l,
      v: (social(l)?.href ?? '').replace(/^https?:\/\/(www\.)?/, ''),
      href: social(l)?.href ?? '#',
      ext: true,
    })),
  ];
  root.innerHTML = `
    <canvas class="cx__gl" aria-hidden="true"></canvas>
    <h1 class="visually-hidden">Got a project in mind?</h1>
    <p class="cx-dots__lead" data-cx-fade>${c.lead}</p>
    <ul class="cx-dots__cells">
      ${cells
        .map(
          (x, i) => `<li data-cx-cell><a href="${x.href}"${x.ext ? ' target="_blank" rel="noopener"' : ''}>
            <span class="cx-dots__num">0${i + 1}</span>
            <span class="cx-dots__k">${x.k}</span>
            <span class="cx-dots__v">${x.v.replaceAll('/', '/<wbr>').replace('@', '<wbr>@')}</span>
            <span class="cx-dots__arrow" aria-hidden="true">↗</span>
          </a></li>`,
        )
        .join('')}
    </ul>
    <p class="cx-dots__sign" data-cx-fade>${c.sign}</p>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cx__gl')!;
  const sh = shader(canvas, FRAG);
  if (!sh) return null;
  const gl = sh.gl;
  gl.uniform3fv(sh.u('u_bg'), hexToRgb(cssVar('--bg', '#e1e8e8')));
  gl.uniform3fv(sh.u('u_ink'), hexToRgb(cssVar('--black', '#141918')));
  gl.uniform3fv(sh.u('u_greenCol'), hexToRgb(cssVar('--green', '#0fb12a')));

  // The question, big, in the space above the cells
  function drawText() {
    sh!.resize();
    const W = sh!.width;
    const H = sh!.height;
    const cellsTop = root.querySelector('.cx-dots__cells')!.getBoundingClientRect().top;
    const desktop = W >= 1024;
    const lines = desktop ? ['GOT A PROJECT', 'IN MIND?'] : ['GOT A', 'PROJECT', 'IN MIND?'];
    const { c: tc, ctx } = textCanvas(W, H, sh!.dpr);
    const probe = (size: number) => {
      ctx.font = font(900, size);
      return Math.max(...lines.map((l) => ctx.measureText(l).width));
    };
    const top = desktop ? H * 0.2 : H * 0.18;
    const avail = cellsTop - top - H * 0.06;
    let size = Math.min((W * 0.86 * 200) / probe(200), avail / (lines.length * 0.9));
    ctx.font = font(900, size);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * 0.9));
    sh!.texture(0, 'u_text', tc);
  }

  const mouse = smoothMouse(0.1);
  const state = { intro: reduced() ? 1 : 0 };
  loop((dt, t) => {
    mouse.step(dt);
    gl.uniform1f(sh.u('u_intro'), state.intro);
    gl.uniform1f(sh.u('u_cell'), Math.max(5, s.cell * (sh.width < 1024 ? 0.6 : 1)));
    gl.uniform1f(sh.u('u_push'), s.push);
    gl.uniform1f(sh.u('u_radius'), s.radius);
    gl.uniform1f(sh.u('u_wave'), reduced() ? 0 : s.wave);
    gl.uniform1f(sh.u('u_green'), s.green);
    sh.draw(t, mouse);
  });

  document.fonts.ready.then(() => {
    drawText();
    if (reduced()) return;
    gsap
      .timeline({ delay: 0.1 })
      .to(state, { intro: 1, duration: 1.8, ease: 'power2.out' }, 0)
      .from(root.querySelectorAll('[data-cx-cell]'), { yPercent: 40, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.5)
      .from(root.querySelectorAll('[data-cx-fade]'), { opacity: 0, duration: 0.8 }, 0.8);
  });
  window.addEventListener('resize', drawText);
  return { refresh: drawText };
}
