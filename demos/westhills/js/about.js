/*
  About: Our Core Values. As in the Figma component, hovering a value turns
  its name and line gold and shows that value's photo over the tilted gold
  card (Smart Animate, ease-out 0.3s). Keyboard focus does the same; touch
  screens cycle through the values while the section is on screen.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;

  Site.ready(function () {
    var rows = $$('[data-value]');
    var visual = $('[data-values-visual]');
    var imgs = $$('[data-value-img]');
    if (!rows.length) return;
    var current = null;

    function show(key) {
      current = key;
      rows.forEach(function (r) { r.classList.toggle('is-on', r.dataset.value === key); });
      imgs.forEach(function (im) { im.classList.toggle('is-on', im.dataset.valueImg === key); });
      visual.classList.toggle('is-on', !!key);
    }

    rows.forEach(function (r) {
      r.addEventListener('mouseenter', function () { show(r.dataset.value); });
      r.addEventListener('focus', function () { show(r.dataset.value); });
      r.addEventListener('click', function () { show(r.dataset.value); });
    });
    $('[data-values]').addEventListener('mouseleave', function () { if (Site.canHover) show(null); });
    $('.values__list').addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest('[data-value]')) show(null);
    });

    if (!Site.canHover && !Site.reduce) {
      var i = 0;
      var timer = null;
      new IntersectionObserver(function (entries) {
        clearInterval(timer);
        if (!entries[0].isIntersecting) return;
        show(rows[i % rows.length].dataset.value);
        timer = setInterval(function () { i++; show(rows[i % rows.length].dataset.value); }, 2600);
      }, { threshold: 0.4 }).observe($('[data-values]'));
    }
  });
})();
