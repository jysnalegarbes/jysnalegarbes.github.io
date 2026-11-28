/*
  Westhills homepage — the parts only the homepage has: the hero intro,
  the services photo stack, and the section choreography. Shared behaviour
  (scroll, nav, forms, headlines and fades) lives in site.js.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var animate = Site.animate;

  /* ---------- Services: one photo per service ---------- */

  function mountServices() {
    var imgs = $$('[data-service-img]');
    var triggers = $$('[data-service]');
    var rows = $$('.service-row');
    var active = 0;
    var z = 1;

    function show(i) {
      if (i === active) return;
      var prev = active;
      active = i;
      rows.forEach(function (r) { r.classList.toggle('is-active', +r.dataset.service === i); });
      var img = imgs[i];
      img.classList.add('is-active');
      if (!animate) {
        imgs[prev].classList.remove('is-active');
        return;
      }
      gsap.killTweensOf(img);
      gsap.set(img, { zIndex: ++z });
      gsap.fromTo(img, { clipPath: 'inset(0% 0% 0% 100%)', scale: 1.15 }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        scale: 1,
        duration: 1.1,
        ease: 'expo.out',
        onComplete: function () {
          imgs.forEach(function (o, n) { if (n !== active) o.classList.remove('is-active'); });
        },
      });
    }

    triggers.forEach(function (t) {
      var i = +t.dataset.service;
      t.addEventListener('mouseenter', function () { show(i); });
      t.addEventListener('focusin', function () { show(i); });
    });

    // Touch screens can't hover: cycle the photos while the section is in view
    if (!Site.canHover && animate) {
      var timer = null;
      new IntersectionObserver(function (e) {
        clearInterval(timer);
        if (e[0].isIntersecting) timer = setInterval(function () { show((active + 1) % imgs.length); }, 3200);
      }).observe($('[data-services-media]'));
    }
  }

  /* ---------- Motion ---------- */

  function intro() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    var titles = $$('.hero [data-split]').map(Site.splitLines);
    var lines = titles.reduce(function (all, s) { return all.concat(s.lines); }, []);

    tl.from('[data-nav]', { yPercent: -100, duration: 1.1 }, 0.1)
      .fromTo('[data-hero-photo]', { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.15)
      .from('[data-hero-photo] img', { scale: 1.3, duration: 2, ease: 'expo.inOut' }, 0.15)
      .from('[data-hero-frame]', { opacity: 0, scale: 0.94, duration: 1.4 }, 0.9)
      .from(lines, { yPercent: 115, duration: 1.3, stagger: 0.12 }, 0.45)
      .from('.hero [data-fade]', { opacity: 0, y: 24, duration: 1.2 }, 0.9)
      .from('.lines--hero', { opacity: 0, duration: 2, ease: 'power2.out' }, 0.2)
      .add(function () { titles.forEach(function (s) { s.revert(); }); });

    // Leaving the hero: the photo drifts inside its frame
    gsap.to('[data-hero-photo] img', {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  function reveals() {
    var once = Site.once;

    gsap.from('.why-item', {
      opacity: 0, y: 30, duration: 1, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: once('.why__list'),
    });

    // Services: gold block grows, photo wipes in, rows and rules draw
    var media = $('[data-services-media]');
    gsap.timeline({ scrollTrigger: once(media, 'top 80%'), defaults: { ease: 'expo.out' } })
      .from('.services__rect', { scaleY: 0, transformOrigin: '50% 100%', duration: 1.3, ease: 'expo.inOut' }, 0)
      .fromTo('.services__stack', { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.15)
      .from('.services__stack img.is-active', { scale: 1.25, duration: 1.8, ease: 'expo.inOut' }, 0.15)
      .from('.service-row a', { opacity: 0, x: 40, duration: 1, stagger: 0.1 }, 0.4)
      .from('.service-row__line', { scaleX: 0, duration: 1.2, stagger: 0.1 }, 0.45)
      .from('.services__more', { opacity: 0, y: 20, duration: 1 }, 0.8);

    // Why us: block slides up, both photos wipe in
    var vis = $('.why__visual');
    gsap.timeline({ scrollTrigger: once(vis, 'top 80%'), defaults: { ease: 'expo.inOut', duration: 1.4 } })
      .from('.why__rect', { scaleX: 0, transformOrigin: '100% 50%' }, 0)
      .fromTo('.why__img--back', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', clearProps: 'clipPath' }, 0.1)
      .fromTo('.why__img--front', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', clearProps: 'clipPath' }, 0.3)
      .from('.why__img img', { scale: 1.25, duration: 1.8, stagger: 0.2 }, 0.1);

    // Blogs: featured photo opens, the list slides in
    gsap.timeline({ scrollTrigger: once('.blogs__grid', 'top 80%'), defaults: { ease: 'expo.out' } })
      .fromTo('.blog-feature', { clipPath: 'inset(0% 0% 100% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .from('.blog-feature__img img', { scale: 1.25, duration: 1.8, ease: 'expo.inOut' }, 0)
      .from('.blog-feature__body > *', { opacity: 0, y: 20, duration: 1, stagger: 0.08 }, 0.7)
      .from('.blog-card', { opacity: 0, x: 60, duration: 1.2, stagger: 0.12 }, 0.2);

    // Depth: blocks and photos drift at different speeds (desktop only)
    ScrollTrigger.matchMedia({
      '(min-width: 1024px)': function () {
        $$('[data-parallax]').forEach(function (el) {
          var d = parseFloat(el.dataset.parallax) || 0;
          gsap.fromTo(el, { y: -d }, {
            y: d,
            ease: 'none',
            scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true },
          });
        });
      },
    });
  }

  Site.ready(function () {
    mountServices();
    if (animate) {
      intro();
      reveals();
    }
  });
})();
