/*
  Wykend Devs demo — landing page behaviour and motion.
  Smooth scroll (Lenis), header (compacts after the top, hides on scroll down,
  mobile menu), toast, the service deck (pinned, scroll deals the cards on
  desktop), the draggable project rail and GSAP scroll motion.

  ?shot      screenshot mode: no smooth scroll, no reveals, static deck
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
  var DESKTOP = '(min-width: 1024px)';
  var desktop = matchMedia(DESKTOP);
  var lenis = null;

  if (shot) {
    root.classList.add('is-shot');
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  }
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

  // One Figma px at the current width (matches --u in the CSS)
  function u(n) { return n * Math.min(window.innerWidth, 1920) / 1920; }

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
  var holdHeader = 0;
  var menuOpen = false;

  function showHeader(ms) {
    holdHeader = Date.now() + (ms || 0);
    header.classList.remove('is-hidden');
  }

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
        gsap.fromTo($$('li, .btn', mobile), { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out', delay: 0.15,
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
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); }
  });

  var lastY = window.scrollY;
  function onScroll(y) {
    header.classList.toggle('is-compact', y > 40);
    if (!menuOpen && !shot && Date.now() > holdHeader) {
      if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6);
    }
    lastY = y;
  }

  /* ---------- Smooth scroll + in-page links ---------- */

  function scrollTo(target) {
    setMenu(false);
    showHeader(1600);
    var offset = target === 0 ? 0 : -u(150);
    if (lenis) lenis.scrollTo(target, { duration: 1.5, offset: offset });
    else {
      var top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    }
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

  /* ---------- Service deck ---------- */

  // Desktop: the four cards sit in one stack (as in Figma). With motion on,
  // the section pins and scrolling deals the top card away to show the next.
  // Mobile / reduced motion: a plain list.
  var PEEK = 16;
  function mountDeck() {
    if (!hasGsap || reduce) return;
    var cards = $$('.svc');
    var n = cards.length;
    var mm = gsap.matchMedia();
    mm.add(DESKTOP, function () {
      root.classList.add('deck-on');
      cards.forEach(function (c, i) {
        gsap.set(c, { zIndex: n - i, y: u(PEEK) * i, scale: 1 - i * 0.04, transformOrigin: '50% 100%' });
      });
      if (!animate) return function () { root.classList.remove('deck-on'); gsap.set(cards, { clearProps: 'all' }); };

      var tl = gsap.timeline({ defaults: { duration: 1 } });
      for (var i = 0; i < n - 1; i++) {
        // Stay solid while it clears the next card, fade only at the end
        tl.to(cards[i], { xPercent: -24, yPercent: -95, rotate: -9, scale: 0.94, ease: 'power2.in' }, i)
          .to(cards[i], { opacity: 0, duration: 0.3, ease: 'none' }, i + 0.7);
        for (var j = i + 1; j < n; j++) {
          tl.to(cards[j], { y: u(PEEK) * (j - i - 1), scale: 1 - (j - i - 1) * 0.04, ease: 'power2.inOut' }, i);
        }
      }
      tl.to({}, { duration: 0.35 });
      var st = ScrollTrigger.create({
        trigger: '.offer',
        start: 'center center',
        end: function () { return '+=' + Math.round(window.innerHeight * 0.6 * (n - 1)); },
        pin: true,
        scrub: 0.8,
        animation: tl,
        invalidateOnRefresh: true,
      });
      return function () {
        st.kill();
        tl.kill();
        root.classList.remove('deck-on');
        gsap.set(cards, { clearProps: 'all' });
      };
    });
  }

  /* ---------- Project rail: drag with the mouse ---------- */

  function mountRail() {
    var rail = $('[data-rail]');
    var down = false, moved = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, v = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false;
      startX = lastX = e.clientX; startLeft = rail.scrollLeft; lastT = performance.now(); v = 0;
      if (hasGsap) gsap.killTweensOf(rail);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; rail.classList.add('is-dragging'); }
      if (!moved) return;
      rail.scrollLeft = startLeft - dx;
      var now = performance.now();
      var dt = Math.max(1, now - lastT);
      v = (e.clientX - lastX) / dt;
      lastX = e.clientX; lastT = now;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (moved && hasGsap && !reduce) {
        gsap.to(rail, { scrollLeft: rail.scrollLeft - v * 380, duration: 0.9, ease: 'power3.out' });
      }
      // Let the click that ends a drag pass without opening anything
      setTimeout(function () { rail.classList.remove('is-dragging'); }, 0);
    });
    rail.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ---------- Motion ---------- */

  function once(trigger, start) {
    return { trigger: trigger, start: start || 'top 82%', once: true };
  }

  function intro() {
    var bold = SplitText.create('[data-bold]', { type: 'chars' });
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: function () { bold.revert(); } });
    tl.from('.header__bar', { yPercent: -170, duration: 1.4 }, 0)
      .from('.header__links li, .header__logo, .burger', { y: -18, opacity: 0, duration: 1, stagger: 0.05, clearProps: 'transform,opacity' }, 0.35)
      .from('.pill--hero', { y: -90, rotate: -24, opacity: 0, duration: 1.8, ease: 'elastic.out(1, 0.5)' }, 0.45)
      .from('.hero__in', { yPercent: 112, duration: 1.3, stagger: 0.1 }, 0.3)
      .from(bold.chars, { scale: 0, rotate: -35, yPercent: 30, duration: 0.9, stagger: 0.05, ease: 'back.out(3)' }, 0.85)
      .from('.hl__bg', { scaleX: 0, duration: 1.1, ease: 'expo.inOut' }, 0.6)
      .fromTo('.hl__text', { clipPath: 'inset(-10% 100% -10% 0%)' }, { clipPath: 'inset(-10% 0% -10% 0%)', duration: 1, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.95)
      .from('[data-hero-sub]', { y: 30, opacity: 0, duration: 1.2 }, 1.1)
      .from('[data-hero-ctas] .btn', { y: 50, opacity: 0, duration: 1.3, stagger: 0.1, ease: 'back.out(1.7)' }, 1.2);

    // Leaving the hero: the headline drifts up a little slower than the page
    gsap.to('.hero__title', {
      y: function () { return -u(140); }, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  }

  function riseLines(el, vars) {
    var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    return gsap.from(s.lines, Object.assign({
      yPercent: 108, duration: 1.2, stagger: 0.09, ease: 'expo.out',
      onComplete: function () { s.revert(); },
    }, vars));
  }

  function reveals() {
    $$('[data-rise]').forEach(function (el) {
      riseLines(el, { scrollTrigger: once(el, 'top 88%') });
    });

    // Pills swing in like tags dropped onto the page
    $$('[data-pill]').forEach(function (el) {
      if (el.classList.contains('pill--hero')) return;
      gsap.from(el, { y: -50, rotate: -22, opacity: 0, duration: 1.7, ease: 'elastic.out(1, 0.5)', scrollTrigger: once(el, 'top 90%') });
    });
    gsap.from('[data-pop]', { y: 40, opacity: 0, duration: 1.2, ease: 'back.out(1.7)', scrollTrigger: once('[data-pop]', 'top 95%') });
    gsap.from('[data-pop-group] .btn', { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'back.out(1.7)', scrollTrigger: once('[data-pop-group]', 'top 95%') });

    // Red panels open out as they arrive; their marks drift
    ['.about', '.cta'].forEach(function (sel) {
      gsap.fromTo(sel, { clipPath: 'inset(4% 3% 0% 3% round 64px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: sel, start: 'top bottom', end: 'top 45%', scrub: true },
      });
    });
    $$('[data-mark]').forEach(function (m) {
      gsap.fromTo(m, { xPercent: 6, yPercent: 10 }, {
        xPercent: -3, yPercent: -4, ease: 'none',
        scrollTrigger: { trigger: m.parentNode, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    var mm = gsap.matchMedia();

    // Process cards are dealt in from alternate sides, then their icons pop
    mm.add(DESKTOP, function () {
      $$('.step').forEach(function (step, i) {
        var side = i % 2 ? 1 : -1;
        gsap.timeline({ scrollTrigger: once(step, 'top 88%') })
          .from(step, { x: side * u(520), y: u(160), rotate: side * 16, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0)
          .from($('.step__icon', step), { scale: 0, rotate: -40, duration: 1, ease: 'back.out(2.2)' }, 0.45);
      });
      gsap.from('.deck', { y: u(120), rotate: 5, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: once('.deck', 'top 90%') });
      gsap.from('.proj', { x: u(260), opacity: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out', scrollTrigger: once('.rail', 'top 88%') });
    });
    mm.add('(max-width: 1023.98px)', function () {
      $$('.step, .svc').forEach(function (el) {
        gsap.from(el, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: once(el, 'top 92%') });
      });
      gsap.from('.proj', { x: 120, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: once('.rail', 'top 90%') });
    });

    // Footer: links settle, the giant wordmark rises letter by letter
    gsap.from('.footer__links .navlink, .footer__row', {
      y: 24, opacity: 0, duration: 1, stagger: 0.05, ease: 'expo.out', scrollTrigger: once('.footer', 'top 92%'),
    });
    var mark = SplitText.create('[data-wordmark]', { type: 'chars', charsClass: 'char' });
    gsap.from(mark.chars, {
      yPercent: 75, stagger: 0.04, ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
    });
  }

  /* ---------- Image loading ---------- */

  // Load lazy images a screen ahead so reveals never show an empty frame
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
    mountDeck();
    mountRail();
    if (animate) {
      intro();
      reveals();
    }
    root.classList.add('is-ready');
    if (hasGsap) ScrollTrigger.refresh();
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
