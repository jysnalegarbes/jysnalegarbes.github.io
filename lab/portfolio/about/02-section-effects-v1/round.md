---
title: "Section effects, first pass"
project: Portfolio
page: About
order: 2
date: 2026-10-20
summary: "The first motion set for the About text, before the transition brief replaced it."
demo: about-sections-v1
files:
  - about-sections.ts
  - about.astro
options:
  - name: "Ink wave"
    status: rejected
    note: "Words (letters for the big headings) condense out of ink through a goo filter, in a wave sweeping each line left to right, while the section scrolls in."
    credit: "Goo filter after Codrops, GooeyTextHoverEffect; split with GSAP SplitText"
  - name: "Melt exit"
    status: rejected
    note: "Words melt upward through the same goo filter as the section scrolls away, overlapping the next section's entry. A sibling of the case-study pinned outro."
  - name: "Velocity bend"
    status: rejected
    note: "Scroll speed bends the lines into a travelling sine (y offset plus a little rotation per word) that settles flat when the scroll stops. Original: a text take on the Work page's Flag ripple."
---
