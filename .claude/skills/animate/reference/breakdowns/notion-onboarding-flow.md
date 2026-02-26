---
ref: notion-onboarding-flow
title: "Notion Web Onboarding — Multi-Phase Progressive Disclosure"
source: "Mobbin screenshots (17 screens, Notion Web Onboarding 0-16)"
type: motion-study
date: 2026-02-26
personality_affinity: neutral-light
tags: [onboarding, form, card, selection, checklist, tutorial, sidebar, stagger, transition, light-mode]
quality_tier: strong
---

# Notion Web Onboarding — Multi-Phase Progressive Disclosure

## Summary

A 17-screen onboarding flow that moves a new user from marketing landing page through account creation, profile setup, purpose/context selection, upsell interstitials, and finally into the live workspace. The choreography is notable for its restraint — each phase is a centered, single-focus card on a warm light background, with progressive form field reveals and layout-shift transitions that culminate in the dramatic "onboarding dissolve into app" moment at screen 16. The flow demonstrates how to orchestrate 7+ distinct phases without ever making the user feel lost, using consistent spatial anchoring, minimal chrome, and one-thing-at-a-time progressive disclosure. This is the canonical reference for Neutral Light onboarding choreography.

## Flow Map

| Screen | Phase | Content | Layout |
|--------|-------|---------|--------|
| 0 | Marketing landing | Hero + logos + feature cards | Full marketing page (nav, hero, grid) |
| 1 | Sign-up (empty) | OAuth buttons + email input | Centered card, minimal chrome |
| 2 | Sign-up (filled) | Email entered, same layout | Same — no layout shift on input |
| 3 | Verification | Email + verification code field revealed | Card height grows — new field slides in |
| 4 | Verification (filled) | Code entered | Same — no shift |
| 5 | Profile (empty) | Avatar placeholder + name + password | Full content swap — new centered card |
| 6 | Profile (photo added) | Real avatar replaces placeholder | Avatar crossfade — micro-moment |
| 7 | Profile (name filled) | Name entered | No layout shift |
| 8 | Profile (password filled) | Password entered, button activates | Button state change — disabled to active |
| 9 | Profile (password visible) | Password revealed via toggle | Inline content swap |
| 10 | Purpose selection | 3 vertical choice cards with icons | Full content swap — staggered card entrance |
| 11 | Context selection | 2 horizontal choice cards with illustrations | Full content swap — card layout change (1-col to 2-col) |
| 12 | Interest tags (empty) | Tag pills + illustration | Full content swap — split layout (left form, right illustration) |
| 13 | Interest tags (selected) | 2 tags selected (blue outline) | Tag selection state — border + subtle bg shift |
| 14 | Desktop app upsell | App icon + feature list + app preview mockup | Full content swap — split layout (left pitch, right preview) |
| 15 | Calendar upsell | Calendar icon + feature list + calendar preview | Full content swap — similar split layout |
| 16 | Workspace (destination) | Full app: sidebar + content + checklist | Layout explosion — onboarding card dissolves into full app chrome |

## Signature Moments

