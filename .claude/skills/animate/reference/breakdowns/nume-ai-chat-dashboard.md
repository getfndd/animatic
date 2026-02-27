---
ref: nume-ai-chat-dashboard
title: "Nume.ai — Chat-to-Dashboard Progressive Build"
source: "https://www.nume.ai/ (saved HTML + 2 MP4 product demo animations)"
type: video
date: 2026-02-27
personality_affinity: editorial
tags: [chat, ai, dashboard, typewriter, progressive-reveal, split-pane, report, stagger, count-up, suggestion-chips, streaming, product-demo, conversation]
quality_tier: exemplary
---

# Nume.ai — Chat-to-Dashboard Progressive Build

## Summary

Nume.ai's product demo animations are a masterclass in **progressive disclosure through conversation**. Two looping MP4s show an AI CFO chatbot that starts as a simple chat input and builds — through natural dialogue — into a fully populated financial dashboard. The key innovation is the **chat-to-split-pane transition**: the conversation pane slides left as a report panel materializes on the right, creating a dual-pane layout from what was a single column. Every element enters through a purposeful sequence — typewriter input, streaming response, card materialization, pane split, stat count-ups, chart renders, suggestion chips — producing a 5-tier speed hierarchy that makes the whole thing feel alive without feeling busy.

Worth studying for: conversation-driven progressive disclosure, the single-pane → dual-pane choreography, how AI response streaming differs from typewriter, and the suggestion chip pattern as a narrative branching device.

## Signature Moments

### GIF_01 — Chat to Report (14s)

| Timestamp | Effect | Duration | Easing | Description |
|-----------|--------|----------|--------|-------------|
| 0:00 | cursor-blink | 530ms loop | step-end | Blinking cursor in empty chat input field. Monospace "Message Nume" placeholder. Solid white block cursor, not line cursor. |
| 0:01–0:02 | chat-typewriter | ~2000ms | linear (per char ~80ms) | "How did we do last month?" types into the input field character by character. Monospace font, left-aligned. Slightly slower than standard typewriter — deliberate, human cadence. |
| 0:03 | input-to-bubble | ~400ms | ease-out | Typed text submits: input clears, text reappears in a right-aligned dark bubble (user message). Bubble fades in with subtle scale(0.97→1.0). Input returns to empty with cursor. |
| 0:04–0:06 | ai-response-stream | ~3000ms | linear (stream), ease-out (per chunk) | AI response text appears left-aligned in word-groups (~3-5 words at a time), simulating real-time generation. Not character-by-character — chunked streaming. Each chunk fades in with translateY(4px→0). |
| 0:06 | report-card-materialize | ~500ms | expo-out | Document card slides up from below with opacity 0→1. Contains: document icon (left), title "Performance Report" + subtitle "November 2024" (center), arrow → (right). Dark elevated card on dark background, subtle border. |
| 0:07–0:08 | continued-stream + question | ~2000ms | linear | More AI text streams in below the card: analysis paragraph + follow-up question. Text pushes the chat container height smoothly (container height animates, not jumps). |
| 0:08–0:09 | cursor-move-to-card | ~400ms | ease-in-out | Simulated cursor appears and moves to the report card. Hover state: card background lightens subtly. |
| 0:09–0:10 | chat-to-split-pane | ~600ms | expo-out | **The signature moment.** Single-column chat compresses leftward (~45% width) as right panel slides in from right edge. Left pane gets a header bar (Nume logo). Right panel has its own header ("Performance Report — November 2024" with document icon). Seamless — the chat content doesn't reflow, it scales/compresses. |
| 0:10–0:11 | stat-card-stagger | 200ms interval, ~800ms total | expo-out per card | Four metric cards stagger left-to-right: "Cash in Bank $338,500", "Revenue $36,000", "Net Burn $41,000", "Runway 8 months". Each card: fadeIn + translateY(12px→0). Values appear as count-up numbers. Green/red delta badges fade in 200ms after value settles. |
| 0:11–0:12 | chart-render | ~800ms | ease-out | Bar chart ("Performance vs Budget") renders: bars grow upward from baseline with staggered timing. Blue/cyan color coding. Chart container fades in first (200ms), then bars animate sequentially. |
| 0:12–0:14 | content-section-stagger | 120ms interval | ease-out | "Key Points" and "Action & Outlook" sections fade in as two columns below the chart. Bullet points stagger within each column at ~80ms interval. Bold inline text highlights ("fixed costs", "what's working in sales") appear with subtle brightness emphasis. |

