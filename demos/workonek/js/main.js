/*
  Workonek demo — landing page behaviour and motion.
  Header (compacts and drops the contact bar on scroll, hides on scroll down,
  sliding active-link bar, mobile menu), search overlay, inquiry form
  (floating labels, headcount stepper, code check), newsletter, the ticker
  (speeds up and reverses with scroll), the job carousel (drifts, drags),
  tilting service cards and GSAP scroll motion.

  ?shot      screenshot mode: no smooth scroll, no reveals, no loops
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
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lenis = null;

  if (shot) {
    root.classList.add('is-shot');
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  }
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

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

  /* ---------- Smooth scroll ---------- */

  function goTo(target, after) {
    setMenu(false);
    showHeader(1600);
    var offset = target === 0 ? 0 : -(desktop.matches ? u(120) : 80);
    if (lenis) lenis.scrollTo(target, { duration: 1.5, offset: offset, onComplete: after });
    else {
      var top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      if (after) setTimeout(after, reduce ? 0 : 700);
    }
  }

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
        gsap.fromTo($$('li, .btn', mobile), { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.2 });
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

  var lastY = window.scrollY;
  function onScroll(y) {
    header.classList.toggle('is-compact', y > 60);
    if (!menuOpen && !shot && Date.now() > holdHeader && !searchOpen) {
      if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.8);
    }
    lastY = y;
  }

  // Active-link bar: slides under the current section's link, follows hover
  var navLinks = $$('[data-spy]');
  var navBar = $('[data-nav-bar]');
  var activeLink = navLinks[0];
  function placeBar(a) {
    if (!a || !navBar) return;
    var nav = navBar.parentNode.getBoundingClientRect();
    var r = a.getBoundingClientRect();
    navBar.style.left = (r.left - nav.left - u(5)) + 'px';
    navBar.style.width = (r.width + u(10)) + 'px';
  }
  function setActive(id) {
    navLinks.forEach(function (a) {
      var on = a.getAttribute('data-spy') === id;
      a.classList.toggle('is-active', on);
      if (on) activeLink = a;
    });
    placeBar(activeLink);
  }
  navLinks.forEach(function (a) {
    a.addEventListener('mouseenter', function () { placeBar(a); });
    a.addEventListener('mouseleave', function () { placeBar(activeLink); });
  });
  window.addEventListener('resize', function () { placeBar(activeLink); });

  function mountSpy() {
    setActive('top');
    if (!hasGsap) return;
    navLinks.forEach(function (a) {
      var id = a.getAttribute('data-spy');
      var el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 45%', end: 'bottom 45%',
        onToggle: function (st) { if (st.isActive) setActive(id); },
      });
    });
  }

  function mountScroll() {
    if (animate && window.Lenis) {
      lenis = new Lenis({ autoRaf: false, duration: 1.15 });
      lenis.on('scroll', function (l) { ScrollTrigger.update(); onScroll(l.scroll); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    }
    onScroll(window.scrollY);

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-toast') || a.hasAttribute('data-apply')) return;
      var hash = a.getAttribute('href');
      if (hash.length < 2) return;
      var el = hash === '#top' ? 0 : $(hash);
      if (el === null) return;
      e.preventDefault();
      goTo(el);
    });
  }

  /* ---------- Search ---------- */

  var search = $('[data-search]');
  var searchInput = $('[data-search-input]');
  var searchResults = $('[data-search-results]');
  var searchOpen = false;
  var index = [];

  function buildIndex() {
    $$('.job h3').forEach(function (h) { index.push({ t: h.textContent, k: 'Job opening', el: '#careers' }); });
    $$('.svc h3').forEach(function (h) { index.push({ t: h.textContent.replace(/\s+/g, ' '), k: 'Service', el: '#services' }); });
    $$('.ind').forEach(function (li) { index.push({ t: li.textContent.trim(), k: 'Industry', el: '#about' }); });
    $$('.lead h3, .post h3').forEach(function (h) { index.push({ t: h.textContent, k: 'Blog', el: '#news' }); });
  }

  function renderResults(q) {
    q = q.trim().toLowerCase();
    var hits = index.filter(function (it) { return !q || it.t.toLowerCase().indexOf(q) > -1 || it.k.toLowerCase().indexOf(q) > -1; }).slice(0, 10);
    searchResults.innerHTML = '';
    if (!hits.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No matches. Try “staffing”, “IT” or “warehouse”.';
      searchResults.appendChild(li);
      return;
    }
    hits.forEach(function (it) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = it.el;
      a.innerHTML = '<span></span><small></small>';
      a.firstChild.textContent = it.t;
      a.lastChild.textContent = it.k;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        setSearch(false);
        goTo($(it.el));
      });
      li.appendChild(a);
      searchResults.appendChild(li);
    });
  }

  function setSearch(open) {
    searchOpen = open;
    if (open) {
      search.hidden = false;
      renderResults(searchInput.value);
      if (lenis) lenis.stop();
      if (animate) gsap.fromTo('.search__panel', { y: -30, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
      setTimeout(function () { searchInput.focus(); }, 30);
    } else {
      search.hidden = true;
      if (lenis) lenis.start();
      $('[data-search-open]').focus();
    }
  }
  $('[data-search-open]').addEventListener('click', function () { setSearch(true); });
  $('[data-search-close]').addEventListener('click', function () { setSearch(false); });
  search.addEventListener('click', function (e) { if (e.target === search) setSearch(false); });
  searchInput.addEventListener('input', function () { renderResults(searchInput.value); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (searchOpen) setSearch(false);
      else if (menuOpen) { setMenu(false); burger.focus(); }
    }
    if (e.key === '/' && !searchOpen && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      setSearch(true);
    }
  });

  /* ---------- Inquiry form ---------- */

  var form = $('[data-form]');
  var formMsg = $('[data-form-msg]');
  var codeEl = $('[data-captcha]');
  var code = '';

  function newCode() {
    var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code = '';
    for (var i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
    codeEl.textContent = code;
    if (animate) gsap.fromTo(codeEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' });
  }
  newCode();
  $('[data-captcha-new]').addEventListener('click', newCode);

  var select = $('#f-location');
  select.addEventListener('change', function () { select.classList.toggle('has-value', !!select.value); });

  var count = $('#f-count');
  $$('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = Math.min(999, Math.max(1, (parseInt(count.value, 10) || 1) + +b.getAttribute('data-step')));
      count.value = v;
      if (animate) gsap.fromTo(count, { scale: 1.25 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = [];
    $$('.field', form).forEach(function (f) { f.classList.remove('is-invalid'); });
    $$('[required]', form).forEach(function (el) {
      var v = el.value.trim();
      var ok = !!v;
      if (ok && el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (ok && el.type === 'tel') ok = (v.match(/\d/g) || []).length >= 7;
      if (ok && el.name === 'code') ok = v === code;
      if (!ok) { bad.push(el); el.closest('.field').classList.add('is-invalid'); }
      el.setAttribute('aria-invalid', String(!ok));
    });
    formMsg.classList.toggle('is-error', bad.length > 0);
    if (bad.length) {
      var codeWrong = bad.some(function (el) { return el.name === 'code'; }) && bad.length === 1;
      formMsg.textContent = codeWrong ? 'The code doesn’t match. Check the letters’ case, or get a new code.' : 'Please fill in the highlighted fields.';
      bad[0].focus();
      if (animate) gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    formMsg.textContent = 'Thanks! This is a design demo, so nothing was sent.';
    form.reset();
    select.classList.remove('has-value');
    count.value = 1;
    newCode();
  });

  // "Apply Now" fills the job title and takes you to the form
  $$('[data-apply]').forEach(function (a) {
    a._wired = true;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (jobsDragged) return;
      var title = a.closest('.job').querySelector('h3').textContent;
      $('#f-job').value = 'Applicant: ' + title;
      goTo($('#inquire'), function () { $('#f-name').focus({ preventScroll: true }); });
    });
  });

  /* ---------- Newsletter ---------- */

  var news = $('[data-news]');
  var newsMsg = $('[data-news-msg]');
  news.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('input', news);
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    newsMsg.textContent = ok ? 'Subscribed! (Demo: nothing was sent.)' : 'Please enter a valid email address.';
    input.setAttribute('aria-invalid', String(!ok));
    if (ok) news.reset();
  });

  /* ---------- Ticker: loops, speeds up and reverses with your scroll ---------- */

  function mountTicker() {
    var track = $('[data-ticker]');
    var set = $('.ticker__set', track);
    // Enough copies to cover wide screens twice over
    var copies = Math.max(2, Math.ceil((window.innerWidth * 2) / set.offsetWidth));
    for (var i = 1; i < copies; i++) track.appendChild(set.cloneNode(true));
    if (!animate) return;
    var w = set.offsetWidth;
    gsap.set(track, { x: -u(12) });
    var loop = gsap.to(track, {
      x: '-=' + w, duration: w / 70, ease: 'none', repeat: -1,
      modifiers: { x: gsap.utils.unitize(function (x) { return parseFloat(x) % w; }) },
    });
    var dir = 1;
    ScrollTrigger.create({
      onUpdate: function (st) {
        var v = st.getVelocity();
        if (Math.abs(v) > 20) dir = v > 0 ? 1 : -1;
        var boost = gsap.utils.clamp(1, 6, 1 + Math.abs(v) / 400);
        gsap.to(loop, { timeScale: dir * boost, duration: 0.25, overwrite: true });
        gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, ease: 'power2.out' });
      },
    });
  }

  /* ---------- Jobs: drift on desktop, drag to browse ---------- */

  var jobsDragged = false;
  function mountJobs() {
    var wrap = $('[data-jobs]');
    var track = $('[data-jobs-track]');
    if (!animate || !desktop.matches) return;
    var items = $$('.job', track);
    items.forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      $$('a', c).forEach(function (a) { a.tabIndex = -1; });
      track.appendChild(c);
    });
    // Clones need the same "Apply Now" behaviour
    $$('[data-apply]', track).forEach(function (a) {
      if (a._wired) return;
      a._wired = true;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (jobsDragged) return;
        $('#f-job').value = 'Applicant: ' + a.closest('.job').querySelector('h3').textContent;
        goTo($('#inquire'), function () { $('#f-name').focus({ preventScroll: true }); });
      });
    });
    var gap = u(20);
    var w = items.reduce(function (s, li) { return s + li.offsetWidth + gap; }, 0);
    var start = -u(147);
    var pos = { x: start };
    // Keep x within one set's width to the left of the start, so the row never runs out
    function wrapX(x) { return ((x - start) % w + w) % w - w + start; }
    var setX = gsap.quickSetter(track, 'x', 'px');
    var speed = 0.35;
    var hovering = false, down = false, lastX = 0, vel = 0;
    gsap.ticker.add(function (t, dt) {
      if (!dt || dt < 0) dt = 16;
      if (!down) {
        vel *= 0.94;
        var drift = hovering ? 0 : -speed * dt / 16;
        pos.x += drift + vel;
      }
      pos.x = wrapX(pos.x);
      setX(pos.x);
    });
    wrap.addEventListener('mouseenter', function () { hovering = true; });
    wrap.addEventListener('mouseleave', function () { hovering = false; down = false; wrap.classList.remove('is-dragging'); });
    wrap.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; jobsDragged = false; lastX = e.clientX; vel = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - lastX;
      if (Math.abs(dx) > 0) { pos.x += dx; vel = dx; }
      if (!jobsDragged && Math.abs(dx) > 3) { jobsDragged = true; wrap.classList.add('is-dragging'); }
      lastX = e.clientX;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      setTimeout(function () { jobsDragged = false; wrap.classList.remove('is-dragging'); }, 0);
    });
    wrap.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ---------- Service cards tilt toward the pointer ---------- */

  function mountTilt() {
    if (!animate || !fine) return;
    $$('[data-tilt]').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      var ty = gsap.quickTo(card, 'y', { duration: 0.6, ease: 'power3.out' });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 10); rx(-py * 8); ty(-u(10));
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); ty(0); });
    });
  }

  /* ---------- Motion ---------- */

  function once(trigger, start) {
    return { trigger: trigger, start: start || 'top 85%', once: true };
  }

  function riseLines(el, vars) {
    var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    return gsap.from(s.lines, Object.assign({
      yPercent: 110, duration: 1.2, stagger: 0.08, ease: 'expo.out',
      onComplete: function () { s.revert(); },
    }, vars));
  }

  function intro() {
    var pieces = $$('.lp');
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(pieces, { scale: 0, rotate: function (i) { return i % 2 ? 90 : -90; }, opacity: 0, duration: 1.2, stagger: 0.06, ease: 'back.out(2)' }, 0.1)
      .from('.logo__word', { y: 10, opacity: 0, duration: 0.8 }, 0.6)
      .from('.topbar li', { y: -20, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.2)
      .from('.nav li, .search-btn', { y: 18, opacity: 0, duration: 0.9, stagger: 0.05, clearProps: 'transform,opacity' }, 0.35)
      .from('.getstarted', { xPercent: 100, duration: 1.1 }, 0.3)
      .fromTo('[data-hero]', { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.3)
      .from('[data-hero-img]', { scale: 1.3, duration: 2.4 }, 0.3)
      .from('.ticker__track', { opacity: 0, x: u(200), duration: 1.4 }, 1)
      .add(function () { placeBar(activeLink); }, 1.2);

    // Hero photo drifts down and zooms gently as you scroll away
    gsap.fromTo('[data-hero-img]', { yPercent: 0, scale: 1 }, {
      yPercent: 14, scale: 1.08, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  function reveals() {
    $$('[data-rise]').forEach(function (el) {
      riseLines(el, { scrollTrigger: once(el, 'top 90%') });
    });
    $$('[data-pop]').forEach(function (el) {
      gsap.from(el, { scale: 0.8, opacity: 0, duration: 1, ease: 'back.out(2)', scrollTrigger: once(el, 'top 95%') });
    });

    // Partners: photo opens, logo watermark turns as you scroll
    $$('[data-reveal]').forEach(function (el) {
      gsap.timeline({ scrollTrigger: once(el, 'top 85%') })
        .fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round 16px)' }, { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' })
        .from($('img', el), { scale: 1.3, duration: 1.8, ease: 'expo.out' }, 0.2);
    });
    $$('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('[data-spin]').forEach(function (m) {
      gsap.to(m, { rotate: 45, ease: 'none', scrollTrigger: { trigger: m.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Form: card rises, the blue bar draws, fields follow
    gsap.timeline({ scrollTrigger: once('[data-form]', 'top 88%') })
      .from('[data-form]', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out' })
      .from('.inquiry__title', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.3)
      .from('.inquiry__grid > *, .btn--submit', { y: 24, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, 0.4);
    gsap.fromTo('.inquiry', { '--bar': 0 }, { '--bar': 1, duration: 1.2, ease: 'expo.inOut', scrollTrigger: once('[data-form]', 'top 88%') });

    // Services: map drifts; cards flip up in 3D, their rules draw across
    gsap.fromTo('[data-bg]', { yPercent: -12, scale: 1.1 }, {
      yPercent: 0, scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.services', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    $$('.svc').forEach(function (card, i) {
      gsap.timeline({ scrollTrigger: once('.svcs', 'top 85%') })
        .from(card, { y: 120, rotationX: -35, opacity: 0, transformOrigin: '50% 100%', duration: 1.3, ease: 'expo.out' }, i * 0.1)
        .from($('hr', card), { scaleX: 0, duration: 1, ease: 'expo.inOut' }, i * 0.1 + 0.45)
        .from($('.svc__window', card), { opacity: 0, scale: 0.6, transformOrigin: '100% 0%', duration: 1.2, ease: 'expo.out' }, i * 0.1 + 0.5);
    });

    // The thick part of the divider slides along as you scroll past it
    gsap.fromTo('[data-divider]', { x: function () { return -u(436); } }, {
      x: function () { return $('.divider').offsetWidth - $('[data-divider]').offsetWidth - u(436); },
      ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: '.divider', start: 'top 95%', end: 'top 15%', scrub: 0.5, invalidateOnRefresh: true },
    });

    // Industries pop in, row by row
    gsap.from('.ind', {
      y: 50, opacity: 0, scale: 0.94, duration: 1, stagger: { each: 0.07, grid: [2, 3], from: 'start' }, ease: 'expo.out',
      scrollTrigger: once('.inds', 'top 88%'),
    });
    gsap.from('.ind__ic', { scale: 0, rotate: -60, duration: 0.9, stagger: 0.07, ease: 'back.out(2.4)', delay: 0.35, scrollTrigger: once('.inds', 'top 88%') });

    // Quadrants: photos slide open from the outside edge and drift
    $$('[data-quad-img]').forEach(function (fig) {
      var left = fig.getAttribute('data-quad-img') === 'left';
      var img = $('img', fig);
      gsap.timeline({ scrollTrigger: once(fig, 'top 85%') })
        .fromTo(fig, { clipPath: left ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' })
        .from(img, { scale: 1.25, duration: 2, ease: 'expo.out' }, 0.2);
      gsap.fromTo(img, { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('[data-list]').forEach(function (ul) {
      gsap.from(ul.children, { x: -30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out', scrollTrigger: once(ul, 'top 90%') });
    });

    // Blogs: lead card from the left, rows from the right
    gsap.from('[data-lead]', { x: -80, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: once('.news__grid', 'top 85%') });
    gsap.from('[data-post]', { x: 80, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: once('.news__grid', 'top 85%') });

    // Careers: cards rise in sequence
    gsap.from('.jobs__track > .job:not([aria-hidden])', { y: 80, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: once('.jobs', 'top 90%') });

    // Footer
    gsap.from('.footer__logo, .footer__links .label, .footer__links li, .footer__cols > *', {
      y: 30, opacity: 0, duration: 1, stagger: 0.04, ease: 'expo.out', scrollTrigger: once('.footer', 'top 85%'),
    });
  }

  /* ---------- Image loading ---------- */

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
    imgs.forEach(function (im) { io.observe(im.closest('section, footer, figure') || im.parentNode); });
  }

  /* ---------- Start ---------- */

  function start() {
    mountPreload();
    mountScroll();
    buildIndex();
    mountTicker();
    mountJobs();
    mountSpy();
    if (animate) {
      intro();
      reveals();
      mountTilt();
    }
    root.classList.add('is-ready');
    placeBar(activeLink);
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
