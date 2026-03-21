# Storyboard Format Spec

A storyboard is the design checkpoint between a creative brief and production. It defines what happens, when, and how — without committing to implementation. Every panel is a decision that a human reviews before any code is written.

## Philosophy

The storyboard answers three questions in order:
1. **What does the audience feel?** (narrative arc, energy)
2. **What do they see?** (composition, visual direction)
3. **How does it move?** (choreography, timing)

Question 3 is Animatic's strength. Questions 1 and 2 are where quality lives. A storyboard that nails feeling and composition will produce a great video regardless of the motion system. A storyboard that specifies motion without addressing feeling produces technically competent garbage.

## Format

```json
{
  "storyboard_id": "sb_fintech_insights_v1",
  "brief_ref": "brief_fintech_v1",
  "title": "Fintech Insights — Product Sizzle",
  "version": 1,

  "direction": {
    "narrative": "Open quiet, build through product demonstration, resolve with brand confidence",
    "tone": "Confident but not aggressive. Let the product speak. Mercury-level restraint.",
    "energy_arc": "quiet → build → peak → resolve → quiet",
    "total_duration_s": 30,
    "personality": "cinematic-dark",
    "style": "prestige"
  },

  "brand": {
    "ref": "fintech-demo",
    "palette_note": "Dark navy backgrounds, warm off-white text, indigo accents. No pure white. No pure black.",
    "typography_note": "Inter or similar geometric sans. Light weight (300) for display, medium (500) for UI labels. Never bold for taglines.",
    "surface_note": "Subtle card surfaces with 4% white opacity. Borders at 6% opacity. Deep shadows on elevated panels."
  },

  "panels": [
    {
      "panel_id": "p_01",
      "act": "open",
      "intent": "Set the tone. Quiet confidence.",
      "description": "Single tagline centered on dark field. No decoration. Just type and space.",
      "content": "Clarity takes craft.",
      "duration_s": 3,
      "transition_in": null,
      "transition_out": { "type": "crossfade", "duration_ms": 600 },
      "camera": "static",
      "energy": "low",
      "content_type": "typography",

      "visual_direction": {
        "composition": "Dead center, generous negative space on all sides",
        "typography": "38px, weight 300, -0.02em tracking, warm off-white on navy",
        "color": "Single color — text on background. Nothing else.",
        "reference": "Mercury 'Clarity takes craft.' frame — the restraint IS the design"
      },

      "motion_notes": {
        "entrance": "Fade in over 400ms, ease-out. No movement — just opacity.",
        "hold": "Static for 2s. Let the audience read.",
        "exit": "Crossfade to next panel"
      }
    },

    {
      "panel_id": "p_02",
      "act": "build",
      "intent": "Show the AI generating actionable insights. This is the product moment.",
      "description": "Three insight cards stack vertically, each revealing a financial trend. Cards are dark surfaces with subtle borders — the content is the focus, not the chrome.",
      "content": [
        { "trend": "up", "title": "12% revenue growth", "detail": "Q3 to Q4 revenue increased from $12,459 to $12,950" },
        { "trend": "down", "title": "Decreased card spend", "detail": "Card spend decreased 8% from $3,490 to $3,210" },
        { "trend": "up", "title": "Increased software spend", "detail": "Software spend increased 16% from $3,283 to $3,808" }
      ],
      "duration_s": 5,
      "transition_in": { "type": "crossfade", "duration_ms": 600 },
      "transition_out": { "type": "crossfade", "duration_ms": 400 },
      "camera": "push_in 0.12",
      "energy": "high",
      "content_type": "insight_cards",

      "visual_direction": {
        "composition": "Cards centered, 560px max width, 14px gap between cards. Vertically centered as a group.",
        "typography": "Card titles: 15px weight 600. Detail text: 13px weight 400, 55% opacity. Trend icons: ↗/↘ in semantic colors.",
        "color": "Card bg: 3.5% white. Border: 6% white. Green for up trends, slate for down.",
        "surfaces": "14px border radius. 18px horizontal padding, 20px vertical.",
        "reference": "Mercury insight cards — notice how the cards don't compete with each other. Equal visual weight, stacked simply."
      },

      "motion_notes": {
        "entrance": "Container enters with cd-card-cascade (translateY 16→2→0, 3-keyframe settle). Camera begins gentle push_in.",
        "choreography": "If individual card stagger is desired: 180ms interval, sequential, descending amplitude.",
        "hold": "Cards visible for ~3s. Camera continues push_in.",
        "exit": "Crossfade to prompt input"
      }
    },

    {
      "panel_id": "p_03",
      "act": "build",
      "intent": "Show the conversational interface. The user can ask follow-up questions naturally.",
      "description": "A chat input field appears center-screen. Text types into it: 'Tell me more about: Increased software spend.' The input has a purple submit button — the only accent color in the scene.",
      "content": "Tell me more about: Increased software spend.",
      "duration_s": 4,
      "transition_in": { "type": "crossfade", "duration_ms": 400 },
      "transition_out": { "type": "hard_cut" },
      "camera": "static",
      "energy": "moderate",
      "content_type": "prompt_input",

      "visual_direction": {
        "composition": "Input field centered horizontally and vertically. 580px max width. Nothing else on screen except the dark background.",
        "typography": "15px weight 400 inside the input. The typed text should feel like a real user typing, not a label.",
        "color": "Input bg: 5% white. Border: 8% white. Submit button: indigo (#6366f1). Upload icon: 30% white.",
        "surfaces": "28px border radius (pill shape). 14px vertical padding, 20px horizontal.",
        "reference": "Mercury prompt input — notice the restraint. One input, one action, nothing else."
      },

      "motion_notes": {
        "entrance": "Input field enters with cd-panel-drilldown (scale 0.97→1 + translateY 20→0). 500ms.",
        "interaction": "Text types in at ~40ms per character after 600ms delay. cd-typewriter primitive.",
        "hold": "Brief hold after typing completes.",
        "exit": "Hard cut to drilldown panel (intentional jarring transition — the AI responded)"
      }
    },

    {
      "panel_id": "p_04",
      "act": "peak",
      "intent": "The AI delivered. Show the answer: a data panel with a bar chart. This is the peak of the demo.",
      "description": "An elevated panel slides in showing the drilldown response. Header with title, explanatory text, a bar chart of top software vendors, and an input field to ask more. This is a fully realized UI component, not a sketch.",
      "content": {
        "header": "Increased software spend",
        "explanation": "Your software spend increase was driven by these 4 vendors",
        "chart_title": "Top software vendors",
        "chart_data": [
          { "label": "Anthropic", "height": "85%" },
          { "label": "Cloudflare", "height": "65%" },
          { "label": "Zoom", "height": "48%" },
          { "label": "Notion", "height": "38%" }
        ]
      },
      "duration_s": 5,
      "transition_in": { "type": "hard_cut" },
      "transition_out": { "type": "crossfade", "duration_ms": 400 },
      "camera": "push_in 0.08",
      "energy": "high",
      "content_type": "chart_panel",

      "visual_direction": {
        "composition": "Elevated panel centered, 580px max width. Internal layout: header → explanation → chart → input. Generous internal spacing (28px padding, 24px between sections).",
        "typography": "Panel title: 17px weight 600. Explanation: 13px weight 400 at 50% opacity. Chart labels: 11px at 50% opacity. Legend: 11px at 35% opacity.",
        "color": "Panel bg: #1f2937 (elevated surface). Border: 8% white. Shadow: deep (32px blur, 50% black). Bar color: 15% white. Axis: 6% white.",
        "surfaces": "Panel: 18px border radius. Bars: 4px top radius. Input at bottom: pill shape, 28px radius.",
        "reference": "Mercury drilldown panel — the chart is simple (4 bars, no gridlines, no animation flair). The data speaks."
      },

      "motion_notes": {
        "entrance": "Panel enters with cd-panel-drilldown. Camera begins push_in synced to panel settle.",
        "choreography": "Bars could grow from baseline (cd-bar-grow, 120ms stagger) — but only if it doesn't distract from reading the data. Consider whether static bars are more respectful of the content.",
        "hold": "Hold for 3s. The audience reads the chart.",
        "exit": "Crossfade to follow-up prompt"
      }
    },

    {
      "panel_id": "p_05",
      "act": "build",
      "intent": "The conversation continues. Show that this isn't a one-shot — it's an ongoing dialogue.",
      "description": "Faded chart context above, new input field below with a second prompt: 'Show me my largest transactions overall in March'. The chart residue connects this moment to the previous panel.",
      "content": "Show me my largest transactions overall in March",
      "duration_s": 3.5,
      "transition_in": { "type": "crossfade", "duration_ms": 400 },
      "transition_out": { "type": "hard_cut" },
      "camera": "static",
      "energy": "moderate",
      "content_type": "prompt_input",

      "visual_direction": {
        "composition": "Upper third: faded mini-chart (35% opacity) as context. Lower third: input field. Vertically balanced.",
        "typography": "Same as p_03. The prompt text is slightly longer — make sure it fits on one line at 580px.",
        "color": "Chart residue at 12% white (barely visible). Input field same as p_03 but submit button slightly dimmer (60% opacity indigo).",
        "reference": "Mercury follow-up prompt — the faded chart creates visual continuity without competing."
      },

      "motion_notes": {
        "entrance": "Chart context fades in first (400ms). Input field enters with cd-card-cascade after 200ms. Text types after 800ms.",
        "exit": "Hard cut to full dashboard"
      }
    },

    {
      "panel_id": "p_06",
      "act": "peak",
      "intent": "The big reveal. Pull back to show the full product — sidebar, navigation, dashboard, charts. This is the 'wow, this is a real product' moment.",
      "description": "Camera pulls out from the detail view to reveal the complete dashboard UI. Left sidebar with navigation (Home, Tasks, Transactions, Insights, Payments). Main content area with Insights page — tabs, cashflow stats, trend summaries, and a bar chart.",
      "content": {
        "nav": ["Home", "Tasks (10)", "Transactions", "Insights", "Payments"],
        "active_nav": "Insights",
        "tabs": ["Overview", "Money In", "Money Out"],
        "stats": { "net_cashflow": "$11,007", "money_in": "$56,102", "money_out": "−$45,100" }
      },
      "duration_s": 5,
      "transition_in": { "type": "hard_cut" },
      "transition_out": { "type": "crossfade", "duration_ms": 600 },
      "camera": "pull_out 0.3 cinematic_scurve",
      "energy": "high",
      "content_type": "dashboard",

      "visual_direction": {
        "composition": "Full-width dashboard. Sidebar: 200px, darker navy. Main area: full width with 24px/32px padding. Charts on the right, text content on the left. Dense but not cluttered — every element earns its space.",
        "typography": "Nav items: 12px. Page title: 22px weight 600. Tab labels: 12px. Stat values: 26px weight 600 (cashflow), 17px weight 500 (in/out). Trend titles: 13px weight 500.",
        "color": "Sidebar: #0f172a (deeper than main bg). Active nav item: 6% white bg, full opacity text. Chart bars: indigo + slate. Stat values: full white.",
        "surfaces": "Sidebar border-right: 6% white. Tab active state: 7% white bg, rounded 7px. Chart bar radius: 2px.",
        "reference": "Mercury full dashboard — this is the most complex visual. It must look like a real product, not a wireframe. Every pixel matters."
      },

      "motion_notes": {
        "entrance": "Content area enters with cd-card-cascade. Sidebar fades in 300ms after. Camera pull_out begins immediately, peaks at 80% through the scene.",
        "choreography": "The pull_out IS the animation. Don't over-choreograph the content — let the camera reveal do the work.",
        "hold": "Hold at full pull_out for 1.5s.",
        "exit": "Crossfade to closing tagline"
      }
    },

    {
      "panel_id": "p_07",
      "act": "resolve",
      "intent": "Name the thing. Two lines, centered. Confident statement of what this is.",
      "description": "Two-line tagline centered on dark field. First line names the feature. Second line describes the value.",
      "content": ["Introducing Insights.", "An intelligent view of your finances."],
      "duration_s": 3,
      "transition_in": { "type": "crossfade", "duration_ms": 600 },
      "transition_out": { "type": "crossfade", "duration_ms": 400 },
      "camera": "static",
      "energy": "low",
      "content_type": "typography",

      "visual_direction": {
        "composition": "Two lines stacked with 8px gap. Centered both axes. Same generous negative space as p_01.",
        "typography": "40px weight 300, -0.025em tracking. Both lines same size and weight — no hierarchy, just two statements.",
        "color": "Warm off-white on navy. Identical to p_01.",
        "reference": "Mercury 'Introducing Insights' frame — notice the period at the end of each line. Declarative, not excited."
      },

      "motion_notes": {
        "entrance": "Fade in 400ms ease-out. Both lines appear together — no stagger.",
        "hold": "Hold 2s.",
        "exit": "Crossfade to closing tagline"
      }
    },

    {
      "panel_id": "p_08",
      "act": "resolve",
      "intent": "The brand statement. One line. Maximum confidence.",
      "description": "Single tagline centered. Shorter than p_07 — punchier.",
      "content": "Radically different banking.",
      "duration_s": 2.5,
      "transition_in": { "type": "crossfade", "duration_ms": 400 },
      "transition_out": { "type": "crossfade", "duration_ms": 400 },
      "camera": "static",
      "energy": "low",
      "content_type": "typography",

      "visual_direction": {
        "composition": "Same as p_01. Dead center. Maximum space.",
        "typography": "40px weight 300. Same as p_07.",
        "reference": "Mercury 'Radically different banking.' — a period, not an exclamation mark. Confidence doesn't shout."
      },

      "motion_notes": {
        "entrance": "Fade in 400ms.",
        "hold": "Hold 1.5s.",
        "exit": "Crossfade to logo"
      }
    },

    {
      "panel_id": "p_09",
      "act": "close",
      "intent": "Brand lockup. The signature. Then silence.",
      "description": "Logo mark and wordmark centered with legal disclaimer below. The logo is the last thing the audience sees.",
      "content": { "wordmark": "ACME FINANCE", "disclaimer": "Acme Finance is a technology company. Banking services provided through partner institutions." },
      "duration_s": 2.5,
      "transition_in": { "type": "crossfade", "duration_ms": 400 },
      "transition_out": null,
      "camera": "static",
      "energy": "static",
      "content_type": "logo_lockup",

      "visual_direction": {
        "composition": "Logo mark + wordmark centered horizontally, slightly above vertical center. Disclaimer below, small, low opacity. Generous gap (48px) between logo group and disclaimer.",
        "typography": "Wordmark: 24px, weight 400, 0.15em letter spacing. Disclaimer: 11px, 25% opacity, max-width 600px, centered.",
        "color": "Logo mark: subtle border container with indigo accent. Wordmark: warm off-white. Disclaimer: barely visible.",
        "reference": "Mercury logo lockup — the logo doesn't try to be impressive. It's just there, quietly, with legal below."
      },

      "motion_notes": {
        "entrance": "Logo group fades in 600ms ease-out. Disclaimer fades in after 400ms delay.",
        "hold": "Hold until end. No exit transition — the video ends on the logo."
      }
    }
  ]
}
```

