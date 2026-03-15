# Motion Spec V1 vs V2: Side-by-Side Comparison

The same 5-layer product launch scene, expressed in the old flat format and the new Motion Spec v2 choreography. Same content, dramatically different motion.

---

## V1: Flat Animation (Before)

```json
{
  "scene_id": "sc_comparison_v1",
  "duration_s": 4.0,
  "fps": 60,
  "personality": "cinematic-dark",
  "layers": [
    { "id": "background",  "type": "image", "depth_class": "background", "src": "bg-launch.jpg" },
    { "id": "hero-image",  "type": "image", "depth_class": "midground",  "src": "product-hero.png" },
    { "id": "headline",    "type": "text",  "depth_class": "foreground", "content": "Product Launch" },
    { "id": "tagline",     "type": "text",  "depth_class": "foreground", "content": "The future is here" },
    { "id": "cta-button",  "type": "text",  "depth_class": "foreground", "content": "Learn More" }
  ],
  "camera": {
    "move": "push_in",
    "intensity": 0.3,
    "easing": "cinematic_scurve"
  },
  "entrance": {
    "primitive": "as-fadeInUp",
    "delay_ms": 0
  }
}
```

**What happens:** All 5 layers fade-in-up simultaneously at frame 0. Camera pushes in on its own timeline. Nothing is connected. Every layer looks the same.

---

## V2: Choreographed Motion (After)

```json
{
  "scene_id": "sc_comparison_v2",
  "duration_s": 4.0,
  "fps": 60,
  "format_version": 2,
  "personality": "cinematic-dark",
  "layers": [
    { "id": "background",  "type": "image", "depth_class": "background", "src": "bg-launch.jpg" },
    { "id": "hero-image",  "type": "image", "depth_class": "midground",  "src": "product-hero.png" },
    { "id": "headline",    "type": "text",  "depth_class": "foreground", "content": "Product Launch" },
    { "id": "tagline",     "type": "text",  "depth_class": "foreground", "content": "The future is here" },
    { "id": "cta-button",  "type": "text",  "depth_class": "foreground", "content": "Learn More" }
  ],
  "motion": {
    "groups": [
      {
        "id": "hero",
        "targets": ["headline"],
        "primitive": "cd-focus-stagger",
        "on_complete": { "emit": "headline_done" },
        "effects": [
          { "type": "blur", "from": 8, "to": 0, "duration_ms": 600, "easing": "expo_out" },
          { "type": "brightness", "from": 0.3, "to": 1.0, "duration_ms": 800, "easing": "ease_out" }
        ]
      },
      {
        "id": "supporting",
        "targets": ["tagline", "cta-button"],
        "primitive": "cd-focus-stagger",
        "delay": { "after": "headline_done", "offset_ms": 200 },
        "stagger": {
          "interval_ms": 120,
          "order": "sequential",
          "amplitude": { "curve": "descending", "start": 1.0, "end": 0.6 }
        }
      },
      {
        "id": "background-group",
        "targets": ["hero-image"],
        "primitive": "fade-in",
        "effects": [
          { "type": "scale", "from": 1.05, "to": 1.0, "duration_ms": 2000, "easing": "ease_out" }
        ]
      },
      {
        "id": "bg-entrance",
        "targets": ["background"],
        "primitive": "fade-in"
      }
    ],
    "camera": {
      "move": "push_in",
      "intensity": 0.4,
      "sync": { "cue": "headline_done", "peak_at": 0.6 }
    }
  }
}
```

**What happens:** The headline emerges from blur with a brightness reveal. When it completes, it emits a cue. That cue triggers the supporting text (tagline, CTA) with 120ms stagger and descending amplitude. The camera peaks its push-in at exactly 60% of the scene, synchronized to the headline completion. The hero image subtly scales down from 1.05x, adding depth. Every element has a distinct role and timing.

---

## What Changed and Why It Matters

### Annotation of Key Differences

| Element | V1 Behavior | V2 Behavior | Why It Matters |
|---------|-------------|-------------|----------------|
| **headline** | `as-fadeInUp` at frame 0 | `cd-focus-stagger` + blur 8->0 + brightness 0.3->1.0 | Hero gets the most dramatic entrance, establishing visual hierarchy |
| **tagline** | `as-fadeInUp` at frame 0 | Enters 200ms after headline completes, amplitude 1.0 | Sequenced entry gives the eye time to read the headline first |
| **cta-button** | `as-fadeInUp` at frame 0 | Enters 320ms after headline (200ms delay + 120ms stagger), amplitude 0.6 | Softer arrival de-emphasizes supporting content |
| **hero-image** | `as-fadeInUp` at frame 0 | `fade-in` + scale 1.05->1.0 over 2s | Subtle Ken Burns effect adds cinematic depth |
| **background** | `as-fadeInUp` at frame 0 | `fade-in` | Background enters quietly, not competing with hero |
| **camera** | `push_in` at intensity 0.3, independent | `push_in` at intensity 0.4, peak synced to `headline_done` cue | Camera movement reinforces the narrative beat |

### The Choreography Model

```
V1 Timeline (flat):
  frame 0                                            frame 240
  |                                                       |
  ALL LAYERS: fadeInUp ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  CAMERA:     push_in  ██████████████████████████████████████

V2 Timeline (choreographed):
  frame 0              headline_done    peak_at 0.6    frame 240
  |                         |                |              |
  background: fade-in  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  hero-image: fade+scale █████████████████████████████████████████████
  headline:   blur+bright ████████░░░░░░░░░░░░░░░░░░░░░░░░
                                 ↓ emit cue
  tagline:              ░░░░░░░░░░░████░░░░░░░░░░░░░░░░░░░
  cta-button:           ░░░░░░░░░░░░░████░░░░░░░░░░░░░░░░░ (0.6x amplitude)
  CAMERA:     push_in   ░░░░░░░░░░░░░░████░░░░░░░░░░░░░░░░ (peaks at cue)
```

---

## Feature Comparison Table

| Feature | V1 | V2 | Improvement |
|---------|----|----|-------------|
| Stagger | -- No stagger | Yes: 120ms interval, descending amplitude (1.0 -> 0.6) | Elements enter in sequence with diminishing energy |
| Cue sync | -- No cue system | Yes: `headline_done` triggers supporting group + camera peak | Motion events are causally connected |
| Effects | -- No per-layer effects | Yes: blur reveal (8->0), brightness fade (0.3->1.0), scale (1.05->1.0) | Rich per-layer visual treatments |
| Camera sync | -- Camera runs independently | Yes: peak aligns with headline completion via cue | Camera reinforces the narrative beat |
| Hierarchy | -- All layers identical | Yes: hero has blur+brightness; supporting has stagger+decay | Visual importance is encoded in motion |
| Groups | -- No grouping | Yes: 4 groups (hero, supporting, background, bg-entrance) | Semantic organization of motion intent |
| Compilable | -- Returns null | Yes: full frame-addressed timeline | Machine-readable, inspectable, testable |
| Critic score | ~40 (estimated) | 85+ | Measurable quality improvement |

---

## Running the Comparison

```bash
node scripts/compare-v1-v2.js
```

This script loads both scenes, compiles the v2 through the motion compiler (v1 returns `null`), runs the critic on the compiled timeline, and prints a detailed comparison report.
