# Animation Principles for Prototype Demos

Based on Disney's 12 Basic Principles of Animation (Johnston & Thomas, 1981),
adapted for UI animation demos.

## Principles We Apply

### 1. Squash & Stretch + Icon Wiggle

**Preferred for buttons: Icon Wiggle pattern.** Rather than deforming the button body
(which can look rubbery), keep the button scale subtle (±2-3%) and animate the icon
inside with rotation (±10-14deg).

```css
/* Preferred — icon wiggle with subtle button scale */
@keyframes btn-press {
  0%   { transform: scale(1);    filter: brightness(1); }
  15%  { transform: scale(1.02); filter: brightness(1.08); }   /* Hover signal */
  40%  { transform: scale(0.97); filter: brightness(1.04); }   /* Press down */
  65%  { transform: scale(1.01); filter: brightness(1); }      /* Release overshoot */
  100% { transform: scale(1);    filter: brightness(1); }
}
@keyframes icon-wiggle {
  0%   { transform: rotate(0deg); }
  15%  { transform: rotate(0deg); }     /* Wait for hover signal */
  30%  { transform: rotate(-14deg); }   /* Wiggle left */
  45%  { transform: rotate(14deg); }    /* Wiggle right */
  60%  { transform: rotate(-6deg); }    /* Settle left */
  75%  { transform: rotate(4deg); }     /* Settle right */
  100% { transform: rotate(0deg); }
}
.demo-btn.pressing svg {
  animation: icon-wiggle 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

**For containers/drop zones:** Keep scale barely perceptible (<0.5%) and use
border/background color pulse as the primary signal. Icon inside can wiggle
with gentler values (±10deg with slight translateY lift).

**Squash & Stretch** (full body deformation) is available for marketing/playful
contexts but is NOT the default for product UI demos. If used, volume must be
conserved — if scaleY increases, scaleX decreases proportionally:

```css
scale(0.96, 1.08)   /* stretch: narrow + tall */
scale(1.06, 0.94)   /* squash: wide + short */
```

### 2. Anticipation
A small reverse movement before the main action. Signals "something is about to happen."
In the icon wiggle pattern, the button's `scale(1.02) + brightness(1.08)` hover signal
serves as anticipation before the press action.

For drop zones, a brief border/background color shift serves as anticipation before
the receive animation plays.

### 3. Staging
Direct the viewer's eye to one thing at a time. Only one element should be animating
at any moment. Don't animate the button AND the drop zone simultaneously.

### 4. Straight-Ahead vs Pose-to-Pose
We use **pose-to-pose** (keyframes with interpolation). Define key moments,
let the browser interpolate between them.

### 5. Follow Through & Overlapping Action
Different parts of the UI move at **different speeds**:

| Element | Speed | Duration |
|---------|-------|----------|
| Header text swap | Fast | 180ms |
| Footer buttons | Quick | 220ms |
| Body phase content | Medium (hero) | 500-600ms |
| Container height | Slow (organic) | 650ms |
| Stagger reveals | Deliberate | 150ms intervals |

This creates **rhythm** — not everything moves together.

### 6. Slow In / Slow Out
Use easing curves — never linear (except progress bars).

| Purpose | Easing |
|---------|--------|
| Elements entering | `cubic-bezier(0.16, 1, 0.3, 1)` (expo out) |
| Elements leaving | `cubic-bezier(0.7, 0, 0.84, 0)` (expo in) |
| Spring interactions | `cubic-bezier(0.22, 1, 0.36, 1)` (quint out) |
| Height changes | `cubic-bezier(0.25, 0.1, 0.25, 1)` (smooth) |

### 7. Arc
Avoid purely linear movement. Even scale changes benefit from curved timing
(the easing curve provides the arc).

### 8. Secondary Action
Supporting animations that reinforce the primary one. Examples:
- Drop zone border darkening while background fills (supporting the "receive" action)
- Button brightness change alongside scale change
- Progress step labels changing color as the bar passes them

### 9. Timing
**Dwell time per phase matters.** Each phase should have enough time for:
1. Staggered elements to fully reveal
2. The viewer to read and comprehend
3. The interaction animation to play before transitioning

Typical phase timings:
- Simple display phase: 2.0-2.5s
- Phase with staggered reveals: 3.0-4.0s
- Phase with progress animation: 3.5-4.5s
- Success/completion phase: 2.5-3.0s

### 10. Exaggeration
In an animation context, interactions must be **more dramatic than real UI**.
What works at interactive speed (subtle opacity change) is invisible in a demo.
Scale changes, brightness shifts, and spring physics need to be theatrical.

| Property | Interactive UI | Demo Animation |
|----------|---------------|----------------|
| Button press scale | 0.98 | 0.94 |
| Button hover scale | 1.0 | 1.04-1.07 |
| Spring overshoot | subtle | visible |
| Hover brightness | 1.02 | 1.12-1.15 |

### 11. Solid Drawing
Maintain visual consistency. Shadows, borders, and radii should stay correct
throughout animations. Don't distort the UI beyond recognition.

### 12. Appeal
The animation should tell a clear story. The viewer should understand:
- What the product does
- What just happened at each step
- The transformation (messy input -> organized output)

## Directional Journey ("Powers of 10")

Inspired by the Eames' *Powers of 10* film — vary the direction of movement across
phases to create a sense of journeying through levels of detail. **Never have all
phases enter from the same direction** — that feels flat and repetitive.

### Per-Phase Entry/Exit Design

Each phase gets a unique entry origin and exit direction:

| Phase | Story Beat | Entry From | Exit To | CSS Transform |
|-------|-----------|-----------|---------|---------------|
| Establishing | First impression | Fade only | Drift up | `opacity` only → `translateY(-6px)` |
| Content arrives | New info lands | Rise from below | Lift up | `translateY(12px)` → `translateY(-8px)` |
| Deep dive | Processing | Below + zoom | Sweep left | `translateY(6px) scale(0.985)` → `translateX(-14px)` |
| Results | New info flows | Slide from right | File away left | `translateX(24px)` → `translateX(-18px)` |
| Resolution | Settling | Scale up | Fade | `scale(0.96)` → `scale(0.98)` |

### Stagger Direction Must Match Phase Direction

**Critical:** The stagger items within each phase should animate from the same
direction as the phase itself. This creates visual coherence:

```css
/* Phase entering from below → items stagger from below */
[data-stagger-group="select"].stagger-item { transform: translateY(8px); }