| Trigger | Effect | Duration (NL) | Easing (NL) | Description |
|---------|--------|---------------|-------------|-------------|
| Screen 0 → 1: CTA click | full-content-swap | 300-400ms | ease-out-quart | Marketing page dissolves entirely; centered auth card fades in on warm stone background. The most dramatic context shift — from noisy marketing to focused, quiet onboarding. |
| Screen 2 → 3: email submit | field-reveal-grow | 300-400ms | ease-smooth | Verification code field slides down from beneath the email field while the card container grows in height. Existing content stays anchored — only new content enters. |
| Screen 4 → 5: verification success | phase-crossfade | 300-400ms | ease-out-quart | Entire auth card content cross-fades to profile card. Heading changes, fields change, avatar area appears. The container position stays centered — content swaps within the same spatial anchor. |
| Screen 5 → 6: photo upload | avatar-crossfade | 150-200ms | ease-out-quart | Placeholder smiley icon cross-fades to uploaded photo. Label changes from "Add a photo" to "Change". Tiny moment, but it personalizes the space. |
| Screen 8: password filled | button-activate | 150-200ms | ease-out-quart | Continue button transitions from disabled (light blue/grey, muted) to active (solid blue). Opacity shift + subtle background-color transition. |
| Screen 9 → 10: profile complete | phase-crossfade-to-cards | 300-400ms | ease-out-quart | Profile form cross-fades out; 3 purpose cards fade in with staggered slide-up. This is the first appearance of card-based selection — a layout vocabulary shift from form fields to choice cards. |
| Screen 10: card entrance | staggered-slide-up | 500-650ms total | ease-out-quart | 3 vertical purpose cards (For work / For personal life / For school) enter with slide+fade stagger. Each card: icon + title + description. ~100ms stagger interval between cards. |
| Screen 10 → 11: purpose selected | card-layout-morph | 300-400ms | ease-out-quart | 3 vertical cards dissolve; 2 horizontal cards appear side-by-side. Layout shifts from single-column stack to two-column grid. Heading updates. |
| Screen 11 → 12: context selected | split-layout-entrance | 300-400ms | ease-out-quart | Centered card layout dissolves; asymmetric split layout appears (form left, illustration right). This is the first time the layout breaks center symmetry. |
| Screen 12 → 13: tag selection | tag-select-state | 150-200ms | ease-out-quart | Unselected tag pill gains blue border + subtle blue background tint. Counter updates ("0 selected" → "2 selected"). No layout shift — purely visual state change. |
| Screen 13 → 14: interests submitted | upsell-split-entrance | 300-400ms | ease-out-quart | Tag selection dissolves; desktop app upsell appears as split layout (pitch left, app preview mockup right). The mockup card has its own internal skeleton/placeholder content. |
| Screen 14 → 15: desktop skip/continue | upsell-content-swap | 300-400ms | ease-out-quart | Desktop upsell dissolves; calendar upsell appears in same split layout pattern. Similar structure but different content — establishing a "product feature interstitial" pattern. |
| Screen 15 → 16: final continue | onboarding-to-app-dissolve | 500-650ms | ease-out-quart | The signature moment. Centered onboarding card dissolves. Full app workspace materializes: sidebar slides in from left, content area fades in, header bar appears. The layout goes from single-focus to multi-panel. The most complex transition in the flow. |

## Technique Breakdown

### 1. Phase Crossfade (screens 1→5, 5→10, etc.)

```css
/* nl-phase-crossfade — Content swap within stable container */
.onboarding-phase {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity var(--nl-medium, 350ms) var(--nl-ease-out);
}

.onboarding-phase[data-state="entering"] {
  opacity: 0;
  pointer-events: none;
}

.onboarding-phase[data-state="active"] {
  opacity: 1;
  pointer-events: auto;
}

.onboarding-phase[data-state="exiting"] {
  opacity: 0;
  pointer-events: none;
}
```

### 2. Field Reveal Grow (screen 2→3)

```css
/* nl-field-reveal — New form field slides down while container grows */
.field-reveal-container {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--nl-medium, 350ms) var(--nl-ease-smooth);
}

.field-reveal-container[data-revealed="true"] {
  grid-template-rows: 1fr;
}

.field-reveal-inner {
  overflow: hidden;
}

.field-reveal-content {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--nl-medium, 350ms) var(--nl-ease-out) 100ms,
    transform var(--nl-medium, 350ms) var(--nl-ease-out) 100ms;
}

.field-reveal-container[data-revealed="true"] .field-reveal-content {
  opacity: 1;
  transform: translateY(0);
}
```

### 3. Staggered Card Entrance (screen 10)

```css
/* nl-purpose-card-stagger — Vertical choice cards enter with slide+fade */
.purpose-card {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--nl-medium, 350ms) var(--nl-ease-out),
    transform var(--nl-medium, 350ms) var(--nl-ease-out);
}

.purpose-card[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger via custom property — 100ms interval */
.purpose-card:nth-child(1) { transition-delay: 0ms; }
.purpose-card:nth-child(2) { transition-delay: 100ms; }
.purpose-card:nth-child(3) { transition-delay: 200ms; }
```

### 4. Tag Selection State (screen 12→13)

