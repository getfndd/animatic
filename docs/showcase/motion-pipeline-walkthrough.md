# Motion Spec v2 Pipeline Walkthrough

Motion Spec v2 replaces per-layer entrance declarations with a unified **motion block** that describes choreography at a semantic level (Level 1: Motion Intent). A compiler transforms this into frame-addressed keyframe tracks (Level 2: Motion Timeline) consumable by the Remotion renderer. This separation means you author *what should happen* and the pipeline figures out *exactly when and how*.

This walkthrough demonstrates the complete pipeline from personality selection through rendered video, using the Animatic MCP tools at each step.

---

## Step 1: Choose a Personality

Every motion decision flows from a personality. The personality defines timing tiers, easing curves, camera rules, and what is allowed or forbidden.

### Tool call

```
get_personality({ slug: "cinematic-dark" })
```

### Key output (abbreviated)

```json
{
  "name": "Cinematic Dark",
  "slug": "cinematic-dark",
  "duration_overrides": {
    "fast": "180ms",
    "medium": "500ms",
    "slow": "700ms",
    "spring": "1200ms"
  },
  "easing_overrides": {
    "enter": "cubic-bezier(0.16, 1, 0.3, 1)",
    "exit": "cubic-bezier(0.7, 0, 0.84, 0)",
    "spring": "cubic-bezier(0.22, 1, 0.36, 1)"
  },
  "characteristics": {
    "contrast": "high",
    "motion_intensity": "dramatic",
    "entrance_style": "focus-pull blur",
    "perspective": "3D (1200px)"
  },
  "camera_behavior": {
    "mode": "full-3d",
    "allowed_movements": ["dolly", "orbit", "crane", "push-in", "rack-focus", "handheld"],
    "depth_of_field": { "enabled": true, "max_blur": "12px", "entrance_blur": true },
    "ambient_motion": {
      "scene_breathe": { "scale": "0.4%", "duration": "8000ms" },
      "drift": { "amplitude": "1.5px", "duration": "12000ms" }
    }
  }
}
```

### What to look for

- **Timing tiers** determine how fast each animation class runs. Cinematic-dark has a 4-tier hierarchy (fast/medium/slow/spring) while editorial only has 3 (no spring).
- **Easing curves** shape the feel. The `expo_out` enter curve (`0.16, 1, 0.3, 1`) gives cinematic-dark its signature aggressive deceleration.
- **Camera rules** define what is physically possible. Cinematic-dark allows full 3D camera (dolly, orbit, crane), blur entrances, and rack focus. Editorial forbids all of these.
- **Ambient motion** adds life between entrances. Cinematic-dark breathes at 0.4% scale; editorial breathes at 0.2%.

---

## Step 2: Author a Scene with Motion Block

A v2 scene separates *what* (layers) from *how* (motion block). The motion block uses groups, stagger, cues, and effects to describe choreography semantically.

### Complete scene JSON

```json
{
  "scene_id": "sc_product_hero",
  "format_version": 2,
  "duration_s": 4,
  "fps": 60,
  "canvas": { "w": 1920, "h": 1080 },
  "camera": { "move": "push_in", "intensity": 0.3 },
  "layers": [
    {
      "id": "bg",
      "type": "image",
      "asset": "hero_bg",
      "depth_class": "background",
      "fit": "cover"
    },
    {
      "id": "product",
      "type": "image",
      "asset": "product_shot",
      "depth_class": "foreground",
      "position": { "x": 480, "y": 140, "w": 960, "h": 720 }
    },
    {
      "id": "headline",
      "type": "text",
      "content": "BUILT FOR SPEED",
      "depth_class": "foreground",
      "style": {
        "fontFamily": "system-ui",
        "fontSize": 64,
        "fontWeight": 700,
        "color": "#ffffff",
        "textTransform": "uppercase"
      }
    },
    {
      "id": "card-0",
      "type": "html",
      "src": "scenes/feature-card-0.html",
      "depth_class": "midground",
      "position": { "x": 80, "y": 800, "w": 280, "h": 180 }
    },
    {
      "id": "card-1",
      "type": "html",
      "src": "scenes/feature-card-1.html",
      "depth_class": "midground",
      "position": { "x": 400, "y": 800, "w": 280, "h": 180 }
    },
    {
      "id": "card-2",
      "type": "html",
      "src": "scenes/feature-card-2.html",
      "depth_class": "midground",
      "position": { "x": 720, "y": 800, "w": 280, "h": 180 }
    }
  ],
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["product"],
        "primitive": "cd-focus-stagger",
        "effects": [
          { "type": "blur", "from": 8, "to": 0, "duration_ms": 600, "easing": "expo_out" },
          { "type": "brightness", "from": 0.3, "to": 1.0, "duration_ms": 800 }
        ],
        "on_complete": { "emit": "hero_done" }
      },
      {
        "id": "title",
        "targets": ["headline"],
        "primitive": "as-fadeInUp",
        "delay": { "after": "hero_done", "offset_ms": 100 },
        "on_complete": { "emit": "headline_done" }
      },
      {
        "id": "cards",
        "targets": ["card-0", "card-1", "card-2"],
        "primitive": "ed-slide-stagger",
        "stagger": {
          "interval_ms": 120,
          "order": "sequential",
          "amplitude": { "curve": "descending", "start": 1.0, "end": 0.6 }
        },
        "delay": { "after": "headline_done", "offset_ms": 200 }
      }
    ],
    "camera": {
      "move": "push_in",
      "intensity": 0.4,
      "sync": { "peak_at": 0.6, "cue": "headline_done" }
    }
  }
}
```

