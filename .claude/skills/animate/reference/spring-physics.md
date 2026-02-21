# Spring Physics for UI Animation

Inspired by Remotion's spring system and real physics simulation.

## Why Springs > Easing Curves

Easing curves (cubic-bezier) are mathematical abstractions. Springs simulate real physics:
- **Mass** — heavier objects resist movement, take longer to stop
- **Stiffness** — how hard the spring pulls toward the target
- **Damping** — friction that bleeds energy and prevents infinite oscillation

This produces naturally-feeling motion because it mimics how real objects behave.

## CSS Spring Approximation

CSS can't do true spring physics, but we can approximate with keyframe animations
that encode the spring curve. The key insight from Remotion: springs **overshoot**
then **settle**, and the overshoot amount depends on damping.

### Recipes by Damping Level

**High damping (smooth settle, minimal overshoot)** — for UI state changes
```css
/* Equivalent: mass=1, stiffness=100, damping=20 */
@keyframes spring-smooth {
  0%   { transform: scale(0); }
  40%  { transform: scale(1.04); }  /* slight overshoot */
  70%  { transform: scale(0.99); }  /* tiny undershoot */
  100% { transform: scale(1); }
}
/* Duration: ~400ms, easing: cubic-bezier(0.25, 1, 0.5, 1) */
```

**Medium damping (visible bounce)** — for button interactions, emphasis
```css
/* Equivalent: mass=1, stiffness=100, damping=10 */
@keyframes spring-bouncy {
  0%   { transform: scale(0); }
  35%  { transform: scale(1.08); }  /* overshoot */
  55%  { transform: scale(0.94); }  /* undershoot */
  75%  { transform: scale(1.02); }  /* settle */
  100% { transform: scale(1); }
}
/* Duration: ~600ms, easing: cubic-bezier(0.22, 1, 0.36, 1) */
```

**Low damping (dramatic bounce)** — for playful/marketing animations
```css
/* Equivalent: mass=1, stiffness=100, damping=5 */
@keyframes spring-dramatic {
  0%   { transform: scale(0); }
  25%  { transform: scale(1.15); }  /* big overshoot */
  45%  { transform: scale(0.90); }  /* big undershoot */
  60%  { transform: scale(1.06); }  /* second overshoot */
  75%  { transform: scale(0.98); }  /* settle */
  100% { transform: scale(1); }
}
/* Duration: ~900ms, easing: cubic-bezier(0.22, 1, 0.36, 1) */
```

## Squash & Stretch with Springs

Volume conservation: when one axis overshoots, the other compensates.

```css
@keyframes spring-squash-stretch {
  0%   { transform: scale(1, 1); }
  20%  { transform: scale(1.02, 0.97); }   /* Anticipation squash */
  40%  { transform: scale(0.96, 1.08); }   /* Stretch (narrow + tall) */
  60%  { transform: scale(1.06, 0.94); }   /* Squash (wide + short) */
  78%  { transform: scale(0.99, 1.02); }   /* Settle overshoot */
  100% { transform: scale(1, 1); }          /* Rest */
}
```

## Icon Wiggle Pattern

**Preferred over full-body squash/stretch for product UI demos.** The icon inside
a button or container rotates while the parent element does a subtle scale.

Production implementation pattern:
- `@keyframes wiggle` (±12deg, 0.3s)
- `hover:scale-[1.02] active:scale-[0.98]` with group-hover wiggle on icon

### Button Icon Wiggle (~1100ms)
```css
@keyframes icon-wiggle {
  0%   { transform: rotate(0deg); }
  15%  { transform: rotate(0deg); }     /* Hold during hover signal */
  30%  { transform: rotate(-14deg); }
  45%  { transform: rotate(14deg); }
  60%  { transform: rotate(-6deg); }    /* Decay */
  75%  { transform: rotate(4deg); }
  100% { transform: rotate(0deg); }
}
```

### Drop Zone Icon Wiggle (~1350ms, gentler)
```css
@keyframes zone-icon-wiggle {
  0%   { transform: rotate(0deg) translateY(0); }
  15%  { transform: rotate(0deg) translateY(0); }
  25%  { transform: rotate(-10deg) translateY(-2px); }  /* Gentler + lift */
  40%  { transform: rotate(10deg) translateY(-2px); }
  55%  { transform: rotate(-4deg) translateY(-1px); }
  70%  { transform: rotate(3deg) translateY(0); }
  100% { transform: rotate(0deg) translateY(0); }
}
```

Key differences from button wiggle:
- Smaller rotation (±10deg vs ±14deg)
- Slight `translateY(-2px)` lift to suggest "receiving"
- Longer duration matching the container's 1350ms

## Stagger with Spring Delay

From Remotion's delay pattern — each element starts its spring N frames later.

**IMPORTANT: Use JS-controlled staggers, NOT CSS `animation-delay`.** CSS animation
delays only fire once and don't replay on loop. For autoplay demos that loop, use:

```javascript
// JS-controlled stagger — replay-safe
function runStagger(groupName, interval) {
  const items = document.querySelectorAll(`[data-stagger-group="${groupName}"]`);
  items.forEach(el => el.classList.remove('stagger-visible'));
  items.forEach((el, i) => {
    setTimeout(() => el.classList.add('stagger-visible'), i * interval);
  });
}
```

```css
/* CSS classes toggled by JS */
.stagger-item {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 450ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger-item.stagger-visible {
  opacity: 1;
  transform: none;
}
```

Cap total stagger time at 400-500ms to avoid feeling slow.

## Interaction Spring Sequences

For demo animations where we simulate user interaction:

### Preferred: Scale + Icon Wiggle

| Phase | Duration | Button | Drop Zone |
|-------|----------|--------|-----------|
| Signal | 0-15% | `scale(1.02) brightness(1.08)` | Border/bg color shift |
| Press/Receive | 15-45% | `scale(0.97)` | `scale(1.005)` barely perceptible |
| Release/Settle | 45-70% | `scale(1.01)` overshoot | `scale(0.998)` |
| Rest | 70-100% | `scale(1)` | `scale(1)` |

Icon inside both targets gets a synced wiggle animation.

### Alternative: Full Squash/Stretch

| Phase | Duration | What Happens |
|-------|----------|--------------|
| Signal | 10-20% | Brightness/color change signals hover |
| Anticipation | 15-25% | Small reverse movement (squash) |
| Action | 25-45% | Main spring movement (stretch toward target) |
| Overshoot | 45-65% | Pass through rest, undershoot |
| Settle | 65-100% | Small counter-bounce, return to rest |

## Why Not Use Remotion Directly?

Remotion is powerful but requires:
- A full React/Node.js rendering pipeline
- Frame-by-frame rendering (slow for iteration)
- AWS Lambda for production rendering at scale

Our approach (CSS keyframe springs + Puppeteer capture) gives us:
- Instant browser preview (refresh to see changes)
- Real CSS animations (not simulated)
- Simple capture pipeline (no build step)
- Self-contained HTML files that work anywhere

We borrow Remotion's **spring physics concepts** and **composition model**
(video = components + time) without the infrastructure overhead. If we need
true programmatic video at scale later, Remotion is the upgrade path.