```css
/* nl-tag-select — Pill toggles between unselected and selected */
.interest-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--nl-border-subtle, #e7e5e4);
  border-radius: 9999px;
  background: var(--nl-surface-card, #ffffff);
  color: var(--nl-text-secondary, #44403c);
  transition:
    border-color var(--nl-fast, 150ms) var(--nl-ease-out),
    background-color var(--nl-fast, 150ms) var(--nl-ease-out);
  cursor: pointer;
}

.interest-tag[aria-pressed="true"] {
  border-color: var(--nl-accent, #3b82f6);
  background: var(--nl-accent-bg, #eff6ff);
  color: var(--nl-accent-text, #1d4ed8);
}
```

### 5. Button Activation (screen 8)

```css
/* nl-button-activate — Disabled-to-active state transition */
.continue-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition:
    background-color var(--nl-fast, 150ms) var(--nl-ease-out),
    opacity var(--nl-fast, 150ms) var(--nl-ease-out);
}

.continue-button[disabled] {
  background: var(--nl-surface-hover, #e7e5e4);
  color: var(--nl-text-tertiary, #78716c);
  opacity: 0.6;
  cursor: not-allowed;
}

.continue-button:not([disabled]) {
  background: var(--nl-accent, #3b82f6);
  color: #ffffff;
  opacity: 1;
  cursor: pointer;
}
```

### 6. Onboarding-to-App Dissolve (screen 15→16)

```css
/* nl-app-materialize — The most complex transition: onboarding dissolves, app appears */

/* Outgoing: onboarding card fades out */
.onboarding-wrapper[data-state="exiting"] {
  opacity: 0;
  transition: opacity var(--nl-medium, 350ms) var(--nl-ease-in);
}

/* Incoming: sidebar slides from left, content fades in */
.app-sidebar {
  opacity: 0;
  transform: translateX(-16px);
  transition:
    opacity var(--nl-slow, 550ms) var(--nl-ease-out) 200ms,
    transform var(--nl-slow, 550ms) var(--nl-ease-out) 200ms;
}

.app-content {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--nl-slow, 550ms) var(--nl-ease-out) 350ms,
    transform var(--nl-slow, 550ms) var(--nl-ease-out) 350ms;
}

.app-header {
  opacity: 0;
  transition: opacity var(--nl-medium, 350ms) var(--nl-ease-out) 200ms;
}

/* Active state — everything settles */
.app-layout[data-state="active"] .app-sidebar,
.app-layout[data-state="active"] .app-content,
.app-layout[data-state="active"] .app-header {
  opacity: 1;
  transform: translate(0);
}
```

## Choreography Notes

### Spatial Anchoring Strategy

The entire onboarding flow uses a single spatial anchor: the center of the viewport. Every phase from screen 1 through screen 15 presents content centered both horizontally and vertically. This consistency means the user's eye never has to hunt for where to look — the new content always appears exactly where the old content was. The only exception is screen 16, where the layout deliberately breaks this anchor to signal "you have arrived somewhere new."

### Progressive Complexity Curve

The flow follows a deliberate complexity escalation:

1. **Screens 1-4** — Single form field focus. One input at a time. Minimal visual load.
2. **Screen 5-9** — Profile form. Multiple fields but still single-column centered. Avatar adds personality.
3. **Screen 10** — First card-based selection. Three options with icons and descriptions. Vertical stack.
4. **Screen 11** — Two-card horizontal selection. Grid layout introduced. Richer illustrations.
5. **Screen 12-13** — Multi-select tag pills with split layout. First asymmetric layout. Illustration appears.
6. **Screens 14-15** — Upsell interstitials. Split layout with product preview mockups. Richest visual content in the onboarding.
7. **Screen 16** — Full application. Sidebar, header, content, checklist. Maximum layout complexity.

Each step adds exactly one layer of visual complexity. The user never faces a jarring jump.

### Speed Tier Usage

- **FAST (150-200ms)**: Tag pill selection, avatar crossfade, button state activation, password toggle. Micro-interactions that respond to direct user action.
- **MEDIUM (300-400ms)**: Phase-to-phase crossfades, card content swaps, field reveals. The primary transition rhythm between screens.
- **SLOW (500-650ms)**: Staggered card entrance sequences, the final onboarding-to-app dissolve. Reserved for moments where multiple elements need to choreograph.

### The "Same Container, New Content" Pattern

Screens 1 through 15 never change the outer container. The page background stays warm stone (`--nl-bg-body`). The centered card area stays the same width. Only the interior content swaps via opacity crossfade. This is the key to making 15 phase transitions feel smooth rather than jarring — the user's peripheral vision never detects a full-page refresh.