### Anatomy of the motion block

**Groups** define *who* moves and *how*:

| Group | Targets | Primitive | Behavior |
|-------|---------|-----------|----------|
| `hero` | `product` | `cd-focus-stagger` | Blur reveal (8px to 0) + brightness ramp. Emits `hero_done` on completion. |
| `title` | `headline` | `as-fadeInUp` | Fade + slide up. Waits for `hero_done` + 100ms. Emits `headline_done`. |
| `cards` | `card-0`, `card-1`, `card-2` | `ed-slide-stagger` | Staggered slide entrance, 120ms apart, with descending amplitude (first card moves full distance, last moves 60%). Waits for `headline_done` + 200ms. |

**Stagger** controls per-element timing within a group:

- `interval_ms: 120` -- each card starts 120ms after the previous
- `order: "sequential"` -- cards enter in array order (also supports `reverse`, `center_out`, `random`)
- `amplitude.curve: "descending"` -- first element gets full motion distance, last gets 60%

**Cues** are named sync points that coordinate groups:

```
scene_start → hero group starts
              hero finishes → emits "hero_done"
                               title group waits for hero_done + 100ms
                               title finishes → emits "headline_done"
                                                 cards group waits for headline_done + 200ms
                                                 camera peaks at headline_done
```

**Effects** add per-layer visual treatments beyond the entrance primitive:

- `blur` from 8 to 0 over 600ms -- the cinematic-dark signature focus-pull
- `brightness` from 0.3 to 1.0 over 800ms -- dark-to-lit reveal

**Camera sync** ties camera movement to choreography:

- `peak_at: 0.6` -- camera reaches maximum push-in at 60% of scene duration
- `cue: "headline_done"` -- alternatively, peak aligns with when the headline finishes entering

### Position parameters (GSAP-inspired)

The `position` field on groups replaces verbose `delay: { after: "cue", offset_ms: N }` objects with a compact GSAP-inspired syntax. It controls when a group starts relative to the previous group or a named cue.

| Syntax | Meaning | Example |
|--------|---------|---------|
| `"<"` | Same start time as previous group | Groups a and b start together |
| `">"` | After previous group finishes | b starts when a ends (default sequential) |
| `">200"` | After previous group + 200ms gap | b starts 200ms after a ends |
| `">-200"` | Before previous group finishes (overlap) | b starts 200ms before a ends |
| `"cue+200"` | After named cue + 200ms | b starts 200ms after the `hero_done` cue |
| `"cue-100"` | Before named cue resolves | b starts 100ms before `hero_done` |

**Before (verbose):**

```json
{
  "groups": [
    { "id": "hero", "primitive": "cd-focus-stagger", "targets": ["product"] },
    { "id": "title", "primitive": "as-fadeInUp", "targets": ["headline"],
      "delay": { "after": "hero_done", "offset_ms": 200 } },
    { "id": "cards", "primitive": "ed-slide-stagger", "targets": ["card-0", "card-1", "card-2"],
      "delay": { "after": "headline_done", "offset_ms": -200 } }
  ]
}
```

