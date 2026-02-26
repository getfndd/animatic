---
ref: vercel-onboarding-flow
title: "Vercel Web Onboarding — Centered Minimal Flow"
source: "Mobbin screenshots: /tmp/mobbin-extract/vercel-onboarding/ (14 screens)"
type: motion-study
date: 2026-02-26
personality_affinity: neutral-light
tags: [onboarding, form, verification, button-stack, radio-card, loading, input, stagger, transition, light-mode]
quality_tier: strong
---

# Vercel Web Onboarding — Centered Minimal Flow

## Summary

Vercel's onboarding is the most stripped-down NL reference in the collection. Pure white background, vertically centered content column (~400px wide), no sidebar, no step indicator, no progress bar, no illustration. Every screen follows the same structural formula: bold heading, brief body text, one interactive element group, one primary action. The implied motion between screens is entirely opacity crossfade — content swaps in place within a fixed vertical axis. This is extreme reduction as design philosophy: the animation serves comprehension by refusing to compete with decision-making. Worth studying for how much choreography you can extract from a flow that appears to have none.

## Flow Progression

14 screens mapping a complete account creation journey across two parallel auth paths:

| Screen | Phase | Content | Key Pattern |
|--------|-------|---------|-------------|
| 0 | Account Setup | Plan Type radio cards (Hobby/Pro), no selection, Continue disabled | Radio card unselected state |
| 1 | Account Setup | Hobby selected (blue check), "Your Name" input revealed, Continue disabled | Radio card selection + conditional field reveal |
| 2 | Account Setup | Name filled ("Alex Smith"), Continue enabled (black) | Button activation state change |
| 3 | Git Provider | 3 provider buttons (GitHub/GitLab/Bitbucket) + email link | Button stack entrance, brand-colored variants |
| 4 | Email Signup | Email input (empty), Continue with Email button, back link | Phase transition: provider to email form |
| 5 | Email Signup | Email filled, same layout | Input filled state |
| 6 | Email Verification (waiting) | Security code badge ("Happy Camel"), waiting copy | Phase transition: form to passive wait state |
| 7 | Email Verification (action) | Verify button in new tab context (minimal nav) | Secondary context: stripped nav, centered CTA |
| 8 | Email Verification (success) | "Sign Up Successful" confirmation text, no CTA | Terminal state: text-only confirmation |
| 9 | Phone Verification | Phone input with country flag prefix, Continue button | Phase transition: new verification type |
| 10 | Phone Verification | Phone number filled | Input filled state |
| 11 | Code Entry (empty) | 4-digit segmented input boxes, Back + Verify buttons | Segmented code input appearance |
| 12 | Code Entry (verifying) | Digits filled ("5696"), spinner + "Verifying" label | Loading state transition on button |
| 13 | Dashboard | Full dashboard with nav, Import Git Repo + Clone Template cards | Terminal state: environment change |

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| Screen 0 load | centered-content-entrance | 300ms | ease-out-quart | Heading + radio cards + button appear as a single centered block; implied slide+fade from opacity 0, translateY(8px) to settled position |
| Screen 0→1 / radio select | radio-card-select | 150ms | ease-out-quart | Hobby card gains blue-tinted left border or background wash, blue filled checkbox appears at right; unselected card remains neutral |
| Screen 0→1 / radio select | conditional-field-reveal | 350ms | ease-smooth | "Your Name" input slides into existence below cards; container height expands smoothly to accommodate new field; Continue remains disabled (gray) |
| Screen 1→2 / input fill | button-activation | 150ms | ease-out-quart | Continue button transitions from gray/disabled (bg ~#e5e5e5, text ~#a3a3a3) to black/enabled (bg #000, text #fff); binary state flip, no intermediate |
| Screen 2→3 / continue click | phase-crossfade | 400ms | ease-out-quart | Entire content block (heading + form) fades out; new content block (heading + button stack) fades in at same vertical center; no lateral movement |
| Screen 3 load | provider-button-stagger | 500ms total, 120ms interval | ease-out-quart | Three provider buttons enter top-to-bottom with staggered slide+fade; GitHub (dark) first, GitLab (purple) second at +120ms, Bitbucket (blue) third at +240ms; email link fades in last at +360ms |
| Screen 3→4 / email click | phase-crossfade | 400ms | ease-out-quart | Provider buttons fade out; email input + button fade in at same center; heading changes from "Let's connect your Git provider" to "Sign up for Vercel" |
| Screen 5→6 / submit email | phase-crossfade | 400ms | ease-out-quart | Email form content crossfades to verification waiting state; heading changes, security code badge appears |
| Screen 6 load | security-badge-entrance | 300ms | ease-out-quart | "Happy Camel" badge appears with subtle slide+fade; bordered pill with bold text |
| Screen 9→11 / phone submit | phase-crossfade-with-morph | 400ms | ease-smooth | Phone input crossfades to segmented code input; heading ("Verification") persists — only body text and input type change; partial content morph |
| Screen 11 load | segmented-input-stagger | 400ms total, 80ms interval | ease-out-quart | Four empty input boxes appear left-to-right with subtle stagger; each box fades in at 80ms intervals |
| Screen 11→12 / code entry | digit-fill-cascade | 200ms total, ~50ms interval | ease-out-quart | Digits appear in boxes sequentially left-to-right as user types; each digit scales from 0.8 to 1.0 with fade-in |
| Screen 12 / verify tap | button-loading-swap | 200ms | ease-out-quart | "Verify" button text replaced by spinner icon + "Verifying" label; button border becomes lighter, fills become transparent/outlined; black solid to gray outline transition |
| Screen 12→13 / verified | environment-transition | 600ms | ease-smooth | Entire onboarding context dissolves; full dashboard appears with navigation, cards, templates; this is the most dramatic transition in the flow — the only one that changes page structure entirely |

## Technique Breakdown

```css
/* nl-phase-crossfade — Content block transition between onboarding phases */
.phase-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: opacity var(--nl-medium, 400ms) var(--nl-ease-out);
}

.phase-content[data-state="entering"] {
  opacity: 0;
  pointer-events: none;
}

.phase-content[data-state="active"] {
  opacity: 1;
  pointer-events: auto;
}

.phase-content[data-state="exiting"] {
  opacity: 0;
  pointer-events: none;
}
```

```css
/* nl-radio-card-select — Radio card selection with conditional reveal */
.radio-card {
  border: 1px solid var(--nl-border-subtle, #e7e5e4);
  border-radius: 8px;
  padding: 16px 20px;
  transition:
    border-color var(--nl-fast, 150ms) var(--nl-ease-out),
    background-color var(--nl-fast, 150ms) var(--nl-ease-out);
}

.radio-card[data-selected="true"] {
  border-color: var(--nl-accent, #3b82f6);
  background-color: var(--nl-accent-bg, #eff6ff);
}

.radio-card__check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--nl-border-medium, #d6d3d1);
  transition:
    border-color var(--nl-fast, 150ms) var(--nl-ease-out),
    background-color var(--nl-fast, 150ms) var(--nl-ease-out);
}

.radio-card[data-selected="true"] .radio-card__check {
  border-color: var(--nl-accent, #3b82f6);
  background-color: var(--nl-accent, #3b82f6);
  /* Checkmark icon appears via SVG background-image */
}
```

```css
/* nl-conditional-reveal — Height expansion for conditional form fields */
.conditional-field-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--nl-medium, 350ms) var(--nl-ease-smooth);
  overflow: hidden;
}

.conditional-field-wrapper[data-visible="true"] {
  grid-template-rows: 1fr;
}

.conditional-field-wrapper > .inner {
  min-height: 0;
  opacity: 0;
  transition: opacity var(--nl-fast, 200ms) var(--nl-ease-out);
  transition-delay: 150ms; /* Wait for height to partially open */
}

.conditional-field-wrapper[data-visible="true"] > .inner {
  opacity: 1;
}
```

```css
/* nl-provider-button-stagger — Staggered button stack entrance */
.provider-stack > * {
  opacity: 0;
  transform: translateY(8px);
  animation: nl-slide-fade-in var(--nl-medium, 300ms) var(--nl-ease-out) forwards;
}

.provider-stack > *:nth-child(1) { animation-delay: 0ms; }
.provider-stack > *:nth-child(2) { animation-delay: 120ms; }
.provider-stack > *:nth-child(3) { animation-delay: 240ms; }
.provider-stack > *:nth-child(4) { animation-delay: 360ms; }

@keyframes nl-slide-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

```css
/* nl-segmented-input — Code verification segmented boxes */
.code-input-group {
  display: flex;
  gap: 12px;
}

.code-box {
  width: 48px;
  height: 52px;
  border: 1px solid var(--nl-border-medium, #d6d3d1);
  border-radius: 6px;
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  color: var(--nl-text-primary, #1c1917);
  opacity: 0;
  transform: translateY(4px);
  animation: nl-slide-fade-in var(--nl-fast, 200ms) var(--nl-ease-out) forwards;
}

.code-box:nth-child(1) { animation-delay: 0ms; }
.code-box:nth-child(2) { animation-delay: 80ms; }
.code-box:nth-child(3) { animation-delay: 160ms; }
.code-box:nth-child(4) { animation-delay: 240ms; }

/* Digit fill micro-animation */
.code-box[data-filled="true"] {
  animation: nl-digit-pop var(--nl-fast, 150ms) var(--nl-ease-out);
}

@keyframes nl-digit-pop {
  from {
    transform: scale(0.8);
    opacity: 0.5;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
```

```css
/* nl-button-activation — Disabled to enabled state flip */
.primary-btn {
  width: 100%;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 500;
  transition:
    background-color var(--nl-fast, 150ms) var(--nl-ease-out),
    color var(--nl-fast, 150ms) var(--nl-ease-out);
}

.primary-btn[disabled] {
  background-color: #e5e5e5;
  color: #a3a3a3;
  cursor: not-allowed;
}

.primary-btn:not([disabled]) {
  background-color: #000;
  color: #fff;
  cursor: pointer;
}
```

```css
/* nl-button-loading-swap — Button text to spinner transition */
.verify-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 100px;
  transition:
    background-color var(--nl-fast, 200ms) var(--nl-ease-out),
    border-color var(--nl-fast, 200ms) var(--nl-ease-out),
    color var(--nl-fast, 200ms) var(--nl-ease-out);
}

.verify-btn[data-state="loading"] {
  background-color: transparent;
  border: 1px solid var(--nl-border-medium, #d6d3d1);
  color: var(--nl-text-secondary, #44403c);
}

.verify-btn__spinner {
  width: 16px;
  height: 16px;
  animation: nl-spinner 800ms linear infinite;
}

@keyframes nl-spinner {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Choreography Notes

- **Single vertical axis.** Every screen centers its content block on the same vertical axis at the same approximate y-position. No lateral drift, no scroll, no layout shift. The user's eye never moves horizontally between phases. This is the choreographic thesis of the entire flow.
- **Heading as anchor.** The heading is always the first element and occupies the same position. When headings persist across a transition (e.g., "Verification" stays between phone input and code input), the effect is a partial morph — only content below the heading changes. When headings change, the full crossfade reads as a new "scene."
- **Two speed tiers dominate.** FAST (150ms) handles micro-interactions within a phase: radio select, button enable, digit pop. MEDIUM (300-400ms) handles phase-to-phase transitions. SLOW is used exactly once — the terminal environment transition to the dashboard.
- **No stagger within phases.** Stagger only appears on element groups entering a new phase (provider buttons, code input boxes). Once a phase is settled, all interactions within it are instant or FAST. This prevents the flow from feeling sluggish during decision-making moments.
- **Conditional reveal is the only height animation.** The "Your Name" field expanding below the radio cards is the only moment where the page height changes. Everything else is a fixed-height content swap. This makes the height change feel intentional and significant.
- **Button state as progress signal.** The disabled-to-enabled transition on the Continue button is the only visual progress indicator in the entire flow. There are no step dots, no progress bars, no numbered phases. The button itself communicates "you have done enough to proceed."
- **Brand color in service of differentiation.** The provider button stack (GitHub dark, GitLab purple, Bitbucket blue) is the only moment with non-monochrome color. Color serves recognition, not decoration. The stagger entrance gives each brand a moment of individual attention.
- **Loading state demotion.** When the Verify button enters loading, it demotes from solid black (high authority) to outlined gray (passive wait). The spinner is small and the label changes to "Verifying." Authority moves from the button to the process — the user can no longer act, only wait.
- **Terminal break.** Screen 13 (dashboard) is a complete structural rupture. Every prior screen used centered single-column layout with minimal nav. The dashboard introduces full navigation, two-column card layout, images, icons. The transition from onboarding context to dashboard context is the only moment that justifies a SLOW duration — it is the only genuine environment change.

## What We Can Steal

- **`nl-phase-crossfade`** — The pure opacity crossfade between onboarding phases is the canonical NL page transition. No translateX, no scale, no clip-path. Just opacity 0 to 1 with the exiting content going to 0 simultaneously. Works because the structural sameness of each screen means the eye doesn't need directional cues to understand the change. Directly maps to the NL theme's "opacity crossfade for phase transitions" rule.
- **`nl-radio-card-select`** — Radio card selection pattern with three synchronized signals: border color change (subtle to accent), background tint (transparent to accent-bg), and check icon fill (empty circle to filled blue). The triple signal is necessary on pure white backgrounds where any single change would be insufficient. The FAST timing (150ms) makes selection feel instantaneous.
- **`nl-conditional-field-reveal`** — Height expansion using `grid-template-rows: 0fr` to `1fr` for the conditional name input. The opacity of the inner content is delayed by 150ms so the container opens before the field appears — prevents the jarring effect of content popping in at full size. This is the NL equivalent of accordion expansion.
- **`nl-provider-button-stagger`** — Three branded buttons entering with 120ms stagger intervals. Each button uses the standard NL slide+fade (translateY 8px + opacity). The email link enters last with a longer delay, separating it from the button group. The stagger gives visual hierarchy: first option reads as recommended.
- **`nl-segmented-code-input`** — Four-box code entry with staggered entrance (80ms intervals, tighter than button stagger because the boxes are smaller and closer together). The digit-fill micro-animation (scale 0.8 to 1.0) provides haptic-like feedback for each keystroke.
- **`nl-button-loading-swap`** — Button transitioning from solid-fill active state to outlined loading state. The demotion of visual authority communicates transfer of control from user to system. The spinner is deliberately small (16px) and the label text provides redundant confirmation.
- **`nl-button-activation`** — Disabled-to-enabled state change as the sole progress indicator. The binary color flip (gray to black) is fast enough to feel reactive but visible enough to register. No opacity animation — hard color swap with eased property transitions.

## What to Avoid

- **Don't add step indicators.** Vercel deliberately omits progress dots, numbered steps, and completion bars. The flow is short enough that the user doesn't need a map. Adding step indicators to an NL prototype of this flow would contradict the source material's core philosophy of radical reduction.
- **Don't animate heading text.** The headings appear fully formed at the start of each phase. There is no fade-in, no typewriter effect, no blur entrance on heading text. This is correct — the heading is the orientation anchor and must be immediately readable.
- **Don't use directional transitions between phases.** There is no left-to-right or right-to-left movement between screens. The content is always centered and transitions in place. Adding directional slide would imply a linear sequence that can be navigated backward, which is misleading for a branching onboarding flow.
- **Don't over-stagger.** The longest stagger sequence is 4 items at 120ms intervals (500ms total). The code input uses 80ms intervals. Never exceed ~500ms total stagger duration in an NL onboarding context — the user needs to act, not watch an entrance ceremony.
- **Don't add hover effects to radio cards.** The screenshots show no hover state differentiation on the Hobby/Pro cards. The click target is the entire card, and the selection state is the only visual feedback. Adding hover previews would be noise in a two-option binary choice.
- **Don't animate the spinner continuously at high speed.** The "Verifying" spinner in screen 12 rotates at a calm 800ms per revolution. Faster spinners (200-400ms) create anxiety. In a verification context where the user is waiting on an async process, the spinner should communicate "working" not "rushing."
- **Don't treat the dashboard transition like a phase crossfade.** Screen 12 to 13 is fundamentally different from all other transitions. It is an environment change (onboarding shell to full app), not a content swap within a fixed layout. Using the same 400ms crossfade would make the dashboard feel like another onboarding step. The longer duration (600ms) and potential for a more structural transition (nav slide-in, content area reveal) is appropriate here.
