gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =========================
   REVEAL UTILITY: MASKED LINE SLIDE
   Wraps each element matching `lineSelector` inside `root` with a
   .line-mask (overflow hidden) containing a .line-inner span, moving the
   line's existing content (including any nested <span class="italic">
   etc.) into that inner span untouched. Returns the .line-inner elements
   so callers can animate them directly — usually translateY from 115% to
   0%, which reads as each line sliding up out of a mask rather than a
   plain fade.

   Idempotent: skips a line that's already wrapped, so this is safe to
   call more than once on the same element.

   Shared by the four section-headline reveals (About/Services/Approach/
   CTA) and the Storytelling captions — same technique, different trigger
   logic per caller.
========================= */
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

/* =========================
   REVEAL UTILITY: MASKED WORD SLIDE
   Same masking technique as wrapLinesForReveal above, but splits each
   matched element's plain text into individual words instead of treating
   the whole element as one line — adapted from a GSAP SplitText codepen
   reference (SplitText is a paid Club GreenSock plugin; this reproduces
   the same masked per-word slide using plain DOM wrapping instead).
   Only safe for elements containing plain text with no nested markup
   (e.g. "VISUAL DESIGNER") — nested spans would be discarded.
========================= */
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

/* =========================
   REVEAL UTILITY: PER-CHARACTER OPACITY SPLIT
   Splits every character inside `root` into its own <span class=
   "char-reveal">, by walking text nodes with a TreeWalker rather than
   flattening root.textContent — this means nested markup (e.g. the
   <span class="italic"> phrase inside a heading) keeps its own styling
   per-character instead of being discarded, since each text node is
   replaced in place within its real parent. Idempotent.
========================= */
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

/* =========================
   SITEWIDE MOTION PATTERN — REVERSIBLE SCROLL FADE

   Named technique: "Reversible Scroll Fade"

   Established site pattern for anything that should fade/reveal when it
   enters the viewport and fade back out when the user scrolls past it:

     ScrollTrigger toggleActions: "play reverse play reverse"

   Plain meaning: play the entrance when crossing the trigger, reverse it
   when scrolling back out, play it again on re-entry, and reverse it again
   when leaving in the opposite direction.

   Use this pattern for the site's normal "fades in/out as you scroll past it"
   behavior. Do NOT replace it with scrub unless the requested effect needs
   to be continuously tied to scroll distance. Do NOT invent a separate
   custom fade system when this established pattern fits the request.
========================= */

/* =========================
   LENIS SMOOTH SCROLL
========================= */
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

/* =========================
   NAV
========================= */
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

