/*
  Layout 3: Ring
  --------------
  The images stand around a slowly tilted ring, facing out. Drag
  sideways, scroll or use the arrow keys to spin it; it glides after a
  flick and settles with one image square to the front, whose title sits
  large under the ring. Hover: the title follows the cursor. Click the
  front image: focus view; click another: the ring turns to it.
  CSS 3D only.
*/
import {
  bindInput,
  cursorLabel,
  ease,
  loop,
  mod,
  openFocus,
  reduced,
  repeat,
  tile,
  type IpItem,
  type Layout,
  type LayoutSettings,
} from './common';

export function mountRing(stage: HTMLElement, items: IpItem[], all: LayoutSettings): Layout {
  const s = all.ring;
  stage.classList.add('ipx-ring');
  const view = document.createElement('div');
  view.className = 'ipx-ring__view';
  const ring = document.createElement('div');
  ring.className = 'ipx-ring__ring';
  view.append(ring);
  const caption = document.createElement('p');
  caption.className = 'ipx-ring__title';
  caption.setAttribute('aria-live', 'polite');
  stage.append(view, caption);

  const list = repeat(items, Math.round(s.count));
  const n = list.length;
  const step = 360 / n;
  const cards = list.map((item, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'ipx-ring__card';
    const t = tile(item);
    wrap.append(t);
    ring.append(wrap);
    return { wrap, tile: t, item, i };
  });

  const label = cursorLabel(stage);
  let angle = 0;
  let target = 0;
  let spin = 0; // deg/s after a flick
  let R = 0;
  let front = -1;
  let snapAt = 0;

  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = Math.min(vh * s.size, vw * 0.5, vh * 0.32);
    const w = h * 0.88;
    R = ((n * w * 1.18) / (2 * Math.PI)) * s.radius;
    view.style.perspective = `${Math.max(1200, R * 2.6)}px`;
    cards.forEach((c) => {
      Object.assign(c.wrap.style, { width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px` });
      c.wrap.style.transform = `rotateY(${c.i * step}deg) translateZ(${R}px)`;
    });
  }

  function place() {
    ring.style.transform = `translateZ(${-R}px) rotateX(${-s.tilt}deg) rotateY(${angle.toFixed(3)}deg)`;
    cards.forEach((c) => {
      // How square to the front: 1 facing you, 0 side-on, below 0 behind
      const facing = Math.cos(((c.i * step + angle) * Math.PI) / 180);
      c.wrap.style.opacity = Math.max(0.12, 0.35 + facing * 0.65).toFixed(3);
    });
    const f = mod(Math.round(-angle / step), n);
    if (f !== front) {
      front = f;
      caption.classList.remove('is-in');
      void caption.offsetWidth;
      caption.textContent = list[f].title;
      caption.classList.add('is-in');
    }
  }

  const snap = () => (target = Math.round(target / step) * step);
  const cardAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((e) => e.classList.contains('ipx-tile'));
    return cards.find((c) => c.tile === el) ?? null;
  };
  const turnTo = (i: number) => {
    // Shortest way round to card i
    const goal = -i * step;
    const diff = mod(goal - target + 180, 360) - 180;
    target += diff;
  };

  bindInput(stage, {
    wheel: (dx, dy) => {
      target -= (Math.abs(dx) > Math.abs(dy) ? dx : dy) * s.wheel;
      snapAt = performance.now() + 180;
    },
    down: () => {
      spin = 0;
    },
    move: (dx) => {
      target += dx * 0.18;
    },
    up: (vx, _vy, moved, e) => {
      if (moved) {
        spin = vx * 0.18;
        snapAt = 0;
      } else {
        const c = cardAt(e.clientX, e.clientY);
        if (!c) return;
        if (c.i === front) openFocus(c.item, c.tile.getBoundingClientRect());
        else turnTo(c.i);
      }
      if (!spin) snap();
    },
    hover: (x, y) => {
      label.move(x, y);
      label.show(cardAt(x, y)?.item.title ?? null);
    },
  });
  stage.addEventListener('pointerleave', () => label.show(null));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') target -= step;
    else if (e.key === 'ArrowLeft') target += step;
    else return;
    e.preventDefault();
    snap();
  });

  const still = reduced();
  loop((dt, now) => {
    if (spin) {
      target += spin * dt;
      spin *= Math.pow(0.92, dt * 60);
      if (Math.abs(spin) < 8) {
        spin = 0;
        snap();
      }
    }
    if (snapAt && now > snapAt) {
      snapAt = 0;
      snap();
    }
    angle += (target - angle) * (still ? 1 : ease(s.smoothing, dt));
    place();
  });

  layout();
  window.addEventListener('resize', layout);
  return { refresh: layout };
}
