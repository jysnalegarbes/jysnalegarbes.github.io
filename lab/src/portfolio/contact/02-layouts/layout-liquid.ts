/*
  Contact layout 1: Liquid email
  ------------------------------
  The email address is the hero, set huge across the page and drawn by a
  shader over a slow marble of the page grey. Near the cursor the letters
  ripple like liquid, split their colours along the motion and turn
  green. It dissolves in through noise on arrival while the other lines
  rise out of masks. The real link sits on top (transparent text), so it
  clicks, selects and reads like any link; "Copy" copies the address.
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import {
  NOISE,
  clamp,
  cssVar,
  font,
  hexToRgb,
  loop,
  reduced,
  shader,
  smoothMouse,
  socialLinks,
  textCanvas,
  type ContactContent,
  type ContactLayout,
  type ContactSettings,
} from './gl';

gsap.registerPlugin(SplitText);

const FRAG = `
precision highp float;
uniform vec2 u_res, u_mouse, u_vel;
uniform float u_time, u_reveal, u_flow, u_warp, u_lens, u_split, u_ripple;
uniform vec3 u_bg, u_ink, u_green;
uniform sampler2D u_text;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = uv * asp;
  vec2 m = u_mouse / u_res.y;
  float d = length(p - m);
  float t = u_time * u_flow * 0.25;

  // Marble: domain-warped noise, a few shades of the page grey
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 4.0));
  float marble = fbm(p * 2.2 + q * 2.4 * u_warp);
  vec3 col = mix(u_bg, u_bg * 0.92, smoothstep(0.42, 0.8, marble));

  // Liquid lens around the cursor
  float fall = exp(-d * d / (u_lens * u_lens));
  vec2 dir = normalize(p - m + 1e-5);
  vec2 off = dir * fall * 0.018 * u_ripple * sin(d * 46.0 - u_time * 5.0);
  off += (q - 0.5) * 0.006 * u_warp;
  off -= u_vel * fall * 0.04;
  off /= asp;
  vec2 s = (dir / asp) * fall * u_split * 0.012 + u_vel / asp * 0.02 * u_split;

  float r = texture2D(u_text, uv + off + s).a;
  float g = texture2D(u_text, uv + off).a;
  float b = texture2D(u_text, uv + off - s).a;

  // Dissolve in through noise
  float n = fbm(p * 5.0 + 3.0);
  float vis = smoothstep(n - 0.08, n + 0.08, u_reveal * 1.2 - 0.1);

  vec3 ink = mix(u_ink, u_green, smoothstep(0.15, 0.9, fall));
  vec3 a = vec3(r, g, b) * vis;
  col = col * (1.0 - a) + ink * a;
  gl_FragColor = vec4(col, 1.0);
}`;

export function mountLiquid(root: HTMLElement, c: ContactContent, all: ContactSettings): ContactLayout | null {
  const s = all.liquid;
  root.classList.add('cx-liquid');
  root.innerHTML = `
    <canvas class="cx__gl" aria-hidden="true"></canvas>
    <div class="cx-liquid__top">
      <p class="cx-liquid__lead" data-cx-split>${c.lead}</p>
      <h1 class="cx-liquid__title" data-cx-split>GOT <span class="serif-italic">a project</span> IN MIND?</h1>
    </div>
    <div class="cx-liquid__mail">
      <a class="cx-liquid__email" href="mailto:${c.email}" data-cx-email>${c.email}</a>
      <div class="cx-liquid__mail-row" data-cx-fade>
        <span>Write to me</span>
        <button type="button" class="cx-liquid__copy" data-cx-copy>Copy address</button>
      </div>
    </div>
    <div class="cx-liquid__foot" data-cx-fade>
      <a href="${c.resume}" target="_blank" rel="noopener">Résumé (PDF) ↗</a>
      <div class="cx-liquid__socials">${socialLinks(c, 'cx-social')}</div>
      <p>${c.sign}</p>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cx__gl')!;
  const email = root.querySelector<HTMLElement>('[data-cx-email]')!;
  const sh = shader(canvas, FRAG);
  if (!sh) return null;
  const gl = sh.gl;
  gl.uniform3fv(sh.u('u_bg'), hexToRgb(cssVar('--bg', '#e1e8e8')));
  gl.uniform3fv(sh.u('u_ink'), hexToRgb(cssVar('--black', '#141918')));
  gl.uniform3fv(sh.u('u_green'), hexToRgb(cssVar('--green', '#0fb12a')));

  // Fit the address to the width, then draw it where the link sits
  function drawText() {
    sh!.resize();
    const W = sh!.width;
    const H = sh!.height;
    const box = email.parentElement!;
    const cs = getComputedStyle(box);
    const max = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const probe = textCanvas(1, 1, 1).ctx;
    probe.font = font(800, 100);
    const size = Math.floor((100 * max) / probe.measureText(c.email).width);
    email.style.fontSize = `${size}px`;
    const r = email.getBoundingClientRect();
    const { c: tc, ctx } = textCanvas(W, H, sh!.dpr);
    ctx.font = font(800, size);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.email, r.left, r.top + r.height / 2 + size * 0.04);
    sh!.texture(0, 'u_text', tc);
  }

  const mouse = smoothMouse(0.08);
  const state = { reveal: reduced() ? 1 : 0 };

  loop((dt, t) => {
    mouse.step(dt);
    gl.uniform1f(sh.u('u_reveal'), state.reveal);
    gl.uniform1f(sh.u('u_flow'), s.flow);
    gl.uniform1f(sh.u('u_warp'), s.warp);
    gl.uniform1f(sh.u('u_lens'), s.lens);
    gl.uniform1f(sh.u('u_split'), s.split);
    gl.uniform1f(sh.u('u_ripple'), s.ripple);
    const vx = clamp(mouse.vx / sh.width, -2, 2);
    const vy = clamp(-mouse.vy / sh.height, -2, 2);
    gl.uniform2f(sh.u('u_vel'), vx * 0.5, vy * 0.5);
    sh.draw(reduced() ? 0 : t, mouse);
  });

  root.querySelector('[data-cx-copy]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(c.email);
      btn.textContent = 'Copied ✓';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => (btn.textContent = 'Copy address'), 1600);
  });

  // Arrival
  document.fonts.ready.then(() => {
    drawText();
    if (reduced()) return;
    const splits = [...root.querySelectorAll<HTMLElement>('[data-cx-split]')].map((el) =>
      SplitText.create(el, { type: 'lines', mask: 'lines' }),
    );
    const tl = gsap.timeline({ delay: 0.15 });
    tl.from(splits.flatMap((sp) => sp.lines), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0);
    tl.to(state, { reveal: 1, duration: 1.8, ease: 'power2.inOut' }, 0.2);
    tl.from(root.querySelectorAll('[data-cx-fade]'), { opacity: 0, y: 14, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 0.9);
  });

  window.addEventListener('resize', drawText);
  return { refresh: drawText };
}