### GIF_02 — Drill-Down Thread (18s)

| Timestamp | Effect | Duration | Easing | Description |
|-----------|--------|----------|--------|-------------|
| 0:00–0:02 | suggestion-chip-stagger | 150ms interval, ~450ms total | expo-out | Three outlined pill buttons stagger top-to-bottom: "Drill down into fixed costs", "Explore how we beat revenue targets", "Review overall drivers of the increased burn". Cyan/teal border on dark background. Each chip: opacity 0→1 + translateY(8px→0). Monospace font inside pills. |
| 0:03 | chip-select + bubble | ~400ms | ease-out | First chip activates (border brightens, subtle scale pulse), then content moves to right-aligned user bubble. Other chips fade out simultaneously (200ms). |
| 0:04–0:07 | ai-response-stream-2 | ~3000ms | linear | Second AI response streams in with new analysis text + new report card ("Overspending Analysis — November 2024"). Same streaming pattern as GIF_01. |
| 0:07–0:08 | cursor-to-card-2 | ~400ms | ease-in-out | Cursor moves to new report card. |
| 0:08–0:09 | panel-content-swap | ~500ms | expo-out (new), ease-in (old) | Right panel content crossfades: old report fades out (opacity 1→0, 200ms), new report fades in (opacity 0→1 + translateY(8px→0), 300ms). Header updates: "Overspending Analysis — November 2024". Panel frame stays stable — only interior content transitions. |
| 0:09–0:10 | chart-update | ~600ms | ease-out | Updated bar chart renders with same grow-from-baseline pattern. New data, same visual language. |
| 0:10–0:12 | table-row-stagger | 80ms interval | ease-out | Detailed overspending table populates: header row appears first, then data rows stagger top-to-bottom. Columns: Category, Actual ($), Budget ($), Overrun ($), Overrun (%). Each row: opacity 0→1 + translateX(-4px→0). Overrun column values appear with red/green color coding. |
| 0:12–0:14 | left-panel-scroll + sections | continuous | ease-out per section | Left chat panel scrolls down to reveal continued AI response. "Summary" heading enters, followed by bulleted lists: "Major Overruns" (Salaries, IT & Software, Other expenses, Rent) and "Savings Offsetting" (Travel & Office, Sales & Marketing). Bullets stagger at 60ms interval. |
| 0:14–0:16 | recommendations-stream | ~2000ms | linear | Numbered recommendations stream in: "1. Salaries and employment costs" → detailed paragraph → "2. IT and Software" → action items. Progressive reveal — longer content blocks stream in sentence-by-sentence rather than all at once. |
| 0:16–0:18 | second-chip-stagger | 150ms interval | expo-out | New suggestion chips appear: "Review salaries", "Deep dive into IT & Software costs", "Break down other expenses". Same cyan-outlined pill pattern. Loop point. |

## Technique Breakdown

### Chat Typewriter (input field variant)

```css
/* Typewriter in an input-like container — not a heading */
.chat-input {
  font-family: 'Aeonik Mono', monospace;
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 12px;
  padding: 16px 20px;
  background: transparent;
}

/* Cursor is a solid block, not a line */
.chat-cursor {
  display: inline-block;
  width: 8px; height: 18px;
  background: white;
  animation: block-blink 1060ms step-end infinite;
  vertical-align: text-bottom;
}
@keyframes block-blink {
  0%, 50% { opacity: 1; }
  50.1%, 100% { opacity: 0; }
}
```

### AI Response Streaming (word-group chunks)

```css
/* Unlike typewriter (char-by-char), this reveals word-groups */
.ai-chunk {
  opacity: 0;
  transform: translateY(4px);
  animation: chunk-reveal 200ms ease-out forwards;
  animation-delay: var(--chunk-delay);
}
@keyframes chunk-reveal {
  to { opacity: 1; transform: translateY(0); }
}
/* JS staggers --chunk-delay at ~120ms intervals per 3-5 word group */
/* Container height transitions smoothly as content is added */
.chat-body {
  transition: height 300ms ease-out;
}
```

