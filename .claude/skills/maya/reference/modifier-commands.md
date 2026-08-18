# Modifier and Transform Commands

Definitions for Maya's single-dimension transform commands. Load when running one — `SKILL.md` keeps the review surface (`review`, `audit`, `critique`, `polish`) because those run constantly; these are reached for deliberately.

---

### `@maya bolder [component]`
Amplify safe or boring designs to make them more visually interesting and stimulating.

**MANDATORY:** Gather context first (audience, use-cases, brand personality). If unclear, ask.

**WARNING - AI SLOP TRAP:** When making things "bolder," AI defaults to cyan/purple gradients, glassmorphism, neon accents. These are the OPPOSITE of bold—they're generic. Bold means distinctive, not "more effects."

**Amplify across:**
- Typography (extreme scale, weight contrast, unexpected choices)
- Color (increase saturation, dominant color strategy, tinted neutrals)
- Spatial Drama (extreme scale jumps, break the grid, asymmetric layouts)
- Visual Effects (dramatic shadows, textures - NOT glassmorphism)
- Motion (entrance choreography, scroll effects, micro-interactions)
- Composition (hero moments, diagonal flows, unexpected proportions)

### `@maya quieter [component]`
Tone down overly bold or visually aggressive designs while maintaining quality.

**MANDATORY:** Gather context first.

**Refine across:**
- Color (reduce saturation, soften palette, neutral dominance)
- Visual Weight (reduce font weights, hierarchy through subtlety, white space)
- Simplification (remove decorative elements, flatten visual hierarchy)
- Motion (reduce intensity, remove decorative animations, refined easing)
- Composition (reduce scale jumps, align to grid, even out spacing)

### `@maya colorize [component]`
Add strategic color to features that are too monochromatic.

**MANDATORY:** Gather context first, especially existing brand colors.

**Apply color strategically:**
- Semantic Color (success/error/warning/info states)
- Accent Color (primary actions, links, icons, headers)
- Background & Surfaces (tinted backgrounds, colored sections)
- Data Visualization (charts, heatmaps)
- Borders & Accents (colored borders, underlines, dividers)
- Typography Color (colored headings, highlight text)

**Rules:**
- More color ≠ better. Strategic color beats rainbow.
- Use 2-4 colors max beyond neutrals
- Follow 60/30/10 rule (dominant/secondary/accent)
- Never gray text on colored backgrounds
- Never pure gray - always tint warm or cool

### `@maya animate [component]`
Add purposeful animations and micro-interactions that enhance usability and delight.

**MANDATORY:** Gather context first. Respect `prefers-reduced-motion`.

**Animate strategically:**
- Entrance Animations (page load choreography, hero section, content reveals)
- Micro-interactions (button feedback, form interactions, toggles)
- State Transitions (show/hide, expand/collapse, loading states)
- Navigation & Flow (page transitions, tab switching, scroll effects)
- Feedback & Guidance (hover hints, drag & drop, focus flow)
- Delight Moments (empty states, completed actions, easter eggs)

**Technical rules:**
- 100-150ms for instant feedback
- 200-300ms for state changes
- 300-500ms for layout changes
- Use ease-out-quart/quint/expo (NEVER bounce/elastic)
- Only animate transform and opacity (GPU-accelerated)

### `@maya animate review [prototype-path]`
Evaluate an autoplay prototype's animation quality against theme rules, Disney's principles, and the quality checklist.

**This is separate from `@maya animate`** — `animate` adds motion to production React components, while `animate review` evaluates self-running prototype animations built with `/animate`.

**Execution:**

1. **Detect theme** from CSS token prefixes in the file:
   - `--cd-` prefix → cinematic-dark
   - `--nl-` prefix → neutral-light
   - No prefix → default theme

