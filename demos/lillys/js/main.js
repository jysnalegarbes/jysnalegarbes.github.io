/*
  Lilly's demo — homepage behaviour and motion.
  Smooth scroll (Lenis), header (solid after the hero, hides on scroll down,
  Menu dropdown, mobile menu), toast, the featured-menu preview swap, the
  water-ripple shader (hero + The Space) and GSAP scroll motion.

  ?shot      screenshot mode: no smooth scroll, no reveals, no shader
  ?shot=id   ...and jump to that section
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var params = new URLSearchParams(location.search);
  var shot = params.has('shot');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText);
  var animate = hasGsap && !reduce && !shot;
  var desktop = matchMedia('(min-width: 1024px)');
  var lenis = null;

  if (shot) {
    root.classList.add('is-shot');
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  }
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ---------- Toast ---------- */

  var toastEl = $('[data-toast-el]');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toast]');
    if (!t) return;
    e.preventDefault();
    toast(t.getAttribute('data-toast'));
  });

  /* ---------- Header ---------- */

  var header = $('[data-header]');
  var burger = $('[data-burger]');
  var mobile = $('[data-mobile-menu]');
  var drop = $('.has-drop');
  var dropBtn = $('[data-drop]');
  var holdHeader = 0;
  var menuOpen = false;

  function showHeader(ms) {
    holdHeader = Date.now() + (ms || 0);
    header.classList.remove('is-hidden');
  }

  function setDrop(open) {
    drop.classList.toggle('is-open', open);
    dropBtn.setAttribute('aria-expanded', String(open));
  }
  dropBtn.addEventListener('click', function () { setDrop(!drop.classList.contains('is-open')); });
  if (matchMedia('(hover: hover)').matches) {
    drop.addEventListener('mouseenter', function () { setDrop(true); });
    drop.addEventListener('mouseleave', function () { setDrop(false); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drop.classList.contains('is-open')) { setDrop(false); dropBtn.focus(); }
    if (menuOpen) { setMenu(false); burger.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-drop')) setDrop(false);
  });

  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      mobile.hidden = false;
      requestAnimationFrame(function () { mobile.classList.add('is-open'); });
      if (lenis) lenis.stop();
      document.body.style.overflow = 'hidden';
      showHeader();
      if (animate) {
        gsap.fromTo($$('li, .btn', mobile), { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out', delay: 0.15,
        });
      }
    } else {
      mobile.classList.remove('is-open');
      if (lenis) lenis.start();
      document.body.style.overflow = '';
      setTimeout(function () { if (!menuOpen) mobile.hidden = true; }, 800);
    }
  }
  burger.addEventListener('click', function () { setMenu(!menuOpen); });
  desktop.addEventListener('change', function () { if (desktop.matches) setMenu(false); });

  var hero = $('.hero');
  var lastY = window.scrollY;
  function onScroll(y) {
    header.classList.toggle('is-solid', y > hero.offsetHeight - 120);
    if (!menuOpen && !shot && Date.now() > holdHeader && !drop.classList.contains('is-open')) {
      if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', y > lastY && y > hero.offsetHeight * 0.6);
    }
    lastY = y;
  }

  /* ---------- Smooth scroll + in-page links ---------- */

  function scrollTo(target) {
    setMenu(false);
    setDrop(false);
    showHeader(1600);
    if (lenis) lenis.scrollTo(target, { duration: 1.5 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  function mountScroll() {
    if (animate && window.Lenis) {
      lenis = new Lenis({ autoRaf: false, duration: 1.2 });
      lenis.on('scroll', function (l) { ScrollTrigger.update(); onScroll(l.scroll); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    }
    onScroll(window.scrollY);

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-toast')) return;
      var hash = a.getAttribute('href');
      if (hash.length < 2) return;
      var el = hash === '#top' ? 0 : $(hash);
      if (el === null) return;
      e.preventDefault();
      scrollTo(el);
    });
  }

  /* ---------- Featured menu: hover a row, the preview swaps ---------- */

  function mountMenu() {
    var preview = $('[data-menu-preview]');
    var imgs = $$('img', preview);
    var rows = $$('[data-row]');
    var current = imgs[0];
    var idle = 0;

    function show(img) {
      if (img === current) return;
      var prev = current;
      prev.classList.add('is-leaving');
      prev.classList.remove('is-on');
      // Restart the wipe from the bottom for the incoming image
      img.classList.remove('is-leaving');
      void img.offsetWidth;
      img.classList.add('is-on');
      current = img;
      setTimeout(function () { if (prev !== current) prev.classList.remove('is-leaving'); }, 900);
    }

    rows.forEach(function (row) {
      var img = $('[data-for="' + row.getAttribute('data-row') + '"]', preview);
      function on() {
        clearTimeout(idle);
        rows.forEach(function (r) { r.classList.toggle('is-active', r === row); });
        show(img);
      }
      row.addEventListener('mouseenter', on);
      row.addEventListener('focus', on);
    });

    // Leaving the list returns to the cover dish after a beat
    $('[data-menu-list]').addEventListener('mouseleave', function () {
      idle = setTimeout(function () {
        rows.forEach(function (r) { r.classList.remove('is-active'); });
        show(imgs[0]);
      }, 600);
    });
  }

  /* ---------- Shader scenes ---------- */

  var heroGL = null;
  var spaceGL = null;

  function mountGL() {
    if (shot || reduce || !window.RippleGL) return;
    heroGL = RippleGL.mount($('.hero'), { intro: animate ? 1 : 0 });
    spaceGL = RippleGL.mount($('.space'), { calm: 1.3 });
  }

  /* ---------- Motion ---------- */

  function once(trigger, start) {
    return { trigger: trigger, start: start || 'top 82%', once: true };
  }

  function intro() {
    var title = SplitText.create('[data-hero-title]', { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: function () { title.revert(); } });
    tl.from('[data-hero-media]', { scale: 1.14, duration: 2.6 }, 0)
      .from(title.lines, { yPercent: 110, duration: 1.4, stagger: 0.09 }, 0.35)
      .from('.header__logo', { scale: 0.4, rotate: -120, opacity: 0, duration: 1.6 }, 0.1)
      .from('.header__nav li, .header__cta, .burger', { y: -24, opacity: 0, duration: 1, stagger: 0.06, clearProps: 'transform,opacity' }, 0.3)
      .fromTo('.scroll-cue__ring', { strokeDasharray: '0 720' }, { strokeDasharray: '720 0', duration: 2, ease: 'power3.inOut' }, 0.6);
    if (heroGL) {
      var u = { v: 1 };
      tl.to(u, { v: 0, duration: 2.4, ease: 'power3.out', onUpdate: function () { heroGL.set('intro', u.v); } }, 0);
    }
  }

  // Script words write themselves left to right, like a pen stroke
  function writeIn(el, vars) {
    return gsap.fromTo(el, { clipPath: 'inset(-20% 100% -30% -10%)' }, Object.assign({
      clipPath: 'inset(-20% -10% -30% -10%)', duration: 1.6, ease: 'power2.inOut', clearProps: 'clipPath',
    }, vars));
  }

  function riseLines(el, vars) {
    var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    return gsap.from(s.lines, Object.assign({
      yPercent: 105, duration: 1.2, stagger: 0.08, ease: 'expo.out',
      onComplete: function () { s.revert(); },
    }, vars));
  }

  function reveals() {
    // Script accents
    $$('[data-script]').forEach(function (el) {
      writeIn(el, { scrollTrigger: once(el, 'top 85%') });
    });

    // Headings and short paragraphs rise by line
    $$('[data-rise]').forEach(function (el) {
      riseLines(el, { scrollTrigger: once(el, 'top 88%'), delay: el.closest('.by') ? 0.15 : 0 });
    });

    // Lists of short lines arrive one after another
    $$('[data-lines]').forEach(function (el) {
      gsap.from(el.children, {
        opacity: 0, y: 30, duration: 1.1, stagger: 0.1, ease: 'expo.out', delay: 0.3,
        scrollTrigger: once(el, 'top 88%'),
      });
    });

    // Dish names: letters tip up into place
    $$('[data-chars]').forEach(function (el) {
      var s = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'split-line' });
      gsap.from(s.chars, {
        yPercent: 120, rotate: 10, duration: 1.1, stagger: 0.025, ease: 'expo.out',
        scrollTrigger: once(el, 'top 85%'),
        onComplete: function () { s.revert(); },
      });
    });

    // Photos open from their curved side, then drift as you scroll
    $$('[data-reveal-media]').forEach(function (fig) {
      var side = fig.getAttribute('data-reveal-media');
      var from = side === 'left' ? 'inset(0% 0% 0% 100%)' : side === 'right' ? 'inset(0% 100% 0% 0%)' : 'inset(100% 0% 0% 0%)';
      var img = $('img', fig);
      gsap.timeline({ scrollTrigger: once(fig, 'top 80%') })
        .fromTo(fig, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
        .from(img, { scale: 1.3, duration: 2, ease: 'expo.out' }, 0.2);
    });
    $$('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -12 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Menu rules draw across, rows follow
    var list = $('[data-menu-list]');
    gsap.fromTo($$('li', list), { '--line': 0 }, {
      '--line': 1, duration: 1.4, stagger: 0.12, ease: 'expo.inOut',
      scrollTrigger: once(list, 'top 80%'),
    });
    gsap.from($$('.menu__row', list), {
      opacity: 0, y: 40, duration: 1.1, stagger: 0.12, ease: 'expo.out', delay: 0.3,
      scrollTrigger: once(list, 'top 80%'),
    });
    gsap.fromTo('[data-menu-preview]', { clipPath: 'inset(0% 0% 100% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath',
      scrollTrigger: once('[data-menu-preview]', 'top 80%'),
    });

    // The space: the line lights up word by word as you scroll through
    var words = SplitText.create('[data-words]', { type: 'words' });
    gsap.fromTo(words.words, { opacity: 0.15 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.space', start: 'top 65%', end: 'center 45%', scrub: true },
    });
    gsap.fromTo('.space__media', { yPercent: -8 }, {
      yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: '.space', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Our story: arches rise from below, then drift at different speeds
    $$('[data-arch]').forEach(function (arch, i) {
      gsap.timeline({ scrollTrigger: once('.story', 'top 70%') })
        .fromTo(arch, { clipPath: 'inset(100% 0% 0% 0% round 50% 50% 0 0)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 0% 0% 0 0)', duration: 1.6, ease: 'expo.inOut', delay: i * 0.15, clearProps: 'clipPath',
        }, 0)
        .from($('img', arch), { scale: 1.35, duration: 2.2, ease: 'expo.out', delay: i * 0.15 }, 0.2);
      gsap.fromTo(arch, { y: (i ? 80 : 40) }, {
        y: (i ? -80 : -40), ease: 'none',
        scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    gsap.from('.story .text-link', { opacity: 0, y: 20, duration: 1, ease: 'expo.out', scrollTrigger: once('.story .text-link', 'top 92%') });

    // Order: delivery apps pop in
    gsap.from('.apps li', {
      scale: 0.4, opacity: 0, rotate: -12, duration: 1, stagger: 0.09, ease: 'back.out(2)',
      scrollTrigger: once('.apps', 'top 92%'),
    });

    // Footer: the badge rolls in, columns follow
    gsap.from('[data-footer-badge]', {
      rotate: -180, scale: 0.6, opacity: 0, duration: 1.8, ease: 'expo.out',
      scrollTrigger: once('.footer', 'top 75%'),
    });
    gsap.from('.fcol', {
      opacity: 0, y: 40, duration: 1.1, stagger: 0.08, ease: 'expo.out',
      scrollTrigger: once('.footer__cols', 'top 90%'),
    });

    // Hero leaves: copy lifts and fades, the water stirs
    gsap.to('[data-hero-title], .scroll-cue', {
      yPercent: -30, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('[data-hero-media]', {
      yPercent: 18, ease: 'none',
      scrollTrigger: {
        trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: function (st) { if (heroGL) heroGL.set('scroll', st.progress); },
      },
    });
    if (spaceGL) {
      ScrollTrigger.create({
        trigger: '.space', start: 'center center', end: 'bottom top',
        onUpdate: function (st) { spaceGL.set('scroll', st.progress); },
      });
    }
  }

  // Buttons lean toward the pointer a little
  function magnetic() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.18);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- Image loading ---------- */

  // Images inside clip-path reveals start fully clipped, and Chrome won't
  // lazy-load what it can't see: load each one when its section is near.
  function mountPreload() {
    var imgs = $$('img[loading="lazy"]');
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(function (im) { im.loading = 'eager'; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('img[loading="lazy"]', e.target).forEach(function (im) { im.loading = 'eager'; });
        io.unobserve(e.target);
      });
    }, { rootMargin: '100% 0px' });
    imgs.forEach(function (im) { io.observe(im.closest('section, footer') || im.parentNode); });
  }

  /* ---------- Start ---------- */

  function start() {
    mountPreload();
    mountScroll();
    mountMenu();
    mountGL();
    if (animate) {
      intro();
      reveals();
      magnetic();
    }
    root.classList.add('is-ready');
    if (shot && params.get('shot')) {
      var el = document.getElementById(params.get('shot'));
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
    }
  }

  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 2500); }),
  ]).then(start);
})();
