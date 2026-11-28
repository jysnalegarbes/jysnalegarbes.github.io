/*
  Alchemist demo catalogue. Every page reads products from here, so the
  shop, product page, cart and checkout always agree.

  fit = how the photo sits in the square grey tile (css/style.css + pages.css):
    shirt, shorts, hat, tall = cut-outs placed like the Figma frame
    square = a square packshot that fills the tile
    cover  = a photo/poster with its own background (no multiply)
    r1, portrait = one-off placements
  Prices follow the design (P320 for single items). Where the design shows a
  struck-out price next to "-20%", the old price is P400 (the design repeated
  P320 there by mistake). Bundle prices are placeholders.
*/
(function () {
  'use strict';

  var P = [
    // ---------- Sportswear ----------
    {
      id: 'brave-red', name: 'T-Shirt Brave Always', variant: 'Red', cat: 'sportswear', type: 'tshirt',
      price: 320, was: 400, img: 'tee-red', fit: 'shirt', tags: ['discount', 'best'], sizes: true,
      // Full gallery from the product page design (index 0 = the cut-out on grey)
      gallery: [
        { src: 'pdp-main', alt: 'T-Shirt Brave Always in red, front and back' },
        { src: 'pdp-red', alt: 'Red Brave Always tee on the printed product card' },
        { src: 'pdp-model-1', alt: 'Model wearing the red tee, front' },
        { src: 'pdp-model-2', alt: 'Model wearing the red tee, back print' },
        { src: 'pdp-model-3', alt: 'Model wearing the red tee, arms crossed' },
      ],
      colors: [
        { name: 'Blue', src: 'pdp-blue' },
        { name: 'Red', src: 'pdp-red', current: true },
        { name: 'Black', src: 'pdp-black' },
        { name: 'White', src: 'pdp-white' },
        { name: 'Olive', src: 'pdp-olive' },
      ],
    },
    { id: 'brave-green', name: 'T-Shirt Brave Always', variant: 'Green', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-green', fit: 'shirt', tags: ['new'], sizes: true },
    { id: 'brave-gray', name: 'T-Shirt Brave Always', variant: 'Charcoal', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-gray', fit: 'shirt', tags: ['best'], sizes: true },
    { id: 'shorts-tan', name: 'Alchemist Dri Fit Short', variant: 'Khaki', cat: 'sportswear', type: 'shorts', price: 320, img: 'shorts-tan', thumb: 'shorts-khaki', fit: 'shorts', tags: ['new'], sizes: true },
    { id: 'shorts-brown', name: 'Alchemist Dri Fit Short', variant: 'Brown', cat: 'sportswear', type: 'shorts', price: 320, was: 400, img: 'shorts-brown', fit: 'shorts', tags: ['discount'], sizes: true },
    { id: 'brave-olive', name: 'T-Shirt Brave Always', variant: 'Olive', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-olive', fit: 'shirt', tags: ['new'], sizes: true },
    { id: 'brave-purple', name: 'T-Shirt Brave Always', variant: 'Purple', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-purple', fit: 'shirt', tags: [], sizes: true },
    { id: 'brave-teal', name: 'T-Shirt Brave Always', variant: 'Teal', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-teal', fit: 'shirt', tags: ['best'], sizes: true },
    { id: 'brave-maroon', name: 'T-Shirt Brave Always', variant: 'Maroon', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-maroon', fit: 'shirt', tags: [], sizes: true },
    { id: 'shatter-tee', name: 'Alchemist Shatter Your Limits T-Shirt', variant: 'Grey', cat: 'sportswear', type: 'tshirt', price: 320, img: 'tee-shatter', fit: 'cover', tags: ['new', 'best'], sizes: true },
    { id: 'shorts-blush', name: 'Alchemist Dri Fit Short', variant: 'Blush', cat: 'sportswear', type: 'shorts', price: 320, img: 'shorts-2', fit: 'shorts', tags: [], sizes: true },

    // ---------- Supplements ----------
    { id: 'a1-creatine', name: 'A1 Creatine Monohydrate', cat: 'supplements', price: 320, img: 'sup-1', fit: 'square', tags: ['best'] },
    { id: 'a1-benchmark', name: 'A1 Benchmark Whey Protein Blend', cat: 'supplements', price: 320, img: 'sup-2', fit: 'square', tags: ['best'] },
    { id: 'a1-mass', name: 'A1 Mass Gainer', cat: 'supplements', price: 320, img: 'sup-3', fit: 'square', tags: ['new'] },
    { id: 'a1-isolate', name: 'A1 Protein Whey Isolate Hydrolyze Whey Protein Isolate', cat: 'supplements', price: 320, was: 400, img: 'rec-isolate', fit: 'square', tags: ['discount'] },
    { id: 'r1-blend', name: 'Rule 1 R1 Protein Blend', cat: 'supplements', price: 320, img: 'rec-r1', fit: 'r1', tags: ['best'] },
    { id: 'wake-grape', name: '(WAKE) Pre-Workout Grape Wave', cat: 'supplements', price: 320, img: 'wake-grape', fit: 'cover', tags: ['new'] },
    { id: 'prothin-whey', name: '(PROTHIN) Whey Ripped', cat: 'supplements', price: 320, img: 'prothin-whey', fit: 'portrait', tags: ['discount'] },

    // ---------- Accessories ----------
    { id: 'trucker-hat', name: 'Alchemist Trucker Hat', cat: 'accessories', price: 320, img: 'acc-1', fit: 'hat', tags: ['new', 'best'] },
    { id: 'shaker-gold', name: 'A1 Protein Shaker, Gold', cat: 'accessories', price: 320, img: 'acc-2', fit: 'tall', tags: [] },
    { id: 'shaker-red', name: 'A1 Protein Shaker, Red', cat: 'accessories', price: 320, was: 400, img: 'acc-3', fit: 'tall', tags: ['discount'] },
    { id: 'alchemist-shaker', name: 'Alchemist Sports Cup Plastic Tumbler', cat: 'accessories', price: 320, img: 'acc-4', fit: 'tall', tags: ['best'] },

    // ---------- Bundles ----------
    { id: 'bundle-whey', name: 'Whey Protein Bundle + Free Shaker', cat: 'bundles', price: 1280, img: 'bundle-1', fit: 'cover', tags: ['best'] },
    { id: 'bundle-deals', name: 'Bundle Deals: Whey, Creatine & Pre-Workout', cat: 'bundles', price: 1280, img: 'bundle-2', fit: 'cover', tags: ['new'] },
    { id: 'bundle-preworkout', name: 'Pre-Workout & Creatine Bundle', cat: 'bundles', price: 1280, was: 1600, img: 'bundle-3', fit: 'cover', tags: ['discount'] },
    { id: 'bundle-insane', name: 'Insane Labz Whey Bundle', cat: 'bundles', price: 1280, img: 'bundle-4', fit: 'cover', tags: [] },
  ];

  var CATS = {
    sportswear: { label: 'Sportswear', pill: 'Sportswear' },
    supplements: { label: 'Supplements', pill: 'Supplement' },
    accessories: { label: 'Accessories', pill: 'Accessories' },
    bundles: { label: 'Bundles', pill: 'Bundle' },
  };

  var TAGS = { new: 'New Arrivals', best: 'Best Seller', discount: 'On Discount' };

  var byId = {};
  P.forEach(function (p) { byId[p.id] = p; });

  window.ALC = {
    products: P,
    cats: CATS,
    tags: TAGS,
    get: function (id) { return byId[id] || null; },
    // The cart a first-time visitor sees: the four items in the Cart design
    seed: [
      { id: 'shorts-tan', qty: 1, size: 'M' },
      { id: 'wake-grape', qty: 1 },
      { id: 'shatter-tee', qty: 1, size: 'L' },
      { id: 'prothin-whey', qty: 1 },
    ],
    // "Explore our recommendations" (the design's four, then more to scroll)
    recs: ['a1-isolate', 'trucker-hat', 'r1-blend', 'alchemist-shaker', 'a1-creatine', 'brave-teal', 'wake-grape', 'shaker-gold'],
  };
})();