**After (position syntax):**

```json
{
  "groups": [
    { "id": "hero", "primitive": "cd-focus-stagger", "targets": ["product"] },
    { "id": "title", "primitive": "as-fadeInUp", "targets": ["headline"],
      "position": "hero_done+200" },
    { "id": "cards", "primitive": "ed-slide-stagger", "targets": ["card-0", "card-1", "card-2"],
      "position": ">-200" }
  ]
}
```

The third group uses `">-200"` — it starts 200ms before the title group finishes, creating an overlap that makes the sequence feel connected rather than sequential.

**Three-group chain example:**

```
a (hero entrance)     |████████████|
b (title, ">")                      |████████|
c (cards, ">-200")              |████████████████|
                                ↑ overlap
```

Group b starts when a ends. Group c starts 200ms before b ends, creating a 200ms overlap where both b and c are animating simultaneously.

### Enhanced stagger

Stagger controls per-element timing within a group. The enhanced stagger system adds `from` patterns, `amount_ms` as an alternative to `interval_ms`, and easing curves that redistribute timing.

**`from` patterns** control which element starts first:

| Pattern | Behavior |
|---------|----------|
| `"start"` | First element starts first (default) |
| `"end"` | Last element starts first |
| `"center"` | Center element starts first, spreads outward |
| `"edges"` | Edge elements start first, converges to center |
| `index` (number) | Specific element index starts first |

**`amount_ms`** defines the total stagger spread instead of per-element interval. With 5 elements and `amount_ms: 800`, the system divides 800ms across 4 gaps = 200ms per gap. This is easier to reason about when element count varies.

**`ease`** redistributes timing within the stagger window. Without ease, elements are evenly spaced. With ease, they bunch toward the start or end.

| Ease | Effect |
|------|--------|
| `"linear"` | Even spacing (default) |
| `"power1_in"` | Elements bunch at the start, spread at the end |
| `"power1_out"` | Elements spread at the start, bunch at the end |
| `"power2_in"` | Stronger bunching at start |
| `"power2_out"` | Stronger bunching at end |

**Bar chart example:**

```json
{
  "id": "metrics",
  "primitive": "cd-bar-grow",
  "targets": ["bar-0", "bar-1", "bar-2", "bar-3", "bar-4"],
  "stagger": {
    "amount_ms": 800,
    "from": "edges",
    "ease": "power1_out"
  }
}
```

This produces a bar chart where the outer bars grow first and the center bar grows last, with the timing weighted toward the end (bars bunch together at the start, spread at the end). The visual effect: a wave that converges to the center with natural deceleration.

**Comparison — interval_ms vs amount_ms:**

| Setting | 3 elements | 5 elements | 10 elements |
|---------|-----------|-----------|------------|
| `interval_ms: 120` | 240ms total | 480ms total | 1080ms total |
| `amount_ms: 600` | 300ms/gap | 150ms/gap | 67ms/gap |

`interval_ms` keeps per-element spacing constant. `amount_ms` keeps total duration constant. Use `amount_ms` when you want consistent visual density regardless of element count.

> See [Scene Format Spec](../cinematography/specs/scene-format.md) for the full position and stagger syntax reference.

---

## Step 3: Compile Motion

The compiler transforms the Level 1 motion intent into a Level 2 frame-addressed timeline. This is a 7-step pipeline:

1. Resolve recipes (expand recipe references to groups)
2. Build cue graph (topological sort of dependencies, assign frame numbers)
3. Expand primitives (catalog lookup, generate keyframes per element)
4. Apply stagger (intervals, amplitude curves, settle behavior)
5. Sync camera (shape camera easing so peak aligns with resolved cue)
6. Validate guardrails (check properties against personality boundaries)
7. Emit timeline (write per-layer keyframe tracks with absolute frames)

### Tool call

```
compile_motion({
  scene: { /* the scene JSON from Step 2 */ },
  personality: "cinematic-dark"
})
```

### Output: Level 2 Motion Timeline

