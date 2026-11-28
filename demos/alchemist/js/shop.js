/*
  Shop page: category + tag filters, search, pagination, all kept in the URL
  (?cat=sportswear&tag=new&type=tshirt&q=whey&page=2) so links from the
  header, mega menu and footer land on the right view.
*/
(function () {
  'use strict';

  var Site = window.Site;
  var $ = Site.$;
  var $$ = Site.$$;
  var PER_PAGE = 9;

  var TYPE_LABELS = {
    tshirt: 'T-Shirts', shorts: 'Shorts', leggings: 'Leggings', 'sports-bras': 'Sports Bras',
    joggers: 'Joggers', 'tank-tops': 'Tank Tops', hoodies: 'Hoodies & Jackets', stringers: 'Stringers & Tanks',
  };
  var ICONS = { all: 'cat-all', sportswear: 'cat-sportswear', supplements: 'cat-supplements', accessories: 'cat-accessories', bundles: 'cat-bundles' };
  var TAG_ICONS = { new: 'cat-new', best: 'cat-best', discount: 'cat-discount' };

  var p = Site.params;
  var state = {
    cat: ALC.cats[p.get('cat')] ? p.get('cat') : 'all',
    tag: ALC.tags[p.get('tag')] ? p.get('tag') : null,
    type: p.get('type') || null,
    q: (p.get('q') || '').trim(),
    page: Math.max(1, parseInt(p.get('page'), 10) || 1),
  };
  var expanded = state.cat === 'all' ? null : state.cat;

  var grid = $('[data-grid]');
  var filtersEl = $('[data-filters]');
  var statusEl = $('[data-status]');
  var pager = $('[data-pager]');
  var pagesEl = $('[data-pages]');
  var findInput = $('#find');
  var first = true;

  /* ---------- Filters ---------- */

  function buildFilters() {
    var html = '<li><button class="filter" type="button" data-cat="all"><img class="filter__icon" src="./assets/svg/cat-all.svg" alt="">All Product</button></li>';
    Object.keys(ALC.cats).forEach(function (cat) {
      html += '<li><button class="filter" type="button" data-cat="' + cat + '" aria-expanded="false" aria-controls="sub-' + cat + '">' +
        '<img class="filter__icon" src="./assets/svg/' + ICONS[cat] + '.svg" alt="">' + ALC.cats[cat].label +
        '<img class="filter__chev" src="./assets/svg/chev-double.svg" alt=""></button>' +
        '<ul class="subfilters" id="sub-' + cat + '" hidden>' +
        Object.keys(ALC.tags).map(function (tag) {
          return '<li><button class="filter" type="button" data-tag="' + tag + '"><img class="filter__icon" src="./assets/svg/' + TAG_ICONS[tag] + '.svg" alt="">' + ALC.tags[tag] + '</button></li>';
        }).join('') +
        '</ul></li>';
    });
    filtersEl.innerHTML = html;

    filtersEl.addEventListener('click', function (e) {
      var b = e.target.closest('.filter');
      if (!b) return;
      if (b.dataset.cat) {
        var cat = b.dataset.cat;
        if (cat === state.cat && cat !== 'all') {
          // Second click on the active category folds its list
          setExpanded(expanded === cat ? null : cat);
          return;
        }
        state.cat = cat;
        state.tag = null;
        state.type = null;
        state.q = '';
        findInput.value = '';
        setExpanded(cat === 'all' ? null : cat);
      } else {
        var tag = b.dataset.tag;
        state.tag = state.tag === tag ? null : tag;
      }
      state.page = 1;
      update(true);
    });
  }

  function setExpanded(cat) {
    var prev = expanded;
    expanded = cat;
    $$('.filter[data-cat]', filtersEl).forEach(function (b) {
      var c = b.dataset.cat;
      if (c === 'all') return;
      var list = document.getElementById('sub-' + c);
      var open = c === cat;
      b.setAttribute('aria-expanded', String(open));
      if (open === !list.hidden) return;
      if (!Site.animate) { list.hidden = !open; return; }
      gsap.killTweensOf(list);
      if (open) {
        list.hidden = false;
        gsap.fromTo(list, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out' });
        gsap.fromTo(list.children, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
      } else if (prev === c) {
        gsap.to(list, { height: 0, duration: 0.4, ease: 'power3.inOut', onComplete: function () { list.hidden = true; gsap.set(list, { clearProps: 'height' }); } });
      } else {
        list.hidden = true;
      }
    });
  }

  function paintFilters() {
    $$('.filter[data-cat]', filtersEl).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat && !state.q));
    });
    $$('.subfilters', filtersEl).forEach(function (list) {
      var inCat = list.id === 'sub-' + state.cat;
      $$('.filter', list).forEach(function (b) {
        b.setAttribute('aria-pressed', String(inCat && b.dataset.tag === state.tag));
      });
    });
    $$('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === state.cat && !state.q) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Results ---------- */

  function results() {
    var q = state.q.toLowerCase();
    return ALC.products.filter(function (prod) {
      if (q) {
        var hay = (prod.name + ' ' + (prod.variant || '') + ' ' + prod.cat + ' ' + (prod.type || '')).toLowerCase();
        return q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
      }
      if (state.cat !== 'all' && prod.cat !== state.cat) return false;
      if (state.tag && prod.tags.indexOf(state.tag) < 0) return false;
      if (state.type && prod.type !== state.type) return false;
      return true;
    });
  }

  function statusText(n) {
    var parts = [];
    if (state.q) parts.push('Results for <strong>“' + Site.esc(state.q) + '”</strong>');
    else {
      parts.push('<strong>' + (state.cat === 'all' ? 'All products' : ALC.cats[state.cat].label) + '</strong>');
      if (state.type) parts.push(Site.esc(TYPE_LABELS[state.type] || state.type));
      if (state.tag) parts.push(ALC.tags[state.tag]);
    }
    var clear = state.q || state.tag || state.type ? '<button type="button" data-clear>Clear</button>' : '';
    return parts.join(' · ') + ' — ' + n + (n === 1 ? ' product' : ' products') + clear;
  }

  function emptyHtml() {
    var what = state.q ? '“' + Site.esc(state.q) + '”' : (TYPE_LABELS[state.type] || 'these filters').toLowerCase();
    return '<li class="shop-empty"><h2 class="display">Nothing here yet</h2>' +
      '<p>This demo store doesn’t stock ' + what + '. The catalogue has tees, shorts, supplements, shakers and bundles.</p>' +
      '<button class="btn btn--black" type="button" data-clear-all>See all products</button></li>';
  }

  function paintPager(pages) {
    pager.hidden = pages < 2;
    if (pages < 2) return;
    var list = [];
    for (var i = 1; i <= pages; i++) {
      if (pages <= 7 || i <= 3 || i > pages - 3 || i === state.page) list.push(i);
      else if (list[list.length - 1] !== '…') list.push('…');
    }
    pagesEl.innerHTML = list.map(function (i) {
      return i === '…' ? '<span aria-hidden="true">…</span>' :
        '<button type="button" data-page="' + i + '" aria-label="Page ' + i + '"' + (i === state.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
    }).join('');
    $('[data-page-prev]').disabled = state.page === 1;
    $('[data-page-next]').disabled = state.page === pages;
  }

  function writeUrl() {
    var u = new URLSearchParams();
    if (state.q) u.set('q', state.q);
    else {
      if (state.cat !== 'all') u.set('cat', state.cat);
      if (state.tag) u.set('tag', state.tag);
      if (state.type) u.set('type', state.type);
    }
    if (state.page > 1) u.set('page', state.page);
    if (Site.shot) u.set('shot', '');
    var s = u.toString();
    history.replaceState(null, '', 'shop.html' + (s ? '?' + s : ''));
  }

  function render() {
    var list = results();
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    state.page = Math.min(state.page, pages);
    var slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
    grid.innerHTML = slice.length ? slice.map(function (prod) { return Site.card(prod); }).join('') : emptyHtml();
    statusEl.innerHTML = statusText(list.length);
    $('[data-crumb]').textContent = state.q ? 'Search' : state.cat === 'all' ? 'All products' : ALC.cats[state.cat].label;
    paintPager(pages);
    paintFilters();
    writeUrl();
  }

  function enter(scroll) {
    if (!Site.animate) return;
    var cards = $$('[data-card], .shop-empty', grid);
    if (first) {
      gsap.from(cards, { opacity: 0, y: 60, duration: 1.1, stagger: 0.07, ease: 'expo.out', delay: 0.35 });
      gsap.from('.filters > li, .shop__bar', { opacity: 0, x: -20, duration: 0.9, stagger: 0.05, ease: 'expo.out', delay: 0.4 });
      return;
    }
    gsap.fromTo(cards, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.05, ease: 'expo.out', clearProps: 'transform' });
    if (scroll) {
      var top = $('.shop').getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > top + 200) Site.scrollTo(top);
    }
  }

  // Old cards drop out, new ones rise in
  function update(scroll) {
    if (!Site.animate) { render(); return; }
    var old = $$('[data-card], .shop-empty', grid);
    gsap.killTweensOf(old);
    gsap.to(old, {
      opacity: 0, y: -16, duration: 0.25, stagger: 0.015, ease: 'power2.in',
      onComplete: function () { render(); enter(scroll); ScrollTrigger.refresh(); },
    });
    if (!old.length) { render(); enter(scroll); }
  }

  /* ---------- Wiring ---------- */

  Site.ready(function () {
    buildFilters();
    findInput.value = state.q;
    if (expanded) {
      $('[data-cat="' + expanded + '"]', filtersEl).setAttribute('aria-expanded', 'true');
      document.getElementById('sub-' + expanded).hidden = false;
    }
    render();
    enter(false);
    first = false;

    $('[data-find]').addEventListener('submit', function (e) {
      e.preventDefault();
      state.q = findInput.value.trim();
      state.page = 1;
      if (state.q) setExpanded(null);
      update(false);
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-clear]')) {
        state.q = '';
        state.tag = null;
        state.type = null;
        findInput.value = '';
        state.page = 1;
        update(false);
      } else if (e.target.closest('[data-clear-all]')) {
        state = { cat: 'all', tag: null, type: null, q: '', page: 1 };
        findInput.value = '';
        setExpanded(null);
        update(true);
      }
    });

    pagesEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]');
      if (!b) return;
      state.page = +b.dataset.page;
      update(true);
    });
    $('[data-page-prev]').addEventListener('click', function () { state.page--; update(true); });
    $('[data-page-next]').addEventListener('click', function () { state.page++; update(true); });

    Site.mountRecs();
  });
})();
