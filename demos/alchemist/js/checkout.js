/*
  Checkout page. Billing form with inline validation, the ALCHEMIST promo
  code from the homepage (30% off), payment choice, and a confirmation
  screen. Nothing is sent anywhere: "placing" the order only clears the
  demo cart in this browser.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var esc = Site.esc;

  var SHIPPING = 100;
  var CODE = 'ALCHEMIST';
  var view = $('[data-checkout-view]');
  var discount = 0;

  var DOWN = '<svg viewBox="0 0 16 9" aria-hidden="true"><path d="M1 1l7 7 7-7" fill="none" stroke="#000" stroke-width="1.6"/></svg>';

  function field(id, label, opts) {
    opts = opts || {};
    var req = opts.optional ? '' : ' required';
    var control = opts.select ?
      '<select class="input" id="' + id + '" name="' + id + '"' + req + '>' + opts.select.map(function (o) { return '<option' + (o === opts.value ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' :
      opts.area ?
        '<textarea class="input" id="' + id + '" name="' + id + '" placeholder="' + (opts.ph || '') + '"' + req + '></textarea>' :
        '<input class="input" id="' + id + '" name="' + id + '" type="' + (opts.type || 'text') + '"' + (opts.ph ? ' placeholder="' + opts.ph + '"' : '') +
        (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + req + '>';
    return '<div class="field' + (opts.half ? ' field--half' : '') + '"><label for="' + id + '">' + label + (opts.optional ? '' : ' *') + '</label>' +
      control + (opts.extra || '') + '<span class="field__error" id="' + id + '-err"></span></div>';
  }

  function summary() {
    var items = Site.cart.items();
    var sub = Site.cart.subtotal();
    var off = Math.round(sub * discount);
    return '<ul class="summary-items">' + items.map(function (l) {
      var p = ALC.get(l.id);
      return '<li>' + Site.thumb(p) + '<span>' + esc(p.name) + (l.qty > 1 ? ' × ' + l.qty : '') + Site.opts(l, p) + '</span><b>' + Site.money(p.price * l.qty) + '</b></li>';
    }).join('') + '</ul><dl>' +
      '<div class="totals__row"><dt>Subtotal:</dt><dd>' + Site.money(sub) + '</dd></div>' +
      (off ? '<div class="totals__row totals__row--discount"><dt>Code ' + CODE + ' (30%):</dt><dd>− ' + Site.money(off) + '</dd></div>' : '') +
      '<div class="totals__row"><dt>Shipping:</dt><dd>' + Site.money(SHIPPING) + '</dd></div>' +
      '<div class="totals__row totals__row--total"><dt>Total</dt><dd>' + Site.money(sub - off + SHIPPING) + '</dd></div></dl>';
  }

  function payOpt(value, label, note) {
    return '<li class="pay__opt"><label><input type="radio" name="pay" value="' + value + '" required>' + label + (note ? DOWN : '') + '</label>' +
      (note ? '<div class="pay__note" hidden><p>' + note + '</p></div>' : '') + '</li>';
  }

  function render() {
    if (!Site.cart.items().length) {
      view.innerHTML = '<div class="cart-empty"><h2 class="display">Nothing to check out</h2><p>Your bag is empty. Add something from the shop first.</p>' +
        '<a class="btn btn--black cart__continue" href="shop.html">Start shopping</a></div>';
      return;
    }
    view.innerHTML = '<form class="checkout__grid" novalidate data-form>' +
      '<div class="checkout__billing">' +
      '<h2 class="label-head">Billing details</h2>' +
      '<div class="bars">' +
      '<div class="bar"><button type="button" aria-expanded="false" aria-controls="bar-login" data-bar>Returning customer? <u>Click here to login</u>' + DOWN + '</button>' +
      '<div class="bar__panel" id="bar-login" hidden><div>Accounts aren’t part of this demo. You can check out as a guest below.</div></div></div>' +
      '<div class="bar"><button type="button" aria-expanded="false" aria-controls="bar-code" data-bar>Have a coupon? <u>Click here to enter your code</u>' + DOWN + '</button>' +
      '<div class="bar__panel" id="bar-code" hidden><div><label class="visually-hidden" for="code">Coupon code</label>' +
      '<input id="code" type="text" placeholder="Coupon code" autocomplete="off" data-code><button class="btn btn--black" type="button" data-apply>Apply</button>' +
      '<span class="field__error" data-code-msg></span></div></div></div>' +
      '</div>' +
      '<div class="fields">' +
      field('first', 'First Name', { half: true, auto: 'given-name' }) +
      field('last', 'Last Name', { half: true, auto: 'family-name' }) +
      field('country', 'Country / Region', { select: ['Philippines'], value: 'Philippines' }) +
      field('street', 'Street Address', { ph: 'House Number and street name', auto: 'address-line1', extra: '<input class="input" id="street2" name="street2" placeholder="Apartment, suite, unit, etc. (optional)" autocomplete="address-line2" aria-label="Apartment, suite, unit (optional)">' }) +
      field('city', 'Town / City', { select: ['Davao', 'Manila', 'Quezon City', 'Cebu', 'Cagayan de Oro', 'General Santos', 'Other'], value: 'Davao' }) +
      field('zip', 'ZIP Code', { mode: 'numeric', auto: 'postal-code' }) +
      field('phone', 'Phone Number', { type: 'tel', auto: 'tel', ph: '09XX XXX XXXX' }) +
      field('email', 'Email Address', { type: 'email', auto: 'email' }) +
      '</div>' +
      '<div class="checks">' +
      '<label class="check"><input type="checkbox" name="account">Create an account?</label>' +
      '<label class="check"><input type="checkbox" name="ship">Ship to a different address?</label></div>' +
      '<div class="fields">' + field('notes', 'Order Notes', { area: true, optional: true, ph: 'Notes about your order e.g. special notes for delivery.' }).replace('Order Notes', 'Order Notes (optional)') + '</div>' +
      '</div>' +
      '<aside class="checkout__side">' +
      '<h2 class="label-head label-head--lg">Your order</h2>' +
      '<div class="totals" data-summary aria-live="polite">' + summary() + '</div>' +
      '<fieldset class="pay" style="border:0;margin-top:0;padding:0"><legend class="label-head label-head--lg" style="padding:0">Payment options</legend>' +
      '<ul class="pay__list">' +
      payOpt('wallet', 'Payment Center / E-Wallet', 'You’d pay at a payment centre or with an e-wallet after ordering. (Demo: nothing is charged.)') +
      payOpt('bank', 'Direct Bank Transfer', 'Bank details would appear in the confirmation email. (Demo: no email is sent.)') +
      payOpt('cod', 'Cash On Delivery') +
      '</ul><span class="field__error" id="pay-err" style="margin-left:calc(23 * var(--u))"></span></fieldset>' +
      '<p class="privacy">Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our <a href="#" data-toast="Legal pages aren\'t part of this demo.">privacy policy</a>.</p>' +
      '<label class="check check--terms"><input type="checkbox" name="terms" required>I have read and agree to the website terms and conditions</label>' +
      '<span class="field__error" id="terms-err"></span>' +
      '<button class="btn-action checkout__submit" type="submit">Place order</button>' +
      '</aside></form>';
  }

  /* ---------- Behaviour ---------- */

  function toggle(btn, panel, open) {
    btn.setAttribute('aria-expanded', String(open));
    if (!Site.animate) { panel.hidden = !open; return; }
    gsap.killTweensOf(panel);
    if (open) {
      panel.hidden = false;
      gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.55, ease: 'expo.out' });
    } else {
      gsap.to(panel, { height: 0, duration: 0.35, ease: 'power3.inOut', onComplete: function () { panel.hidden = true; gsap.set(panel, { clearProps: 'height' }); } });
    }
  }

  function applyCode() {
    var input = $('[data-code]');
    var msg = $('[data-code-msg]');
    var val = input.value.trim().toUpperCase();
    if (val === CODE) {
      discount = 0.3;
      msg.style.color = '#1d6b35';
      msg.textContent = 'Code applied: 30% off your order.';
    } else {
      discount = 0;
      msg.style.color = '';
      msg.textContent = val ? 'That code isn’t valid. Try ' + CODE + '.' : 'Enter a code.';
    }
    $('[data-summary]').innerHTML = summary();
    if (Site.animate) gsap.from('.totals__row--total dd, .totals__row--discount', { opacity: 0, y: -8, duration: 0.6, ease: 'expo.out' });
  }

  var rules = {
    first: function (v) { return v ? '' : 'Enter your first name.'; },
    last: function (v) { return v ? '' : 'Enter your last name.'; },
    street: function (v) { return v ? '' : 'Enter your street address.'; },
    zip: function (v) { return /^\d{4}$/.test(v) ? '' : 'Enter a 4-digit ZIP code.'; },
    phone: function (v) { return /^(\+?63|0)9\d{9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter a mobile number, e.g. 0917 123 4567.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address.'; },
  };

  function check(id) {
    var el = document.getElementById(id);
    var msg = rules[id](el.value.trim());
    el.setAttribute('aria-invalid', String(!!msg));
    if (msg) el.setAttribute('aria-describedby', id + '-err');
    document.getElementById(id + '-err').textContent = msg;
    return !msg;
  }

  function validate() {
    var bad = Object.keys(rules).filter(function (id) { return !check(id); });
    var pay = $('input[name="pay"]:checked');
    $('#pay-err').textContent = pay ? '' : 'Choose a payment option.';
    var terms = $('input[name="terms"]');
    $('#terms-err').textContent = terms.checked ? '' : 'Please agree to the terms to continue.';
    var firstBad = bad.length ? document.getElementById(bad[0]) : !pay ? $('input[name="pay"]') : !terms.checked ? terms : null;
    if (firstBad) {
      firstBad.focus({ preventScroll: true });
      Site.scrollTo(firstBad.closest('.field, .pay, .check') || firstBad);
      return false;
    }
    return true;
  }

  function placed(form) {
    var ref = 'ALC-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    var name = $('#first', form).value.trim();
    var finish = function () {
      Site.cart.clear();
      view.innerHTML = '<div class="done" tabindex="-1">' +
        '<svg class="done__tick" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="40"/><path d="M26 43l11 11 21-23"/></svg>' +
        '<h2 class="display">Thank you, ' + esc(name) + '!</h2>' +
        '<p>Your order is in. In the real store you’d get a confirmation email next.</p>' +
        '<span class="done__ref">Order ' + ref + '</span>' +
        '<p><small>This is a design demo: no order was sent and nothing was charged. Your demo bag has been emptied.</small></p>' +
        '<a class="btn btn--black" href="shop.html">Keep shopping</a></div>';
      var done = $('.done');
      done.focus({ preventScroll: true });
      Site.scrollTo($('.checkout'));
      if (Site.animate) {
        var c = $('.done__tick circle');
        var t = $('.done__tick path');
        [c, t].forEach(function (el) { var len = el.getTotalLength(); gsap.set(el, { strokeDasharray: len, strokeDashoffset: len }); });
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .to(c, { strokeDashoffset: 0, duration: 1 })
          .to(t, { strokeDashoffset: 0, duration: 0.6 }, 0.5)
          .from('.done > :not(svg)', { opacity: 0, y: 24, duration: 0.9, stagger: 0.08 }, 0.3);
      }
    };
    var btn = $('.checkout__submit', form);
    btn.disabled = true;
    btn.textContent = 'Placing order…';
    if (!Site.animate) { finish(); return; }
    gsap.to(form, { opacity: 0, y: -20, duration: 0.5, delay: 0.6, ease: 'power2.in', onComplete: finish });
  }

  Site.ready(function () {
    render();
    var form = $('[data-form]');
    if (!form) return;

    if (Site.animate) {
      gsap.from('.checkout__billing > *, .fields > .field, .checks', { opacity: 0, y: 26, duration: 0.9, stagger: 0.04, ease: 'expo.out', delay: 0.3 });
      gsap.from('.checkout__side > *', { opacity: 0, y: 26, duration: 0.9, stagger: 0.07, ease: 'expo.out', delay: 0.45 });
    }

    $$('[data-bar]').forEach(function (b) {
      var panel = document.getElementById(b.getAttribute('aria-controls'));
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        toggle(b, panel, open);
        if (open && panel.id === 'bar-code') setTimeout(function () { $('[data-code]').focus(); }, 50);
      });
    });
    $('[data-apply]').addEventListener('click', applyCode);
    $('[data-code]').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyCode(); }
    });

    // Payment notes open under the chosen option
    form.addEventListener('change', function (e) {
      if (e.target.name === 'pay') {
        $('#pay-err').textContent = '';
        $$('.pay__opt').forEach(function (li) {
          var note = $('.pay__note', li);
          if (!note) return;
          var on = $('input', li).checked;
          if (on === !note.hidden) return;
          if (!Site.animate) { note.hidden = !on; return; }
          if (on) { note.hidden = false; gsap.fromTo(note, { height: 0 }, { height: 'auto', duration: 0.5, ease: 'expo.out' }); }
          else gsap.to(note, { height: 0, duration: 0.3, ease: 'power3.inOut', onComplete: function () { note.hidden = true; gsap.set(note, { clearProps: 'height' }); } });
        });
      }
      if (e.target.name === 'terms' && e.target.checked) $('#terms-err').textContent = '';
    });

    // Re-check a field once it has been flagged
    form.addEventListener('input', function (e) {
      var id = e.target.id;
      if (rules[id] && e.target.getAttribute('aria-invalid') === 'true') check(id);
    });
    form.addEventListener('focusout', function (e) {
      var id = e.target.id;
      if (rules[id] && e.target.value.trim()) check(id);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (validate()) placed(form);
    });
  });
})();