### Stagger Intervals

- **Purpose cards (screen 10)**: 3 cards, ~100ms stagger = 200ms total offset. Quick enough to feel connected, slow enough to register as sequential.
- **App materialize (screen 16)**: sidebar → header → content, ~150ms stagger. Reads left-to-right, top-to-bottom — following natural reading order.

## What We Can Steal

- **`nl-phase-crossfade`** — The foundation primitive for multi-step onboarding flows. Content swaps within a stable, centered container using only opacity. No translateY on the container itself, only on entering child elements. This is the NL answer to cinematic-dark's clip-path wipe transitions. Reusable for any wizard, setup flow, or multi-step form.

- **`nl-field-reveal-grow`** — Progressive form field disclosure using CSS grid `grid-template-rows: 0fr → 1fr` for smooth height animation, with the content inside using slide+fade with a 100ms delay after the container starts growing. Avoids the jarring "jump" of instant field insertion. Critical for verification code fields, conditional form sections, and expanding detail panels.

- **`nl-staggered-card-entrance`** — Vertical stack of choice cards entering with slide+fade at 100ms intervals. Each card has icon + title + description. The pattern works for 2-5 options. Beyond 5, the total stagger time becomes noticeable. Reusable for any purpose-selection, plan-selection, or feature-choice screen.

- **`nl-tag-pill-select`** — Multi-select pill/chip with clean state toggle: transparent bg + subtle border → accent border + accent-bg tint. The transition uses FAST tier because selection is a direct manipulation response. Counter updates are instant (no animation on the count). Reusable for interest pickers, filter bars, and multi-category selectors.

- **`nl-button-activate`** — Disabled-to-active button transition when form validation passes. Uses FAST tier opacity + background-color change. The muted state uses `opacity: 0.6` rather than a completely different color, which makes the activation feel like "coming alive" rather than "changing identity."

- **`nl-app-materialize`** — The onboarding-to-app dissolve. The single most complex transition: centered card fades out (MEDIUM, ease-in), then sidebar slides from left (SLOW, ease-out, 200ms delay), header fades in (MEDIUM, 200ms delay), content fades up (SLOW, 350ms delay). This three-layer stagger creates a sense of "the workspace assembling itself around you." Reusable for any tutorial-to-product transition.

- **`nl-split-layout-entrance`** — The shift from centered single-column to asymmetric split layout (form left, preview/illustration right). The entire split layout enters via phase crossfade, but internally the left and right columns can use a subtle horizontal stagger (left first, right 100ms later). Used in screens 12-15 for the interest/upsell phases.

## What to Avoid

- **Don't animate the outer container position.** Notion keeps the card anchored at viewport center for all 15 onboarding phases. Moving the container between phases would create motion sickness over a flow this long. The stability is the choreographic backbone.

- **Don't use slide transitions between phases.** It would be tempting to slide content left-to-right between steps (like a carousel). Notion deliberately avoids this, using only crossfade. For a 7+ phase flow, directional slides create a false sense of linear progress and make it harder to go back. Crossfade is phase-neutral.

- **Don't stagger more than 5 items.** The purpose cards (screen 10) stagger 3 items. The interest tags (screen 12) appear all at once — no stagger. At 11 tags, staggering would create a 1+ second wave that draws attention to the animation rather than the content. Beyond 5 items, show them simultaneously.

- **Don't add entrance animation to form field typing.** Screens 2, 4, 7-9 show progressive form filling. The text appearing in input fields has no animation — it is instant. Animating user input creates a disconnect between action and feedback. Only animate the structural changes (new fields appearing, button activating), never the user's own content.

- **Don't overload upsell interstitials with motion.** Screens 14-15 are product upsells with preview mockups. The mockups are static — no internal animations, no skeleton loading simulations, no auto-playing demos. The motion budget for these screens is spent entirely on the phase entrance transition. Adding internal mockup animation would compete with the pitch copy and dilute the message.

- **Don't break the background.** All 16 onboarding screens (1-16, excluding marketing) use the same warm stone background (`--nl-bg-body`). The workspace (screen 16) introduces its own internal backgrounds (white content area, grey sidebar) but the page-level background remains consistent. Changing the background between phases would be the equivalent of changing rooms — too disruptive for what should feel like one continuous conversation.
