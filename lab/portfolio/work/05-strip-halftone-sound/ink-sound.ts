/*
  Ink sound
  ---------
  A short, soft "ink settling" sound for when the Work strip's halftone
  resolves: a brushy hiss (noise through a band-pass that sweeps down)
  over a faint low drop, about 0.4s. Synthesised with the Web Audio API,
  so there's no file to load or license.

  Browsers only allow sound after the visitor has clicked, tapped or
  pressed a key on the page (a wheel scroll doesn't count), so the first
  of those unlocks it; until then it stays silent. Off under reduced
  motion. LEVEL sets the loudness.
*/

const LEVEL = 0.18;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  // Half a second of white noise, reused for every hiss
  noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// The first click / tap / key press unlocks audio
const unlock = () => {
  context()?.resume();
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.removeEventListener(t, unlock));
};
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, unlock, { passive: true }));
}

export function playInkSettle() {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = LEVEL;
  out.connect(ctx.destination);

  // Brushy hiss: band-passed noise sweeping 2.8k → 700 Hz, quick in, soft tail
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(2800, t);
  band.frequency.exponentialRampToValueAtTime(700, t + 0.35);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.0001, t);
  hissGain.gain.exponentialRampToValueAtTime(0.6, t + 0.012);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  hiss.connect(band).connect(hissGain).connect(out);
  hiss.start(t);
  hiss.stop(t + 0.4);

  // Faint low drop under it, like a drop landing on paper
  const drop = ctx.createOscillator();
  drop.type = 'sine';
  drop.frequency.setValueAtTime(180, t);
  drop.frequency.exponentialRampToValueAtTime(70, t + 0.16);
  const dropGain = ctx.createGain();
  dropGain.gain.setValueAtTime(0.0001, t);
  dropGain.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
  dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  drop.connect(dropGain).connect(out);
  drop.start(t);
  drop.stop(t + 0.22);
}
