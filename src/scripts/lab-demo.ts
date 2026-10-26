/*
  Helpers for effects-library demos (/lab/demo/*). Embedded in a library
  card (?embed), a scroll-driven demo plays itself: it scrolls from one end
  of its range to the other and back, holding at each end. The library
  pauses and resumes it by postMessage ({ lab: 'pause' | 'play' }).
  Reduced motion: it sits at the middle of the range instead.
*/

const TRAVEL = 3.2; // s from one end to the other
const HOLD = 0.9; // s at each end

const embedded = new URLSearchParams(location.search).has('embed');

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** range: [from, to] scroll positions in px, read on every frame (resizes) */
export function autoplayScroll(range: () => [number, number]) {
  if (!embedded) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const [a, b] = range();
    scrollTo({ top: (a + b) / 2, behavior: 'instant' });
    return;
  }

  let paused = false;
  let t = 0; // s into the loop
  let last = 0;
  const loop = 2 * (TRAVEL + HOLD);

  function frame(now: number) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (!paused) t = (t + dt) % loop;
    const [a, b] = range();
    const k = t < HOLD ? 0 : t < HOLD + TRAVEL ? (t - HOLD) / TRAVEL : t < 2 * HOLD + TRAVEL ? 1 : 1 - (t - 2 * HOLD - TRAVEL) / TRAVEL;
    scrollTo({ top: a + (b - a) * ease(k), behavior: 'instant' });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.lab === 'pause') paused = true;
    if (e.data?.lab === 'play') paused = false;
  });
}
