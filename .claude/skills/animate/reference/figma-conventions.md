# Figma Frame Naming Conventions for Animation Phases

**Status:** Validated via POC (ANI-7, 2026-02-28)
**Setup:** See `docs/process/figma-mcp-setup.md` for Figma MCP installation

## Why Conventions Matter

No Figma MCP extracts animation or transition data. The animation pipeline infers phases, timing, and choreography from how designers name and structure their frames. Consistent naming enables automatic phase detection; inconsistent naming requires manual intervention.

## Required Naming Patterns

### Frame Naming

Use the pattern `Phase N: Label` for top-level frames that represent animation states.

```
✅ Phase 1: Upload
✅ Phase 2: Processing
✅ Phase 3: Results
✅ Step 1: Select Files
✅ Step 2: Organize

❌ Upload Screen
❌ v2-final
❌ Frame 47
```

**Detection regex:** `/^(?:Phase|Step)\s+(\d+):\s*(.+)$/i`

### Variant Naming

For Figma component variants representing UI states:

```
✅ State=Default, State=Hover, State=Active
✅ Status=Empty, Status=Loading, Status=Complete

❌ Button / Button Copy / Button Copy 2
```

Variants map to phase transitions — each variant becomes a phase in the animation.

### Section Naming

Figma sections group related frames into phase groups:

```
✅ Onboarding Flow
✅ Upload Wizard
✅ Dashboard States

❌ Section 1
❌ Untitled
```

One flow per page keeps detection simple. Multiple flows in one page require section dividers.

## How Frames Map to Engine Config

### Direct Mapping

| Figma Frame | Engine Config |
|-------------|---------------|
| `Phase 1: Upload` | `{ id: 0, label: 'Upload', dwell: 2500 }` |
| `Phase 2: Processing` | `{ id: 1, label: 'Processing', dwell: 3500 }` |
| `Phase 3: Results` | `{ id: 2, label: 'Results', dwell: 3500 }` |

### Dwell Time Inference

Dwell times are inferred from content density, not specified in Figma:

| Content Type | Inferred Dwell | Rationale |
|-------------|---------------|-----------|
| Simple form / single CTA | 2.0–2.5s | One concept, quick scan |
| List with stagger items | 2.5–3.0s | Items need time to appear |
| Progress / processing | 3.5–4.5s | Animation plays through |
| Results with sub-animations | 3.5–4.0s | Complex reveals need time |
| Success / completion | 2.5–3.0s | Landing moment, let it breathe |

### Full Engine Instantiation

```javascript
// Frames: "Phase 1: Upload", "Phase 2: Processing", "Phase 3: Ready"
// Personality: editorial
const engine = new EditorialEngine({
  phases: [
    { id: 0, label: 'Upload',     dwell: 2500 },
    { id: 1, label: 'Processing', dwell: 3500 },
    { id: 2, label: 'Ready',      dwell: 3000 },
  ],
  titles: ['Upload Files', 'Processing...', 'Ready to Share'],
  onPhaseEnter: {
    0: (e) => e.runBlurReveal('upload-zone', 250),
    1: (e) => e.runSlideStagger('files', 120),
    2: (e) => { e.runSlideStagger('results', 150); e.runCountUp(600); },
  },
  tokenOverrides: {
    // From Figma variables (see Token Mapping below)
    '--ed-accent': '#6366f1',
    '--ed-accent-bg': '#eef2ff',
  },
});
```

## How Figma Variables Map to Token Overrides

### Variable Naming Convention

Use the path format `Colors/Category/Name` in Figma:

```
Colors/Surface/Primary    → background
Colors/Surface/Card       → card surface
Colors/Surface/Secondary  → secondary surface
Colors/Text/Primary       → primary text
Colors/Text/Secondary     → secondary text
Colors/Accent/Default     → accent color
Colors/Accent/Background  → accent bg tint
Colors/Accent/Text        → accent text
```

