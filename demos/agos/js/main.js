/*
  Agos demo — landing page behaviour and motion.
  Smooth scroll (Lenis), header (solid after the top, hides on scroll down,
  scroll-spy, mobile menu), toast, newsletter validation and GSAP motion:
  the hero photo opens out of its V cut and widens to full bleed as you
  scroll, products float, the raised panel lifts, the founder's signature
  writes itself, stats count up and drift, the CTA photo drifts.

  ?shot      screenshot mode: no smooth scroll, no reveals
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

  /* ---------- Newsletter ---------- */

  var news = $('[data-news]');
  var newsMsg = $('[data-news-msg]');
  news.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = news.elements.email;
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    newsMsg.classList.toggle('is-error', !ok);
    newsMsg.textContent = ok
      ? 'Thanks! This is a design demo, so nothing was sent.'
      : 'Please enter a valid email address.';
    input.setAttribute('aria-invalid', String(!ok));
    if (ok) news.reset();
    else input.focus();
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
    header.classList.toggle('is-solid', y > 40);
    if (!menuOpen && !shot && Date.now() > holdHeader) {
      if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.7);
    }
    lastY = y;
  }

  // Scroll-spy: the nav link for the section in the middle of the screen lights up
  function mountSpy() {
    var links = $$('[data-spy]');
    function set(id) {
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-spy') === id); });
    }
    if (!hasGsap) return;
    links.forEach(function (a) {
      var id = a.getAttribute('data-spy');
      var el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (st) { if (st.isActive) set(id); },
      });
    });
  }

  /* ---------- Smooth scroll + in-page links ---------- */

  function scrollTo(target) {
    setMenu(false);
    showHeader(1600);
    var offset = target === 0 ? 0 : -(desktop.matches ? u(110) : 80);
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

  /* ---------- Motion ---------- */

  function once(trigger, start) {
    return { trigger: trigger, start: start || 'top 84%', once: true };
  }

  function riseLines(el, vars) {
    var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    return gsap.from(s.lines, Object.assign({
      yPercent: 110, duration: 1.2, stagger: 0.08, ease: 'expo.out',
      onComplete: function () { s.revert(); },
    }, vars));
  }

  function intro() {
    var media = $('[data-hero-media]');
    var title = SplitText.create('[data-hero-title]', { type: 'lines,words', mask: 'lines', linesClass: 'split-line' });
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: function () { title.revert(); } });

    tl.from('.header__bar', { yPercent: -100, opacity: 0, duration: 1.2 }, 0)
      .from('.logo__mark', { scale: 0, rotate: -90, duration: 1.4, ease: 'back.out(2)' }, 0.25)
      .from('.nav li, .header__cta, .logo__text', { y: -16, opacity: 0, duration: 0.9, stagger: 0.05, clearProps: 'transform,opacity' }, 0.35)
      .from(title.words, { yPercent: 110, rotate: 4, duration: 1.3, stagger: 0.045 }, 0.2)
      .from('[data-hero-ctas] .btn', { y: 30, opacity: 0, scale: 0.9, duration: 1.1, stagger: 0.08, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }, 0.75)
      // The photo opens from a sliver in the middle, then the V cut drops in
      .fromTo(media, { '--side': function () { return (window.innerWidth / 2 - 2) + 'px'; }, '--notch': '0px' }, {
        '--side': function () { return desktop.matches ? u(250) + 'px' : '12px'; },
        duration: 1.6, ease: 'expo.inOut',
      }, 0.45)
      .to(media, { '--notch': function () { return desktop.matches ? u(82) + 'px' : '30px'; }, duration: 1.1, ease: 'expo.out' }, 1.5)
      .from('[data-hero-img]', { scale: 1.35, duration: 2.4, ease: 'expo.out', clearProps: 'scale' }, 0.45);

    // Scrolling into the photo widens it to full bleed and flattens the V
    gsap.fromTo(media, {
      '--side': function () { return desktop.matches ? u(250) + 'px' : '12px'; },
      '--rad': function () { return desktop.matches ? u(24) + 'px' : '20px'; },
      '--notch': function () { return desktop.matches ? u(82) + 'px' : '30px'; },
    }, {
      '--side': '0px', '--rad': '0px', '--notch': '0px', ease: 'none', immediateRender: false,
      // Starts at scroll 0 (the photo is already on screen), done by the time it fills the view
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: 0.6, invalidateOnRefresh: true },
    });
    gsap.fromTo('[data-hero-img]', { yPercent: -6 }, {
      yPercent: 8, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  function reveals() {
    $$('[data-rise]').forEach(function (el) {
      riseLines(el, { scrollTrigger: once(el, 'top 88%') });
    });
    $$('[data-rise-group] p').forEach(function (el) {
      riseLines(el, { duration: 1.1, stagger: 0.04, scrollTrigger: once(el, 'top 92%') });
    });

    // Section chips pop open from their left edge
    $$('[data-chip]').forEach(function (el) {
      gsap.from(el, { clipPath: 'inset(0% 100% 0% 0% round 100px)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: once(el, 'top 90%') });
    });
    $$('[data-pop]').forEach(function (el) {
      gsap.from(el, { y: 30, opacity: 0, duration: 1.1, ease: 'back.out(1.7)', scrollTrigger: once(el, 'top 95%') });
    });
    gsap.from('[data-pop-group] .btn', { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'back.out(1.7)', scrollTrigger: once('[data-pop-group]', 'top 92%') });

    // Products: cards rise, the products drop in, then float gently
    $$('.prod').forEach(function (prod, i) {
      var img = $('.prod__img', prod);
      gsap.timeline({ scrollTrigger: once('.prods', 'top 82%') })
        .from(prod, { y: 90, opacity: 0, duration: 1.2, ease: 'expo.out' }, i * 0.1)
        .from(img, { y: -60, scale: 0.6, rotate: i % 2 ? 14 : -14, opacity: 0, duration: 1.4, ease: 'back.out(1.6)' }, i * 0.1 + 0.25)
        .add(function () {
          gsap.to(img, { y: u(-8), duration: 2.4 + i * 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        });
    });

    // The raised panel lifts over the products as it arrives
    gsap.fromTo('[data-panel]', { y: function () { return u(140); } }, {
      y: 0, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: '[data-panel]', start: 'top bottom', end: 'top 45%', scrub: true, invalidateOnRefresh: true },
    });

    // Service cards: icon pops, photo opens upward and drifts
    $$('[data-svc]').forEach(function (svc, i) {
      gsap.timeline({ scrollTrigger: once(svc, 'top 82%') })
        .from(svc, { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out' }, i * 0.12)
        .from($('.svc__icon', svc), { scale: 0, rotate: -30, duration: 1.1, ease: 'back.out(2.4)' }, i * 0.12 + 0.2)
        .fromTo($('.svc__img', svc), { clipPath: 'inset(100% 0% 0% 0% round 32px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, i * 0.12 + 0.25);
      gsap.fromTo($('.svc__img img', svc), { yPercent: -10 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: svc, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // About: the founder rises out of the panel, the signature writes itself
    gsap.timeline({ scrollTrigger: once('[data-portrait]', 'top 80%') })
      .fromTo('[data-portrait]', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .from('[data-portrait] img', { yPercent: 18, scale: 1.1, duration: 2, ease: 'expo.out' }, 0.2);
    gsap.fromTo('[data-sign]', { clipPath: 'inset(-30% 100% -30% -5%)' }, {
      clipPath: 'inset(-30% -5% -30% -5%)', duration: 2.2, ease: 'power2.inOut',
      scrollTrigger: once('[data-sign]', 'top 92%'),
    });

    // Stats: bubbles pop in, numbers count up, then they drift like they float on water
    $$('[data-stat]').forEach(function (stat, i) {
      var num = $('[data-count]', stat);
      var to = +num.getAttribute('data-count');
      var comma = num.hasAttribute('data-comma');
      var c = { v: 0 };
      gsap.timeline({ scrollTrigger: once('.stats', 'top 80%') })
        .from(stat, { scale: 0, opacity: 0, duration: 1.2, ease: 'back.out(2)' }, i * 0.15)
        .to(c, {
          v: to, duration: 1.8, ease: 'power3.out',
          onUpdate: function () { var n = Math.round(c.v); num.textContent = comma ? n.toLocaleString('en-US') : n; },
        }, i * 0.15 + 0.1);
      if (desktop.matches) {
        gsap.to(stat, { y: u(-12), x: u(i % 2 ? 6 : -6), duration: 3 + i * 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.5 + i * 0.4 });
      }
    });

    // CTA: the card opens out, the pipes drift behind the copy
    gsap.fromTo('[data-cta]', { clipPath: 'inset(8% 6% 8% 6% round 64px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: '[data-cta]', start: 'top bottom', end: 'top 40%', scrub: true },
    });
    gsap.fromTo('[data-cta-img]', { yPercent: -18, scale: 1.12 }, {
      yPercent: 0, scale: 1, ease: 'none',
      scrollTrigger: { trigger: '[data-cta]', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Blogs: photos open, text follows
    $$('[data-post]').forEach(function (post, i) {
      gsap.timeline({ scrollTrigger: once(post, 'top 86%') })
        .fromTo($('.post__img', post), { clipPath: 'inset(0% 100% 0% 0% round 32px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, i * 0.1)
        .from($('.post__img img', post), { scale: 1.3, duration: 1.8, ease: 'expo.out' }, i * 0.1 + 0.2)
        .from($('.post__body', post).children, { y: 30, opacity: 0, duration: 1, stagger: 0.07, ease: 'expo.out' }, i * 0.1 + 0.5);
    });

    // Footer: the mark spins in, columns settle
    gsap.from('.flogo__mark', { scale: 0.4, rotate: -120, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: once('.footer', 'top 80%') });
    gsap.from('.flogo > span, .socials li, .news > *', { y: 24, opacity: 0, duration: 1, stagger: 0.05, ease: 'expo.out', scrollTrigger: once('.footer', 'top 78%') });
    gsap.from('.fcol', { y: 40, opacity: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out', scrollTrigger: once('.footer__cols', 'top 92%') });
  }

  // CTA buttons lean toward the pointer
  function magnetic() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.2);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
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
    mountSpy();
    if (animate) {
      intro();
      reveals();
      magnetic();
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
