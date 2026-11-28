/*
  Contact page: map intro (roads draw in, pin drops and pulses, the store
  card slides in) and the message form. The form never sends: it validates,
  then thanks the visitor and says so.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;

  var rules = {
    'c-first': function (v) { return v ? '' : 'Enter your first name.'; },
    'c-phone': function (v) { return !v || /^(\+?63|0)9\d{9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter a mobile number, e.g. 0917 123 4567, or leave it empty.'; },
    'c-email': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address.'; },
    'c-msg': function (v) { return v.length >= 5 ? '' : 'Write a short message.'; },
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
      var name = $('#c-first').value.trim();
      var done = document.createElement('div');
      done.className = 'form-done';
      done.setAttribute('role', 'status');
      done.innerHTML = '<h3>Thanks, ' + Site.esc(name) + '. Message received.</h3>' +
        '<p>In the live store the team would reply by email. This is a design demo, so nothing was sent.</p>';
      var swap = function () {
        $('.fields', form).replaceWith(done);
        $('.contact__submit', form).remove();
        if (Site.animate) gsap.from(done, { opacity: 0, y: 20, duration: 0.8, ease: 'expo.out' });
      };
      if (!Site.animate) { swap(); return; }
      gsap.to([$('.fields', form), $('.contact__submit', form)], { opacity: 0, y: -16, duration: 0.4, stagger: 0.05, ease: 'power2.in', onComplete: swap });
    });
  }

  function mapIntro() {
    if (!Site.animate) return;
    var paths = $$('[data-draw]');
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 });
    tl.from('[data-map]', { scale: 1.08, duration: 2.2, transformOrigin: '50% 40%' }, 0)
      .to(paths, { strokeDashoffset: 0, duration: 2, stagger: 0.12, ease: 'power2.inOut' }, 0.1)
      .from('[data-pin]', { y: -140, opacity: 0, duration: 0.9, ease: 'bounce.out' }, 0.7)
      .fromTo('[data-visit]', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.3)
      .from('[data-visit] p', { opacity: 0, x: -20, duration: 0.9 }, 1.1);
    // Gentle pulse under the pin
    gsap.fromTo('[data-ring]', { scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1.8, ease: 'power2.out', repeat: -1, delay: 1.6 });
  }

  Site.ready(function () {
    mountForm();
    mapIntro();
  });
})();
