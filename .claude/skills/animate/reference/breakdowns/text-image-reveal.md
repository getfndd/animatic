---
ref: text-image-reveal
title: "Text Block Image Reveal — Editorial Split"
source: "inspiration/8f7cd2b9101369ef1989a302fa54148f.gif"
type: gif
date: 2026-02-24
personality_affinity: editorial
tags: [typography, image, reveal, editorial, split, clip-path, hero, content]
quality_tier: exemplary
---

# Text Block Image Reveal — Editorial Split

## Summary

Bold display typography ("OUR STAGE / YOUR STAGE") sits in two blocks separated by a centered image that expands and contracts. The image acts as a breathing window between typographic masses — growing to reveal more of the photograph, then contracting back. This is editorial animation at its best: the content IS the animation. No decorative motion — the typography and imagery do the work together. Directly applicable to hero sections, brand statements, and feature headlines.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / loop start | text-block entrance | ~500ms | expo-out | Both text blocks ("OUR STAGE" top, "YOUR STAGE" bottom) are present, large bold white-on-black |
| 0:00 / continuous | image-expand | ~1800ms | ease-in-out | Center image grows from ~60px height to ~200px height, pushing text blocks apart vertically |
| ~0:02 / after expand | image-contract | ~1400ms | ease-in-out | Image shrinks back, text blocks pull together — breathing rhythm |
| continuous | image crop shift | synced with expand | ease-in-out | As image expands, the visible crop area shifts (object-position changes), creating parallax within the image frame |
| continuous | text tracking shift | subtle, ~200ms | ease-out | Letter-spacing on typography tightens slightly as blocks move together, loosens as they separate |

## Technique Breakdown

```css
/* bk-text-image-split — Expanding image between text blocks */
.hero-split {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.text-block {
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: var(--tracking, 0.02em);
  line-height: 1;
  transition: letter-spacing 200ms ease-out;
}

.image-window {
  width: 200px;
  overflow: hidden;
  animation: image-breathe 3200ms ease-in-out infinite;
}

.image-window img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  animation: image-crop-shift 3200ms ease-in-out infinite;
}

@keyframes image-breathe {
  0%, 100% { height: 60px; }
  50% { height: 200px; }
}

@keyframes image-crop-shift {
  0%, 100% { object-position: 50% 40%; }
  50% { object-position: 50% 55%; }
}
```

```css
/* Text tracking that responds to image state */
.hero-split.expanded .text-block {
  --tracking: 0.06em;
}

.hero-split.contracted .text-block {
  --tracking: 0.01em;
}

/* Or sync with animation via CSS custom properties */
@keyframes tracking-breathe {
  0%, 100% { letter-spacing: 0.01em; }
  50% { letter-spacing: 0.06em; }
}
```

## Choreography Notes

- **The image is the breath.** Expand = inhale, contract = exhale. The entire composition breathes as one organism. This is the choreographic insight — typography doesn't animate independently; it responds to the image's state.
- **Asymmetric timing.** Expand (1800ms) is slower than contract (1400ms). The reveal is savored; the return is crisp. This prevents the animation from feeling metronomic.
- **Typography as architecture, image as movement.** The text blocks are massive and stable. The image is small and dynamic. This contrast creates the tension that makes it compelling.
- **Crop shift within the frame.** The image doesn't just scale — the viewport into the image also shifts. This creates a parallax depth effect within a 2D composition.

## What We Can Steal

- **`bk-text-image-split`** — A hero section pattern where content and imagery breathe together. Perfect for brand statements, product hero sections, or chapter dividers in scrollytelling. The text/image/text sandwich structure is immediately usable.
- **Image-as-breath choreography** — The principle of an element expanding/contracting as a breathing metaphor. Applicable beyond images: a chart that breathes, a code block that expands to show more, a feature list that reveals.
- **Synchronized tracking shift** — Letter-spacing responding to layout state. A subtle detail that separates good from great typography animation. Use anywhere display type appears near a dynamic element.
- **Object-position parallax** — Moving the crop within a fixed-size container creates depth without 3D transforms. Lightweight and effective.

## What to Avoid

- **Don't use with small type.** This pattern demands display-scale typography (3rem+). At body text size, the spacing shifts would be imperceptible and the composition would lack the architectural quality.
- **Don't over-expand.** The image should never dominate — it's a window, not a hero image. The text blocks should always be the primary visual mass.
- **Don't add easing on the type itself.** The text blocks should feel like they're being physically pushed by the image expansion, not independently animated. Keep the text motion as a consequence, not a parallel animation.
