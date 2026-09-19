gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Splits each matched line into a .line-mask (overflow hidden) wrapping
   a .line-inner span, preserving nested markup like <span class="italic">.
   Animate .line-inner's translateY (115% → 0%) to slide each line up out
   of its mask. Idempotent. Shared by all section-headline reveals and
   the Storytelling captions. */
function wrapLinesForReveal(root, lineSelector) {
  if (!root) return [];
  const lines = root.querySelectorAll(lineSelector);
  lines.forEach((line) => {
    if (line.querySelector(":scope > .line-mask")) return;
    const mask = document.createElement("span");
    mask.className = "line-mask";
    const inner = document.createElement("span");
    inner.className = "line-inner";
    inner.innerHTML = line.innerHTML;
    mask.appendChild(inner);
    line.innerHTML = "";
    line.appendChild(mask);
  });
  return Array.from(root.querySelectorAll(`${lineSelector} .line-inner`));
}

/* Same masking technique, split by word instead of by line — reproduces
   a GSAP SplitText effect without the paid plugin. Only safe for plain
   text (nested spans get discarded). */
function wrapWordsForReveal(root, selector) {
  if (!root) return [];
  const targets = root.querySelectorAll(selector);
  targets.forEach((el) => {
    if (el.querySelector(".word-mask")) return;
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((word) => `<span class="line-mask word-mask"><span class="line-inner">${word}</span></span>`)
      .join(" ");
  });
  return Array.from(root.querySelectorAll(`${selector} .line-inner`));
}

/* Splits every character inside `root` into its own .char-reveal span via
   a TreeWalker, so nested markup (e.g. .italic) keeps its own styling
   per-character. Idempotent. */
function wrapCharsForReveal(root) {
  if (!root) return [];
  if (root.querySelector(".char-reveal")) {
    return Array.from(root.querySelectorAll(".char-reveal"));
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.length) textNodes.push(node);
  }

  textNodes.forEach((textNode) => {
    const frag = document.createDocumentFragment();
    textNode.textContent.split("").forEach((ch) => {
      const span = document.createElement("span");
      span.className = "char-reveal";
      span.textContent = ch;
      frag.appendChild(span);
    });
    textNode.parentNode.replaceChild(frag, textNode);
  });

  return Array.from(root.querySelectorAll(".char-reveal"));
}

/* Sitewide pattern for scroll fade-in/out: ScrollTrigger
   toggleActions: "play reverse play reverse". Use this for anything that
   should reveal on enter and reverse on exit; use scrub only when the
   effect needs to track scroll distance continuously. */

/* LENIS SMOOTH SCROLL */
let lenis;
if (!prefersReduced) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* NAV */
(function nav() {
  const wrapper = document.getElementById("navWrapper");
  const logoMark = document.getElementById("logoMarkFixed");
  const burger = document.getElementById("burger");
  const links = document.getElementById("navLinks");

  window.addEventListener(
    "scroll",
    () => {
      const scrolled = window.scrollY > 10;
      wrapper.classList.toggle("scrolled", scrolled);
      if (logoMark) logoMark.classList.toggle("scrolled", scrolled);
    },
    { passive: true }
  );

  burger.addEventListener("click", () => {
    burger.classList.toggle("active");
    links.classList.toggle("open");
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const targetEl = document.querySelector(a.getAttribute("href"));
      if (!targetEl) return;
      e.preventDefault();
      burger.classList.remove("active");
      links.classList.remove("open");
      gsap.to(window, {
        duration: 1.2,
        scrollTo: { y: targetEl, autoKill: true },
        ease: "power3.out",
      });
    });
  });
})();

