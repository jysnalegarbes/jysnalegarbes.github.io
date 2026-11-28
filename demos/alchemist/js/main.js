/*
  Alchemist homepage — the parts only the homepage has.
  Shared behaviour (smooth scroll, header, cart, toast, titles and fades)
  lives in site.js. The hero carousel uses the WebGL transition from
  hero-gl.js when it can, a crossfade if not.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var animate = Site.animate;
  var hasGsap = Site.hasGsap;
  var reduce = Site.reduce;

  /* ---------- Hero carousel ---------- */

  function mountHero() {
    var hero = $('.hero');
    var slides = $$('[data-slide]', hero);
    var dotsWrap = $('[data-hero-dots]', hero);
    var current = 0;
    var busy = false;
    var timer = null;
    var gl = hasGsap && !reduce && window.HeroGL ? window.HeroGL.mount(hero) : null;

    var dots = slides.map(function (s, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Slide ' + (n + 1) + ' of ' + slides.length);
      b.setAttribute('aria-selected', String(n === 0));
      b.addEventListener('click', function () { go(n, n > current ? 1 : -1); restart(); });
      dotsWrap.appendChild(b);
      return b;
    });

    function setState(n) {
      slides.forEach(function (s, k) {
        s.classList.toggle('is-active', k === n);
        s.setAttribute('aria-hidden', String(k !== n));
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', String(k === n)); });
      hero.classList.toggle('on-poster', n === 1);
    }

    function go(n, dir) {
      n = (n + slides.length) % slides.length;
      if (busy || n === current) return;
      var from = current;
      current = n;
      setState(n);
      if (gl && hero.classList.contains('is-gl')) {
        busy = true;
        gl.transition(from, n, dir).eventCallback('onComplete', function () {
          busy = false;
          gl.show(n);
        });
      } else if (animate) {
        busy = true;
        gsap.set(slides[n], { zIndex: 1 });
        gsap.fromTo(slides[n], { opacity: 0 }, {
          opacity: 1, duration: 0.9, ease: 'power2.inOut',
          onComplete: function () {
            gsap.set(slides[n], { clearProps: 'zIndex,opacity' });
            busy = false;
          },
        });
      }
      // Copy re-enters on the people slide
      if (animate && n === 0) {
        gsap.fromTo('.hero__title, .hero__sub', { y: 24 }, { y: 0, duration: 1, ease: 'expo.out', delay: 0.4 });
      }
    }

    function restart() {
      clearInterval(timer);
      if (animate) timer = setInterval(function () { go(current + 1, 1); }, 6500);
    }

    $('[data-hero-next]', hero).addEventListener('click', function () { go(current + 1, 1); restart(); });
    $('[data-hero-prev]', hero).addEventListener('click', function () { go(current - 1, -1); restart(); });
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(current + 1, 1); restart(); }
      if (e.key === 'ArrowLeft') { go(current - 1, -1); restart(); }
    });
    // Pause while someone is reading or interacting
    hero.addEventListener('mouseenter', function () { clearInterval(timer); });
    hero.addEventListener('mouseleave', restart);
    hero.addEventListener('focusin', function () { clearInterval(timer); });
    document.addEventListener('visibilitychange', function () { document.hidden ? clearInterval(timer) : restart(); });

    // Swipe on touch screens
    var sx = null;
    hero.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
    hero.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) { go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); restart(); }
    });

    setState(0);
    restart();
  }

  /* ---------- Promo code ---------- */

  function mountPromo() {
    var code = $('[data-copy]');
    code.addEventListener('click', function () {
      var text = code.dataset.copy;
      var done = function () {
        code.classList.add('is-copied');
        Site.toast('Promo code ' + text + ' copied.');
        setTimeout(function () { code.classList.remove('is-copied'); }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
  }

  /* ---------- Accordion ---------- */

  function mountAccordion() {
    $$('[data-acc]').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        if (!animate) {
          panel.hidden = !open;
          return;
        }
        gsap.killTweensOf(panel);
        if (open) {
          panel.hidden = false;
          gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out' });
          gsap.fromTo(panel.firstElementChild, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.1, ease: 'expo.out' });
        } else {
          gsap.to(panel, { height: 0, duration: 0.45, ease: 'power3.inOut', onComplete: function () { panel.hidden = true; gsap.set(panel, { clearProps: 'height' }); } });
        }
      });
    });
  }

  /* ---------- Ticker: endless, nudged by scroll speed ---------- */

  function mountTicker() {
    var track = $('[data-ticker-track]');
    if (!track) return;
    // One extra copy for a seamless loop
    track.innerHTML += track.innerHTML;
    if (!animate) return;
    var half = 0;
    var measure = function () { half = track.scrollWidth / 2; };
    measure();
    addEventListener('resize', measure);
    var x = 0;
    var boost = 0;
    var setX = gsap.quickSetter(track, 'x', 'px');
    var setSkew = gsap.quickSetter(track, 'skewX', 'deg');
    gsap.ticker.add(function (t, dt) {
      dt = Math.min(Math.max(dt, 0), 64);
      var v = Site.lenis ? Site.lenis.velocity : 0;
      boost += (Math.min(Math.abs(v), 40) - boost) * 0.1;
      x -= (0.9 + boost * 0.35) * (dt / 16.67);
      if (x <= -half) x += half;
      setX(x);
      setSkew(-Math.max(-8, Math.min(8, v * 0.25)));
    });
  }

  /* ---------- Blog slider: loops, steps by one post, drag ---------- */

  function mountBlog() {
    var viewport = $('[data-blog]');
    var track = $('[data-blog-track]');
    var originals = $$('.post', track);
    // Copies make the loop seamless; hidden from assistive tech
    for (var k = 0; k < 2; k++) {
      originals.forEach(function (li) {
        var c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('img', c).forEach(function (im) { im.alt = ''; im.loading = 'eager'; });
        track.appendChild(c);
      });
    }
    var unit = 0;
    var setW = 0;
    var measure = function () {
      var a = track.children[0].getBoundingClientRect();
      var b = track.children[1].getBoundingClientRect();
      unit = b.left - a.left;
      setW = unit * originals.length;
    };
    measure();
    addEventListener('resize', measure);

    var pos = { x: 0 };
    var target = 0;
    var wrap = function (x) { return hasGsap ? gsap.utils.wrap(-setW, 0, x) : x; };
    var render = function () { track.style.transform = 'translate3d(' + wrap(pos.x) + 'px,0,0)'; };

    var step = function (d) {
      target = Math.round(target / unit) * unit - d * unit;
      if (!hasGsap) { pos.x = target; render(); return; }
      gsap.to(pos, { x: target, duration: animate ? 1 : 0.01, ease: 'expo.out', overwrite: true, onUpdate: render });
    };
    $('[data-blog-next]').addEventListener('click', function () { step(1); });
    $('[data-blog-prev]').addEventListener('click', function () { step(-1); });

    var drag = null;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (hasGsap) gsap.killTweensOf(pos);
      drag = { x: e.clientX, start: pos.x, moved: false };
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) {
        drag.moved = true;
        viewport.classList.add('is-dragging');
      }
      pos.x = drag.start + dx;
      target = pos.x;
      render();
    });
    var end = function () {
      if (!drag) return;
      var moved = pos.x - drag.start;
      drag = null;
      viewport.classList.remove('is-dragging');
      target = pos.x;
      // Settle on the nearest post, leaning in the drag direction
      var snap = Math.round((pos.x - Math.sign(moved) * unit * 0.2) / unit) * unit;
      if (hasGsap) gsap.to(pos, { x: snap, duration: 0.8, ease: 'expo.out', onUpdate: render });
      target = snap;
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    render();
  }

  /* ---------- Reveals (titles and fades come from site.js) ---------- */

  function intro() {
    var title = SplitText.create('.hero__title', { type: 'lines,chars', mask: 'lines', linesClass: 'split-line' });
    gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: function () { title.revert(); } })
      .from('.hero__slides', { scale: 1.12, duration: 2.2, ease: 'expo.out' }, 0)
      .from(title.chars, { yPercent: 120, rotate: 8, duration: 1.2, stagger: 0.02 }, 0.3)
      // clearProps: the poster slide hides the copy with CSS, so no inline opacity may stay
      .from('.hero__sub, .hero__btn', { opacity: 0, y: 24, duration: 1, stagger: 0.1, clearProps: 'opacity,transform' }, 0.8)
      .from('.hero .round-arrow, .hero__dots', { opacity: 0, duration: 1 }, 1)
      .from('.header', { yPercent: -100, duration: 1 }, 0);
  }

  function reveals() {
    var once = Site.once;

    // Groups that arrive one after another
    ['.perks', '.promo-cards', '.chips', '.accordion', '.partners__row'].forEach(function (sel) {
      var parent = $(sel);
      gsap.from($$('[data-stagger]', parent), {
        opacity: 0, y: 40, duration: 1, stagger: 0.08, ease: 'expo.out',
        scrollTrigger: once(parent),
      });
    });

    // Product cards: rise in, image settles
    $$('.grid').forEach(function (grid) {
      gsap.from($$('[data-card]', grid), {
        opacity: 0, y: 60, duration: 1.1, stagger: 0.08, ease: 'expo.out',
        scrollTrigger: once(grid),
      });
    });

    // Bundles open like shutters
    gsap.fromTo('[data-bundle]', { clipPath: 'inset(0% 0% 100% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, stagger: 0.1, ease: 'expo.inOut', clearProps: 'clipPath',
      scrollTrigger: once('.bundles__grid'),
    });

    // Video poster and the blog posts wipe open
    gsap.fromTo('[data-reveal-img]', { clipPath: 'inset(10% 10% 10% 10%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath',
      scrollTrigger: once('[data-reveal-img]', 'top 80%'),
    });
    gsap.from('.post', {
      opacity: 0, x: 80, duration: 1.1, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: once('.blog'),
    });

    // Promo banner: the poster drifts behind its frame
    gsap.fromTo('[data-parallax-img]', { yPercent: -4, scale: 1.08 }, {
      yPercent: 4, scale: 1.08, ease: 'none',
      scrollTrigger: { trigger: '.banner', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  Site.ready(function () {
    mountPromo();
    mountAccordion();
    mountTicker();
    mountBlog();
    mountHero();
    if (animate) {
      intro();
      reveals();
    }
    if (Site.shot && Site.params.get('shot')) {
      var el = document.getElementById(Site.params.get('shot'));
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - $('[data-header]').offsetHeight);
    }
  });
})();