2. **Load reference files:**
   - The detected theme's `THEME.md` (rules, do/don't, timing guide)
   - `.claude/skills/animate/reference/animation-principles.md` (Disney's 12 principles)
   - Quality checklist from `.claude/skills/animate/SKILL.md`

3. **Evaluate across four categories:**

   **Quality Checklist** (13 items, -5 per fail):
   - Icon wiggle, drop zone icon, subtle scale, anticipation, speed hierarchy, directional journey, stagger direction, JS staggers, staging, dwell time, loop replay, embed mode, design system tokens

   **Disney's Principles** (-7 per violation):
   - Staging, anticipation, follow-through, overlapping action, slow in/out, timing, exaggeration, secondary action

   **Theme Compliance** (-5 per violation):
   - Correct token prefix usage, transition technique (wipes vs crossfade), entrance technique (focus-pull vs slide), camera motion (3D vs flat), speed tier count, easing curves

   **Timing Analysis** (-3 per issue):
   - Phase dwell times within recommended ranges
   - Total loop duration appropriate for content
   - Interaction lead time sufficient for spring animations
   - Loop pause present between cycles

4. **Output structured scorecard:**

```
═══════════════════════════════════════════════════
ANIMATION REVIEW: [filename]
Theme: [detected theme]
═══════════════════════════════════════════════════

QUALITY CHECKLIST (X/13 pass)
──────────────────────────────
[PASS] Icon wiggle: Button icons rotate ±14deg
[FAIL] Speed hierarchy: Only 2 tiers visible (need 3+)
  Fix: Add FAST tier for header/footer swaps
...

DISNEY'S PRINCIPLES (X/8 pass)
───────────────────────────────
[PASS] Staging: One attention point per moment
[FAIL] Anticipation: Button press has no signal phase
  Fix: Add brightness glow before scale down
...

THEME COMPLIANCE (X/N pass)
────────────────────────────
[PASS] Token usage: All colors use --cd-* prefix
[FAIL] Transitions: Phase 2 uses opacity fade
  Fix: Use clip-path: inset() wipe per THEME.md
...

TIMING (X/N pass)
──────────────────
[PASS] Phase 0 dwell: 2500ms (range: 2000-2500ms)
[FAIL] Total loop: 12s (expected: 16-19s)
  Fix: Increase processing phase dwell
...

═══════════════════════════════════════════════════
SCORE: XX/100
Deductions: -X checklist, -X principles, -X theme, -X timing
═══════════════════════════════════════════════════
```

**Scoring:** Start at 100. Deductions: -5 per checklist fail, -7 per principle violation, -5 per theme violation, -3 per timing issue. Score >= 80 is shippable.

### `@maya simplify [component]`
Strip designs to their essence by removing unnecessary complexity.

**MANDATORY:** Gather context first. Simplifying the wrong things destroys usability.

**Simplify across:**
- Information Architecture (reduce scope, progressive disclosure, combine related actions)
- Visual (reduce color palette, limit typography, remove decorations, flatten structure)
- Layout (linear flow, remove sidebars, consistent alignment, generous white space)
- Interaction (reduce choices, smart defaults, inline actions, clear CTAs)
- Content (shorter copy, active voice, remove jargon, essential info only)
- Code (remove unused code, flatten component trees, consolidate styles)

**NEVER:**
- Remove necessary functionality
- Sacrifice accessibility
- Make things so simple they're unclear
- Eliminate hierarchy completely

### `@maya normalize [feature]`
Normalize design to match the design system and ensure consistency.

**Steps:**
1. Discover the design system (tokens, components, patterns)
2. Analyze current feature for deviations
3. Create normalization plan
4. Execute systematically across: typography, color, spacing, components, motion, responsive, accessibility

### `@maya extract [component]`
Extract and consolidate reusable components, design tokens, and patterns into the design system.

**Steps:**
1. Find the design system structure
2. Identify patterns (repeated components, hard-coded values, inconsistent variations)
3. Assess value (3+ uses, improves consistency, general vs context-specific)
4. Plan extraction (components, tokens, variants, naming, migration path)
5. Extract & Enrich (well-designed components, clear props API, accessibility, docs)
6. Migrate existing uses
7. Document in design system

### `@maya which preset [intent]`
Determine the correct preset or pattern.

- Use `suggest_preset` or `search_presets_semantic` MCP tools
- Prefer existing patterns over invention
- Explicitly say when no preset exists

### `@maya iterate [component]`
Collaborative refinement mode.

- Present options, not solutions
- Wait for approval before implementing
- Track what was tried and rejected
- Do not finalize until user says "OK, do it"
