/*
  Cart page: lines from the shared demo cart, quantity steppers, remove,
  live totals. Totals count up/down when they change.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var esc = Site.esc;

  var MINUS = '<svg viewBox="0 0 17 17" aria-hidden="true"><path d="M0 8.5h17" stroke="#fff" stroke-width="2"/></svg>';
  var PLUS = '<svg viewBox="0 0 17 17" aria-hidden="true"><path d="M0 8.5h17M8.5 0v17" stroke="#fff" stroke-width="2"/></svg>';
  var CROSS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" stroke="#000" stroke-width="1.6"/></svg>';

  var view = $('[data-cart-view]');
  var shown = { subtotal: 0 };

  function lineHtml(l) {
    var p = ALC.get(l.id);
    var url = 'product.html?id=' + p.id;
    return '<li class="line" data-line="' + esc(l.key) + '">' +
      '<div class="line__product"><a href="' + url + '" tabindex="-1" aria-hidden="true">' + Site.thumb(p) + '</a>' +
      '<p class="line__name"><a href="' + url + '">' + esc(p.name) + '</a>' + Site.opts(l, p) + '</p></div>' +
      '<span class="line__price">' + Site.money(p.price) + '</span>' +
      '<div class="stepper"><button type="button" aria-label="One less ' + esc(p.name) + '" data-step="-1"' + (l.qty < 2 ? ' disabled' : '') + '>' + MINUS + '</button>' +
      '<input type="number" inputmode="numeric" min="1" max="99" value="' + l.qty + '" aria-label="Quantity of ' + esc(p.name) + '" data-qty>' +
      '<button type="button" aria-label="One more ' + esc(p.name) + '" data-step="1">' + PLUS + '</button></div>' +
      '<span class="line__total" data-line-total>' + Site.money(p.price * l.qty) + '</span>' +
      '<button class="remove" type="button" aria-label="Remove ' + esc(p.name) + '" data-remove>' + CROSS + '</button>' +
      '</li>';
  }

  function render() {
    var items = Site.cart.items();
    if (!items.length) {
      view.innerHTML = '<div class="cart-empty"><h2 class="display">Your bag is empty</h2>' +
        '<p>Add something from the shop and it will show up here.</p>' +
        '<a class="btn btn--black cart__continue" href="shop.html">Start shopping</a></div>';
      if (Site.animate) gsap.from('.cart-empty > *', { opacity: 0, y: 24, duration: 0.9, stagger: 0.08, ease: 'expo.out' });
      return;
    }
    shown.subtotal = Site.cart.subtotal();
    view.innerHTML = '<div class="cart__grid">' +
      '<div class="cart-table">' +
      '<div class="cart-table__head" aria-hidden="true"><span>Product</span><span>Price</span><span>Quantity</span><span>Total</span><span></span></div>' +
      '<ul data-lines>' + items.map(lineHtml).join('') + '</ul>' +
      '<a class="btn btn--black cart__continue" href="shop.html">Continue shopping</a></div>' +
      '<aside class="cart__side" aria-labelledby="total-title">' +
      '<h2 class="label-head label-head--lg" id="total-title">Cart total</h2>' +
      '<dl class="totals" aria-live="polite">' +
      '<div class="totals__row"><dt>Subtotal:</dt><dd data-subtotal>' + Site.money(shown.subtotal) + '</dd></div>' +
      '<div class="totals__row totals__row--muted"><dt>Shipping:</dt><dd>Shipping &amp; taxes calculated at checkout</dd></div>' +
      '<div class="totals__row totals__row--total"><dt>Total</dt><dd data-total>' + Site.money(shown.subtotal) + '</dd></div></dl>' +
      '<ul class="perks-box">' +
      '<li><img src="./assets/svg/perk-1.svg" alt=""><p>Delivery in 3 days<button type="button" data-toast="Delivery details aren\'t part of this demo.">More details</button></p></li>' +
      '<li><img src="./assets/svg/perk-2.svg" alt=""><p>15 days return<button type="button" data-toast="The returns page isn\'t part of this demo.">View more</button></p></li>' +
      '<li><img src="./assets/svg/perk-4.svg" alt=""><p>100% payment secure<button type="button" data-toast="Payment details aren\'t part of this demo.">More info</button></p></li></ul>' +
      '<a class="btn-action cart__order" href="checkout.html">Place order</a>' +
      '</aside></div>';
  }

  // Numbers roll to their new value
  function paintTotals() {
    var target = Site.cart.subtotal();
    var sub = $('[data-subtotal]');
    var tot = $('[data-total]');
    if (!sub) return;
    if (!Site.animate) {
      sub.textContent = tot.textContent = Site.money(target);
      shown.subtotal = target;
      return;
    }
    gsap.to(shown, {
      subtotal: target, duration: 0.7, ease: 'power3.out', overwrite: true,
      onUpdate: function () { sub.textContent = tot.textContent = Site.money(Math.round(shown.subtotal)); },
    });
    gsap.fromTo(tot, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'expo.out' });
  }

  function setQty(row, qty) {
    var key = row.dataset.line;
    var l = Site.cart.items().filter(function (x) { return x.key === key; })[0];
    if (!l) return;
    qty = Math.max(1, Math.min(99, qty || 1));
    Site.cart.setQty(key, qty);
    var p = ALC.get(l.id);
    $('[data-qty]', row).value = qty;
    $('[data-step="-1"]', row).disabled = qty < 2;
    var total = $('[data-line-total]', row);
    total.textContent = Site.money(p.price * qty);
    if (Site.animate) gsap.fromTo(total, { y: -6, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.45, ease: 'expo.out' });
    paintTotals();
  }

  function remove(row) {
    var key = row.dataset.line;
    var done = function () {
      Site.cart.remove(key);
      if (!Site.cart.items().length) render();
      else { row.remove(); paintTotals(); }
    };
    if (!Site.animate) { done(); return; }
    gsap.timeline({ onComplete: done })
      .to(row, { x: 60, opacity: 0, duration: 0.35, ease: 'power2.in' })
      .to(row, { height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: 0.4, ease: 'power3.inOut' });
  }

  Site.ready(function () {
    render();
    if (Site.animate && $('[data-lines]')) {
      gsap.from('.cart-table__head, .line', { opacity: 0, y: 30, duration: 1, stagger: 0.08, ease: 'expo.out', delay: 0.3 });
      gsap.from('.cart__side > *', { opacity: 0, y: 30, duration: 1, stagger: 0.08, ease: 'expo.out', delay: 0.45 });
    }

    view.addEventListener('click', function (e) {
      var row = e.target.closest('[data-line]');
      if (!row) return;
      var step = e.target.closest('[data-step]');
      if (step) setQty(row, +$('[data-qty]', row).value + +step.dataset.step);
      if (e.target.closest('[data-remove]')) remove(row);
    });
    view.addEventListener('change', function (e) {
      if (!e.target.matches('[data-qty]')) return;
      setQty(e.target.closest('[data-line]'), parseInt(e.target.value, 10));
    });
  });
})();
