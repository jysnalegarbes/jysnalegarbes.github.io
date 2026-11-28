/*
  Contact layout 4: Wave marquee
  ------------------------------
  Three bands of moving type fill the page ("GOT A PROJECT IN MIND?",
  "let's make something good" in the serif, and the question again in
  outline), each running its own way. A shader bends them into a slow
  wave and magnifies them under a lens that follows the cursor; scrolling
  speeds them up and deepens the wave. The contact card sits calm in the
  middle. Each band is drawn once (one period) into a texture strip and
  repeated in the shader, so nothing is redrawn per frame.
*/
import gsap from 'gsap';
import {
  clamp,
  cssVar,
  ease,
  font,
  hexToRgb,
  loop,
  reduced,
  shader,
  smoothMouse,
  socialLinks,
  type ContactContent,
  type ContactLayout,
  type ContactSettings,
} from './gl';

const FRAG = `
precision highp float;
uniform vec2 u_res, u_mouse;
uniform float u_time, u_wave, u_lens, u_band;
uniform vec3 u_off, u_periodPx, u_share, u_bg, u_ink;
uniform sampler2D u_atlas;
void main() {
  vec2 px = gl_FragCoord.xy;
  // Lens: magnify around the cursor
  vec2 d = px - u_mouse;
  float r = u_res.y * 0.22;
  float k = exp(-dot(d, d) / (r * r));
  px = u_mouse + d * (1.0 - 0.35 * u_lens * k);

  // Wave: the bands bend with x and time
  float y = px.y + sin(px.x / u_res.x * 6.2832 * 1.2 + u_time * 0.8) * u_res.y * 0.05 * u_wave;
  y += sin(px.x / u_res.x * 6.2832 * 0.5 - u_time * 0.5) * u_res.y * 0.03 * u_wave;

  // Three bands stacked around the middle
  float band = u_band;
  float top = u_res.y * 0.5 + band * 1.5;
  float f = (top - y) / band;            // 0..3 across the bands
  float row = clamp(floor(f), 0.0, 2.0);
  float inBand = step(0.0, f) * step(f, 3.0);
  float v = fract(f);

  float off = mix(mix(u_off.x, u_off.y, step(1.0, row)), u_off.z, step(2.0, row));
  float per = mix(mix(u_periodPx.x, u_periodPx.y, step(1.0, row)), u_periodPx.z, step(2.0, row));
  float share = mix(mix(u_share.x, u_share.y, step(1.0, row)), u_share.z, step(2.0, row));
  // One period of the band = its strip in the atlas (share of the width)
  float u = fract((px.x + off) / per);
  vec2 auv = vec2(u * share, 1.0 - (row + v) / 3.0);
  float a = texture2D(u_atlas, auv).a * inBand;
  gl_FragColor = vec4(mix(u_bg, u_ink, a), 1.0);
}`;