/* Phase entering from right → items stagger from right */
[data-stagger-group="suggest"].stagger-item { transform: translateX(16px); }

/* Phase entering via scale → items stagger via scale */
[data-stagger-group="success"].stagger-item { transform: scale(0.96); }

/* All settle to neutral */
.stagger-item.stagger-visible { transform: none; }
```

### Exit Direction Rule

Exit direction should create narrative flow — content "leaves" in a way that
suggests where it's going next. Common patterns:
- Content drifts **up** = "uploaded" or "sent"
- Content sweeps **left** = "filed away" or "done"
- Content **scales down** = "receding" or "closing"

## Speed Hierarchy

Create rhythm by varying speeds across elements:

```
FAST (150-220ms)   → Header swaps, footer transitions, color changes
MEDIUM (450-600ms) → Body content crossfades, primary transitions
SLOW (650-800ms)   → Container height, stagger sequences
SPRING (900-1350ms) → Interaction animations (button press, drop zone)
```

## Interaction Animation Pattern

### Buttons (~1100ms): Scale + Icon Wiggle

The **preferred** button interaction pattern. Subtle body scale with icon rotation:

1. **Signal** (0-15%) — `scale(1.02) + brightness(1.08)` — hover glow
2. **Press** (15-40%) — `scale(0.97) + brightness(1.04)` — press down
3. **Release** (40-65%) — `scale(1.01)` — overshoot on release
4. **Settle** (65-100%) — `scale(1)` — return to rest

The icon SVG inside the button gets a synced `icon-wiggle` animation:
±14deg rotation that starts after the hover signal and decays (14° → 6° → 4° → 0°).

### Drop Zones (~1350ms): Border/BG Pulse + Icon Wiggle

Gentler than buttons. The primary signal is border/background color, not scale:

1. **Signal** (0-20%) — Border darkens, background fills
2. **Receive** (20-45%) — Border strongest, `scale(1.005)` barely perceptible
3. **Settle** (45-70%) — Colors return, `scale(0.998)` micro-undershoot
4. **Rest** (70-100%) — Back to default

The icon inside the drop zone (e.g., upload arrow) gets a gentler wiggle:
±10deg rotation with slight `translateY(-2px)` lift to suggest "receiving."

### Full Squash/Stretch (alternative)

For playful/marketing contexts where more dramatic deformation is appropriate:
1. **Anticipation** (10-20%) — small reverse movement + brightness
2. **Main Action** (20-40%) — squash/stretch with volume conservation
3. **Overshoot** (40-60%) — pass through rest position
4. **Settle** (60-100%) — counter-overshoot, return to rest
