/*
  Contact layout 5: Ink drops
  ---------------------------
  Glossy black ink drops (metaballs) drift and merge behind the question;
  one follows the cursor and pulls the others into it. They are lit like
  wet ink: a soft highlight and a thin green rim. Click anywhere and they
  burst apart, then drift back together. The text is one colour in
  difference mode, so it reads over both the ink and the page. On
  arrival the drops swell up from nothing while the title rises.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import {
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
uniform float u_time, u_grow, u_burst, u_size, u_gloss, u_follow;
uniform vec3 u_bg, u_ink, u_green;

// Field and its gradient from 6 drops (5 drifting + the cursor's)
void drop(vec2 p, vec2 c, float r, inout float f, inout vec2 g) {
  vec2 d = p - c;
  float q = dot(d, d) + 1e-4;
  f += r * r / q;
  g += -2.0 * r * r * d / (q * q);
}

void main() {
  float asp = u_res.x / u_res.y;
  vec2 p = gl_FragCoord.xy / u_res.y;
  vec2 centre = vec2(asp * 0.5, 0.5);
  vec2 m = u_mouse / u_res.y;
  float t = u_time * 0.35;
  float R = 0.085 * u_size * u_grow;
  float spread = 0.26 + u_burst * 0.5;

  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float k = float(i);
    vec2 orbit = vec2(cos(t * (0.7 + k * 0.13) + k * 1.9) * asp * 0.55, sin(t * (0.9 + k * 0.11) + k * 2.7)) * spread;
    drop(p, centre + orbit, R * (0.8 + 0.25 * sin(k * 3.1)), f, g);
  }
  drop(p, mix(centre, m, u_follow), R * 1.25, f, g);

  float inside = smoothstep(0.96, 1.04, f);
  // Light it like wet ink: normal from the field's slope
  vec3 n = normalize(vec3(-g * 0.02, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.6, 0.8));
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0) * u_gloss;
  vec3 ink = u_ink + spec * 0.9;
  // A thin green rim (wide, it turns pink under the inverted text)
  ink = mix(ink, u_green, (1.0 - smoothstep(1.0, 1.1, f)) * 0.75 * u_gloss);
  vec3 col = mix(u_bg, ink, inside);
  gl_FragColor = vec4(col, 1.0);
}`;

export function mountOrb(root: HTMLElement, c: ContactContent, all: ContactSettings): ContactLayout | null {
  const s = all.orb;
  root.classList.add('cx-orb');
  root.innerHTML = `
    <canvas class="cx__gl" aria-hidden="true"></canvas>
    <div class="cx-orb__ink">
      <p class="cx-orb__lead" data-cx-split>${c.lead}</p>
      <h1 class="cx-orb__title" data-cx-split>GOT <span class="serif-italic">a project</span><br />IN MIND?</h1>
      <p class="cx-orb__hint" data-cx-fade>Click anywhere</p>
    </div>
    <div class="cx-orb__links" data-cx-fade>
      <a class="cx-orb__pill cx-orb__pill--primary" href="mailto:${c.email}">${c.email}</a>
      <a class="cx-orb__pill" href="${c.resume}" target="_blank" rel="noopener">Résumé ↗</a>
      ${c.socials.map((x) => `<a class="cx-orb__pill" href="${x.href}" target="_blank" rel="noopener noreferrer">${x.label} ↗</a>`).join('')}
    </div>
    <p class="cx-orb__sign" data-cx-fade>${c.sign}</p>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cx__gl')!;
  const sh = shader(canvas, FRAG);
  if (!sh) return null;
  const gl = sh.gl;
  gl.uniform3fv(sh.u('u_bg'), hexToRgb(cssVar('--bg', '#e1e8e8')));
  gl.uniform3fv(sh.u('u_ink'), hexToRgb(cssVar('--black', '#141918')));
  gl.uniform3fv(sh.u('u_green'), hexToRgb(cssVar('--green', '#0fb12a')));

  const mouse = smoothMouse(0.25);
  const state = { grow: reduced() ? 1 : 0, burst: 0 };
  let time = 0;
  loop((dt) => {
    mouse.step(dt);
    if (!reduced()) time += dt * s.speed;
    gl.uniform1f(sh.u('u_grow'), state.grow);
    gl.uniform1f(sh.u('u_burst'), state.burst);
    gl.uniform1f(sh.u('u_size'), s.size * (sh.width < 1024 ? 0.8 : 1));
    gl.uniform1f(sh.u('u_gloss'), s.gloss);
    gl.uniform1f(sh.u('u_follow'), s.follow);
    sh.draw(time, mouse);
  });
  window.addEventListener('resize', () => sh.resize());

  // Burst on a click that isn't on a link
  root.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a, button') || reduced()) return;
    gsap.killTweensOf(state, 'burst');
    gsap
      .timeline()
      .to(state, { burst: 1, duration: 0.35, ease: 'power3.out' })
      .to(state, { burst: 0, duration: 2.2, ease: 'elastic.out(1, 0.4)' });
  });

  document.fonts.ready.then(() => {
    if (reduced()) return;
    const lines = [...root.querySelectorAll<HTMLElement>('[data-cx-split]')].flatMap(
      (el) => SplitText.create(el, { type: 'lines', mask: 'lines' }).lines,
    );
    gsap
      .timeline({ delay: 0.1 })
      .to(state, { grow: 1, duration: 1.8, ease: 'elastic.out(1, 0.55)' }, 0)
      .from(lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0.25)
      .fromTo(root.querySelectorAll('.cx-orb__pill'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.7)', stagger: 0.06 }, 0.7)
      .from(root.querySelectorAll('[data-cx-fade]:not(.cx-orb__links)'), { opacity: 0, duration: 0.8 }, 1);
  });

  return { refresh: () => sh.resize() };
}
