---
ref: linear-onboarding-wizard
title: "Linear Onboarding Wizard — Multi-Step Setup Flow"
source: "Mobbin screenshots: /tmp/mobbin-extract/linear-onboarding/ (25 screens)"
type: motion-study
date: 2026-02-26
personality_affinity: neutral-light
tags: [onboarding, wizard, step-indicator, form, card, selection, stagger, transition, multi-step, light-mode, crossfade, progress-dots, authentication, workspace-setup]
quality_tier: exemplary
---

# Linear Onboarding Wizard — Multi-Step Setup Flow

## Summary

Linear's onboarding is a masterclass in progressive disclosure through a multi-step wizard on a clean white canvas. The flow moves through 7 distinct phases — authentication, workspace creation, welcome gate, theme selection, command-menu tutorial, integration offers, and completion — each presented as a centered content block that replaces the previous one via implied opacity crossfade. A horizontal dot progress indicator at the bottom of the wizard phases tracks advancement without adding visual weight. The entire sequence is defined by restraint: no decorative animation, no parallax, no blur, no spring physics. Content enters, the user acts, content exits. This is Neutral Light's ideal reference — clarity as choreography.

## Flow Map

The 25 screenshots decompose into these structural phases:

| Phase | Screens | Layout | Description |
|-------|---------|--------|-------------|
| **A. Landing** | 0 | Dark marketing page | Linear homepage — dark palette, product screenshots, CTA |
| **B. Authentication** | 1-6 | Centered column, white bg | Create workspace → email input → email verification → code entry |
| **C. Workspace Setup** | 7-12 | Centered card on white bg | Form card with name, URL, region, company size, role dropdowns |
| **D. Loading Gate** | 13 | Centered spinner on white bg | Logo with circular progress ring, status text |
| **E. Welcome** | 14 | Centered hero, dot indicator | Large app icon, welcome heading, "Get started" CTA, 7-dot progress |
| **F. Wizard Steps** | 15-22 | Centered content, dot indicator | Theme picker, command menu tutorial, GitHub integration, invite, subscribe, completion |
| **G. App Landing** | 23-24 | Full app UI, dark sidebar | Active issues list with educational popover tooltip |

## Signature Moments

