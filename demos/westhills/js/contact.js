/*
  Contact: the form checks its fields, then shows the "Thanks for reaching
  out!" panel from the Figma component's third variant. Nothing is sent.
  The illustrated map draws its roads in and drops the pin.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;

  var rules = {
    'c-name': function (v) { return v ? '' : 'Please enter your name.'; },
    'c-phone': function (v) { return !v || /^[\d\s()+.-]{7,}$/.test(v) ? '' : 'Enter a phone number, or leave it empty.'; },
    'c-email': function (v) { return Site.emailOk(v) ? '' : 'Please enter a valid email address.'; },
    'c-msg': function (v) { return v.length >= 5 ? '' : 'Please write a short message.'; },
  };

  function check(id) {
    var el = document.getElementById(id);
    var msg = rules[id](el.value.trim());
    el.setAttribute('aria-invalid', String(!!msg));
    el.setAttribute('aria-describedby', id + '-err');
    document.getElementById(id + '-err').textContent = msg;
    return !msg;
  }

  function mountForm() {
    var form = $('[data-contact]');
    var dialog = $('[data-thanks]');
    var panel = $('.thanks__panel', dialog);
    var lastFocus = null;

    function close() {
      if (dialog.hidden) return;
      var done = function () { dialog.hidden = true; if (lastFocus) lastFocus.focus(); };
      if (!Site.animate) { done(); return; }
      gsap.to(dialog, { opacity: 0, duration: 0.3, onComplete: function () { gsap.set(dialog, { clearProps: 'opacity' }); done(); } });
    }

    form.addEventListener('input', function (e) {
      if (rules[e.target.id] && e.target.getAttribute('aria-invalid') === 'true') check(e.target.id);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = Object.keys(rules).filter(function (id) { return !check(id); });
      if (bad.length) {
        document.getElementById(bad[0]).focus();
        return;
      }
      form.reset();
      $$('.ffield', form).forEach(function (f) { f.classList.remove('is-filled'); });
      lastFocus = document.activeElement;
      dialog.hidden = false;
      panel.focus();
      if (Site.animate) {
        gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.35 });
        gsap.fromTo(panel, { y: 40, scale: 0.94 }, { y: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.75)' });
        gsap.from($$('img, h2, p, small', panel), { opacity: 0, y: 20, duration: 0.8, stagger: 0.08, ease: 'expo.out', delay: 0.15 });
      }
    });
    $('[data-thanks-close]').addEventListener('click', close);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function mapIntro() {
    if (!Site.animate) return;
    var paths = $$('[data-draw]');
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.timeline({ scrollTrigger: Site.once('.map', 'top 80%'), defaults: { ease: 'expo.out' } })
      .to(paths, { strokeDashoffset: 0, duration: 2, stagger: 0.1, ease: 'power2.inOut' }, 0)
      .from('[data-pin]', { y: -120, opacity: 0, duration: 0.9, ease: 'bounce.out' }, 0.6)
      .from('[data-map-label]', { opacity: 0, x: -16, duration: 0.8 }, 1.2)
      .add(function () {
        gsap.fromTo('[data-ring]', { scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1.8, ease: 'power2.out', repeat: -1 });
      }, 1.4);
  }

  Site.ready(function () {
    mountForm();
    mapIntro();
  });
})();