### Personality Token Mapping

| Figma Variable Path | Editorial | Cinematic | Neutral Light | Montage |
|---------------------|-----------|-----------|---------------|---------|
| Colors/Surface/Primary | `--ed-bg-body` | `--cd-bg-body` | `--nl-bg-body` | `--mo-bg-body` |
| Colors/Surface/Card | `--ed-surface-card` | `--cd-surface-card` | `--nl-surface-card` | `--mo-surface-card` |
| Colors/Surface/Secondary | `--ed-surface-secondary` | `--cd-surface-secondary` | `--nl-surface-secondary` | `--mo-surface-secondary` |
| Colors/Text/Primary | `--ed-text-primary` | `--cd-text-primary` | `--nl-text-primary` | `--mo-text-primary` |
| Colors/Text/Secondary | `--ed-text-secondary` | `--cd-text-secondary` | `--nl-text-secondary` | `--mo-text-secondary` |
| Colors/Accent/Default | `--ed-accent` | `--cd-accent` | `--nl-accent` | `--mo-accent` |
| Colors/Accent/Background | `--ed-accent-bg` | `--cd-accent-bg` | `--nl-accent-bg` | `--mo-accent-bg` |
| Colors/Accent/Text | `--ed-accent-text` | `--cd-accent-text` | `--nl-accent-text` | `--mo-accent-text` |

### Override Efficiency

Only override tokens that diverge from the personality's defaults. From the POC:

```javascript
// Figma uses stone/neutral palette matching editorial defaults
// → Only accent tokens need overriding
tokenOverrides: {
  '--ed-accent': '#6366f1',      // Figma indigo, not editorial default blue
  '--ed-accent-bg': '#eef2ff',   // Indigo tint
  '--ed-accent-text': '#4338ca', // Indigo dark
  // Surface and text tokens match editorial defaults — no override needed
}
```

## Examples

### Sequential Flow (3 frames)

**Figma page:** "Data Room Upload"

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Phase 1: Upload  │  │ Phase 2: Scan   │  │ Phase 3: Ready  │
│                  │  │                  │  │                  │
│  [Drop zone]     │  │  [File list]     │  │  [Share card]    │
│  [Browse btn]    │  │  [Progress bar]  │  │  [Download btn]  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Result:** 3-phase editorial autoplay with drop zone entrance, file list stagger, share card reveal.

### Variant Component (4 states)

**Figma component:** "Status Badge"

```
Variants:
  State=Empty     → Phase 0
  State=Loading   → Phase 1
  State=Complete  → Phase 2
  State=Error     → Phase 3
```

**Result:** 4-phase animation showing state transitions.

### Single Frame (decomposed)

**Figma page:** "Dashboard" (one frame, complex layout)

When a single frame contains logically distinct sections, decompose by content hierarchy:

```
Phase 0: Header + nav (fast entrance)
Phase 1: Stat cards (stagger reveal)
Phase 2: Main chart (draw/reveal)
Phase 3: Activity feed (slide stagger)
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Non-sequential frames (branching) | Use variant components; each branch = separate animation |
| Single frame, no sections | Decompose by visual hierarchy (header → hero → supporting → details) |
| Mixed personalities in one file | Use Figma sections to group; each section gets its own personality |
| No Figma variables defined | Use personality defaults; no tokenOverrides needed |
| Variables don't follow convention | Manual mapping required; document in meta.json |

## Pipeline Workflow Summary

```
1. Designer names frames:     Phase 1: Upload, Phase 2: Process, Phase 3: Ready
2. Designer defines variables: Colors/Accent/Default = #6366f1
3. get_design_context(url)    → structured node tree with frame names
4. get_variable_defs(fileKey) → variable collections with values
5. Claude transforms to HTML  → semantic markup with phase markers
6. /animate applies personality → autoplay with token overrides
7. Capture pipeline            → WebM/MP4/GIF for distribution
```