| Trigger / Screen | Effect | Duration (est.) | Easing (NL) | Description |
|------------------|--------|-----------------|-------------|-------------|
| 0→1 / CTA click | full-page-crossfade | MEDIUM (300ms) | ease-out-quart | Dark marketing page dissolves to white auth page — total palette inversion. Logo anchors continuity. |
| 1→2 / "Continue with Email" | inline-expand-reveal | MEDIUM (300ms) | ease-smooth | "Continue with Email" button transforms: button collapses, email input + submit button expand in-place. Heading stays anchored. |
| 2→3 / email entered | field-value-settle | FAST (150ms) | ease-out-quart | Placeholder text replaced by typed email. Input border subtly shifts from idle to filled state. |
| 3→4 / submit email | content-crossfade | MEDIUM (350ms) | ease-out-quart | Auth form fades out, "Check your email" confirmation fades in. Logo stays fixed. Heading text swaps. |
| 4→5 / "Enter code manually" | inline-expand-reveal | MEDIUM (300ms) | ease-smooth | Link text replaced by code input field + "Continue with login code" button. Same expand pattern as screen 1→2. |
| 5→6 / code entered | field-value-settle | FAST (150ms) | ease-out-quart | Code appears in monospace input. Button remains static — awaiting action. |
| 6→7 / code verified | phase-crossfade | MEDIUM (400ms) | ease-out-quart | Auth screens dissolve entirely. Workspace creation form card fades in with slight slide-up. Navigation chrome appears (Log out, Logged in as). |
| 7→8 / workspace name typed | live-slug-generation | FAST (150ms) | — | URL field auto-populates slug derived from workspace name. Feels instantaneous — no transition, just reactivity. |
| 8→9 / region dropdown | dropdown-expand | FAST (200ms) | ease-out-quart | Small dropdown appears below region selector. Two options. Checkmark indicates current selection. |
| 9→10 / region selected | dropdown-collapse + info-reveal | FAST/MEDIUM (200/300ms) | ease-out-quart / ease-smooth | Dropdown collapses. Helper text expands below: region warning with "Learn more" link. Container height animates smoothly. |
| 10→11 / company size dropdown | dropdown-expand-long | MEDIUM (300ms) | ease-out-quart | Taller dropdown with 8 options. List items may enter with micro-stagger (~30ms). |
| 11→12 / all fields filled | form-complete-state | FAST (150ms) | ease-out-quart | Both dropdowns show selected values. "Create workspace" button visually ready. No glow, no pulse — just filled state. |
| 12→13 / submit workspace | card-dissolve + spinner-entrance | MEDIUM (400ms) | ease-out-quart | Form card fades out. Loading state fades in: Linear logo inside circular progress ring, "Setting up your workspace..." text below. Logo scales slightly smaller than auth screens. |
| 13→14 / workspace ready | spinner-to-welcome | SLOW (500ms) | ease-out-quart | Loading spinner dissolves. Welcome screen enters: large glossy app icon (3D-ish, rounded rect), large heading "Welcome to Linear", subtitle, purple "Get started" CTA. 7-dot progress indicator appears at bottom. First dot active. |
| 14→15 / "Get started" | wizard-step-crossfade | MEDIUM (350ms) | ease-out-quart | Welcome content fades out. "Choose your style" theme picker fades in. Two side-by-side cards (Light selected with blue border, Dark). Second dot activates. |
| 15→16 / "Continue" | wizard-step-crossfade | MEDIUM (350ms) | ease-out-quart | Theme picker out. "Meet the command menu" in. Card shows keyboard shortcut visualization (Cmd+K). Third dot activates. |
| 16→17 / Cmd+K pressed | command-palette-entrance | MEDIUM (300ms) | ease-out-quart | Command palette dialog appears: search input at top, action list below with icons and keyboard shortcuts. Card-on-card layering. Heading text changes to instructional. |
| 17→18 / action completed | content-crossfade + micro-celebration | MEDIUM (350ms) | ease-out-quart | Command palette gone. "That was easy!" confirmation text. Understated — no confetti, no animation. Just text swap. Third dot stays active. |
| 18→19 / "Continue" | wizard-step-crossfade | MEDIUM (350ms) | ease-out-quart | Transition to "Connect with GitHub". GitHub icon, feature list card with 3 checkmarked rows, purple CTA, "I'll do this later" skip link. Fourth dot activates. |
| 19→20 / skip or continue | wizard-step-crossfade | MEDIUM (350ms) | ease-out-quart | "Invite co-workers" screen. Card with invite link input, copy button (purple), "Invite with email" link. Fifth dot activates. |
| 20→21 / "Continue" | wizard-step-crossfade | MEDIUM (350ms) | ease-out-quart | "Subscribe to updates" screen. Card with toggle (changelog) and button (@linear Twitter). Sixth dot activates. |
| 21→22 / "Continue" | wizard-step-crossfade + card-stagger | MEDIUM/SLOW (350/500ms) | ease-out-quart | "You're good to go" completion screen. Three side-by-side action cards (Tell your team, Integrate GitHub & Slack, Keyboard shortcuts) enter — likely staggered left-to-right. "Open Linear" CTA. Seventh dot activates. |
| 22→23 / "Open Linear" | full-page-transition-to-app | SLOW (500-650ms) | ease-out-quart | Onboarding dissolves. Full Linear app UI loads: dark sidebar, issue list, educational popover dialog. The most dramatic transition in the flow — moving from wizard isolation to full product chrome. |
| 23→24 / dismiss popover | popover-dismiss | FAST (200ms) | ease-in | Educational popover ("Active Issues" explanation) fades out. Full issue list revealed. Onboarding complete. |