export function mountMarquee(root: HTMLElement, c: ContactContent, all: ContactSettings): ContactLayout | null {
  const s = all.marquee;
  root.classList.add('cx-marquee');
  root.innerHTML = `
    <canvas class="cx__gl" aria-hidden="true"></canvas>
    <h1 class="visually-hidden">Got a project in mind?</h1>
    <div class="cx-marquee__card" data-cx-card>
      <p class="cx-marquee__lead">${c.lead}</p>
      <a class="cx-marquee__email" href="mailto:${c.email}">${c.email}</a>
      <div class="cx-marquee__row">
        <a class="cx-marquee__resume" href="${c.resume}" target="_blank" rel="noopener">Résumé (PDF) ↗</a>
        <div class="cx-marquee__socials">${socialLinks(c, 'cx-social')}</div>
      </div>
    </div>
    <p class="cx-marquee__sign">${c.sign}</p>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cx__gl')!;
  const sh = shader(canvas, FRAG);
  if (!sh) return null;
  const gl = sh.gl;
  gl.uniform3fv(sh.u('u_bg'), hexToRgb(cssVar('--bg', '#e1e8e8')));
  gl.uniform3fv(sh.u('u_ink'), hexToRgb(cssVar('--black', '#141918')));

  // Atlas: 4096 wide, three strips; each strip holds one period of its text
  const ATLAS_W = 4096;
  let bandPx = 0;
  let periods: [number, number, number] = [1, 1, 1]; // in screen px
  function drawAtlas() {
    sh!.resize();
    const H = sh!.height;
    // (phones: smaller bands, or a letter fills the screen)
    bandPx = Math.round(H * 0.24 * s.size * (sh!.width < 1024 ? 0.55 : 1));
    const stripH = Math.min(240, Math.round(bandPx * sh!.dpr)); // keeps each period under the 4096 atlas
    const scale = stripH / bandPx; // atlas px per screen px
    const cv = document.createElement('canvas');
    cv.width = ATLAS_W;
    cv.height = stripH * 3;
    const ctx = cv.getContext('2d')!;
    const texts = [
      { t: 'GOT A PROJECT IN MIND? — ', f: font(900, stripH * 0.78), stroke: false },
      { t: "let's make something good — ", f: font(400, stripH * 0.82, true), stroke: false },
      { t: 'GOT A PROJECT IN MIND? — ', f: font(900, stripH * 0.78), stroke: true },
    ];
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, stripH * 0.012);
    ctx.textBaseline = 'middle';
    periods = texts.map((x, i) => {
      ctx.font = x.f;
      const w = Math.min(ATLAS_W, Math.ceil(ctx.measureText(x.t).width));
      const y = i * stripH + stripH * 0.52;
      if (x.stroke) ctx.strokeText(x.t, 0, y);
      else ctx.fillText(x.t, 0, y);
      return w / scale;
    }) as [number, number, number];
    sh!.texture(0, 'u_atlas', cv);
    gl.uniform3f(sh!.u('u_share'), ...(periods.map((p) => (p * scale) / ATLAS_W) as [number, number, number]));
  }

  const mouse = smoothMouse(0.12);
  const offs = [0, 0, 0];
  let boost = 0;
  const state = { wave: 0 };
  window.addEventListener(
    'wheel',
    (e) => {
      boost = clamp(boost + Math.abs(e.deltaY) * 0.02, 0, 30);
    },
    { passive: true },
  );

  loop((dt, t) => {
    mouse.step(dt);
    boost += (0 - boost) * ease(0.5, dt);
    const still = reduced();
    const v = still ? 0 : (60 + boost * 40) * s.speed;
    offs[0] += v * dt;
    offs[1] -= v * 0.8 * dt;
    offs[2] += v * 1.2 * dt;
    // Offsets wrap at each band's period
    const o = offs.map((x, i) => ((x % periods[i]) + periods[i]) % periods[i]);
    gl.uniform3f(sh.u('u_off'), o[0] * sh.dpr, o[1] * sh.dpr, o[2] * sh.dpr);
    gl.uniform1f(sh.u('u_band'), bandPx * sh.dpr);
    gl.uniform3f(sh.u('u_periodPx'), periods[0] * sh.dpr, periods[1] * sh.dpr, periods[2] * sh.dpr);
    gl.uniform1f(sh.u('u_wave'), still ? 0 : state.wave * s.wave * (1 + boost * 0.03));
    gl.uniform1f(sh.u('u_lens'), still ? 0 : s.lens);
    sh.draw(t, mouse);
  });

  document.fonts.ready.then(() => {
    drawAtlas();
    if (reduced()) {
      state.wave = 1;
      return;
    }
    gsap
      .timeline({ delay: 0.1 })
      .to(state, { wave: 1, duration: 2, ease: 'power2.out' }, 0)
      .from(root.querySelector('[data-cx-card]'), { y: 40, opacity: 0, scale: 0.94, duration: 1.1, ease: 'expo.out' }, 0.3);
  });
  window.addEventListener('resize', drawAtlas);
  return { refresh: drawAtlas };
}
