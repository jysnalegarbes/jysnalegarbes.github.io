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

/**
 * Embedded only: calls onFrame(t) every frame with t = seconds into a loop
 * of `loop` seconds, honouring the library's pause/play. Hover demos use it
 * to drive a virtual cursor (they dispatch the pointer events themselves).
 * Reduced motion: never starts.
 */
export function autoplayLoop(loop: number, onFrame: (t: number) => void) {
  if (!embedded || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let paused = false;
  let t = 0;
  let last = 0;

  function frame(now: number) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (!paused) {
      t = (t + dt) % loop;
      onFrame(t);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.lab === 'pause') paused = true;
    if (e.data?.lab === 'play') paused = false;
  });
}

/**
 * Embedded only: replays a one-shot demo (a page loader) by reloading the
 * page `holdSeconds` after `done` resolves, unless the library paused it.
 */
export function replayAfter(done: Promise<unknown>, holdSeconds = 2.5) {
  if (!embedded) return;
  let paused = false;
  let due = false;
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.lab === 'pause') paused = true;
    if (e.data?.lab === 'play') {
      paused = false;
      if (due) location.reload();
    }
  });
  done.then(() =>
    setTimeout(() => {
      due = true;
      if (!paused) location.reload();
    }, holdSeconds * 1000),
  );
}
