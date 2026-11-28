/*
  Westhills — shared by every page.
  Lenis smooth scroll driving GSAP ScrollTrigger, the navigation (current
  page, burger menu, hide on scroll), toasts, the footer newsletter,
  floating-label fields, and the section reveals from the Figma prototype:
  each section's "Default -> Variant 2" (Smart Animate, Slow, ~1s) plays as
  it scrolls into view. Elements say how they arrive:
    data-reveal="left|right|up|down|fade|zoom"   slide in from that side
    data-split        headline lines rise
    data-fade         fade up
    data-stagger-group / data-stagger   children one after another
    data-count        numbers count up (and grow in, like the Figma variant)

  Page scripts register with Site.ready(fn).
  ?shot  screenshot mode: no smooth scroll, no reveals, every state settled.
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

  if (shot) {
    root.classList.add('is-shot');
    // Full-page captures never scroll, so lazy images would stay blank
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  }
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

  var Site = {
    $: $, $$: $$, params: params, shot: shot, reduce: reduce,
    hasGsap: hasGsap, animate: animate, lenis: null,
    canHover: matchMedia('(hover: hover) and (pointer: fine)').matches,
  };

  /* ---------- Smooth scroll ---------- */

  function mountScroll() {
    if (!animate || !window.Lenis) return;
    Site.lenis = new Lenis({ autoRaf: false, duration: 1.15 });
    Site.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { Site.lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  Site.scrollTo = function (target) {
    if (typeof target === 'string') target = target === '#top' ? 0 : $(target);
    if (target === null) return;
    var navH = nav.offsetHeight;
    // Lenis already honours html { scroll-padding-top } (the nav height)
    if (Site.lenis) Site.lenis.scrollTo(target, { duration: 1.4 });
    else {
      var y = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - navH + 1;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  /* ---------- Navigation ---------- */

  var nav = $('[data-nav]');
  var burger = $('[data-burger]');
  var menu = $('[data-menu]');
  var menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    $('[data-burger-label]').textContent = open ? 'Close menu' : 'Open menu';
    nav.classList.remove('is-hidden');
    if (Site.lenis) open ? Site.lenis.stop() : Site.lenis.start();
    if (open && animate) {
      gsap.fromTo($$('li, .btn', menu), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
    }
  }

  function mountNav() {
    // Current page (body data-page)
    var page = document.body.dataset.page;
    $$('[data-nav-link]').forEach(function (l) {
      if (l.dataset.navLink === page) l.setAttribute('aria-current', 'page');
    });

    burger.addEventListener('click', function () { setMenu(!menuOpen); });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) {
        setMenu(false);
        burger.focus();
      }
    });
    matchMedia('(min-width: 1024px)').addEventListener('change', function (m) {
      if (m.matches && menuOpen) setMenu(false);
    });

    // In-page anchors
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-scroll]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      Site.scrollTo(hash);
    });

    // Hide while scrolling down, come back on the way up
    var lastY = window.scrollY;
    addEventListener('scroll', function () {
      var y = window.scrollY;
      if (!menuOpen && !shot) nav.classList.toggle('is-hidden', y > lastY && y > 300);
      lastY = y;
    }, { passive: true });
  }

  /* ---------- Toasts ---------- */

  var toastEl = $('[data-toast-el]');
  var toastTimer;
  Site.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  };

  /* ---------- Forms (demo: nothing is ever sent) ---------- */

  Site.emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };

  function mountForms() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-toast]');
      if (b) Site.toast(b.dataset.toast);
    });

    var form = $('[data-newsletter]');
    if (form) {
      var input = $('input', form);
      var status = $('[data-newsletter-status]');
      input.addEventListener('input', function () { input.removeAttribute('aria-invalid'); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v || !Site.emailOk(v)) {
          input.setAttribute('aria-invalid', 'true');
          status.textContent = v ? 'That email address looks incomplete.' : 'Please enter your email address.';
          input.focus();
          return;
        }
        status.textContent = 'Thanks! This is a design demo, so you haven\'t been subscribed to anything.';
        form.reset();
      });
    }

    // Floating labels (the Figma input field: the label rises onto the border)
    $$('.ffield input, .ffield textarea').forEach(function (el) {
      var f = el.closest('.ffield');
      var sync = function () { f.classList.toggle('is-filled', !!el.value); };
      el.addEventListener('input', sync);
      sync();
    });
  }

  /* ---------- Reveals ---------- */

  Site.splitLines = function (el) {
    return SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
  };
  Site.once = function (trigger, start) { return { trigger: trigger, start: start || 'top 85%', once: true }; };

  // Offsets for data-reveal, in Figma px (scaled to the window)
  var FROM = {
    left: { xPercent: -18, opacity: 0 },
    right: { xPercent: 18, opacity: 0 },
    up: { y: 120, opacity: 0 },
    down: { y: -90, opacity: 0 },
    fade: { opacity: 0 },
    zoom: { scale: 0.6, opacity: 0 },
  };

  Site.reveal = function (scope) {
    if (!animate) return;
    scope = scope || document;

    $$('[data-split]', scope).forEach(function (el) {
      if (el.closest('[data-intro]')) return;
      var s = Site.splitLines(el);
      gsap.from(s.lines, {
        yPercent: 115, duration: 1.2, stagger: 0.1, ease: 'expo.out',
        scrollTrigger: Site.once(el),
        onComplete: function () { s.revert(); },
      });
    });

    $$('[data-fade]', scope).forEach(function (el) {
      if (el.closest('[data-intro]')) return;
      gsap.from(el, { opacity: 0, y: 24, duration: 1.1, ease: 'expo.out', scrollTrigger: Site.once(el) });
    });

    $$('[data-reveal]', scope).forEach(function (el) {
      if (el.closest('[data-intro]')) return;
      var from = Object.assign({}, FROM[el.dataset.reveal] || FROM.up);
      var unit = parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 1;
      if (from.y) from.y *= Math.max(unit, 0.5);
      gsap.from(el, Object.assign(from, {
        duration: 1.25, ease: 'expo.out',
        delay: parseFloat(el.dataset.delay) || 0,
        clearProps: 'transform,opacity',
        scrollTrigger: Site.once(el, 'top 88%'),
      }));
    });

    $$('[data-stagger-group]', scope).forEach(function (group) {
      gsap.from($$('[data-stagger]', group), {
        opacity: 0, y: 30, duration: 1, stagger: 0.09, ease: 'expo.out',
        clearProps: 'transform,opacity',
        scrollTrigger: Site.once(group),
      });
    });

    // Numbers: grow in like the Figma variant, then count up
    $$('[data-count]', scope).forEach(function (el, i) {
      var target = parseFloat(el.dataset.count);
      var fmt = function (n) { return (el.dataset.prefix || '') + Math.round(n).toLocaleString('en-US') + (el.dataset.suffix || ''); };
      var o = { n: 0 };
      el.textContent = fmt(0);
      gsap.timeline({ scrollTrigger: Site.once(el, 'top 90%'), delay: i * 0.08 })
        .from(el.parentNode, { scale: 0.3, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0)
        .to(o, { n: target, duration: 1.8, ease: 'expo.out', onUpdate: function () { el.textContent = fmt(o.n); } }, 0.1);
    });
  };

  // Inner pages: the title section's AFTER_TIMEOUT variant (crumbs and title
  // slide in from opposite sides), then the line background fades up
  function pageIntro() {
    var hero = $('[data-intro].page-hero');
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(nav, { yPercent: -100, duration: 1.1 }, 0.05);
    if (!hero) return tl;
    tl.from($('.page-hero__crumbs', hero), { xPercent: 30, opacity: 0, duration: 1.3 }, 0.2)
      .from($('.page-hero__title', hero), { xPercent: -30, opacity: 0, duration: 1.3 }, 0.25)
      .from($('.lines', hero), { opacity: 0, duration: 1.8, ease: 'power2.out' }, 0.1);
    return tl;
  }

  /* ---------- Start ---------- */

  var queue = [];
  var started = false;
  Site.ready = function (fn) { started ? fn() : queue.push(fn); };

  function init() {
    mountScroll();
    mountNav();
    mountForms();
    if (animate && document.body.dataset.page !== 'home') pageIntro();
    started = true;
    queue.forEach(function (fn) { fn(); });
    if (animate) Site.reveal();
    root.classList.add('is-ready');
    if (animate) ScrollTrigger.refresh();

    if (shot) {
      var id = params.get('shot');
      var el = id && document.getElementById(id);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - nav.offsetHeight);
    } else if (location.hash && $(location.hash)) {
      Site.scrollTo(location.hash);
    }
  }

  window.Site = Site;
  // Split lines only once the fonts are in (line breaks depend on them)
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1500); }),
  ]).then(init);
})();