/* HERO */
(function hero() {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // Per-word masked reveal (see wrapWordsForReveal, top of file).
  const titleWords = wrapWordsForReveal(document.querySelector(".hero-title"), ".title-line");
  gsap.set(titleWords, { yPercent: 115 });

  tl.to(titleWords, { yPercent: 0, duration: 0.85, stagger: 0.07, ease: "power3.out" })
    .from(".hero-portrait", { opacity: 0, y: 24, duration: 1 }, "-=0.6")
    .from(".philosophy span", { opacity: 0, y: 14, duration: 0.6, stagger: 0.15 }, "-=0.7")
    .from(".hero-socials", { opacity: 0, y: 14, duration: 0.6 }, "-=0.6")
    .from(".hero-ctas", { opacity: 0, y: 14, duration: 0.6 }, "-=0.5")
    .from(".orbit-system", { opacity: 0, duration: 1.2 }, "-=1");

  // Orbit is static now (no mouse parallax) — entrance fade only, handled above.

  gsap.to(".hero-container", {
    opacity: 0,
    scale: 0.94,
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
})();

/* MAGNETIC BUTTONS — social icons + hero CTA subtly pull toward the
   cursor within their .magnetic wrapper (see the hit-zone comment in
   style.css). Adapted from a GSAP v2 (TweenMax) codepen reference to
   GSAP 3 syntax. Uses mouseleave, not the reference's mouseout — mouseout
   bubbles from the nested <a>/<img>, which would reset the pull the
   moment the cursor crosses onto the link itself instead of only on a
   genuine exit. Skipped for touch devices (no real hover) and reduced
   motion. */
(function magneticButtons() {
  if (prefersReduced || !window.matchMedia("(pointer: fine)").matches) return;

  const strength = 25;

  gsap.utils.toArray(".magnetic").forEach((magnet) => {
    magnet.addEventListener("mousemove", (e) => {
      const bounds = magnet.getBoundingClientRect();
      gsap.to(magnet, {
        x: ((e.clientX - bounds.left) / magnet.offsetWidth - 0.5) * strength,
        y: ((e.clientY - bounds.top) / magnet.offsetHeight - 0.5) * strength,
        duration: 1,
        ease: "power4.out",
      });
    });

    magnet.addEventListener("mouseleave", () => {
      gsap.to(magnet, { x: 0, y: 0, duration: 1, ease: "power4.out" });
    });
  });
})();

/* HERO PORTRAIT — cycles through all portraits every 2s while hovered, resets on leave */
(function heroPortraitCycler() {
  const wrap = document.getElementById("heroPortrait");
  const img = document.getElementById("heroPortraitImg");
  if (!wrap || !img) return;

  const TOTAL = 15;
  const portraits = Array.from(
    { length: TOTAL },
    (_, i) => `assets/hero_portraits/img_hero ${i + 1}.webp`
  );

  let index = 0;
  let timer = null;

  wrap.addEventListener("mouseenter", () => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    index = 0;
    timer = setInterval(() => {
      index = (index + 1) % portraits.length;
      img.src = portraits[index];
    }, 100);
  });

  wrap.addEventListener("mouseleave", () => {
    clearInterval(timer);
    index = 0;
    img.src = portraits[0];
  });
})();

/* ABOUT */
(function about() {
  gsap.from(".about-intro", {
    opacity: 0, y: 20, duration: 0.7, ease: "power2.out",
    scrollTrigger: { trigger: ".about", start: "top 70%", toggleActions: "play reverse play reverse" },
  });

  gsap.from(".about-paragraph", {
    opacity: 0, y: 16, duration: 0.7, stagger: 0.15, ease: "power2.out",
    scrollTrigger: { trigger: ".about-left", start: "top 70%", toggleActions: "play reverse play reverse" },
  });

  // About's headline reveal lives in the shared lineReveal() module below.

  gsap.utils.toArray(".about-photo").forEach((el, i) => {
    gsap.fromTo(
      el,
      { clipPath: "inset(0% 100% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1,
        delay: 0.25 + i * 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play reverse play reverse",
        },
      }
    );
  });

  const decor = document.getElementById("aboutDecor");
  if (decor) {
    gsap.to(decor, {
      yPercent: 15,
      ease: "none",
      scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: true },
    });
  }
})();