## Panel Fields

### Required
| Field | Type | Description |
|-------|------|-------------|
| `panel_id` | string | Unique ID, `p_XX` pattern |
| `act` | enum | `open`, `build`, `peak`, `resolve`, `close` |
| `intent` | string | **Why this panel exists.** What should the audience feel? |
| `description` | string | What's on screen, in plain language |
| `content` | string/object/array | The actual text, data, or structure to display |
| `duration_s` | number | Hold time in seconds |
| `camera` | string | Camera move description |
| `energy` | enum | `static`, `low`, `moderate`, `high` |
| `content_type` | string | Visual category for template selection |

### Visual direction (required for quality)
| Field | Type | Description |
|-------|------|-------------|
| `visual_direction.composition` | string | Spatial layout — where things go, how much space |
| `visual_direction.typography` | string | Exact sizes, weights, tracking, line height |
| `visual_direction.color` | string | Specific colors and opacities |
| `visual_direction.surfaces` | string | Border radius, padding, shadows |
| `visual_direction.reference` | string | What to study — specific frame from a reference video |

### Motion notes (guides implementation)
| Field | Type | Description |
|-------|------|-------------|
| `motion_notes.entrance` | string | How elements appear |
| `motion_notes.choreography` | string | Stagger, sequencing, coordination |
| `motion_notes.hold` | string | What happens during the hold phase |
| `motion_notes.exit` | string | How the panel ends |