```json
{
  "scene_id": "sc_product_hero",
  "duration_frames": 240,
  "fps": 60,
  "tracks": {
    "camera": {
      "scale": [
        { "frame": 0, "value": 1 },
        { "frame": 144, "value": 1.072, "easing": "cubic-bezier(0.33,0,0.2,1)" }
      ]
    },
    "layers": {
      "product": {
        "opacity": [
          { "frame": 0, "value": 0 },
          { "frame": 24, "value": 1, "easing": "cubic-bezier(0.16,1,0.3,1)" }
        ],
        "translateY": [
          { "frame": 0, "value": 30 },
          { "frame": 24, "value": 0, "easing": "cubic-bezier(0.16,1,0.3,1)" }
        ],
        "filter_blur": [
          { "frame": 0, "value": 8 },
          { "frame": 36, "value": 0, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ],
        "filter_brightness": [
          { "frame": 0, "value": 0.3 },
          { "frame": 48, "value": 1, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ]
      },
      "headline": {
        "opacity": [
          { "frame": 30, "value": 0 },
          { "frame": 54, "value": 1, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ],
        "translateY": [
          { "frame": 30, "value": 30 },
          { "frame": 54, "value": 0, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ]
      },
      "card-0": {
        "opacity": [
          { "frame": 66, "value": 0 },
          { "frame": 90, "value": 1, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ],
        "translateY": [
          { "frame": 66, "value": 30 },
          { "frame": 90, "value": 0, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ]
      },
      "card-1": {
        "opacity": [
          { "frame": 73, "value": 0 },
          { "frame": 97, "value": 1, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ],
        "translateY": [
          { "frame": 73, "value": 24 },
          { "frame": 97, "value": 0, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ]
      },
      "card-2": {
        "opacity": [
          { "frame": 80, "value": 0 },
          { "frame": 104, "value": 1, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ],
        "translateY": [
          { "frame": 80, "value": 18 },
          { "frame": 104, "value": 0, "easing": "cubic-bezier(0.25,0.46,0.45,0.94)" }
        ]
      }
    }
  }
}
```

### How the compiler transforms intent to timeline

**Recipes expand to primitives.** The group's `primitive: "cd-focus-stagger"` is looked up in the catalog, which returns keyframe definitions with `at` proportions (0.0 to 1.0), duration, and easing. These proportions are converted to absolute frame numbers.

**Cues resolve to frame numbers.** The cue graph builds a dependency chain:
- `hero_done` = frame when the hero group's last element finishes = frame 24 (primitive duration) + 0 (no stagger) = frame 24
- `headline` starts at: `hero_done` (frame 24) + 100ms offset = frame 24 + 6 = frame 30
- `headline_done` = frame 30 + 24 (primitive duration) = frame 54
- `cards` start at: `headline_done` (frame 54) + 200ms offset = frame 54 + 12 = frame 66

**Stagger produces per-element timing offsets.** The 3 cards are staggered at 120ms intervals:
- `card-0` starts at frame 66 (group start)
- `card-1` starts at frame 66 + 7 (120ms at 60fps) = frame 73
- `card-2` starts at frame 66 + 14 = frame 80

The descending amplitude curve scales `translateY` distance: card-0 gets `30px * 1.0 = 30px`, card-1 gets `30px * 0.8 = 24px`, card-2 gets `30px * 0.6 = 18px`. Each successive card moves less, creating a settling cascade.

