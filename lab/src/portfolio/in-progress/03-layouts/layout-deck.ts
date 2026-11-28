/*
  Layout 4: Deck
  --------------
  The images lie in a loose stack. Grab the top one and throw it off
  (any direction): it flies out and slides back in under the pile; let go
  too gently and it springs back. Scroll down / the right arrow throws the
  top card, scroll up / the left arrow brings the last one back on top.
  The top card tilts toward the cursor; its title and number sit under
  the stack. Click the top card: focus view.
*/
import gsap from 'gsap';
import {
  bindInput,
  cursorLabel,
  openFocus,
  reduced,
  repeat,
  tile,
  type IpItem,
  type Layout,
  type LayoutSettings,
} from './common';

export function mountDeck(stage: HTMLElement, items: IpItem[], all: LayoutSettings): Layout {
  const s = all.deck;
  stage.classList.add('ipx-deck');
  const pile = document.createElement('div');
  pile.className = 'ipx-deck__pile';
  const caption = document.createElement('div');
  caption.className = 'ipx-deck__cap';
  caption.innerHTML = '<span class="ipx-deck__num"></span><span class="ipx-deck__title"></span>';
  stage.append(pile, caption);

  const list = repeat(items, Math.max(6, items.length));
  const seed = (i: number, k: number) => {
    const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const cards = list.map((item, i) => {
    const t = tile(item, 'ipx-tile ipx-deck__card');
    pile.append(t);
    return { el: t, item, i, rot: seed(i, 1) };
  });
  let order = cards.slice(); // order[0] is on top
  const label = cursorLabel(stage);
  const d = reduced() ? 0.01 : 1;
  let w = 0;
  let h = 0;
  let busy = false;
  let drag = { x: 0, y: 0 };

  const pose = (k: number, c: (typeof cards)[number]) => ({
    x: k * s.spread * 0.5,
    y: k * s.spread,
    rotation: k === 0 ? 0 : c.rot * s.tilt * 0.45,
    scale: 1 - Math.min(k, 6) * 0.025,
  });

  function settle(duration = 0.7) {
    order.forEach((c, k) => {
      c.el.style.zIndex = String(order.length - k);
      gsap.to(c.el, { ...pose(k, c), rotationX: 0, rotationY: 0, duration: duration * d, ease: 'expo.out', overwrite: 'auto' });
    });
    const top = order[0];
    caption.querySelector('.ipx-deck__num')!.textContent =
      `${String((top.i % items.length) + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    caption.querySelector('.ipx-deck__title')!.textContent = top.item.title;
  }

  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // (phones: under the intro text, so a smaller pile)
    h = vw < 1024 ? Math.min(vh * 0.4, vw * 0.62) : Math.min(vh * s.size, vw * 0.7);
    w = h * 0.88;
    cards.forEach((c) => Object.assign(c.el.style, { width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px` }));
    caption.style.marginTop = `${h / 2 + 28}px`;
    settle(0);
  }

  /** Throw the top card toward (dx, dy) and slide it back in under the pile */
  function throwTop(dx: number, dy: number) {
    if (busy) return;
    busy = true;
    const top = order[0];
    const len = Math.hypot(dx, dy) || 1;
    const far = Math.max(window.innerWidth, window.innerHeight) * 0.9;
    order = [...order.slice(1), top];
    label.show(null);
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to(top.el, {
        x: `+=${(dx / len) * far}`,
        y: `+=${(dy / len) * far * 0.6}`,
        rotation: `+=${Math.sign(dx || 1) * 28}`,
        duration: 0.45 * d,
        ease: 'power2.in',
      })
      .add(() => {
        top.el.style.zIndex = '0';
        settle();
      });
  }

  /** Bring the bottom card back on top, from the left */
  function bringBack() {
    if (busy) return;
    busy = true;
    const last = order[order.length - 1];
    order = [last, ...order.slice(0, -1)];
    gsap.set(last.el, { x: -window.innerWidth * 0.8, rotation: -24, zIndex: order.length + 1 });
    settle();
    gsap.delayedCall(0.4 * d, () => (busy = false));
  }

  const onTop = (x: number, y: number) =>
    document.elementsFromPoint(x, y).find((e) => e.classList.contains('ipx-deck__card')) === order[0].el;

  let grabbing = false;
  bindInput(stage, {
    down: (x, y) => {
      grabbing = !busy && onTop(x, y);
      drag = { x: 0, y: 0 };
      if (grabbing) gsap.killTweensOf(order[0].el);
    },
    move: (dx, dy) => {
      if (!grabbing) return;
      drag.x += dx;
      drag.y += dy;
      gsap.set(order[0].el, { x: drag.x, y: drag.y, rotation: drag.x * 0.06, rotationX: 0, rotationY: 0 });
    },
    up: (vx, vy, moved, e) => {
      if (!grabbing) return;
      grabbing = false;
      if (!moved) {
        if (onTop(e.clientX, e.clientY)) openFocus(order[0].item, order[0].el.getBoundingClientRect());
        return;
      }
      const fast = Math.hypot(vx, vy) > 700;
      if (fast || Math.hypot(drag.x, drag.y) > w * s.fling) throwTop(fast ? vx : drag.x, fast ? vy : drag.y);
      else gsap.to(order[0].el, { ...pose(0, order[0]), duration: 0.9 * d, ease: 'elastic.out(1, 0.5)' });
    },
    hover: (x, y) => {
      label.move(x, y);
      const top = order[0];
      const hit = !busy && onTop(x, y);
      label.show(hit ? 'Drag to throw' : null);
      if (grabbing || busy || reduced()) return;
      // Tilt toward the cursor while over the top card
      const r = top.el.getBoundingClientRect();
      const nx = hit ? ((x - r.left) / r.width) * 2 - 1 : 0;
      const ny = hit ? ((y - r.top) / r.height) * 2 - 1 : 0;
      gsap.to(top.el, { rotationY: nx * 8, rotationX: -ny * 8, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    },
  });

  // Wheel: one card per gesture (a pause of 400 ms ends a gesture)
  let wheelAcc = 0;
  let wheelT = 0;
  let wheelLocked = false;
  window.addEventListener(
    'wheel',
    (e) => {
      if ((e.target as Element)?.closest?.('[data-ip-ignore], .site-header')) return;
      const now = performance.now();
      if (now - wheelT > 400) {
        wheelAcc = 0;
        wheelLocked = false;
      }
      wheelT = now;
      if (wheelLocked) return;
      wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(wheelAcc) < 90) return;
      wheelLocked = true;
      if (wheelAcc > 0) throwTop(-1, -0.2);
      else bringBack();
    },
    { passive: true },
  );
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') throwTop(1, -0.2);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') bringBack();
    else return;
    e.preventDefault();
  });

  layout();
  window.addEventListener('resize', layout);
  return { refresh: layout };
}