## Technique Breakdown

### 1. Wizard Step Crossfade (Core Pattern)

The backbone of screens 14-22. Each step uses the same transition: outgoing content fades to 0, incoming content fades from 0. No directional slide between wizard steps — pure opacity swap.

```css
/* nl-wizard-step-crossfade — Phase content transition */
.wizard-step {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--nl-medium, 350ms) var(--nl-ease-out);
}

.wizard-step.active {
  opacity: 1;
  pointer-events: auto;
}

.wizard-step.exiting {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--nl-medium, 300ms) var(--nl-ease-in);
}
```

**Key detail:** Exit is slightly faster than entrance (~300ms vs ~350ms). The outgoing content should feel like it's yielding, not competing.

### 2. Dot Progress Indicator

Seven dots at the bottom of screens 14-22. Active dot is filled/darker, inactive dots are lighter/hollow. Transition between states is a fast fill.

```css
/* nl-progress-dot — Wizard step indicator */
.progress-dots {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 24px 0;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nl-text-quaternary, #a8a29e);
  transition: background var(--nl-fast, 150ms) var(--nl-ease-out);
}

.progress-dot.active {
  background: var(--nl-text-secondary, #44403c);
}

.progress-dot.completed {
  background: var(--nl-text-tertiary, #78716c);
}
```

**No width animation, no pulse, no scale.** Just a color shift. This is the Neutral Light way — progress without performance.

### 3. Inline Expand Reveal (Auth Pattern)

Screens 1→2 and 4→5. A button or link transforms into a form field group. The container height animates to accommodate new content.

```css
/* nl-inline-expand — Button transforms to input group */
.auth-expandable {
  overflow: hidden;
  transition: max-height var(--nl-medium, 300ms) var(--nl-ease-smooth);
}

.auth-expandable[data-state="collapsed"] {
  max-height: 56px; /* Single button height */
}

.auth-expandable[data-state="expanded"] {
  max-height: 140px; /* Input + button height */
}

.auth-expandable .input-group {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--nl-medium, 300ms) var(--nl-ease-out),
              transform var(--nl-medium, 300ms) var(--nl-ease-out);
}

.auth-expandable[data-state="expanded"] .input-group {
  opacity: 1;
  transform: translateY(0);
}
```

### 4. Card Selection State (Theme Picker)

Screen 15. Two side-by-side cards. Selected card gets a blue border. Unselected card has subtle gray border.

```css
/* nl-card-select — Exclusive selection with border highlight */
.theme-card {
  border: 2px solid var(--nl-border-subtle, #e7e5e4);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: border-color var(--nl-fast, 150ms) var(--nl-ease-out),
              background var(--nl-fast, 150ms) var(--nl-ease-out);
}

.theme-card:hover {
  background: var(--nl-surface-hover, #e7e5e4);
}

.theme-card[aria-selected="true"] {
  border-color: var(--nl-accent, #3b82f6);
  background: var(--nl-accent-bg, #eff6ff);
}
```

### 5. Completion Card Stagger

Screen 22. Three action cards enter side-by-side. Implied stagger — left card first, then middle, then right.

```css
/* nl-card-stagger — Completion screen card entrance */
.completion-card {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--nl-medium, 350ms) var(--nl-ease-out),
              transform var(--nl-medium, 350ms) var(--nl-ease-out);
}

.completion-cards.visible .completion-card:nth-child(1) { transition-delay: 0ms; }
.completion-cards.visible .completion-card:nth-child(2) { transition-delay: 80ms; }
.completion-cards.visible .completion-card:nth-child(3) { transition-delay: 160ms; }

.completion-cards.visible .completion-card {
  opacity: 1;
  transform: translateY(0);
}
```

