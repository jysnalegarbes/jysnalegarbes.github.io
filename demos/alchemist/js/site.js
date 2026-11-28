/*
  Alchemist demo — shared by every page.
  Smooth scroll (Lenis), header (hide on scroll, burger menu, Sportswear mega
  menu), announcement bar, toast, the demo cart (saved in localStorage, so it
  carries across pages), product cards, add-to-bag with a fly-to-cart motion,
  and scroll reveals.

  Page scripts register with Site.ready(fn); fn runs after fonts load and the
  shared parts are mounted.

  ?shot  screenshot mode: no smooth scroll, no reveals, no autoplay.
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
  var desktop = matchMedia('(min-width: 1024px)');

  if (shot) {
    root.classList.add('is-shot');
    $$('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  }
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

  var Site = {
    $: $, $$: $$, params: params, shot: shot, reduce: reduce,
    hasGsap: hasGsap, animate: animate, lenis: null,
  };

  /* ---------- Formatting ---------- */

  Site.money = function (n) {
    return '₱ ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  Site.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  Site.img = function (name) { return './assets/img/' + name + '.webp'; };

  /* ---------- Toast ---------- */

  var toastEl = $('[data-toast-el]');
  var toastTimer;
  Site.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  };

  /* ---------- Cart (demo: lives in this browser only) ---------- */

  var KEY = 'alchemist-demo-cart-v1';
  var memory = null; // fallback when storage is blocked
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) {
        // First visit: start with the cart shown in the design
        var seed = window.ALC ? ALC.seed.map(function (l) { return lineFor(l.id, l.size, null, l.qty); }) : [];
        write(seed);
        return seed;
      }
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(function (l) { return window.ALC && ALC.get(l.id) && l.qty > 0; }) : [];
    } catch (e) {
      return memory || [];
    }
  }
  function write(list) {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* memory only */ }
  }
  function lineFor(id, size, color, qty) {
    return { key: [id, size || '', color || ''].join('|'), id: id, size: size || null, color: color || null, qty: qty || 1 };
  }
  var listeners = [];
  function changed() {
    var list = read();
    listeners.forEach(function (fn) { fn(list); });
  }

  Site.cart = {
    items: read,
    count: function () { return read().reduce(function (n, l) { return n + l.qty; }, 0); },
    subtotal: function () {
      return read().reduce(function (n, l) { return n + ALC.get(l.id).price * l.qty; }, 0);
    },
    add: function (id, opts) {
      opts = opts || {};
      var list = read();
      var line = lineFor(id, opts.size, opts.color, opts.qty);
      var found = list.filter(function (l) { return l.key === line.key; })[0];
      if (found) found.qty = Math.min(99, found.qty + line.qty);
      else list.push(line);
      write(list);
      changed();
    },
    setQty: function (key, qty) {
      var list = read();
      list.forEach(function (l) { if (l.key === key) l.qty = Math.max(1, Math.min(99, qty)); });
      write(list);
      changed();
    },
    remove: function (key) {
      write(read().filter(function (l) { return l.key !== key; }));
      changed();
    },
    clear: function () { write([]); changed(); },
    onChange: function (fn) { listeners.push(fn); },
  };

  // Other tabs (or the viewer iframe) changing the cart
  addEventListener('storage', function (e) { if (e.key === KEY) changed(); });

  /* ---------- Product cards ---------- */

  Site.card = function (p, extra) {
    var cat = ALC.cats[p.cat];
    var url = 'product.html?id=' + p.id;
    var name = Site.esc(p.name);
    var alt = Site.esc(p.name + (p.variant ? ', ' + p.variant : ''));
    var badge = p.was ? '<span class="badge">-' + Math.round((1 - p.price / p.was) * 100) + '%</span>' : '';
    var price = (p.was ? '<s>' + Site.money(p.was) + '</s> ' : '') + Site.money(p.price);
    return '<li class="card' + (extra || '') + '" data-card data-id="' + p.id + '">' +
      '<a class="card__media card__media--' + p.fit + '" href="' + url + '" tabindex="-1" aria-hidden="true">' +
      '<img src="' + Site.img(p.img) + '" alt="" loading="lazy">' +
      '<span class="pill">' + cat.pill + '</span>' + badge + '</a>' +
      '<h4><a href="' + url + '">' + name + '</a></h4>' +
      '<p class="card__meta"><span class="rating"><img src="./assets/svg/star.svg" alt="" width="20" height="20">4.4 (Reviews)</span>' +
      '<span class="price">' + price + '</span></p>' +
      '<div class="card__btns"><button class="btn-bag" type="button" data-add aria-label="Add ' + alt + ' to bag">Add to bag</button>' +
      '<button class="btn-buy" type="button" data-buy aria-label="Buy ' + alt + ' now">Buy now</button></div>' +
      '</li>';
  };

  // Small square photo for cart and order lines
  Site.thumb = function (p) {
    var src = p.thumb || p.img;
    var cover = p.thumb || p.fit === 'cover' || p.fit === 'portrait';
    return '<span class="thumb' + (cover ? ' thumb--cover' : '') + '"><img src="' + Site.img(src) + '" alt=""></span>';
  };

  // "Red · Size M" under a line's name
  Site.opts = function (l, p) {
    var bits = [];
    if (l.color) bits.push(l.color);
    else if (p.variant) bits.push(p.variant);
    if (l.size) bits.push('Size ' + l.size);
    return bits.length ? '<span class="line__opts">' + Site.esc(bits.join(' · ')) + '</span>' : '';
  };

  /* ---------- Smooth scroll and anchors ---------- */

  function mountScroll() {
    if (animate && window.Lenis) {
      Site.lenis = new Lenis({ autoRaf: false, duration: 1.15 });
      Site.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { Site.lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-scroll]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      e.preventDefault();
      Site.scrollTo(hash === '#top' ? 0 : $(hash));
    });
  }

  Site.scrollTo = function (target) {
    if (target === null) return;
    setMenu(false);
    // Keep the header in view during and after the jump (the offset below
    // the header is the html scroll-padding-top)
    showHeader(1800);
    if (Site.lenis) Site.lenis.scrollTo(target, { duration: 1.4 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- Header ---------- */

  var header = $('[data-header]');
  var menu = $('[data-menu]');
  var burger = $('[data-burger]');
  var mega = $('[data-mega]');
  var megaTrigger = $('[data-mega-trigger]');
  var menuOpen = false;
  var megaOpen = false;
  var holdHeader = 0;

  function showHeader(ms) {
    header.classList.remove('is-hidden');
    holdHeader = Date.now() + (ms || 0);
  }

  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    if (open) {
      setMega(false);
      showHeader();
      if (animate) gsap.fromTo($$('li', menu), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out' });
    }
  }

  function setMega(open) {
    if (!mega || open === megaOpen) return;
    if (open && !desktop.matches) return;
    megaOpen = open;
    megaTrigger.setAttribute('aria-expanded', String(open));
    header.classList.toggle('is-mega', open);
    if (open) {
      mega.hidden = false;
      if (animate) {
        gsap.killTweensOf(mega);
        gsap.fromTo(mega, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'expo.out' });
        gsap.fromTo($$('li, h3', mega), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.015, ease: 'expo.out', delay: 0.05 });
      }
    } else if (animate) {
      gsap.killTweensOf(mega);
      gsap.to(mega, { clipPath: 'inset(0 0 100% 0)', duration: 0.35, ease: 'power3.in', onComplete: function () { if (!megaOpen) mega.hidden = true; } });
    } else {
      mega.hidden = true;
    }
  }

  function mountHeader() {
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!menuOpen);
    });
    document.addEventListener('click', function (e) {
      if (menuOpen && !menu.contains(e.target)) setMenu(false);
    });
    addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (menuOpen) { setMenu(false); burger.focus(); }
      if (megaOpen) { setMega(false); megaTrigger.focus(); }
    });

    // Mega menu: hover with a short grace period, or keyboard focus
    if (mega) {
      var t;
      var zone = [megaTrigger.parentNode, mega];
      zone.forEach(function (el) {
        el.addEventListener('mouseenter', function () { clearTimeout(t); setMega(true); });
        el.addEventListener('mouseleave', function () { t = setTimeout(function () { setMega(false); }, 160); });
      });
      megaTrigger.addEventListener('focus', function () { setMega(true); });
      header.addEventListener('focusout', function (e) {
        if (!e.relatedTarget || !zone.some(function (z) { return z.contains(e.relatedTarget); })) setMega(false);
      });
      desktop.addEventListener('change', function () { setMega(false); });
    }

    var lastY = window.scrollY;
    addEventListener('scroll', function () {
      var y = window.scrollY;
      if (!menuOpen && !megaOpen && !shot && Date.now() > holdHeader) header.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    }, { passive: true });

    // Header search goes to the shop with the query
    var search = $('[data-search]');
    search.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('input', search).value.trim();
      if (!q) { Site.toast('Type a product name to search.'); return; }
      location.href = 'shop.html?q=' + encodeURIComponent(q);
    });
  }

  /* ---------- Announcement bar ---------- */

  function mountAnnounce() {
    var items = $$('[data-announce]');
    if (!items.length) return;
    var i = 0;
    var timer;
    function go(n, dir) {
      var prev = items[i];
      i = (n + items.length) % items.length;
      var next = items[i];
      if (!animate) {
        prev.classList.remove('is-active');
        next.classList.add('is-active');
        return;
      }
      gsap.to(prev, { yPercent: -60 * dir, opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: function () { prev.classList.remove('is-active'); } });
      next.classList.add('is-active');
      gsap.fromTo(next, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, delay: 0.25, ease: 'expo.out' });
    }
    function restart() {
      clearInterval(timer);
      if (animate) timer = setInterval(function () { go(i + 1, 1); }, 4500);
    }
    $('[data-announce-next]').addEventListener('click', function () { go(i + 1, 1); restart(); });
    $('[data-announce-prev]').addEventListener('click', function () { go(i - 1, -1); restart(); });
    restart();
  }

  /* ---------- Cart badge, add to bag, buy now ---------- */

  var badge = $('[data-cart-count]');
  var cartBtn = $('[data-cart]');

  function paintBadge(bump) {
    var n = Site.cart.count();
    badge.textContent = n;
    badge.hidden = n === 0;
    cartBtn.setAttribute('aria-label', 'Bag, ' + n + (n === 1 ? ' item' : ' items'));
    if (bump && animate) {
      gsap.fromTo(badge, { scale: 1.7 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      gsap.fromTo(cartBtn, { rotate: -14 }, { rotate: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' });
    }
  }

  // A copy of the product photo arcs into the bag icon
  Site.flyToCart = function (img, done) {
    if (!animate || !img || !img.getBoundingClientRect().width) { done(); return; }
    showHeader(1600);
    var from = img.getBoundingClientRect();
    var ghost = img.cloneNode();
    ghost.removeAttribute('loading');
    ghost.className = 'fly-ghost';
    ghost.alt = '';
    Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(ghost);
    // Measure the icon after the header has slid back in
    requestAnimationFrame(function () {
      var to = cartBtn.getBoundingClientRect();
      var dx = to.left + to.width / 2 - (from.left + from.width / 2);
      var dy = to.top + to.height / 2 - (from.top + from.height / 2);
      var s = Math.max(0.06, 28 / Math.max(from.width, from.height));
      var tl = gsap.timeline({ onComplete: function () { ghost.remove(); done(); } });
      tl.to(ghost, { x: dx, duration: 0.85, ease: 'power2.inOut' }, 0)
        .to(ghost, { y: dy, duration: 0.85, ease: 'back.in(1.6)' }, 0)
        .to(ghost, { scale: s, rotate: 14, duration: 0.85, ease: 'power2.in' }, 0)
        .to(ghost, { opacity: 0, duration: 0.15 }, 0.72);
    });
  };

  function productFrom(el) {
    var host = el.closest('[data-id]');
    return host ? { host: host, p: ALC.get(host.dataset.id) } : null;
  }

  function mountShopping() {
    paintBadge(false);
    Site.cart.onChange(function () { paintBadge(false); });

    document.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]');
      var buy = e.target.closest('[data-buy]');
      var btn = add || buy;
      if (!btn) return;
      var found = productFrom(btn);
      if (!found || !found.p) return;
      // The product page passes its own options (size, colour, quantity)
      var opts = btn.dataset.opts ? JSON.parse(btn.dataset.opts) : {};
      if (found.p.sizes && !opts.size) opts.size = 'M';
      if (buy) {
        Site.cart.add(found.p.id, opts);
        location.href = 'cart.html';
        return;
      }
      var img = found.host.querySelector('[data-fly]') || found.host.querySelector('.card__media img');
      btn.classList.add('is-added');
      var label = btn.innerHTML;
      btn.textContent = 'Added ✓';
      setTimeout(function () { btn.classList.remove('is-added'); btn.innerHTML = label; }, 1600);
      Site.flyToCart(img, function () {
        Site.cart.add(found.p.id, opts);
        paintBadge(true);
      });
      Site.toast(found.p.name + (found.p.variant ? ' (' + found.p.variant + ')' : '') + ' added to your bag.');
    });

    cartBtn.addEventListener('click', function () { location.href = 'cart.html'; });

    // Delegated, so buttons rendered later work too
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-toast]');
      if (b) Site.toast(b.dataset.toast);
    });
  }

  /* ---------- Recommendations carousel ---------- */

  Site.mountRecs = function (exclude) {
    var wrap = $('[data-recs]');
    if (!wrap) return;
    var track = $('[data-recs-track]', wrap);
    track.innerHTML = ALC.recs
      .filter(function (id) { return id !== exclude; })
      .map(function (id) { return Site.card(ALC.get(id)); })
      .join('');
    var step = function (d) {
      var card = track.firstElementChild;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      track.scrollBy({ left: d * (card.offsetWidth + gap), behavior: reduce ? 'auto' : 'smooth' });
    };
    var prev = $('[data-recs-prev]', wrap);
    var next = $('[data-recs-next]', wrap);
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    var edges = function () {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
    };
    track.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges);
    edges();
  };

  /* ---------- Reveals ---------- */

  Site.once = function (trigger, start) { return { trigger: trigger, start: start || 'top 85%', once: true }; };

  Site.splitIn = function (el, opts) {
    var s = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'split-line' });
    return gsap.from(s.chars, Object.assign({
      yPercent: 120, rotate: 6, duration: 1, stagger: 0.025, ease: 'expo.out',
      onComplete: function () { s.revert(); },
    }, opts || {}));
  };

  Site.reveal = function (scope) {
    if (!animate) return;
    scope = scope || document;
    $$('[data-split]', scope).forEach(function (el) {
      if (el.hasAttribute('data-split-now')) return;
      Site.splitIn(el, { scrollTrigger: Site.once(el) });
    });
    $$('[data-fade]', scope).forEach(function (el) {
      gsap.from(el, { opacity: 0, y: 28, duration: 1, ease: 'expo.out', scrollTrigger: Site.once(el) });
    });
    $$('[data-stagger-group]', scope).forEach(function (group) {
      gsap.from($$('[data-stagger]', group), {
        opacity: 0, y: 36, duration: 1, stagger: 0.07, ease: 'expo.out',
        scrollTrigger: Site.once(group),
      });
    });
    $$('[data-cards]', scope).forEach(function (grid) {
      gsap.from($$('[data-card]', grid), {
        opacity: 0, y: 60, duration: 1.1, stagger: 0.08, ease: 'expo.out',
        scrollTrigger: Site.once(grid),
      });
    });
  };

  // Header drops in, the page title rises (inner pages)
  function intro() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.header', { yPercent: -100, duration: 1 }, 0);
    var now = $('[data-split-now]');
    if (now) tl.add(Site.splitIn(now, { duration: 1.2, stagger: 0.035, delay: 0 }), 0.25);
    var bg = $('[data-hero-bg]');
    if (bg) tl.from(bg, { scale: 1.15, duration: 2, ease: 'expo.out' }, 0);
    return tl;
  }

  /* ---------- Start ---------- */

  var queue = [];
  var started = false;
  Site.ready = function (fn) { started ? fn() : queue.push(fn); };

  function init() {
    mountScroll();
    mountHeader();
    mountAnnounce();
    mountShopping();
    if (animate && !document.body.hasAttribute('data-home')) intro();
    started = true;
    queue.forEach(function (fn) { fn(); });
    if (animate) Site.reveal();
    root.classList.add('is-ready');
    if (animate) ScrollTrigger.refresh();
  }

  window.Site = Site;
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1500); }),
  ]).then(init);
})();