/* SELECTED WORKS
   Continuous-scroll parallax, adapted from a GSAP "parallax with wiping
   titles" reference — not pinned, no snapping. Each .works-slide scrubs
   its own background and title block independently as it passes through
   the viewport: background moves at roughly half the scroll rate (classic
   parallax depth), the title block moves at 2x rate in the opposite
   direction (the "wipe"). getRatio() is the reference's own formula for
   how far a slide's background should travel relative to its own height
   vs. the viewport height — works for any slide height, not just 100vh. */
(function worksParallax() {
  const slides = gsap.utils.toArray(".works-slide");
  if (!slides.length) return;

  // Label ("Selected Works") and the View Project link stay pinned for
  // the entire time you're scrolling through the works slides, instead
  // of scrolling away with each individual slide. pinSpacing:false is
  // required here — the tall scrollable range already comes from
  // .works-slides itself; without this, ScrollTrigger's default pin
  // behavior would insert an *additional* 100vh spacer on top of that.
  const worksSection = document.querySelector(".works");
  const fixedOverlay = document.querySelector(".works-fixed-overlay");
  if (worksSection && fixedOverlay) {
    ScrollTrigger.create({
      trigger: worksSection,
      start: "top top",
      end: "bottom top",
      pin: fixedOverlay,
      pinSpacing: false,
    });
  }

  const getRatio = (el) => window.innerHeight / (window.innerHeight + el.offsetHeight);

  // Clip-path entrance reveal — first slide only, confined to the scroll
  // distance of Works arriving into view (its top going from the bottom
  // of the viewport to the top). Once that's done, normal scrolling
  // through the 3 slides behaves exactly as it already did — this never
  // fires again for slides 2/3, and only reverses if scrolled back up
  // past the boundary, same reversible convention as the rest of the
  // site. Chosen over the transform-scale alternative for a crisper,
  // non-distorted reveal — see the demo this was compared against.
  const firstSlideBg = document.getElementById("worksSlideBgFirst");
  const firstSlideScrim = document.getElementById("worksSlideScrimFirst");
  if (firstSlideBg && !prefersReduced) {
    const entranceTargets = [firstSlideBg, firstSlideScrim].filter(Boolean);
    gsap.set(entranceTargets, { clipPath: "inset(30vh 32vw round 20px)" });
    gsap.to(entranceTargets, {
      clipPath: "inset(0vh 0vw round 0px)",
      ease: "none",
      scrollTrigger: {
        trigger: worksSection,
        start: "top bottom",
        end: "top top",
        scrub: 1,
      },
    });
  }

  if (prefersReduced) {
    return;
  }

  slides.forEach((slide, i) => {
    const bg = slide.querySelector(".works-slide-bg");
    const content = slide.querySelector(".works-center");
    const scrollConfig = {
      trigger: slide,
      start: () => (i ? "top bottom" : "top top"),
      end: "bottom top",
      scrub: true,
      invalidateOnRefresh: true,
    };

    if (bg) {
      gsap.fromTo(
        bg,
        { y: () => (i ? -window.innerHeight * getRatio(slide) : 0) },
        {
          y: () => window.innerHeight * (1 - getRatio(slide)),
          ease: "none",
          scrollTrigger: scrollConfig,
        }
      );
    }

    if (content) {
      gsap.fromTo(
        content,
        { y: () => (i ? window.innerHeight * -getRatio(slide) * 2 : 0) },
        {
          y: () => window.innerHeight * getRatio(slide) * 2,
          ease: "none",
          scrollTrigger: scrollConfig,
        }
      );
    }
  });
})();

/* GLOBAL CURSOR (Curzr "Big Circle")
   mousemove only, no enter/leave — DOM churn elsewhere (e.g. Works
   swapping images under the cursor) can otherwise make it disappear. */