**80ms stagger interval.** Fast enough to feel like a group, slow enough to read as sequence. NL keeps stagger intervals tight — this is functional choreography, not showmanship.

### 6. Feature List Row Stagger (GitHub Card)

Screen 19. Three feature bullet rows inside a card, each with a checkmark icon. Implied stagger top-to-bottom.

```css
/* nl-list-stagger — Feature list entrance within card */
.feature-row {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity var(--nl-medium, 300ms) var(--nl-ease-out),
              transform var(--nl-medium, 300ms) var(--nl-ease-out);
}

.feature-card.visible .feature-row:nth-child(1) { transition-delay: 50ms; }
.feature-card.visible .feature-row:nth-child(2) { transition-delay: 120ms; }
.feature-card.visible .feature-row:nth-child(3) { transition-delay: 190ms; }

.feature-card.visible .feature-row {
  opacity: 1;
  transform: translateY(0);
}
```

**70ms interval between rows.** Slightly tighter than card stagger — rows are smaller elements with less visual weight, so they can sequence faster.

## Choreography Notes

### Speed Hierarchy Observed

Linear's onboarding uses exactly the 3-tier model that Neutral Light codifies:

1. **FAST (150-200ms)** — Dot state changes, field value appearance, dropdown toggle, input focus borders. Anything that responds to direct interaction.
2. **MEDIUM (300-400ms)** — Content crossfades between wizard steps, card entrances, form expand/collapse. The workhorse tier — most transitions live here.
3. **SLOW (500-650ms)** — Loading gate to welcome, final transition to full app UI. Reserved for structural shifts — when the entire context changes.

### Anchor Strategy

Every phase transition keeps one element stable to prevent disorientation:

| Transition | Anchor |
|------------|--------|
| Landing → Auth | Linear logo (shifts from nav to centered) |
| Auth screens | Logo + heading position (content swaps below) |
| Auth → Workspace | Page background (white canvas persists) |
| Workspace form states | Card container (content changes within) |
| Loading → Welcome | Center point of page (spinner → icon occupy same zone) |
| Wizard steps | Dot indicator + vertical center alignment |
| Wizard → App | None — full break. This is intentional. |

The wizard-to-app transition (screen 22→23) is the only moment without an anchor. This communicates: "Onboarding is over. You're in the product now." The structural break *is* the signal.

### Content Density Progression

The flow gradually increases information density:

1. **Auth** (screens 1-6): 1-2 elements. Maximum white space. Zero cognitive load.
2. **Workspace** (screens 7-12): Form card with 4-5 fields. Moderate density but contained in a single card.
3. **Loading** (screen 13): Single element. Breathing room before the wizard.
4. **Wizard** (screens 14-22): Title + card + CTA. Consistent density. Never more than one decision per screen.
5. **App** (screens 23-24): Full product UI. Maximum density. The contrast makes the product feel powerful.

This is the essence of onboarding choreography: **start sparse, end dense, never jump.**

### The Purple Button System

Linear uses a consistent muted purple/indigo (`~#7c6fea`) for all primary CTAs throughout onboarding. The button never changes color, never pulses, never glows. It is always the same size and position (centered, full-width of the content column). This consistency means the user never has to *find* the next action — it's always in the same place with the same appearance.

In NL terms, this maps to `--nl-accent` for the active state, though Linear's actual purple is warmer than our blue-500. The principle holds: **one CTA style, one CTA position, across the entire wizard.**

### What the Dot Indicator Communicates

The 7-dot progress indicator (screens 14-22) tells the user three things without words:

1. **Where I am** — Active dot (filled)
2. **How far I've come** — Dots to the left (completed state)
3. **How much is left** — Dots to the right (inactive state)

It does NOT tell you what each step contains. This is a deliberate information design choice — showing step labels would add cognitive load ("Do I need to do all of these?"). Dots are abstract enough to feel lightweight.

## What We Can Steal