### Chat-to-Split-Pane Transition

```css
/* The hero choreography — single column splits into dual pane */
.chat-container {
  width: 100%;
  transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.chat-container.split {
  width: 45%;
}

.report-panel {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 55%;
  opacity: 0;
  transform: translateX(40px);
  transition: opacity 400ms ease-out 200ms,
              transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.report-panel.active {
  opacity: 1;
  transform: translateX(0);
}
/* Chat header bar materializes simultaneously */
.chat-header {
  height: 0; opacity: 0;
  transition: height 400ms ease-out, opacity 300ms ease-out;
}
.split .chat-header {
  height: 48px; opacity: 1;
}
```

### Suggestion Chip Stagger

```css
.suggestion-chip {
  font-family: 'Aeonik Mono', monospace;
  border: 1px solid rgba(0, 210, 190, 0.6); /* cyan/teal */
  border-radius: 999px;
  padding: 10px 20px;
  color: rgba(0, 210, 190, 0.9);
  background: transparent;
  opacity: 0;
  transform: translateY(8px);
  animation: chip-enter 350ms expo-out forwards;
  animation-delay: calc(var(--chip-index) * 150ms);
}
@keyframes chip-enter {
  to { opacity: 1; transform: translateY(0); }
}
/* On select: border brightens, subtle pulse, then content migrates to bubble */
.suggestion-chip.selected {
  border-color: rgba(0, 210, 190, 1);
  animation: chip-pulse 200ms ease-out;
}
/* Unselected chips fade out simultaneously */
.suggestion-chip.dismissed {
  animation: chip-exit 200ms ease-in forwards;
}
@keyframes chip-exit {
  to { opacity: 0; transform: translateY(-4px); }
}
```

### Stat Card Count-Up Stagger

```css
.stat-card {
  opacity: 0;
  transform: translateY(12px);
  animation: stat-enter 400ms expo-out forwards;
  animation-delay: calc(var(--stat-index) * 200ms);
}
@keyframes stat-enter {
  to { opacity: 1; transform: translateY(0); }
}
/* Value count-up runs after card entrance settles */
/* Delta badge (green +3.4%, red -14.5%) fades in 200ms after value */
.stat-delta {
  opacity: 0;
  animation: delta-fade 200ms ease-out forwards;
  animation-delay: calc(var(--stat-index) * 200ms + 600ms);
}
```

## Choreography Notes

### 5-Tier Speed Hierarchy

This is the most disciplined speed hierarchy I've seen in a product demo:

| Tier | Speed | Elements | Role |
|------|-------|----------|------|
| **INSTANT** | 0-100ms | Cursor blink, chip select pulse | Feedback — "I heard you" |
| **FAST** | 150-300ms | Chip enter/exit, delta badges, bullet points | Supporting cast — quick, don't compete |
| **MEDIUM** | 400-600ms | Bubble submit, card materialize, panel swap | Action beats — clear narrative punctuation |
| **SLOW** | 600-800ms | Split-pane transition, stat stagger sequence, chart render | Scene changes — give the eye time to reorient |
| **AMBIENT** | 2000-3000ms | AI streaming, typewriter, recommendation flow | Content rhythm — the reading pace |

### Directional Journey

The animation creates spatial meaning through consistent direction:

- **User actions** → right-aligned (bubbles, chip selections)
- **AI responses** → left-aligned (text, cards, suggestions)
- **Expansion** → rightward (split-pane opens right)
- **New content** → upward (content pushes chat up as it arrives)
- **Drill-down** → the report panel *replaces* content in-place rather than expanding further

### Narrative Structure

Both animations follow **question → process → answer → branch**:

1. User asks → typewriter creates anticipation
2. AI processes → streaming creates the feeling of thinking
3. Report materializes → the answer is a *thing*, not just text
4. Follow-up branches → suggestion chips invite continuation

