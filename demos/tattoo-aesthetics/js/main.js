/*
  Tattoo & Aesthetics — motion and behaviour.
  GSAP 3 core + Observer (section lock), ScrollToPlugin, SplitText.

  Two scroll modes:
  - Locked (mouse/trackpad, motion allowed): every wheel gesture or key moves
    exactly one section, with an eased glide and depth parallax.
  - Native (touch, reduced motion): CSS scroll-snap does the locking, so phones
    keep their natural swipe and momentum; reveals still play as sections arrive.

  ?shot=N  screenshot mode: no intro, no reveals, opens on section N.
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var ready = function () { root.classList.add('is-ready'); };

  if (!window.gsap || !window.Observer || !window.ScrollToPlugin || !window.SplitText) {
    root.classList.add('is-native');
    ready();
    return;
  }

  gsap.registerPlugin(Observer, ScrollToPlugin, SplitText);

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  var params = new URLSearchParams(location.search);
  var shot = params.has('shot') ? Math.max(0, parseInt(params.get('shot'), 10) || 0) : null;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var animate = !reduce && shot === null;
  var locked = animate && fine;
  root.classList.add(locked ? 'is-locked' : 'is-native');

  var panels = $$('[data-panel]');
  var navLinks = $$('.nav a[data-goto]');
  var pagerBtns = $$('[data-pager] button');
  var current = 0;
  var busy = false;
  var menuOpen = false;

  /* ---------- Section reveals (play once per section) ---------- */

  var reveals = [];
  var played = {};

  function buildReveal(panel) {
    var tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 1.2 } });
    var splits = [];

    // Opacity, not autoAlpha: hidden content must stay reachable by Tab
    $$('[data-reveal="fade"]', panel).forEach(function (el) {
      tl.from(el, { opacity: 0, y: 14, duration: 1 }, 0);
    });

    $$('[data-reveal="lines"]', panel).forEach(function (el) {
      var split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
      splits.push(split);
      tl.from(split.lines, { yPercent: 110, stagger: 0.09, duration: 1.3 }, 0.05);
    });

    var services = $$('[data-reveal="service"]', panel);
    if (services.length) tl.from(services, { opacity: 0, y: 80, stagger: 0.12, duration: 1.4 }, 0.15);

    var items = $$('[data-reveal="item"]', panel);
    if (items.length) tl.from(items, { opacity: 0, y: 26, stagger: 0.06 }, 0.3);

    var roster = $$('[data-roster] button', panel);
    if (roster.length) {
      tl.from(roster, { opacity: 0, x: -30, stagger: 0.05 }, 0.25);
      tl.fromTo('[data-portrait]', { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
      tl.from('[data-portrait] img:first-child', { scale: 1.25, duration: 1.8, ease: 'expo.inOut' }, 0);
      tl.from('[data-artist-body], [data-artist-card] .link', { opacity: 0, y: 20, stagger: 0.08 }, 0.5);
    }

    var cards = $$('.work-card', panel).slice(0, 4);
    if (cards.length) tl.from(cards, { opacity: 0, x: 220, stagger: 0.08, duration: 1.6 }, 0.1);

    // Give the lines back to the browser so they re-wrap on resize
    tl.eventCallback('onComplete', function () {
      splits.forEach(function (s) { s.revert(); });
    });
    return tl;
  }

  function reveal(i, delay) {
    if (!animate || played[i] || !reveals[i]) return;
    played[i] = true;
    gsap.delayedCall(delay || 0, function () { reveals[i].play(); });
  }

  function setActive(i, delay) {
    current = i;
    root.dataset.theme = panels[i].dataset.theme;
    pagerBtns.forEach(function (b, n) { b.setAttribute('aria-current', String(n === i)); });
    navLinks.forEach(function (a) { a.setAttribute('aria-current', String(+a.dataset.goto === i)); });
    reveal(i, delay);
  }

  /* ---------- Hero intro ---------- */

  function intro() {
    var media = $('[data-hero-media]');
    var split = SplitText.create('[data-hero-title]', { type: 'lines,chars', mask: 'lines', linesClass: 'line' });
    var tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: function () { split.revert(); },
    });
    tl.fromTo(media, { clipPath: 'inset(16% 24% 16% 24%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.9, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .from($('img', media), { scale: 1.4, duration: 2.3, ease: 'expo.inOut' }, 0)
      .from(split.chars, { yPercent: 115, duration: 1.4, stagger: 0.024 }, 1)
      .from('[data-hero-fade]', { opacity: 0, y: 22, duration: 1.2, stagger: 0.12 }, 1.3)
      .from('.header > *', { opacity: 0, y: -14, duration: 1, stagger: 0.06 }, 1.2)
      .from('.pager', { opacity: 0, x: 14, duration: 1 }, 1.5);
  }

  /* ---------- Section lock ---------- */

  var DUR = 1.2;

  function goTo(i, opts) {
    opts = opts || {};
    i = gsap.utils.clamp(0, panels.length - 1, i);
    var to = panels[i];

    if (!locked) {
      to.scrollIntoView({ behavior: animate ? 'smooth' : 'auto' });
      return;
    }
    if (busy) return;

    var from = panels[current];
    var dir = i === current ? 0 : i > current ? 1 : -1;
    var y = to.offsetTop;
    // Coming back up into a tall section: land on its bottom edge
    if (opts.fromEnd) y = Math.max(y, to.offsetTop + to.offsetHeight - innerHeight);

    busy = true;
    setActive(i, 0.4);
    var tl = gsap.timeline({ onComplete: function () { busy = false; } });
    tl.to(window, { scrollTo: { y: y, autoKill: false }, duration: DUR, ease: 'expo.inOut' }, 0);

    // Depth: outgoing content drifts on ahead, incoming content settles in late
    if (dir) {
      var a = $('[data-depth]', from);
      var b = $('[data-depth]', to);
      tl.fromTo(a, { y: 0 }, { y: -dir * 160, duration: DUR, ease: 'expo.inOut', immediateRender: false }, 0)
        .fromTo(b, { y: dir * 160 }, { y: 0, duration: DUR, ease: 'expo.inOut' }, 0)
        .set(a, { y: 0 });
    }
  }

  // One step down/up: scroll within a section taller than the screen first
  function step(dir) {
    var p = panels[current];
    var top = p.offsetTop;
    var bottom = top + p.offsetHeight;
    var y = window.scrollY;
    var vh = innerHeight;

    if (dir > 0 && bottom - (y + vh) > 2) return glide(Math.min(bottom - vh, y + vh * 0.8));
    if (dir < 0 && y - top > 2) return glide(Math.max(top, y - vh * 0.8));

    var next = current + dir;
    if (next < 0 || next >= panels.length) return;
    goTo(next, { fromEnd: dir < 0 });
  }

  function glide(y) {
    busy = true;
    gsap.to(window, {
      scrollTo: { y: y, autoKill: false },
      duration: 0.9,
      ease: 'expo.out',
      onComplete: function () { busy = false; },
    });
  }

  // Trackpads keep sending inertial wheel events for a second or more:
  // a new step needs a short quiet gap first, so one flick = one section.
  var quietUntil = 0;
  function gate(dir) {
    var now = performance.now();
    var ok = !busy && !menuOpen && now > quietUntil;
    quietUntil = now + 180;
    if (ok) step(dir);
  }

  function mountLock() {
    Observer.create({
      target: window,
      type: 'wheel,touch',
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      ignore: 'textarea',
      onUp: function () { gate(1); },
      onDown: function () { gate(-1); },
    });

    addEventListener('keydown', function (e) {
      if (menuOpen || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      var k = e.key;
      var d = 0;
      if (k === 'ArrowDown' || k === 'PageDown') d = 1;
      else if (k === 'ArrowUp' || k === 'PageUp') d = -1;
      else if (k === ' ') {
        if (e.target.closest && e.target.closest('button, a')) return; // Space activates those
        d = e.shiftKey ? -1 : 1;
      } else if (k === 'Home' || k === 'End') {
        e.preventDefault();
        goTo(k === 'Home' ? 0 : panels.length - 1);
        return;
      }
      if (!d) return;
      e.preventDefault();
      if (!busy) step(d);
    });

    // Focus moves, find-in-page and hash jumps scroll natively: follow them
    var t;
    addEventListener('scroll', function () {
      if (busy) return;
      clearTimeout(t);
      t = setTimeout(function () {
        if (busy) return;
        var mid = window.scrollY + innerHeight / 2;
        for (var i = 0; i < panels.length; i++) {
          var p = panels[i];
          if (mid >= p.offsetTop && mid < p.offsetTop + p.offsetHeight) {
            if (i !== current) setActive(i);
            break;
          }
        }
      }, 120);
    }, { passive: true });

    // Keep the current section aligned when the window changes size
    var r;
    addEventListener('resize', function () {
      clearTimeout(r);
      r = setTimeout(function () {
        if (!busy) gsap.set(window, { scrollTo: { y: panels[current].offsetTop, autoKill: false } });
      }, 150);
    });
  }

  function mountNative() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(panels.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    panels.forEach(function (p) { io.observe(p); });
  }

  /* ---------- Links to sections ---------- */

  function mountLinks() {
    $$('[data-goto]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var i = +el.dataset.goto;
        var go = function () {
          goTo(i);
          panels[i].setAttribute('tabindex', '-1');
          panels[i].focus({ preventScroll: true });
        };
        if (menuOpen) closeMenu(go);
        else go();
      });
    });
  }

  /* ---------- Mobile menu ---------- */

  var burger = $('[data-burger]');
  var menu = $('[data-menu]');
  var burgerLabel = $('.burger__label', burger);

  function openMenu() {
    menuOpen = true;
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burgerLabel.textContent = 'Close';
    root.classList.add('menu-open');
    if (!locked) root.style.overflow = 'hidden';
    gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: animate ? 0.8 : 0, ease: 'expo.inOut' });
    gsap.fromTo($$('.menu__list li, .menu__foot', menu), { yPercent: 60, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: animate ? 0.9 : 0, stagger: 0.05, delay: animate ? 0.25 : 0, ease: 'expo.out' });
  }

  function closeMenu(after) {
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    burgerLabel.textContent = 'Menu';
    root.classList.remove('menu-open');
    if (!locked) root.style.overflow = '';
    gsap.to(menu, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: animate ? 0.7 : 0,
      ease: 'expo.inOut',
      onComplete: function () {
        menu.hidden = true;
        if (typeof after === 'function') after();
      },
    });
  }

  function mountMenu() {
    burger.addEventListener('click', function () {
      if (menuOpen) closeMenu();
      else openMenu();
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) {
        closeMenu();
        burger.focus();
      }
    });
    // Desktop width again: the menu has no place there
    matchMedia('(min-width: 1024px)').addEventListener('change', function (m) {
      if (m.matches && menuOpen) closeMenu();
    });
  }

  /* ---------- Artists ---------- */

  var ARTISTS = [
    ['Fine-line & botanical', 'Single-needle florals and script that age gracefully. Twelve years on the machine.'],
    ['Realism & portrait', 'Colour and black-and-grey realism: portraits of people, pets and places.'],
    ['Blackwork & ornamental', 'Bold black geometry and ornament drawn to follow the body.'],
    ['Neo-traditional', 'Strong lines and rich colour; classic motifs redrawn for today.'],
    ['Brow & lip aesthetics', 'Licensed practitioner for brow shaping, lip blush and skin boosters.'],
    ['Japanese & large-scale', 'Sleeves and back pieces, planned with you across several sessions.'],
  ];

  function mountArtists() {
    var buttons = $$('[data-artist]');
    var pics = $$('[data-portrait] img');
    var body = $('[data-artist-body]');
    var roleEl = $('[data-artist-role]');
    var bioEl = $('[data-artist-bio]');
    var idxEl = $('[data-artist-index]');
    var firstEl = $('[data-artist-first]');
    var active = 0;
    var z = 1;

    function show(i) {
      if (i === active) return;
      active = i;
      buttons.forEach(function (b, n) {
        b.classList.toggle('is-active', n === i);
        b.setAttribute('aria-pressed', String(n === i));
      });

      var img = pics[i];
      gsap.killTweensOf(img);
      gsap.set(img, { zIndex: ++z, visibility: 'visible' });
      if (animate) {
        gsap.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.2 },
          { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.1, ease: 'expo.out' });
      }

      var swap = function () {
        roleEl.textContent = ARTISTS[i][0];
        bioEl.textContent = ARTISTS[i][1];
        idxEl.textContent = pad(i + 1);
        firstEl.textContent = buttons[i].textContent.trim().split(' ')[0];
      };
      if (!animate) return swap();
      gsap.killTweensOf(body);
      gsap.to(body, {
        opacity: 0, y: -10, duration: 0.2, ease: 'power2.in',
        onComplete: function () {
          swap();
          gsap.fromTo(body, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' });
        },
      });
    }

    buttons.forEach(function (b, n) {
      b.addEventListener('click', function () { show(n); });
      b.addEventListener('focus', function () { show(n); });
      if (fine) b.addEventListener('mouseenter', function () { show(n); });
    });
  }

  /* ---------- Works marquee ---------- */

  function mountMarquee() {
    var marquee = $('[data-marquee]');
    var track = $('[data-marquee-track]');
    var originals = Array.prototype.slice.call(track.children);

    // Two extra copies make the loop seamless; they're hidden from assistive tech
    for (var k = 0; k < 2; k++) {
      originals.forEach(function (li) {
        var c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('img', c).forEach(function (im) { im.alt = ''; });
        track.appendChild(c);
      });
    }

    var setW = 0;
    var unit = 0;
    var measure = function () {
      setW = track.children[originals.length].offsetLeft - originals[0].offsetLeft;
      unit = setW / originals.length;
    };
    measure();
    addEventListener('resize', measure);
    $$('img', track).forEach(function (im) { if (!im.complete) im.addEventListener('load', measure, { once: true }); });

    var m = { base: 0, off: 0, offTarget: 0, factor: 1, target: 1 };
    var speed = animate ? 0.45 : 0; // px per 60fps frame
    var inView = false;
    var setX = gsap.quickSetter(track, 'x', 'px');

    new IntersectionObserver(function (e) { inView = e[0].isIntersecting; }).observe(marquee);

    gsap.ticker.add(function (time, dt) {
      if (!inView || !setW) return;
      dt = Math.min(Math.max(dt, 0), 64);
      m.factor += (m.target - m.factor) * (1 - Math.exp(-dt / 220));
      m.base -= speed * m.factor * (dt / 16.67);
      setX(gsap.utils.wrap(-setW, 0, m.base + m.off));
    });

    var nudge = function (d) {
      m.offTarget -= d * unit;
      gsap.to(m, { off: m.offTarget, duration: animate ? 1.1 : 0.01, ease: 'expo.out', overwrite: true });
    };
    $('[data-works-next]').addEventListener('click', function () { nudge(1); });
    $('[data-works-prev]').addEventListener('click', function () { nudge(-1); });

    if (fine) {
      marquee.addEventListener('mouseenter', function () { m.target = 0; });
      marquee.addEventListener('mouseleave', function () { m.target = 1; });
    }

    // Drag / swipe sideways, with a little momentum on release
    var drag = null;
    marquee.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      gsap.killTweensOf(m);
      drag = { last: e.clientX, t: performance.now(), v: 0 };
      marquee.setPointerCapture(e.pointerId);
      marquee.classList.add('is-dragging');
    });
    marquee.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var now = performance.now();
      var dx = e.clientX - drag.last;
      drag.v = dx / Math.max(1, now - drag.t);
      drag.last = e.clientX;
      drag.t = now;
      m.off += dx;
      m.offTarget = m.off;
    });
    var release = function () {
      if (!drag) return;
      m.offTarget = m.off + gsap.utils.clamp(-3, 3, drag.v) * 320;
      gsap.to(m, { off: m.offTarget, duration: 1.2, ease: 'expo.out', overwrite: true });
      drag = null;
      marquee.classList.remove('is-dragging');
    };
    marquee.addEventListener('pointerup', release);
    marquee.addEventListener('pointercancel', release);
  }

  /* ---------- Booking form (demo: nothing is sent) ---------- */

  function mountForm() {
    var form = $('[data-form]');
    var status = $('[data-form-status]');
    var required = $$('input[required]', form);

    required.forEach(function (f) {
      f.addEventListener('input', function () { f.removeAttribute('aria-invalid'); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      required.forEach(function (f) {
        var ok = f.checkValidity();
        if (ok) f.removeAttribute('aria-invalid');
        else f.setAttribute('aria-invalid', 'true');
        if (!ok && !bad) bad = f;
      });
      if (bad) {
        status.textContent = bad.type === 'email' && bad.value
          ? 'That email address looks incomplete.'
          : 'Please add your name and email so we can reply.';
        bad.focus();
        return;
      }
      var name = form.elements.name.value.trim().split(/\s+/)[0];
      var service = form.elements.service.value.toLowerCase();
      status.textContent = 'Thanks, ' + name + '. A real studio would reply within a day about your '
        + service + ' session. This is a concept site, so nothing was sent.';
      form.reset();
    });
  }

  /* ---------- Start ---------- */

  function init() {
    if (animate) {
      panels.forEach(function (p, i) { if (i > 0) reveals[i] = buildReveal(p); });
    }
    mountLinks();
    mountMenu();
    mountArtists();
    mountMarquee();
    mountForm();

    var start = 0;
    if (shot !== null) start = Math.min(shot, panels.length - 1);
    else if (location.hash) {
      var hashIndex = panels.findIndex(function (p) { return '#' + p.id === location.hash; });
      if (hashIndex > -1) start = hashIndex;
    }

    if (locked) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      mountLock();
    } else {
      mountNative();
    }
    window.scrollTo({ top: panels[start].offsetTop, behavior: 'instant' });
    setActive(start);
    if (start > 0) played[0] = true;

    if (shot !== null) {
      // Headless screenshots ignore scroll: show the requested section alone
      root.classList.add('is-shot');
      panels.forEach(function (p, n) { if (n !== start) p.style.display = 'none'; });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    ready();
    if (animate && start === 0) intro();
  }

  // Split text only once the web fonts are in (line breaks depend on them)
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1500); }),
  ]).then(init);
})();