- **`nl-wizard-step-crossfade`** — The core wizard transition. Pure opacity swap with no directional slide. Works because the content column stays centered and the dot indicator provides spatial continuity. Directly maps to NL's opacity crossfade technique. Use for any multi-step onboarding, setup wizard, or tutorial sequence.

- **`nl-progress-dots`** — Minimal dot progress indicator. Color shift only — no width expansion, no pulse, no scale. Three states: inactive (quaternary text), completed (tertiary text), active (secondary text). Pairs with the crossfade to create a complete wizard navigation system.

- **`nl-inline-expand`** — Button-to-input transformation. The "Continue with Email" button expands into an email input field + submit button. Container height animates with ease-smooth. This is a smarter alternative to showing the input upfront — it reduces initial visual complexity.

- **`nl-card-select`** — Border-highlight selection for exclusive choice cards (Light/Dark theme picker). Selected card gets accent border + subtle accent background. Transition is FAST tier. No scale, no shadow lift — border color alone communicates state.

- **`nl-completion-stagger`** — 3-card horizontal stagger entrance for the completion screen. 80ms interval, slide+fade from 8px below. Works as a "landing moment" — the user sees a summary of what they can do next, revealed progressively.

- **`nl-list-row-stagger`** — Feature list stagger inside a card (GitHub integration benefits). 70ms interval, 6px translateY. Tighter than card stagger. Useful for any bulleted benefit list, checklist, or feature summary within a card.

- **`nl-loading-gate`** — Logo + circular progress ring + status text. The breathing room between form submission and the wizard. This "interstitial pause" pattern prevents the jarring jump from form → wizard. Time: SLOW tier. Use wherever a backend operation needs a dignified wait state.

- **Anchor strategy** — The principle of keeping one element stable across every transition. Logo during auth, card container during form, dot indicator during wizard. This should be a formal choreography rule for NL prototypes.

## What to Avoid

- **Don't add directional slides between wizard steps.** Linear's wizard steps don't slide left/right despite being a sequential flow. Directional slide implies spatial layout (steps arranged horizontally), which creates expectations about navigation (swipe? back button goes left?). Opacity crossfade is spatially neutral — each step occupies the same space.

- **Don't animate the dot indicator with width expansion.** Some wizard implementations make the active dot wider (pill shape). Linear keeps all dots the same size. Width animation draws attention to the progress indicator, stealing focus from the content. The indicator should be glanceable, not watchable.

- **Don't add celebration animation to micro-completions.** Screen 18 ("That was easy!") uses plain text — no confetti, no checkmark animation, no scale-up. The restraint is the point. Celebration animation in a 7-step wizard would be exhausting by step 3.

- **Don't use the dark landing page style inside the onboarding wizard.** Screen 0 is marketing — dark, product-shot heavy, dramatic. The onboarding (screens 1-22) is clinical white. These are two different contexts with different animation vocabularies. Don't bleed cinematic-dark patterns into NL territory.

- **Don't show all form fields at once if some can be progressive.** The auth flow (screens 1-6) shows email input only after clicking "Continue with Email." The inline-expand pattern reduces initial complexity. Avoid presenting a wall of inputs when progressive disclosure would serve better.

- **Don't skip the loading gate.** Screen 13 exists even though the workspace creation might complete in under a second. The loading state provides psychological transition time — the user needs a beat to shift from "filling out a form" to "being welcomed." Cutting straight from form submit to the welcome screen would feel abrupt.

- **Don't use spring easing for wizard transitions.** The entire flow uses ease-out-quart for entrances and ease-in for exits. Spring physics would add personality that competes with the content. Tutorials are about clarity; spring is about delight. Wrong tool.

- **Don't animate form validation inline.** Screens 7-12 show form fields filling in without visible validation animation (no green checkmarks appearing, no red shake on error). The form trusts the user. Inline validation animation adds anxiety. Save it for explicit error states only.
