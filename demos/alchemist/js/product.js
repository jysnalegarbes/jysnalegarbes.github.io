/*
  Product page (product.html?id=...). Built from the catalogue entry.
  Products with a gallery (the red Brave Always tee, as in the design) get
  the homepage's WebGL slash-wipe between photos (hero-gl.js), thumbnails,
  arrows, swipe and colour swatches that switch the photo. Other products
  show their packshot on the grey tile.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var esc = Site.esc;

  var CHEV = '<svg viewBox="0 0 12 7" aria-hidden="true"><path d="M1 6l5-5 5 5" fill="none" stroke="#000" stroke-width="1.8"/></svg>';
  var CHEV_DOWN = '<svg viewBox="0 0 12 7" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="#000" stroke-width="1.8"/></svg>';
  var ARROW_L = '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M15 5H1M5 1 1 5l4 4" fill="none" stroke="#000" stroke-width="1.6"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 5h14M11 1l4 4-4 4" fill="none" stroke="#000" stroke-width="1.6"/></svg>';

  // 4.4 of 5 stars: gold stars clipped to 88%, grey behind
  function stars() {
    var star = 'M12.5 1l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6L1.5 9.1 9.1 8z';
    var row = function (fill) {
      var s = '';
      for (var i = 0; i < 5; i++) s += '<path transform="translate(' + i * 25 + ' 0)" d="' + star + '" fill="' + fill + '"/>';
      return s;
    };
    return '<svg viewBox="0 0 125 25" aria-hidden="true"><defs><clipPath id="rate"><rect width="' + 125 * 0.88 + '" height="25"/></clipPath></defs>' +
      row('#d9d9d9') + '<g clip-path="url(#rate)">' + row('#ffcf2a') + '</g></svg>';
  }

  function copy(p) {
    if (p.cat === 'sportswear') {
      return {
        feature: '<ul><li>Relaxed, oversized cut with a dropped shoulder.</li><li>Alchemist mark on the chest' + (p.type === 'tshirt' ? ', large print on the back.' : '.') + '</li><li>Made for training days and rest days alike.</li></ul>',
        info: 'Sizes S to XXL. Not sure which one? Check the size guide. Colour: ' + esc(p.variant || '') + '.',
      };
    }
    if (p.cat === 'supplements') {
      return {
        feature: 'Sold sealed, from the brand’s official distributor. Check the label for serving size, flavours and allergens before use.',
        info: 'Ships in 3 days within Davao, nationwide on request. Store in a cool, dry place.',
      };
    }
    if (p.cat === 'bundles') {
      return {
        feature: 'A ready-made stack at a lower price than buying each item. Contents are shown on the bundle image.',
        info: 'Bundle items ship together. Free items are while stocks last.',
      };
    }
    return {
      feature: 'Alchemist gear for the gym bag: built to be used daily.',
      info: 'One size. Wipe clean.',
    };
  }

  function render(p) {
    var cat = ALC.cats[p.cat];
    document.title = p.name + ' — Alchemist (store design demo)';
    $('[data-pdp]').dataset.id = p.id;
    $('[data-pdp-crumbs]').innerHTML = '<img src="./assets/svg/home.svg" alt="" width="13" height="13">' +
      '<a href="index.html">Home</a> / <a href="shop.html?cat=' + p.cat + '">' + cat.label + '</a> / <span aria-current="page">' + esc(p.name) + '</span>';
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === p.cat) a.setAttribute('aria-current', 'page'); });

    // Gallery
    var slides = [];
    var gallery;
    if (p.gallery) {
      slides = p.gallery.slice();
      (p.colors || []).forEach(function (c) {
        if (!c.current) slides.push({ src: c.src, alt: 'T-Shirt Brave Always in ' + c.name.toLowerCase(), color: c.name });
      });
      gallery = '<div class="gallery"><div class="gallery__stage" data-stage tabindex="0" aria-roledescription="carousel" aria-label="Product photos">' +
        slides.map(function (s, i) {
          return '<figure class="gallery__slide' + (i === 0 ? ' is-active' : '') + '" data-slide><img src="' + Site.img(s.src) + '" alt="' + esc(s.alt) + '"' + (i === 0 ? ' data-fly' : '') + '></figure>';
        }).join('') +
        '<canvas class="gallery__gl" data-hero-gl aria-hidden="true"></canvas>' +
        '<button class="circle-btn gallery__prev" type="button" aria-label="Previous photo" data-g-prev>' + ARROW_L + '</button>' +
        '<button class="circle-btn gallery__next" type="button" aria-label="Next photo" data-g-next>' + ARROW_R + '</button></div>' +
        '<div class="thumbs" role="group" aria-label="Choose a photo">' +
        p.gallery.map(function (s, i) {
          return '<button type="button" data-thumb="' + i + '" aria-label="Photo ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '><img src="' + Site.img(s.src) + '" alt=""></button>';
        }).join('') + '</div></div>';
    } else {
      gallery = '<div class="gallery"><div class="gallery__stage"><div class="card__media card__media--' + p.fit + ' gallery__solo">' +
        '<img src="' + Site.img(p.img) + '" alt="' + esc(p.name + (p.variant ? ', ' + p.variant : '')) + '" data-fly></div></div></div>';
    }

    var price = 'PHP ' + p.price.toLocaleString('en-PH', { minimumFractionDigits: 2 }) + (p.was ? '<s>PHP ' + p.was.toLocaleString('en-PH', { minimumFractionDigits: 2 }) + '</s>' : '');

    var sizes = p.sizes ?
      '<div class="pdp__block"><h2 id="size-label">Size: <span data-size-name></span></h2><div class="sizes" role="group" aria-labelledby="size-label">' +
      ['S', 'M', 'L', 'XL', 'XXL'].map(function (s) { return '<button type="button" aria-pressed="false" data-size="' + s + '">' + s + '</button>'; }).join('') +
      '</div><span class="field__error" data-size-error></span>' +
      '<button class="size-guide" type="button" data-toast="The size guide isn\'t part of this demo.">Size guide</button></div>' : '';

    var colors = p.colors || (p.variant ? [{ name: p.variant, src: p.img, current: true, cutout: true }] : null);
    var colorBlock = colors ?
      '<div class="pdp__block"><h2 id="color-label">Color: <span data-color-name>' + esc(colors.filter(function (c) { return c.current; })[0].name) + '</span></h2>' +
      '<div class="swatches" role="group" aria-labelledby="color-label">' +
      colors.map(function (c) {
        return '<button type="button" aria-pressed="' + !!c.current + '" aria-label="' + esc(c.name) + '" data-color="' + esc(c.name) + '">' +
          '<img src="' + Site.img(c.src) + '" alt=""' + (c.cutout ? ' class="is-cutout"' : '') + '></button>';
      }).join('') + '</div></div>' : '';

    var c = copy(p);
    var acc = function (id, title, body) {
      return '<div class="pacc"><h3><button type="button" aria-expanded="false" aria-controls="' + id + '" data-pacc>' + title +
        '<img src="./assets/svg/acc-chev.svg" alt=""></button></h3><div class="pacc__panel" id="' + id + '" hidden><div>' + body + '</div></div></div>';
    };

    $('[data-pdp-body]').innerHTML = gallery +
      '<div class="pdp__info">' +
      '<div class="pdp__head"><h1>' + esc(p.name) + '</h1>' +
      '<p class="pdp__stars">' + stars() + '<span>4.4 out of 5</span></p>' +
      '<p class="pdp__price">' + price + '</p>' +
      sizes + colorBlock + '</div>' +
      '<div class="order">' +
      '<div class="qty"><label class="visually-hidden" for="qty">Quantity</label><input id="qty" type="number" inputmode="numeric" min="1" max="99" value="1" data-qty>' +
      '<div class="qty__btns"><button type="button" aria-label="One more" data-qty-up>' + CHEV + '</button><button type="button" aria-label="One less" data-qty-down>' + CHEV_DOWN + '</button></div></div>' +
      '<button class="btn-cart" type="button" data-add data-pdp-add><img src="./assets/svg/bag-add.svg" alt=""><span>Add to bag</span></button>' +
      '<button class="btn-wish" type="button" aria-pressed="false" data-wish><img src="./assets/svg/heart.svg" alt=""><span>Add to wishlist</span></button>' +
      '</div>' +
      '<ul class="kps">' +
      '<li><img src="./assets/svg/kp-1.svg" alt="">Delivery in 3 days</li>' +
      '<li><img src="./assets/svg/kp-2.svg" alt="">15 days return</li>' +
      '<li><img src="./assets/svg/kp-3.svg" alt="">Delivery in 3 days</li>' +
      '<li><img src="./assets/svg/kp-4.svg" alt="">100% payment secure</li></ul>' +
      '<div class="pdp__acc">' +
      acc('acc-feature', 'Product feature', c.feature) +
      acc('acc-info', 'Additional information', c.info) +
      acc('acc-review', 'Review', '<strong>4.4 out of 5.</strong> Written reviews aren’t part of this demo.') +
      '</div></div>';

    return { slides: slides, colors: colors };
  }

  /* ---------- Gallery ---------- */

  function mountGallery(p, slidesData) {
    var stage = $('[data-stage]');
    if (!stage) return { go: function () {} };
    var slides = $$('[data-slide]', stage);
    var thumbs = $$('[data-thumb]');
    var current = 0;
    var busy = false;
    var queued = null;
    var gl = Site.hasGsap && !Site.reduce && window.HeroGL ? window.HeroGL.mount(stage) : null;

    function paint(n) {
      slides.forEach(function (s, k) {
        s.classList.toggle('is-active', k === n);
        s.setAttribute('aria-hidden', String(k !== n));
        var img = s.querySelector('img');
        if (k === n) img.setAttribute('data-fly', '');
        else img.removeAttribute('data-fly');
      });
      thumbs.forEach(function (t, k) { t.setAttribute('aria-current', String(k === n)); });
    }

    function go(n, dir) {
      n = (n + slides.length) % slides.length;
      if (n === current) return;
      if (busy) { queued = [n, dir]; return; }
      if (!dir) dir = n > current ? 1 : -1;
      var from = current;
      current = n;
      paint(n);
      if (gl && stage.classList.contains('is-gl')) {
        busy = true;
        gl.transition(from, n, dir).eventCallback('onComplete', function () {
          busy = false;
          gl.show(n);
          if (queued) { var q = queued; queued = null; go(q[0], q[1]); }
        });
      }
      // Colour name follows the photo
      var color = slidesData[n].color || (p.colors && n < p.gallery.length ? 'Red' : null);
      if (color) setColor(color, true);
    }

    $('[data-g-next]').addEventListener('click', function () { go(current + 1, 1); });
    $('[data-g-prev]').addEventListener('click', function () { go(current - 1, -1); });
    thumbs.forEach(function (t) { t.addEventListener('click', function () { go(+t.dataset.thumb); }); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(current + 1, 1);
      if (e.key === 'ArrowLeft') go(current - 1, -1);
    });
    var sx = null;
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    paint(0);
    return {
      go: go,
      indexOf: function (color) {
        if (color === 'Red') return 0;
        for (var i = 0; i < slidesData.length; i++) if (slidesData[i].color === color) return i;
        return -1;
      },
    };
  }

  /* ---------- Options ---------- */

  var chosen = { size: null, color: null, qty: 1 };
  var gallery;

  function setColor(name, fromGallery) {
    chosen.color = name;
    $$('[data-color]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.color === name)); });
    var label = $('[data-color-name]');
    if (label) label.textContent = name;
    if (!fromGallery && gallery && gallery.indexOf) {
      var i = gallery.indexOf(name);
      if (i > -1) gallery.go(i);
    }
    syncOpts();
  }

  function syncOpts() {
    var btn = $('[data-pdp-add]');
    var opts = { qty: chosen.qty };
    if (chosen.size) opts.size = chosen.size;
    if (chosen.color && chosen.colorKnown) opts.color = chosen.color;
    btn.dataset.opts = JSON.stringify(opts);
  }

  function mountOptions(p) {
    var colors = p.colors;
    chosen.color = colors ? 'Red' : p.variant || null;
    chosen.colorKnown = !!colors;

    $$('[data-size]').forEach(function (b) {
      b.addEventListener('click', function () {
        chosen.size = b.dataset.size;
        $$('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $('[data-size-name]').textContent = chosen.size;
        $('[data-size-error]').textContent = '';
        if (Site.animate) gsap.fromTo(b, { scale: 0.88 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
        syncOpts();
      });
    });

    $$('[data-color]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!colors) return;
        setColor(b.dataset.color, false);
      });
    });

    var qty = $('[data-qty]');
    var setQty = function (n) {
      chosen.qty = Math.max(1, Math.min(99, n || 1));
      qty.value = chosen.qty;
      syncOpts();
    };
    $('[data-qty-up]').addEventListener('click', function () { setQty(chosen.qty + 1); });
    $('[data-qty-down]').addEventListener('click', function () { setQty(chosen.qty - 1); });
    qty.addEventListener('change', function () { setQty(parseInt(qty.value, 10)); });

    // Size first: stop the shared add-to-bag handler until one is picked
    $('[data-pdp-add]').addEventListener('click', function (e) {
      if (p.sizes && !chosen.size) {
        e.stopPropagation();
        $('[data-size-error]').textContent = 'Choose a size first.';
        var group = $('.sizes');
        if (Site.animate) gsap.fromTo(group, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        $('[data-size]').focus();
      }
    });

    var wish = $('[data-wish]');
    wish.addEventListener('click', function () {
      var on = wish.getAttribute('aria-pressed') !== 'true';
      wish.setAttribute('aria-pressed', String(on));
      $('span', wish).textContent = on ? 'In your wishlist' : 'Add to wishlist';
      if (on && Site.animate) gsap.fromTo($('img', wish), { scale: 1.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      Site.toast(on ? 'Saved to your wishlist (this visit only).' : 'Removed from your wishlist.');
    });

    $$('[data-pacc]').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        if (!Site.animate) { panel.hidden = !open; return; }
        gsap.killTweensOf(panel);
        if (open) {
          panel.hidden = false;
          gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out' });
        } else {
          gsap.to(panel, { height: 0, duration: 0.4, ease: 'power3.inOut', onComplete: function () { panel.hidden = true; gsap.set(panel, { clearProps: 'height' }); } });
        }
      });
    });

    syncOpts();
  }

  function intro() {
    if (!Site.animate) return;
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
    tl.fromTo('.gallery__stage', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .from('.gallery__stage img', { scale: 1.2, duration: 1.8 }, 0.2)
      .from('.thumbs button', { opacity: 0, y: 20, duration: 0.8, stagger: 0.06 }, 0.7)
      .from('.pdp__info > *, .pdp__head > *', { opacity: 0, y: 30, duration: 1, stagger: 0.06 }, 0.35);
  }

  Site.ready(function () {
    var p = ALC.get(Site.params.get('id')) || null;
    if (!p) {
      $('[data-pdp-crumbs]').innerHTML = '<a href="index.html">Home</a> / <a href="shop.html">Products</a>';
      $('[data-pdp-body]').innerHTML = '<div class="shop-empty"><h2 class="display">Product not found</h2><p>That product isn’t in this demo store.</p><a class="btn btn--black" href="shop.html">Back to the shop</a></div>';
      Site.mountRecs();
      return;
    }
    var built = render(p);
    gallery = mountGallery(p, built.slides);
    mountOptions(p);
    Site.mountRecs(p.id);
    intro();
  });
})();