### Transitions
| Field | Type | Description |
|-------|------|-------------|
| `transition_in` | object/null | How this panel enters from the previous |
| `transition_out` | object/null | How this panel exits to the next |

## Act Structure

Every storyboard follows a narrative arc with 5 acts:

| Act | Energy | Purpose | Typical panels |
|-----|--------|---------|----------------|
| `open` | low | Set tone, establish visual language | 1 panel |
| `build` | moderate→high | Show the product, demonstrate features | 2-4 panels |
| `peak` | high | The "wow" moment — full product reveal | 1-2 panels |
| `resolve` | low | Name it, brand it, declare value | 1-2 panels |
| `close` | static | Logo lockup, sign off | 1 panel |

## Quality Gates

A storyboard is **not ready for production** until:

1. Every panel has an `intent` that answers "what should the audience feel?"
2. Every panel has `visual_direction` with specific typography sizes and colors (not "make it look nice")
3. The `energy_arc` has genuine variation — not all the same energy level
4. The `brand` section has specific palette and typography notes
5. Transitions are intentional — each one has a reason (crossfade for continuity, hard cut for surprise)
6. At least one panel has a `reference` pointing to real-world inspiration
7. A human has reviewed and approved the storyboard before any HTML is generated

## Relationship to Pipeline

```
/brief                    → creative brief (what to say)
/storyboard               → storyboard (how to say it) ← THIS SPEC
  ↓ human review
/prototype (per panel)    → designed HTML (what it looks like)
/animate (per prototype)  → motion-enriched HTML (how it moves)
/sizzle                   → captured video sequence (the output)
```

The storyboard is the **last document a human reviews** before production begins. Everything after it is execution.
