# Camera Rig & Cinematic Motion for UI Animation

How to create depth, movement, and cinematic quality in product demos using CSS camera techniques. Covers everything from basic perspective setup to AI-driven intent mapping.

---

## Table of Contents

1. [Camera Philosophy](#1-camera-philosophy)
2. [CSS Camera Rig Setup](#2-css-camera-rig-setup)
3. [Motion Primitives](#3-motion-primitives)
4. [Parallax System](#4-parallax-system)
5. [Depth of Field Simulation](#5-depth-of-field-simulation)
6. [Ambient Micro-Movement](#6-ambient-micro-movement)
7. [Camera Behavior by Personality](#7-camera-behavior-by-personality)
8. [Emotion-to-Camera Mapping](#8-emotion-to-camera-mapping)
9. [Camera Feature Taxonomy](#9-camera-feature-taxonomy)
10. [Easing & Motion Quality](#10-easing--motion-quality)
11. [Guardrails & Quality Controls](#11-guardrails--quality-controls)
12. [Common Mistakes](#12-common-mistakes)

---

## 1. Camera Philosophy

### Digital Camera vs Real Camera

In CSS/web animation, the "camera" is a virtual construct. We don't move a camera — we transform the **scene** in the opposite direction. The camera is the viewport; movement is an illusion created by transforming content.

Unlike real cameras, digital cameras can move perfectly smoothly, ignore physics, and break rules. **But they shouldn't carelessly.** The same principles that make real cinematography compelling apply to UI animation:

1. **Every camera move must be motivated.** Ask: "Why is it moving?"
2. **Camera serves comprehension, not spectacle.** Movement should help users understand spatial relationships, hierarchy, and flow.
3. **Stillness is a valid choice.** Constant motion fatigues viewers. The absence of camera movement can be as powerful as its presence.

### The Two Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Camera as transition** | Move between states/phases | Phase changes, reveals, navigation |
| **Camera as atmosphere** | Subtle continuous movement | Ambient scenes, idle states, breathing |

---

## 2. CSS Camera Rig Setup

### Basic Rig (Cinematic Dark)

The camera rig uses CSS `perspective` to create a shared 3D space. All camera "movements" are transforms applied to the scene container.

```css
/* The Camera — parent container with perspective */
.camera-rig {
  perspective: 1200px;
  perspective-origin: 50% 40%;  /* slightly above center — heroic angle */
  transform-style: preserve-3d;
  overflow: hidden;
}

/* The Scene — what the camera looks at */
.camera-rig .scene {
  transform-style: preserve-3d;
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Why parent the camera this way?**
Animating the scene (not the camera) avoids gimbal issues and messy animation curves. This mirrors professional 3D animation where cameras are parented to null objects for cleaner control.

### Perspective Values by Context

| Context | Perspective | Effect |
|---------|------------|--------|
| Dramatic close-up | `600px` | Strong depth distortion, intimate |
| Standard product demo | `1000-1200px` | Natural depth, professional |
| Wide establishing | `1800px` | Flat, expansive, documentary |
| Flat/2D (editorial) | `none` | No 3D, pure translate/scale |

### Perspective Origin (Camera Angle)

```css
/* Default: slightly above center (heroic) */
perspective-origin: 50% 40%;

/* Dead center (neutral) */
perspective-origin: 50% 50%;

/* Low angle (power, authority) */
perspective-origin: 50% 70%;

/* High angle (vulnerability, overview) */
perspective-origin: 50% 20%;

/* Off-center (tension, dynamism) */
perspective-origin: 30% 40%;
```

---

## 3. Motion Primitives

### Camera Movement Types

Every camera movement maps to a specific CSS transform on the scene:

| Movement | CSS Transform | What It Does | Cinematic Use |
|----------|--------------|--------------|---------------|
| **Dolly** | `translateZ()` | Push forward/back through Z-space | Creates parallax, feels immersive |
| **Truck** | `translateX()` | Move left/right | Reveals adjacent content |
| **Pedestal** | `translateY()` | Move up/down | Scale reveal, status shift |
| **Pan** | `rotateY()` | Rotate on Y-axis | Gradually reveals information |
| **Tilt** | `rotateX()` | Rotate on X-axis | Dramatic scale reveal |
| **Zoom** | `scale()` | Change apparent size | No parallax — flat magnification |
| **Orbit** | `rotateY() + rotateX()` | Rotate around content | 3D showcase, object reveal |
| **Arc** | Curved path via keyframes | Movement along a curve | Elegant transitions, cinema |
| **Push-in** | `translateZ()` (positive, small) | Slow dolly toward subject | Build tension, focus attention |
| **Pull-out** | `translateZ()` (negative) | Slow dolly away from subject | Reveal context, resolution |
| **Crane** | `translateY() + translateZ()` | Combined vertical + depth | Grand reveals, establishing |
| **Rack Focus** | `filter: blur()` transition | Shift sharp focus between layers | Direct attention, emotional beats |
| **Handheld Drift** | Randomized micro-transforms | Subtle organic movement | Documentary feel, authenticity |

### Pro Insight: Dolly vs Zoom

Beginners overuse zoom (scale). Professionals prefer dolly (translateZ) because:
- **Dolly creates parallax** — foreground moves faster than background
- **Zoom is flat** — everything scales uniformly, no depth
- **Dolly feels immersive** — the viewer moves through space
- **Zoom feels observed** — the viewer watches from a distance

Use zoom only when you explicitly want flat magnification (product spotlight, detail callout).

---

## 4. Parallax System

### Why Parallax Matters

Parallax is the single biggest upgrade to flat animation. It creates perceived depth by moving layers at different speeds based on their Z-distance from the camera.

### CSS Parallax Layers

```css
/* Scene with depth layers */
.parallax-scene {
  perspective: 1200px;
  transform-style: preserve-3d;
}

/* Layer speeds: foreground fastest, background slowest */
.parallax-bg {
  transform: translateZ(-800px) scale(1.67);
  /* Scale compensates: scale = 1 + (|Z| / perspective) */
  /* 1 + (800 / 1200) = 1.67 */
}

.parallax-mid {
  transform: translateZ(-400px) scale(1.33);
  /* 1 + (400 / 1200) = 1.33 */
}

.parallax-fg {
  transform: translateZ(0);
  /* Foreground at camera plane — moves at camera speed */
}
```

### Scale Compensation Formula

When elements are placed at negative Z (further from camera), they appear smaller. Compensate with scale:

```
scale = (perspective + |translateZ|) / perspective
```

Or simplified: `scale = 1 + (|Z| / perspective)`

### Exaggerated Depth Separation

For cinematic impact, don't space layers evenly. Exaggerate the depth difference:

| Layer | Z-Depth | Scale | Visual Effect |
|-------|---------|-------|---------------|
| Foreground | `0` | `1.0` | Sharp, fast movement |
| Midground | `-400px` | `1.33` | Medium movement |
| Background | `-800px` | `1.67` | Slow, grounding |
| Deep background | `-1600px` | `2.33` | Near-static, atmospheric |

### Parallax During Transitions

During phase transitions, different elements move at different speeds:

```css
.transitioning .bg-element {
  transform: translateY(-20px);   /* slow */
  transition: transform 800ms var(--cd-ease-enter);
}
.transitioning .mid-element {
  transform: translateY(-40px);   /* medium */
  transition: transform 600ms var(--cd-ease-enter);
}
.transitioning .fg-element {
  transform: translateY(-80px);   /* fast — foreground moves most */
  transition: transform 400ms var(--cd-ease-enter);
}
```

### Parallax by Personality

| Personality | Parallax Approach | Max Depth Separation |
|-------------|-------------------|---------------------|
| Cinematic Dark | True 3D translateZ + perspective | `-800px` to `0` (3+ layers) |
| Editorial | 2D speed differential only (different translateY/X rates) | `20-60px` offset range |
| Neutral Light | Minimal or none — content clarity first | `0-10px` if any |

---

## 5. Depth of Field Simulation

### CSS Depth of Field

True DOF requires real 3D rendering, but CSS can simulate it effectively:

```css
/* Background layer — out of focus */
.dof-bg {
  filter: blur(3px);
  opacity: 0.4;
  transform: translateZ(-200px) scale(1.17);
}

/* Subject layer — sharp focus */
.dof-subject {
  filter: blur(0);
  transform: translateZ(0);
}

/* Foreground element — slightly soft */
.dof-fg {
  filter: blur(1px);
  opacity: 0.7;
  transform: translateZ(100px) scale(0.92);
}
```

### Rack Focus (Animated Focus Shift)

Shift viewer attention between layers by animating blur:

```css
@keyframes rack-focus-to-bg {
  0% {
    /* Subject sharp, background blurred */
  }
  100% {
    /* Subject blurred, background sharp */
  }
}

.subject.rack-to-bg {
  animation: blur-out 800ms var(--cd-ease-smooth) forwards;
}
.background.rack-to-bg {
  animation: blur-in 800ms var(--cd-ease-smooth) forwards;
}

@keyframes blur-out {
  from { filter: blur(0); }
  to { filter: blur(4px); opacity: 0.6; }
}
@keyframes blur-in {
  from { filter: blur(4px); opacity: 0.4; }
  to { filter: blur(0); opacity: 1; }
}
```

### DOF by Personality

| Personality | DOF Usage | Max Blur |
|-------------|-----------|----------|
| Cinematic Dark | Full — entrance blur, rack focus, background separation | `12px` entrance, `4px` ambient |
| Editorial | Subtle — reduced contrast on background only, no blur on entrances | `0px` (use opacity/contrast instead) |
| Neutral Light | None — tutorials must be sharp from frame 1 | `0px` |

**Editorial simulated depth** (no blur):
```css
/* Editorial: depth through contrast/opacity, not blur */
.ed-depth-bg {
  opacity: 0.35;
  filter: contrast(0.8) saturate(0.7);
}
.ed-depth-subject {
  opacity: 1;
}
```

---

## 6. Ambient Micro-Movement

### Why Static Scenes Feel Dead

Even when artwork is polished, a completely still scene feels lifeless. Ambient micro-movement — barely perceptible drift, breathing, and float — transforms static compositions into living scenes.

### Scene Breathing

Entire scene has a slow, rhythmic scale pulse:

```css
@keyframes scene-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.003); }  /* 0.3% — barely perceptible */
}
.scene { animation: scene-breathe 8s ease-in-out infinite; }
```

### Ambient Drift

Subtle positional shift suggesting the camera is handheld:

```css
@keyframes ambient-drift {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(1px, -0.5px); }
  50% { transform: translate(-0.5px, 1px); }
  75% { transform: translate(0.5px, 0.5px); }
}
.scene { animation: ambient-drift 12s ease-in-out infinite; }
```

### Element Float

Individual elements drift independently for organic feel:

```css
@keyframes element-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-3px) rotate(0.2deg); }
  75% { transform: translateY(2px) rotate(-0.15deg); }
}

/* Stagger children with different durations for organic feel */
.float-item:nth-child(1) { animation: element-float 6s ease-in-out infinite; }
.float-item:nth-child(2) { animation: element-float 7s ease-in-out infinite -1.5s; }
.float-item:nth-child(3) { animation: element-float 5.5s ease-in-out infinite -3s; }
```

### Slow Push-In

The most powerful ambient camera technique. An imperceptible dolly over 4-8 seconds:

```css
@keyframes slow-push-in {
  0% { transform: scale(1); }
  100% { transform: scale(1.015); }  /* 1.5% over full duration */
}
.scene {
  animation: slow-push-in 6s ease-in-out forwards;
}
```

### Micro-Movement by Personality

| Personality | Breathing | Drift | Float | Push-In |
|-------------|-----------|-------|-------|---------|
| Cinematic Dark | `0.3-0.5%` scale, 8s | `1-2px`, 12s | `3-8px` Y, per-element | `1.5-3%` over 6s |
| Editorial | `0.2%` scale, 10s | `0.5-1px`, 15s | `1-3px` Y, subtle | `0.5-1%` over 8s |
| Neutral Light | None or `0.1%`, 12s | None | None | None (stillness = clarity) |

---

## 7. Camera Behavior by Personality

### Cinematic Dark — Full Cinematography

**Allowed:** All camera movements, 3D perspective, parallax, DOF, shake, full orbit
**Perspective:** `1200px` default
**Camera easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (spring-like enter)
**Camera speed tiers:**

| Speed | Duration | Use Case |
|-------|----------|----------|
| Fast | `400-600ms` | Quick reframe, reaction cut |
| Medium | `800-1200ms` | Standard transition, dolly |
| Slow | `1400-2000ms` | Establishing shot, dramatic reveal |
| Spring | `1200ms` | Bounced settle after movement |

**Signature camera moves:**
- Focus pull entrance (blur → sharp)
- Dolly forward into content
- Orbit reveal (slow rotation)
- Crane shot (vertical + depth)
- Dolly zoom (Vertigo effect)

**Camera shake:** Allowed, subtle. Frequency `0.5-2Hz`, amplitude `1-3px`, exponential decay.

### Editorial — Restrained 2D Motion

**Allowed:** 2D translate only (no perspective, no rotateX/Y). Scale for push-in/pull-out.
**Perspective:** None (flat)
**Camera easing:** `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (smooth ease-out)
**Camera speed tiers:**

| Speed | Duration | Use Case |
|-------|----------|----------|
| Fast | `300-400ms` | Content swap, tab switch |
| Medium | `500-700ms` | Section transition |
| Slow | `800-1200ms` | Slow push-in, editorial drift |

**Allowed camera-like behaviors:**
- Subtle horizontal pan (`translateX`, max `30px`)
- Slow push-in via scale (`1.0 → 1.01`, over 4-8s)
- Speed-differential parallax (different translate rates, no Z-depth)
- Opacity/contrast depth simulation (no blur)

**Forbidden:** `rotateX`, `rotateY`, `translateZ`, `perspective`, `filter: blur()` on entrances, camera shake.

### Neutral Light — Attention Direction Only

**Allowed:** No camera movement. Use attention-direction primitives instead.
**Perspective:** None
**Camera easing:** N/A

**Attention direction primitives (instead of camera):**
- `nl-spotlight` — draws eye to element
- `nl-cursor-to` — simulated cursor guides attention
- `nl-step-progress` — numbered steps direct flow
- `nl-tooltip` — contextual pointer

**Allowed ambient:** Near-zero breathing (`0.1%` max), only if the scene is long-running (>10s).

**Forbidden:** All camera movement, all parallax, all blur, all 3D.

---

## 8. Emotion-to-Camera Mapping

Use this table when Claude needs to translate emotional intent into camera behavior. This is the core of the "cinematic intelligence" layer.

### Intent → Camera Decision Tree

| Intent | Camera Move | Speed | Parallax | DOF | Personality Support |
|--------|------------|-------|----------|-----|-------------------|
| **Dramatic reveal** | Slow dolly + crane | Slow | Strong (3 layers) | Background blur | CD only |
| **Build tension** | Slow push-in + slight shake | Slow | Medium | Rack to subject | CD only |
| **Power / authority** | Low angle + push-in | Medium | Medium | Subtle | CD only |
| **Intimacy** | Slow push-in | Slow | None | Shallow (subject sharp) | CD, ED (scale only) |
| **Calm / overview** | Static + ambient drift | Ambient | Subtle | None | CD, ED, NL (minimal) |
| **Energetic / fast** | Quick truck + pan | Fast | Strong | None | CD only |
| **Content focus** | Subtle scale push-in | Slow | None | Content sharp | ED |
| **Tutorial guidance** | None — spotlight + cursor | N/A | None | None | NL |
| **Product showcase** | Orbit or slow dolly | Medium | Medium | Background soft | CD only |
| **Reveal (editorial)** | Fade + slide, speed differential | Medium | Speed-only | Contrast-based | ED |
| **Resolution** | Pull-out (scale down) | Slow | Receding | Sharpening | CD, ED |

### Scene Energy Principle

Camera speed should match scene energy, but through **framing**, not literal speed:

- **Fast scene** → Faster cuts/transitions, not faster camera movement
- **Slow scene** → Subtle movement, not static (static = dead)
- **Emotional beat** → Camera slows while content pauses

---

## 9. Camera Feature Taxonomy

Five layers from foundational to intelligent. Each layer builds on the one below.

### Layer 1 — Core Transform (Infrastructure)

The raw CSS properties. Never exposed directly to users.

- Position: `translateX/Y/Z`
- Rotation: `rotateX/Y/Z`
- Perspective: `perspective`, `perspective-origin`
- Scale: `scale()`
- Clipping: `overflow: hidden`

### Layer 2 — Motion Primitives (Atomic Moves)

Named, parameterized movements built on transforms. These are what we register in the primitives system.

See [Section 3: Motion Primitives](#3-motion-primitives) for the full list.

### Layer 3 — Cinematic Enhancements (Scene Properties)

Properties that affect the whole scene, not individual elements:

- **Parallax** — Auto Z-spacing, intensity multiplier
- **Depth of Field** — Focus target, aperture simulation
- **Camera Shake** — Frequency, amplitude, decay
- **Ambient Motion** — Scene breathing, drift

### Layer 4 — Targeting & Intelligence (Smart Framing)

Behavioral rules for how the camera relates to content:

- **Follow** — Camera tracks a moving element
- **Look-at** — Camera faces a specific point
- **Damped follow** — Follow with lag smoothing (organic)
- **Smart framing** — Keep subject in rule-of-thirds zone
- **Safe margins** — Never let content leave frame

### Layer 5 — Cinematic Intent (AI Reasoning)

Intent-to-primitive mapping. This is where natural language becomes camera behavior.

- Emotion → Camera mapping (see Section 8)
- Style synthesis (documentary, cinematic, editorial)
- Scene rhythm alignment (match camera to content pacing)
- Composition scoring (evaluate framing quality)

**Implementation note:** Layers 1-3 are CSS. Layer 4 is logic rules. Layer 5 is deterministic mapping tables consumed by Claude through the MCP — not ML models.

---

## 10. Easing & Motion Quality

### Camera Easing Principles

Raw linear camera movement feels robotic. Camera motion must:

1. **Accelerate gradually** — Start slow
2. **Maintain velocity** — Smooth middle
3. **Decelerate before stop** — Gentle arrival
4. **Never stop abruptly** — Abrupt stops scream "amateur"

### Recommended Easing by Movement Type

| Movement | Easing | Why |
|----------|--------|-----|
| Dolly in/out | `cubic-bezier(0.16, 1, 0.3, 1)` | Spring-like, overshoots slightly for organic feel |
| Pan/Truck | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Smooth ease-out, directional |
| Orbit | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Very smooth, no overshoot |
| Push-in (ambient) | `ease-in-out` | Symmetrical for continuous motion |
| Crane | `cubic-bezier(0.16, 1, 0.3, 1)` | Same as dolly — spring settle |
| Shake | `linear` | Randomized — easing is in the amplitude decay |

### Graph Editor Mindset

Think of camera easing like a graph editor curve:
- **X-axis:** Time
- **Y-axis:** Position/rotation value
- **Slope:** Velocity (steeper = faster)
- **Curvature:** Acceleration

A good camera curve is S-shaped: slow start, fast middle, slow end. The start and end slopes should approach zero (the camera starts and stops gently).

---

## 11. Guardrails & Quality Controls

### Speed Limiter

Prevent camera from moving too fast for comfortable viewing:

| Property | Max Velocity | Reasoning |
|----------|-------------|-----------|
| `translateX/Y` | `400px/s` | Beyond this, motion blur needed |
| `translateZ` | `600px/s` | Depth movement is more forgiving |
| `rotateX/Y` | `15deg/s` | Rotation is disorienting at speed |
| `scale` (ambient) | `0.5%/s` | Push-in should be imperceptible |

### Acceleration Clamp

Remove abrupt stops by ensuring deceleration phase is at least 30% of total duration.

### Jerk Detection

Sudden direction changes create visual discomfort. If camera reverses direction:
- Insert a minimum 200ms settling period
- Use spring easing to smooth the reversal

### Lens Sanity

| Parameter | Min | Max | Default |
|-----------|-----|-----|---------|
| Perspective | `400px` | `2400px` | `1200px` |
| Scale (push-in) | `0.95` | `1.05` | `1.0` |
| Blur (DOF) | `0px` | `8px` | `0px` |
| Rotation | `-20deg` | `20deg` | `0deg` |

### Personality Enforcement

Camera primitives must respect personality boundaries. Never apply:
- 3D camera moves to editorial or neutral-light
- Blur to neutral-light
- Camera shake to editorial
- Any camera movement to neutral-light (use attention primitives instead)

---

## 12. Common Mistakes

1. **Overusing zoom instead of dolly** — Zoom is flat. Dolly creates parallax and immersion. Default to dolly.

2. **Moving camera and subject in same direction at same speed** — This kills depth perception. Either move the camera OR the subject, or offset their speeds.

3. **No easing** — Linear camera movement looks robotic. Always use ease-in-out or spring curves.

4. **Too much DOF blur** — Subtle is cinematic. Heavy blur is distracting. Keep ambient blur under 4px.

5. **Camera outpacing animation timing** — If elements are entering at 500ms but the camera is moving at 200ms, the camera arrives before the content. Sync camera speed to content timing.

6. **Symmetrical parallax spacing** — Equal Z-depth intervals produce boring parallax. Exaggerate foreground-to-background distance.

7. **Camera for camera's sake** — Constant motion fatigues viewers. If the camera doesn't serve comprehension, keep it still.

8. **Mixing personality camera rules** — 3D orbit in an editorial demo, blur entrance in neutral-light. Never cross personality boundaries.

9. **Forgetting scale compensation** — Elements at negative Z appear smaller. Apply the scale formula or they'll look shrunken.

10. **Ignoring safe margins** — Camera movement can push content off-screen. Always test that key content stays within the viewport at movement extremes.