The report card is a genius intermediary: it appears inline in the conversation (text scale), then when clicked, it *becomes* a full dashboard panel. The object persists — it just changes context.

## What We Can Steal

- **`bk-chat-typewriter-submit`** — The input-field typewriter → bubble submit transition. Works for any chat/command interface demo. The monospace font + block cursor sells "someone is actually typing this." Key detail: the submit doesn't snap — the text fades out of the input and fades into the bubble, maintaining spatial continuity.

- **`bk-ai-response-stream`** — Word-group streaming is fundamentally different from character typewriter. It's chunked (3-5 words at a time), each chunk fades in with a micro-slide, and the container grows smoothly. Perfect for demonstrating AI products without the "watching paint dry" pace of char-by-char.

- **`bk-chat-to-split-pane`** — The single-column → dual-pane transition. The chat compresses, the report panel slides in, and a header bar materializes — all in one 600ms move. This is the signature choreography. Applicable to any "simple view → detailed view" transition: chat → report, list → detail, search → results.

- **`bk-suggestion-chip-stagger`** — Outlined monospace pills with cyan/teal accent on dark background. The stagger (150ms interval) + select pulse + dismiss fade creates a complete interaction arc. The monospace font inside pills is a strong choice — it says "these are commands, not suggestions."

- **`bk-stat-card-count-up`** — Metric cards that enter with stagger, then count up their values, then reveal delta badges. Three sequential micro-animations on the same element, timed to the stagger offset. Reusable for any dashboard reveal.

- **`bk-panel-content-swap`** — Report panel interior crossfades between different reports while the panel frame stays fixed. Old content fades out (fast, 200ms), new content fades in with micro-slide (300ms). Keeps the user oriented — the container is stable, only the content changes.

- **`bk-table-row-stagger`** — Data table rows entering top-to-bottom with a tight 80ms interval and subtle leftward slide. The header row enters first as a group, then data rows follow. Column values can have color coding that appears as part of the row entrance.

- **`bk-report-card-materialize`** — The compact document card (icon + title + subtitle + arrow) that slides up inline in conversation. It's an intermediate object — a preview of the full report at chat scale. When clicked, it becomes the anchor for the dashboard panel. This "object that changes context" pattern is reusable for any inline-preview → expanded-view transition.

- **`bk-scroll-trigger-typewriter`** — The page-level scroll-triggered typewriter with a "thinking before speaking" cursor pre-blink. GSAP ScrollTrigger fires at "top 90%", cursor blinks twice (800ms), then Typed.js takes over. The pre-blink beat is the differentiator — it creates anticipation that a standard instant-start typewriter lacks.

## What to Avoid

- **The streaming pace for short content** — The ~120ms-per-chunk streaming works for multi-sentence AI responses but would feel sluggish for headings or short labels. Reserve streaming for content that benefits from "being generated."

- **Cyan accent for non-interactive elements** — The cyan/teal is reserved exclusively for interactive suggestion chips. Using it on static text or decorative elements would dilute its "clickable" signal. Good discipline to maintain.

- **Dual-pane on narrow viewports** — The 45%/55% split requires substantial width. Below ~900px, this becomes unusable. Need a stack or sheet pattern for mobile.

## Page-Level Animations (Website)

Beyond the two product demo videos, the Nume.ai homepage uses:

| Pattern | Implementation | Notes |
|---------|---------------|-------|
| Logo marquee | Finsweet marquee, CSS `animation: slide 25s infinite linear` | Standard ticker, ~10 logos |
| Scroll-trigger typewriter | GSAP ScrollTrigger + Typed.js, 50ms/char, cursor pre-blinks 2x before typing | Two instances: "Get started in minutes" (process section) + "Get started" (CTA section) |
| Section reveals | GSAP ScrollTrigger, start: "top 90%" | Standard fadeIn reveals on scroll |
| Number counters | Finsweet `fs-cnumbercount-instance` | "500+ growing companies" stat |
| Navbar interactions | Webflow IX3 native | Promo banner dismiss, mobile menu |

The scroll-trigger typewriter pattern is worth noting: cursor blinks twice before typing begins, creating a "thinking before speaking" beat. Nice touch.