**Camera syncs to the headline cue.** The `peak_at: 0.6` resolves to frame 144 (60% of 240 frames). The camera scales from 1.0 to 1.072 (intensity 0.4 * cinematic-dark's SCALE_FACTOR of 0.18) using the cinematic s-curve easing.

---

## Step 4: Critique the Timeline

The motion critic analyzes the compiled Level 2 timeline for quality issues. It runs 7 detection rules and produces a 0-100 score with actionable suggestions.

### Tool call

```
critique_motion({
  timeline: { /* the compiled Level 2 timeline from Step 3 */ },
  scene: { /* the original scene JSON from Step 2 */ }
})
```

### Output

```json
{
  "score": 84,
  "issues": [
    {
      "rule": "orphan_layer",
      "severity": "warning",
      "layer": "bg",
      "message": "Layer \"bg\" is defined in the scene but has no animation tracks",
      "suggestion": "Add \"bg\" to a motion group or give it an entrance primitive"
    },
    {
      "rule": "repetitive_easing",
      "severity": "info",
      "layer": null,
      "message": "88% of keyframes use \"cubic-bezier(0.25,0.46,0.45,0.94)\" — motion feels monotonous",
      "suggestion": "Mix easing curves: use expo_out for hero entrances, ease_out for supporting, linear for ambient"
    }
  ],
  "summary": "Good (score: 84) — 1 warning, 1 suggestion"
}
```

### What the critic detects

| Rule | Threshold | What it catches |
|------|-----------|-----------------|
| `dead_hold` | >30% of scene at same value | Layer stuck with nothing happening |
| `flat_motion` | All layers start at same frame | No stagger, everything pops in at once |
| `missing_hierarchy` | Hero has less complexity than supporting | Supporting layers upstage the hero |
| `repetitive_easing` | >80% same curve | Monotonous, robotic feel |
| `orphan_layer` | Layer in scene but no tracks | Static layer that should be animated |
| `camera_motion_mismatch` | Camera peaks with no layer motion | Wasted camera energy |
| `excessive_simultaneity` | >3 layers in same 10-frame window | Visual chaos |

### How to iterate

The critic found two issues. To fix them:

1. **Orphan background layer** -- Add `bg` to a group with a subtle entrance (slow fade-in) or add ambient scale drift to prevent it from being a dead static element.
2. **Repetitive easing** -- Use `expo_out` for the hero entrance (more aggressive deceleration) and keep `ease_out` for the supporting cards. This creates contrast between the dramatic hero reveal and the gentler card cascade.

Scoring deductions:
- `warning` = -8 points
- `info` = -3 points
- Score: 100 - 8 - 3 = 89 (or 84 if multiple sub-issues contribute)

A score of 80+ is "Good." Below 80 is "Needs attention." Below 60 is "Significant issues."

---

## Step 5: Evaluate the Sequence

For multi-scene sequences, `evaluate_sequence` scores the full manifest against style pack rules and cinematography principles.

### Tool call

```
evaluate_sequence({
  manifest: {
    "sequence_id": "seq_product_launch",
    "fps": 60,
    "style": "dramatic",
    "scenes": [
      { "scene": "sc_product_hero", "duration_s": 4.0 },
      { "scene": "sc_feature_grid", "duration_s": 3.0, "transition_in": { "type": "crossfade", "duration_ms": 400 } },
      { "scene": "sc_testimonial", "duration_s": 3.5, "transition_in": { "type": "hard_cut" } },
      { "scene": "sc_cta_closing", "duration_s": 2.5, "transition_in": { "type": "crossfade", "duration_ms": 600 } }
    ]
  },
  scenes: [ /* analyzed scene objects with metadata */ ],
  style: "dramatic"
})
```

### Evaluation dimensions

The evaluator scores across four dimensions:

| Dimension | What it measures | Score range |
|-----------|-----------------|-------------|
| **Pacing** | Duration distribution, rhythm variation, arc shape | 0-100 |
| **Variety** | Camera move diversity, transition type mixing, content type spread | 0-100 |
| **Flow** | Transition appropriateness, energy continuity, visual weight shifts | 0-100 |
| **Adherence** | Style pack rule compliance (allowed transitions, duration bounds, camera rules) | 0-100 |

### Output (example)

```json
{
  "overall_score": 78,
  "dimensions": {
    "pacing": { "score": 82, "findings": ["Good duration variety (2.5-4.0s range)"] },
    "variety": { "score": 71, "findings": ["Only 2 transition types used — consider adding whip_left for energy"] },
    "flow": { "score": 85, "findings": ["Energy builds appropriately toward testimonial"] },
    "adherence": { "score": 74, "findings": ["Dramatic style prefers crossfade duration 200-400ms; scene 4 uses 600ms"] }
  }
}
```

Motion richness (v2) adds an additional signal: scenes with motion blocks contribute complexity scores from their compiled timelines. Scenes without motion blocks score lower on the richness axis, signaling opportunities to upgrade from v1 entrance-only scenes to full v2 choreography.

---

## Step 6: Render

The compiled timeline feeds directly into the Remotion renderer. The renderer reads the Level 2 keyframe tracks and interpolates values per frame.

### Render commands

```bash
# Single scene
npx remotion render Scene --output renders/scene.mp4

# Full sequence (manifest-driven)
npx remotion render Sequence --output renders/sequence.mp4

# Via npm scripts
npm run remotion:render:scene
npm run remotion:render:sequence
```

### What the renderer does

For each frame, the `SceneComposition` component:

1. Reads camera tracks → applies `scale` and `translate` to the camera rig wrapper
2. Reads layer tracks → interpolates each property (`opacity`, `translateY`, `filter_blur`, etc.) between keyframes using the declared easing curves
3. Applies depth-class parallax → background layers move less than foreground layers during camera motion
4. Composites layers in stack order → first layer is deepest, last is topmost

The output is a 1920x1080 MP4 at 60fps. The Remotion studio (`npm run remotion:studio`) provides a live preview with frame scrubbing during development.

---

## Step 7: Personality Comparison

The same content authored for each personality produces dramatically different motion. The motion block structure remains identical -- what changes is the primitive selection, timing, effects, and camera behavior.

### Scene: Product hero with 4 layers

| Aspect | cinematic-dark | editorial | neutral-light | montage |
|--------|---------------|-----------|---------------|---------|
| **Hero entrance** | Blur reveal (8px→0) + brightness ramp | Opacity crossfade + slide | Simple fade in | Scale pop (1.15→1.0) |
| **Card stagger** | 180ms interval, spring settle | 120ms interval, ease_out | 150ms interval, ease_out | 100ms interval, linear |
| **Amplitude curve** | descending (dramatic settling) | uniform | uniform | ascending (building energy) |
| **Camera move** | `push_in` at 0.4 intensity | `push_in` at 0.2 intensity | `static` (no camera) | `static` (no camera) |
| **Camera sync** | Peak at headline cue | Peak at scene end | N/A | N/A |
| **Effects** | blur + brightness | none | none | none |
| **Easing** | expo_out (aggressive) | ease_out (gentle) | ease_out (gentle) | expo_out (snappy) |

### cinematic-dark

```json
{
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["product"],
        "primitive": "cd-focus-stagger",
        "effects": [
          { "type": "blur", "from": 8, "to": 0, "duration_ms": 600, "easing": "expo_out" },
          { "type": "brightness", "from": 0.3, "to": 1.0, "duration_ms": 800 }
        ],
        "on_complete": { "emit": "hero_done" }
      },
      {
        "id": "cards",
        "targets": ["card-0", "card-1", "card-2"],
        "primitive": "cd-focus-stagger",
        "stagger": { "interval_ms": 180, "order": "sequential",
          "amplitude": { "curve": "descending", "start": 1.0, "end": 0.6 },
          "settle": { "easing": "spring", "duration_ms": 1200 }
        },
        "delay": { "after": "hero_done", "offset_ms": 200 }
      }
    ],
    "camera": {
      "move": "push_in", "intensity": 0.4,
      "sync": { "cue": "hero_done" }
    }
  }
}
```

Signature: blur reveals, spring physics for settle, deep zoom (SCALE_FACTOR: 0.18), 3D perspective.

### editorial

```json
{
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["product"],
        "primitive": "ed-slide-stagger",
        "on_complete": { "emit": "hero_done" }
      },
      {
        "id": "cards",
        "targets": ["card-0", "card-1", "card-2"],
        "primitive": "ed-slide-stagger",
        "stagger": { "interval_ms": 120, "order": "sequential",
          "amplitude": { "curve": "uniform", "start": 1.0, "end": 1.0 }
        },
        "delay": { "after": "hero_done", "offset_ms": 150 }
      }
    ],
    "camera": {
      "move": "push_in", "intensity": 0.2,
      "sync": { "peak_at": 1.0 }
    }
  }
}
```

Signature: no blur, no 3D, opacity crossfades, restrained camera (SCALE_FACTOR: 0.10, max 1% scale change). Content-forward.

### neutral-light

```json
{
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["product"],
        "primitive": "as-fadeIn",
        "on_complete": { "emit": "hero_done" }
      },
      {
        "id": "cards",
        "targets": ["card-0", "card-1", "card-2"],
        "primitive": "nl-slide-stagger",
        "stagger": { "interval_ms": 150, "order": "sequential" },
        "delay": { "after": "hero_done", "offset_ms": 200 }
      }
    ],
    "camera": { "move": "static" }
  }
}
```

Signature: no blur, no 3D, no camera movement at all, sequential reveals. Clarity through stillness. Attention directed via spotlights and cursors, not camera.

### montage

```json
{
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["product"],
        "primitive": "mo-scale-entrance",
        "on_complete": { "emit": "hero_done" }
      },
      {
        "id": "cards",
        "targets": ["card-0", "card-1", "card-2"],
        "primitive": "mo-scale-entrance",
        "stagger": { "interval_ms": 100, "order": "sequential",
          "amplitude": { "curve": "ascending", "start": 0.6, "end": 1.0 }
        },
        "delay": { "after": "hero_done", "offset_ms": 0 }
      }
    ],
    "camera": { "move": "static" }
  }
}
```

Signature: scale entrances (1.15 to 1.0), no blur, no camera, no ambient motion. Hard cuts between scenes, ascending energy within scenes. Scenes are too short (2-4s) for any ambient effects.

---

## Architecture

```
                        LEVEL 1                           LEVEL 2
                    Motion Intent                     Motion Timeline

 ┌────────┐     ┌──────────────────┐     ┌──────────┐     ┌──────────────────┐     ┌────────┐
 │        │     │   Scene JSON     │     │          │     │  Frame-Addressed │     │        │
 │ Brief  │────▶│   + Motion Block │────▶│ Compiler │────▶│  Keyframe Tracks │────▶│Renderer│──▶ .mp4
 │        │     │                  │     │          │     │                  │     │        │
 └────────┘     └──────────────────┘     └──────────┘     └──────────────────┘     └────────┘
                         │                    │ ▲                  │
                         │               ┌────┘ │                 │
                         ▼               ▼      │                 ▼
                  ┌──────────────┐  ┌────────┐  │          ┌──────────────┐
                  │ Personality  │  │Catalogs│  │          │    Critic    │
                  │  (rules,     │  │        │  │          │  (7 rules,  │
                  │   timing,    │  │Recipes │  │          │   scoring,  │
                  │   easing,    │  │Prims   │  │          │   suggest)  │
                  │   camera)    │  │        │  │          │             │
                  └──────────────┘  └────────┘  │          └──────┬──────┘
                                                │                 │
                                                └─── iterate ─────┘
```

### Pipeline stages

| Stage | Input | Output | MCP Tool |
|-------|-------|--------|----------|
| Personality | slug | timing, easing, camera rules | `get_personality` |
| Scene authoring | layers + motion block | v2 scene JSON | manual / `generate_scenes` |
| Compilation | scene + personality | Level 2 timeline | `compile_motion` |
| Critique | timeline + scene | score + issues + suggestions | `critique_motion` |
| Validation | primitives + personality | PASS / WARN / BLOCK | `validate_choreography` |
| Evaluation | manifest + scenes + style | pacing/variety/flow/adherence scores | `evaluate_sequence` |
| Rendering | scene or manifest | MP4 video | `npx remotion render` |

### Level 1 vs Level 2

| | Level 1: Motion Intent | Level 2: Motion Timeline |
|--|----------------------|-------------------------|
| **Unit** | Groups, cues, recipes | Per-layer keyframe tracks |
| **Time** | Relative (`after: "hero_done"`) | Absolute (`frame: 73`) |
| **Animation** | Primitive references (`"cd-focus-stagger"`) | Expanded properties (`opacity`, `translateY`) |
| **Stagger** | Declarative (`interval_ms: 120`) | Pre-computed offsets per element |
| **Camera** | Intent (`sync.cue: "headline_done"`) | Frame-addressed scale/translate tracks |
| **Authored by** | Human or AI | Compiler only |
| **Consumed by** | Compiler | Renderer |

---

## Summary

The Motion Spec v2 pipeline separates authoring from execution. You describe choreography as groups of layers with primitives, stagger, and cue-based sequencing. The compiler resolves the dependency graph, expands primitives to keyframes, applies stagger offsets and amplitude curves, syncs camera to cues, and emits a frame-addressed timeline. The critic catches quality issues before rendering. The evaluator scores multi-scene sequences against style rules. The personality system ensures every decision -- timing, easing, effects, camera -- stays within the boundaries of the chosen aesthetic.

The complete tool chain:

```
get_personality → author scene → compile_motion → critique_motion
                                                       ↓
                                            fix issues, re-compile
                                                       ↓
                               plan_sequence → evaluate_sequence → render
```