/* =========================
   HERO
========================= */
(function hero() {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // Per-word masked reveal (adapted from a GSAP SplitText codepen
  // reference — see wrapWordsForReveal at the top of this file for why
  // it's reimplemented rather than using the paid SplitText plugin).
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

/* =========================
   HERO PORTRAIT — hover image cycler
   Cycles through all portraits every 2s while hovered, resets on leave.
========================= */
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

/* =========================
   ABOUT
========================= */
(function about() {
  gsap.from(".about-intro", {
    opacity: 0, y: 20, duration: 0.7, ease: "power2.out",
    scrollTrigger: { trigger: ".about", start: "top 70%", toggleActions: "play reverse play reverse" },
  });

  gsap.from(".about-paragraph", {
    opacity: 0, y: 16, duration: 0.7, stagger: 0.15, ease: "power2.out",
    scrollTrigger: { trigger: ".about-left", start: "top 70%", toggleActions: "play reverse play reverse" },
  });

  // About's headline reveal now lives in the shared lineReveal() module
  // below (masked per-line slide instead of a plain fade) — see that IIFE.

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

/* =========================
   SELECTED WORKS
   Full-bleed 3-column slider (adapted from the codepen "up/down" mechanic),
   driven by a pinned + snapped ScrollTrigger instead of manual wheel-locking.
   This is what makes scroll snap into place and what fixes the section
   getting "stuck" — we no longer fight Lenis with preventDefault, we just
   let it scroll normally through a pinned range and react to progress.
========================= */
const worksController = (function works() {
  const PROJECTS = [
    {
      title: "Financial Consulting <em>Platform</em>",
      tags: ["Website Design", "UX Strategy"],
      image: "assets/projects/Project - Financial Consulting Platform.webp",
    },
    {
      title: "E-commerce <em>Fitness</em> Website",
      tags: ["Website Design", "E-commerce Strategy"],
      image: "assets/projects/Project - E-commerce Fitness Website.webp",
    },
    {
      title: "Aluminum Systems <em>Company</em>",
      tags: ["Website Design", "Marketing & Print"],
      image: "assets/projects/Project - Aluminum Systems Company.webp",
    },
    {
      title: "Industrial Machinery <em>Brand</em>",
      tags: ["Design System", "Brand & Marketing"],
      image: "assets/projects/Project - Industrial Machinery Brand.webp",
    },
  ];

  const section = document.querySelector(".works");
  const colsWrap = document.getElementById("worksColumns");
  const cols = colsWrap ? Array.from(colsWrap.children) : [];
  const dotsWrap = document.getElementById("worksDots");
  const titleEl = document.getElementById("worksTitle");
  const tagsEl = document.getElementById("worksTags");
  const prevBtn = document.getElementById("worksPrev");
  const nextBtn = document.getElementById("worksNext");

  if (!section || cols.length === 0) return null;

  let index = 0;
  let playing = false;
  const COLS = cols.length;
  const N = PROJECTS.length;

  dotsWrap.innerHTML = PROJECTS.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("");
  const dots = Array.from(dotsWrap.children);

  function makeInner(project, colIndex) {
    const inner = document.createElement("div");
    inner.className = "works-col-inner";
    inner.style.backgroundImage = `url("${project.image}")`;
    inner.style.left = `-${(100 / COLS) * colIndex}vw`;
    return inner;
  }

  function renderMeta(project) {
    tagsEl.innerHTML = project.tags.map((t) => `<span>${t}</span>`).join("");
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }

  // GSAP clip-path mask reveal for the title — wipes in top-to-bottom
  // whenever the project changes.
  function revealTitle(project) {
    gsap
      .timeline()
      .set(titleEl, { clipPath: "inset(0% 0% 100% 0%)" })
      .call(() => (titleEl.innerHTML = project.title))
      .to(titleEl, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.85, ease: "power3.out" }, "+=0.05");
  }

  // Initial paint (no animation on first load)
  cols.forEach((col, i) => col.appendChild(makeInner(PROJECTS[0], i)));
  titleEl.innerHTML = PROJECTS[0].title;
  renderMeta(PROJECTS[0]);

  function setSlide(newIndex, dir) {
    if (newIndex === index || newIndex < 0 || newIndex >= N || playing) return;
    playing = true;
    index = newIndex;
    const project = PROJECTS[index];

    cols.forEach((col, i) => {
      const goingDown = (i - Math.max(0, dir)) % 2 !== 0;
      const newInner = makeInner(project, i);
      gsap.set(newInner, { yPercent: goingDown ? -100 : 100 });
      col.appendChild(newInner);

      const oldInner = col.querySelectorAll(".works-col-inner")[0];

      gsap.to(oldInner, {
        yPercent: goingDown ? 100 : -100,
        duration: 1.1,
        ease: "power4.inOut",
        onComplete: () => oldInner.remove(),
      });

      gsap.to(newInner, {
        yPercent: 0,
        duration: 1.1,
        ease: "power4.inOut",
        onComplete: () => {
          if (i === cols.length - 1) playing = false;
        },
      });
    });

    renderMeta(project);
    revealTitle(project);
  }

  return {
    setSlide,
    get index() { return index; },
    total: N,
    section,
  };
})();

/* Pinned + snapped ScrollTrigger drives the slider from normal page scroll */
(function worksScrollTrigger() {
  if (!worksController) return;
  const { section, total, setSlide } = worksController;
  const prevBtn = document.getElementById("worksPrev");
  const nextBtn = document.getElementById("worksNext");

  const st = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${(total - 1) * 100}%`,
    pin: true,
    anticipatePin: 1,
    snap: {
      snapTo: 1 / (total - 1),
      duration: 0.5,
      ease: "power2.inOut",
    },
    onUpdate: (self) => {
      const idx = Math.round(self.progress * (total - 1));
      if (idx !== worksController.index) {
        setSlide(idx, idx > worksController.index ? 1 : -1);
      }
    },
  });

  function goToIndex(i) {
    if (i < 0 || i >= total) return;
    const y = st.start + (st.end - st.start) * (i / (total - 1));
    if (lenis) {
      lenis.scrollTo(y, { duration: 1, easing: (t) => 1 - Math.pow(1 - t, 3) });
    } else {
      gsap.to(window, { duration: 1, scrollTo: y, ease: "power2.inOut" });
    }
  }

  prevBtn.addEventListener("click", () => goToIndex(worksController.index - 1));
  nextBtn.addEventListener("click", () => goToIndex(worksController.index + 1));
})();

/* =========================
   GLOBAL CURSOR (Curzr "Big Circle")
   Tracks the pointer with mousemove only (no enter/leave state), so DOM
   churn elsewhere on the page (like the Works slider swapping images under
   the cursor) can't cause it to spuriously "disappear".
========================= */
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

/* =========================
   MY APPROACH — hover rows + cursor preview
========================= */
(function approach() {
  // Approach's headline reveal now lives in the shared lineReveal() module
  // below (masked per-line slide instead of a plain fade) — see that IIFE.

  gsap.from(".approach-row", {
    opacity: 0, y: 20, duration: 0.7, stagger: 0.12, ease: "power2.out",
    scrollTrigger: { trigger: ".approach", start: "top 60%", toggleActions: "play reverse play reverse" },
  });

  const section = document.querySelector(".approach");
  const preview = document.getElementById("approachPreview");
  const previewImg = document.getElementById("approachPreviewImg");
  const rows = document.querySelectorAll(".approach-row");

  // gsap.quickTo (per the devales codepen reference) instead of creating a
  // new gsap.to() tween on every single mousemove event — quickTo builds
  // one reusable, highly optimized tween function up front, which is
  // meaningfully cheaper for something firing this often.
  const previewX = gsap.quickTo(preview, "x", { duration: 0.5, ease: "power3.out" });
  const previewY = gsap.quickTo(preview, "y", { duration: 0.5, ease: "power3.out" });

  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => {
      row.classList.add("active");
      const img = row.getAttribute("data-image");
      if (img) previewImg.src = img;

      // Box settles in (opacity/scale), image separately de-zooms from
      // 1.4 down to 1 — matches the codepen reference exactly.
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

  // Note: the codepen reference also scales up the custom cursor on
  // hover — intentionally not doing that here. .curzr-hover is
  // deliberately absent from .approach-row (see HANDOFF.md gotcha #3):
  // the enlarged cursor circle visually overlaps this floating preview
  // box, which is exactly the clash that fix exists to avoid.

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

/* =========================
   PORTFOLIO WEBSITE SERVICES
   Image-led editorial cards with the Round 9 Produx-inspired interaction:
   - hovered card stays crisp and lifts slightly
   - sibling cards blur + dim
   - hovered image shifts subtly opposite the pointer and scales up
   - image returns smoothly on mouse-leave
========================= */
(function services() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".service-card"));
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  // Entrance adapted from a GSAP "card stacking" codepen reference: cards
  // start below, faded, and slightly scaled down, then rise into their
  // final position staggered as the section scrolls into view. The
  // reference pins its section because its cards travel a long horizontal
  // distance; ours only need to rise a short way into an already-laid-out
  // grid, so this uses a scrubbed (not pinned) ScrollTrigger — same
  // staggered fly-in feel, without scroll-jacking an already fairly dense
  // section. `scrub` also gives reverse-on-scroll-up for free, same as
  // everywhere else on the site.
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

/* =========================
   SERVICES BOTTOM-COPY: PER-CHARACTER OPACITY REVEAL ON SCROLL
   Revised per the person's clarification of the "change text color on
   scroll" codepen reference: not a spatial color-swap wipe (the previous
   version of this effect), but the whole heading starting at 50% opacity
   and scrubbing up to 100% per character, staggered so it visibly reveals
   from the first letter to the last as the section scrolls through view.
   Uses wrapCharsForReveal (top of file) so the nested .italic phrase
   keeps its own color per-character rather than being flattened to plain
   text. `stagger` + `scrub` together is a standard GSAP combination —
   the whole staggered sequence's playhead is scrubbed by scroll position,
   rather than playing on a fixed timer.
========================= */
(function servicesColorReveal() {
  const wrap = document.getElementById("servicesBottomHeading");
  const heading = wrap ? wrap.querySelector(".color-reveal-base") : null;
  if (!heading) return;

  const chars = wrapCharsForReveal(heading);
  if (!chars.length) return;

  if (prefersReduced) {
    gsap.set(chars, { opacity: 1 });
    return;
  }

  gsap.set(chars, { color: "#ffffff" });
  gsap.to(chars, {
  color: "#141918",
  stagger: { each: 0.012, from: "start" },
  ease: "none",
  scrollTrigger: {
    trigger: wrap,
    start: "top 85%",
    end: "top 35%",
    scrub: 0.6,
  },
});
})();


/* NOTE: Services entrance reveals use the site's named "Reversible Scroll Fade"
   technique: ScrollTrigger `toggleActions: "play reverse play reverse"`.
   This is the established site pattern for "fades in/out as you scroll past it"
   and should be reused for similar future reveal/fade requests. */

/* =========================
   SCROLL-SCRUB STORYTELLING
   Video-scrubbed: the pinned ScrollTrigger sets the <video>'s currentTime
   directly from scroll progress (0–1 maps to 0–duration) instead of
   tweening SVG shapes. Freeze-on-stop and reverse-on-scroll-up are
   automatic side effects of that, same as the earlier SVG version — only
   what's being scrubbed changed.

   Heading + caption timing (fractions of total scroll progress, 0–1):
     - Heading is visible from the start, scrubs out smoothly across
       HEADING_OUT_START–HEADING_OUT_END so it's fully gone exactly at the
       midpoint of the scroll-scrub, per spec.
     - Each caption is a discrete "has this appeared yet" reveal keyed to
       its own threshold in CAPTION_THRESHOLDS, not a continuous scrub —
       once shown it stays shown through the end of the scroll, per spec.
       Scrolling back up past a caption's threshold reverses it, matching
       the site's established reversible-motion convention.
     - Each caption's title uses the same masked line-slide reveal as the
       section headlines (wrapLinesForReveal, top of file), fired at that
       threshold-crossing rather than tied 1:1 to scroll distance.

   IMPORTANT HANDOFF TERMINOLOGY — PIN-RELEASE, NOT PARALLAX:
   The storytelling → CTA transition is a pinned-section release. The scene
   is scrubbed while the storytelling section is pinned; when that pinned
   range ends, the section releases and the following CTA naturally takes
   over in document flow. This should NOT be interpreted as layered parallax.
   Do not build independent foreground/background parallax layers, per-layer
   scroll speeds, or a faux depth stack for this handoff unless a future
   request explicitly asks for a different effect.

   Current preference: the existing handoff is liked as-is. A more deliberate
   visual handoff may be explored later, but that is a refinement of the
   pin-release transition — not a reason to introduce actual parallax layers.
========================= */
(function storytelling() {
  const section = document.getElementById("storytelling");
  const video = document.getElementById("storytellingVideo");
  if (!section || !video) return;

  const heading = document.getElementById("storytellingHeading");
  const captions = [
    document.getElementById("storyCaption1"),
    document.getElementById("storyCaption2"),
    document.getElementById("storyCaption3"),
  ].filter(Boolean);

  // Reduced motion: skip the pin/scrub entirely — show the video's final
  // frame with the heading already gone (its job is done by the midpoint
  // regardless) and all three captions settled visible.
  if (prefersReduced) {
    if (heading) gsap.set(heading, { opacity: 0 });
    captions.forEach((cap) => {
      const lines = wrapLinesForReveal(cap, ".caption-line");
      gsap.set(lines, { y: "0%" });
      gsap.set(cap, { opacity: 1 });
    });
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = video.duration || 0;
      },
      { once: true }
    );
    return;
  }

  // The heading's exit uses the same masked line-slide technique as its
  // reveal counterpart elsewhere on the site, just inverted: instead of
  // sliding up out of a mask to become visible, each line slides back
  // down into the mask to disappear. A small per-line offset gives the
  // two lines a slight cascading exit instead of moving in lockstep.
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

  const HEADING_OUT_START = 0.42;
  const HEADING_OUT_END = 0.5;
  const CAPTION_THRESHOLDS = [0.5, 0.68, 0.86];
  const shown = captions.map(() => false);

  function buildTimeline() {
    let trigger;

    function setup() {
      video.pause();
      video.currentTime = 0;

      trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "+=250%",
        pin: "#storyPin",
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;

          if (video.duration) {
            video.currentTime = progress * video.duration;
          }

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
    }

    // currentTime can't be set reliably before the browser knows the
    // video's duration — wait for that if it hasn't loaded yet.
    if (video.readyState >= 1) {
      setup();
    } else {
      video.addEventListener("loadedmetadata", setup, { once: true });
    }

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

/* =========================
   CTA
========================= */
(function cta() {
  const tl = gsap.timeline({
    scrollTrigger: { trigger: ".cta", start: "top 60%", toggleActions: "play reverse play reverse" },
    defaults: { ease: "power2.out" },
  });

  tl.from(".cta-rect", { opacity: 0, scale: 0.6, stagger: 0.15, duration: 1 })
    .from(".cta-headline", { opacity: 0, y: 24, scale: 0.95, duration: 0.9 }, "-=0.6")
    .from(".cta-sub", { opacity: 0, y: 14, duration: 0.6 }, "-=0.5")
    .from(".cta-bar", { opacity: 0, y: 14, duration: 0.6 }, "-=0.4");
})();

/* =========================
   SECTION HEADLINE REVEALS — MASKED LINE SLIDE
   Applies the shared per-line reveal (wrapLinesForReveal, top of file) to
   the four main section headlines, each on its own ScrollTrigger using
   the site's standard reversible pattern (toggleActions: "play reverse
   play reverse"). Replaces the plain opacity/y fades those headlines used
   to have individually in about()/approach()/cta() — do not re-add a
   second reveal for any of these four elements elsewhere.
========================= */
(function lineReveal() {
  const targets = [
    { el: document.querySelector(".about-headline"), start: "top 70%" },
    { el: document.querySelector(".services-headline"), start: "top 75%" },
    { el: document.querySelector(".approach-headline"), start: "top 70%" },
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

/* =========================
   FOOTER
========================= */
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