(function globalCursor() {
  const cursor = document.getElementById("siteCursor");
  const label = document.getElementById("cursorLabel");
  if (!cursor) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const circle = cursor.querySelector(".circle");
  const dot = cursor.querySelector(".dot");
  let hovering = false;
  let shown = false;

  window.addEventListener("mousemove", (e) => {
    if (!shown) {
      shown = true;
      cursor.hidden = false;
      requestAnimationFrame(() => cursor.classList.add("active"));
    }

    circle.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)${hovering ? " scale(2.5)" : ""}`;
    dot.style.transform = `translate3d(calc(-50% + ${e.clientX}px), calc(-50% + ${e.clientY}px), 0)`;

    const target = e.target.closest(".curzr-hover");
    hovering = !!target;

    if (label) {
      const labeled = e.target.closest("[data-cursor-label]");
      if (labeled) {
        label.textContent = labeled.getAttribute("data-cursor-label");
        label.classList.add("active");
        label.style.left = `${e.clientX}px`;
        label.style.top = `${e.clientY}px`;
      } else {
        label.classList.remove("active");
      }
    }
  });

  window.addEventListener("mouseleave", () => cursor.classList.remove("active"));
  window.addEventListener("mouseenter", () => shown && cursor.classList.add("active"));
})();

/* MY APPROACH — hover rows + cursor preview */
(function approach() {
  // Approach's headline reveal lives in the shared lineReveal() module below.

  gsap.from(".approach-row", {
    opacity: 0, y: 20, duration: 0.7, stagger: 0.12, ease: "power2.out",
    scrollTrigger: { trigger: ".approach", start: "top 60%", toggleActions: "play reverse play reverse" },
  });

  const section = document.querySelector(".approach");
  const preview = document.getElementById("approachPreview");
  const previewImg = document.getElementById("approachPreviewImg");
  const rows = document.querySelectorAll(".approach-row");

  // gsap.quickTo — one reusable tween function, cheaper than creating a
  // new tween on every mousemove.
  const previewX = gsap.quickTo(preview, "x", { duration: 0.5, ease: "power3.out" });
  const previewY = gsap.quickTo(preview, "y", { duration: 0.5, ease: "power3.out" });

  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => {
      row.classList.add("active");
      const img = row.getAttribute("data-image");
      if (img) previewImg.src = img;

      // Box settles in; image separately de-zooms from 1.4 down to 1.
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" });
      gsap.fromTo(previewImg, { scale: 1.4 }, { scale: 1, duration: 0.4, ease: "power2.out" });
    });
    row.addEventListener("mouseleave", () => {
      row.classList.remove("active");
      gsap.to(preview, { opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.out" });
    });
  });

  section.addEventListener("mousemove", (e) => {
    previewX(e.clientX);
    previewY(e.clientY);
  });

  // .curzr-hover is deliberately absent from .approach-row — the
  // enlarged cursor circle would overlap this floating preview box.

  // Approach uses the same scroll-out language as the Hero: its content
  // gently fades and scales down as the next section takes over.
  gsap.to([section.querySelector(".approach-headline"), section.querySelector(".approach-rows")], {
    opacity: 0,
    scale: 0.94,
    transformOrigin: "50% 50%",
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "bottom bottom",
      end: "bottom top",
      scrub: true,
    },
  });
})();

/* PORTFOLIO WEBSITE SERVICES
   Hovered card stays crisp and lifts; siblings blur + dim; hovered image
   shifts opposite the pointer and scales up, resetting on mouse-leave. */
(function services() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".service-card"));
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  // Cards rise from below into place, scrubbed (not pinned) to the
  // section's own scroll — enough for a staggered fly-in feel without
  // scroll-jacking. scrub also gives reverse-on-scroll-up for free.
  if (prefersReduced) {
    gsap.set(cards, { opacity: 1, y: 0, scale: 1 });
  } else {
    gsap.set(cards, { opacity: 0, y: 70, scale: 0.88 });
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      stagger: 0.18,
      ease: "power2.out",
      scrollTrigger: {
        trigger: grid,
        start: "top 80%",
        end: "top 25%",
        scrub: 0.8,
      },
    });
  }

  cards.forEach((card) => {
    const media = card.querySelector(".service-media");
    const image = card.querySelector(".service-media img");
    if (!media || !image) return;

    let moveX = null;
    let moveY = null;

    if (finePointer) {
      moveX = gsap.quickTo(image, "x", {
        duration: 0.55,
        ease: "power3.out",
      });
      moveY = gsap.quickTo(image, "y", {
        duration: 0.55,
        ease: "power3.out",
      });

      card.addEventListener("mousemove", (e) => {
        const rect = media.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;

        // Move opposite the pointer, kept deliberately restrained.
        moveX(-px * 14);
        moveY(-py * 10);

        gsap.to(image, {
          scale: 1.045,
          duration: 0.55,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    }

    card.addEventListener("mouseenter", () => {
      grid.classList.add("hovering");
      card.classList.add("active");

      if (finePointer) {
        gsap.to(image, {
          scale: 1.045,
          duration: 0.55,
          ease: "power3.out",
          overwrite: "auto",
        });
      }
    });

    card.addEventListener("mouseleave", () => {
      card.classList.remove("active");
      grid.classList.remove("hovering");

      gsap.to(image, {
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "power3.out",
        overwrite: "auto",
      });
    });
  });
})();

/* Heading starts at 50% opacity; per-character reveal sweeps to full
   color left-to-right as the section scrolls. "portfolio website" and
   "you." reveal to green, everything else to gray — see the color
   function below. Uses wrapCharsForReveal so nested markup keeps its
   own styling per character. */
(function servicesColorReveal() {
  const wrap = document.getElementById("servicesBottomHeading");
  const heading = wrap ? wrap.querySelector(".color-reveal-base") : null;
  if (!heading) return;

  const chars = wrapCharsForReveal(heading);
  if (!chars.length) return;

  if (prefersReduced) {
    gsap.set(chars, { opacity: 1 });
    gsap.set(chars, {
      color: (i, target) => (target.closest(".italic, .highlight-green") ? "#0fb12a" : "#141918"),
    });
    return;
  }

  gsap.set(chars, { color: "#d7dede" });
  gsap.to(chars, {
  color: (i, target) => (target.closest(".italic, .highlight-green") ? "#0FB12A" : "#7B7F7B"),
  stagger: { each: 0.02, from: "start" },
  ease: "none",
  scrollTrigger: {
    trigger: wrap,
    start: "top 90%",
    end: "top 8%",
    scrub: 0.6,
  },
});
})();

/* Services entrance reveals use the site's "play reverse play reverse"
   toggleActions pattern — reuse it for similar reveal/fade requests. */

/* SCROLL-SCRUB STORYTELLING
   The wireframe illustration draws itself in (stroke-dashoffset per
   element, staggered across ILLUSTRATION_STEPS) as the heading is still
   visible; heading fades out at the midpoint; each caption is a one-time
   reveal at its own threshold in CAPTION_THRESHOLDS and stays visible
   once shown (reversible if you scroll back up past it). The
   Storytelling → CTA handoff is a plain pin-release, not parallax —
   don't add depth layers here. */
/* STORYTELLING STAR FIELD
   Deliberately independent of the scroll-scrub below — this only
   generates the stars once; all their motion (twinkle + drift) is pure
   CSS animation (see .story-star / .storytelling-stars in style.css),
   so it keeps running continuously regardless of scroll position, pin
   state, or whether storytelling()'s ScrollTrigger has even fired yet. */
(function storytellingStars() {
  const field = document.getElementById("storytellingStars");
  if (!field || prefersReduced) return;

  const STAR_COUNT = 90;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("span");
    star.className = "story-star";
    const size = (Math.random() * 1.8 + 0.6).toFixed(2);
    const twinkleDuration = (Math.random() * 3 + 2).toFixed(2);
    const twinkleDelay = (Math.random() * 4).toFixed(2);
    const minOpacity = (Math.random() * 0.2 + 0.05).toFixed(2);
    const maxOpacity = (Math.random() * 0.4 + 0.5).toFixed(2);
    // Each star floats its own small distance in its own random direction
    // — this, plus a randomized duration/delay per star, is what makes
    // 90 stars read as independently drifting rather than one uniform
    // sheet moving in lockstep.
    const floatDuration = (Math.random() * 12 + 8).toFixed(2);
    const floatDelay = (Math.random() * 8).toFixed(2);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 18 + 8;
    const starX = (Math.cos(angle) * distance).toFixed(1);
    const starY = (Math.sin(angle) * distance).toFixed(1);
    star.style.cssText = `
      top: ${(Math.random() * 100).toFixed(2)}%;
      left: ${(Math.random() * 100).toFixed(2)}%;
      width: ${size}px;
      height: ${size}px;
      animation-duration: ${twinkleDuration}s, ${floatDuration}s;
      animation-delay: -${twinkleDelay}s, -${floatDelay}s;
      --star-min: ${minOpacity};
      --star-max: ${maxOpacity};
      --star-x: ${starX}px;
      --star-y: ${starY}px;
    `;
    frag.appendChild(star);
  }

  field.appendChild(frag);
})();

(function storytelling() {
  const section = document.getElementById("storytelling");
  const illustration = document.getElementById("storytellingIllustration");
  if (!section || !illustration) return;

  const heading = document.getElementById("storytellingHeading");
  const captions = [
    document.getElementById("storyCaption1"),
    document.getElementById("storyCaption2"),
    document.getElementById("storyCaption3"),
  ].filter(Boolean);

  // Each drawable element gets its own [start, end] slice of the overall
  // 0–1 scroll progress. getTotalLength() works on <rect>, <line>, and
  // <circle> in modern browsers (SVGGeometryElement), not just <path>.
  const ILLUSTRATION_STEPS = [
    { el: document.getElementById("wfFrame"), start: 0.0, end: 0.08 },
    { el: document.getElementById("wfChromeLine"), start: 0.05, end: 0.11 },
    { el: document.getElementById("wfAddressBar"), start: 0.07, end: 0.12 },
    { el: document.getElementById("wfNavLine"), start: 0.12, end: 0.16 },
    { el: document.getElementById("wfHero"), start: 0.14, end: 0.22 },
    { el: document.getElementById("wfButton"), start: 0.32, end: 0.38 },
  ];
  document.querySelectorAll(".wf-text-line").forEach((el, i) => {
    ILLUSTRATION_STEPS.push({ el, start: 0.2 + i * 0.025, end: 0.27 + i * 0.025 });
  });
  document.querySelectorAll(".wf-card").forEach((el, i) => {
    ILLUSTRATION_STEPS.push({ el, start: 0.26 + i * 0.025, end: 0.33 + i * 0.025 });
  });

  const drawables = ILLUSTRATION_STEPS.filter((s) => s.el && typeof s.el.getTotalLength === "function").map(
    (s) => ({ ...s, length: s.el.getTotalLength() })
  );
  drawables.forEach(({ el, length }) => {
    el.style.strokeDasharray = length;
    el.style.strokeDashoffset = length;
  });

  // Traffic-light dots are small/decorative — a plain opacity fade reads
  // just as well as a stroke-draw.
  const dots = Array.from(document.querySelectorAll(".wf-dot"));
  gsap.set(dots, { opacity: 0 });
  const DOTS_RANGE = [0.09, 0.13];
  const ILLUSTRATION_RECEDE_RANGE = [0.55, 0.68];

  // Reduced motion: skip the pin/scrub entirely — show the finished
  // illustration with the heading already gone (its job is done by the
  // midpoint regardless) and all three captions settled visible.
  if (prefersReduced) {
    section.style.setProperty("--story-bg", "#182420");
    drawables.forEach(({ el }) => { el.style.strokeDashoffset = 0; });
    gsap.set(dots, { opacity: 1 });
    gsap.set(illustration, { opacity: 0.25 });
    if (heading) gsap.set(heading, { opacity: 0 });
    captions.forEach((cap) => {
      const lines = wrapLinesForReveal(cap, ".caption-line");
      gsap.set(lines, { y: "0%" });
      gsap.set(cap, { opacity: 1 });
    });
    return;
  }

  // Heading exit is the reveal technique inverted: lines slide back down
  // into their mask instead of up out of it, with a small per-line offset.
  const headingLines = heading ? wrapLinesForReveal(heading, ".headline-line") : [];
  if (heading) gsap.set(headingLines, { yPercent: 0 });

  const captionLines = captions.map((cap) => wrapLinesForReveal(cap, ".caption-line"));
  captions.forEach((cap, i) => {
    gsap.set(cap, { opacity: 0 });
    gsap.set(captionLines[i], { y: "115%" });
    const desc = cap.querySelector(".story-caption-desc");
    if (desc) gsap.set(desc, { opacity: 0 });
  });

  function revealCaption(i) {
    const cap = captions[i];
    const desc = cap.querySelector(".story-caption-desc");
    gsap.to(cap, { opacity: 1, duration: 0.3, ease: "power1.out" });
    gsap.to(captionLines[i], {
      y: "0%",
      duration: 0.7,
      stagger: 0.08,
      ease: "power3.out",
    });
    if (desc) gsap.to(desc, { opacity: 1, duration: 0.5, delay: 0.2, ease: "power1.out" });
  }

  function hideCaption(i) {
    const cap = captions[i];
    const desc = cap.querySelector(".story-caption-desc");
    gsap.to(cap, { opacity: 0, duration: 0.25, ease: "power1.in" });
    gsap.to(captionLines[i], { y: "115%", duration: 0.4, ease: "power2.in" });
    if (desc) gsap.to(desc, { opacity: 0, duration: 0.2, ease: "power1.in" });
  }

  const HEADING_OUT_START = 0.35;
  const HEADING_OUT_END = 0.58;
  const CAPTION_THRESHOLDS = [0.45, 0.45, 0.45];
  const shown = captions.map(() => false);

  function rangeProgress(progress, start, end) {
    return gsap.utils.clamp(0, 1, (progress - start) / (end - start));
  }

  function buildTimeline() {
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=250%",
      pin: "#storyPin",
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const progress = self.progress;

        // Background mood shift across the whole section — dark toward a
        // subtly greener dark tone, echoing "raw" → "refined." This is
        // the one piece of the illustration tied to scroll; the star
        // field behind it is deliberately not.
        section.style.setProperty("--story-bg", gsap.utils.interpolate("#141918", "#182420", progress));

        drawables.forEach(({ el, length, start, end }) => {
          el.style.strokeDashoffset = length * (1 - rangeProgress(progress, start, end));
        });
        gsap.set(dots, { opacity: rangeProgress(progress, DOTS_RANGE[0], DOTS_RANGE[1]) });

        // Once the build finishes and the heading is gone, the wireframe
        // recedes to a faint backdrop rather than fighting the captions
        // for visual space — its job (showing HOW) is done, the captions
        // take over (explaining WHY it matters).
        const receedT = rangeProgress(progress, ILLUSTRATION_RECEDE_RANGE[0], ILLUSTRATION_RECEDE_RANGE[1]);
        gsap.set(illustration, { opacity: 1 - receedT * 0.75 });

        if (headingLines.length) {
          headingLines.forEach((line, i) => {
            // Small per-line offset (0.02 of the fade range each) so the
            // two lines don't move in perfect lockstep.
            const localStart = HEADING_OUT_START + i * 0.02;
            const localEnd = HEADING_OUT_END + i * 0.02;
            const visible = gsap.utils.clamp(
              0,
              1,
              1 - (progress - localStart) / (localEnd - localStart)
            );
            gsap.set(line, { yPercent: (1 - visible) * -115 });
          });
        }

        CAPTION_THRESHOLDS.forEach((threshold, i) => {
          const shouldShow = progress >= threshold;
          if (shouldShow && !shown[i]) {
            shown[i] = true;
            revealCaption(i);
          } else if (!shouldShow && shown[i]) {
            shown[i] = false;
            hideCaption(i);
          }
        });
      },
    });

    return trigger;
  }

  // matchMedia keeps desktop and mobile configs cleanly separate and lets
  // GSAP tear down/rebuild automatically on breakpoint changes — currently
  // both breakpoints run the same setup, scaffolding for future
  // mobile-specific tuning rather than an active difference today.
  ScrollTrigger.matchMedia({
    "(min-width: 601px)": buildTimeline,
    "(max-width: 600px)": buildTimeline,
  });
})();

/* CTA */
(function cta() {
  const tl = gsap.timeline({
    scrollTrigger: { trigger: ".cta", start: "top 60%", toggleActions: "play reverse play reverse" },
    defaults: { ease: "power2.out" },
  });

  // cta-headline's reveal lives in the shared lineReveal() module below
  // (masked per-line slide instead of a plain fade) — see that IIFE.
  tl.from(".cta-rect", { opacity: 0, scale: 0.6, stagger: 0.15, duration: 1 })
    .from(".cta-sub", { opacity: 0, y: 14, duration: 0.6 }, "-=0.5")
    .from(".cta-bar", { opacity: 0, y: 14, duration: 0.6 }, "-=0.4");
})();

/* SECTION HEADLINE REVEALS — masked line slide (wrapLinesForReveal) on
   each main headline. Don't add a second reveal for these elsewhere. */
(function lineReveal() {
  const targets = [
    { el: document.querySelector(".about-headline"), start: "top 70%" },
    { el: document.querySelector(".services-headline"), start: "top 75%" },
    { el: document.querySelector(".approach-headline"), start: "top 70%" },
    { el: document.querySelector(".cta-headline"), start: "top 65%" },
  ].filter((t) => t.el);

  targets.forEach(({ el, start }) => {
    const lines = wrapLinesForReveal(el, ".headline-line");
    if (!lines.length) return;

    if (prefersReduced) {
      gsap.set(lines, { y: "0%" });
      return;
    }

    gsap.set(lines, { y: "115%" });
    gsap.to(lines, {
      y: "0%",
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start,
        toggleActions: "play reverse play reverse",
      },
    });
  });
})();

/* FOOTER */
(function footer() {
  gsap.from(".footer-socials-top a", {
    opacity: 0,
    y: -12,
    duration: 0.6,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".footer",
      start: "top 85%",
      toggleActions: "play reverse play reverse",
    },
  });

  // "Jayson" slides in from the left, "Alegarbes" slides in from the right,
  // both settling into their normal flush left/right position. This uses
  // scrub (not toggleActions) so the movement is directly tied to scroll
  // position/amount as you scroll — not a one-shot play/reverse triggered
  // by crossing a threshold.
  gsap.fromTo(
    "#footerNameLeft",
    { xPercent: -100 },
    {
      xPercent: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".footer",
        start: "top bottom",
        end: "top 30%",
        scrub: 0.5,
      },
    }
  );

  gsap.fromTo(
    "#footerNameRight",
    { xPercent: 100 },
    {
      xPercent: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".footer",
        start: "top bottom",
        end: "top 30%",
        scrub: 0.5,
      },
    }
  );

  gsap.from(".footer-bottom", {
    opacity: 0,
    y: 12,
    duration: 0.6,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".footer",
      start: "top 40%",
      toggleActions: "play reverse play reverse",
    },
  });

  document.getElementById("backToTop").addEventListener("click", () => {
    gsap.to(window, { duration: 1.2, scrollTo: { y: 0 }, ease: "power3.out" });
  });
})();
