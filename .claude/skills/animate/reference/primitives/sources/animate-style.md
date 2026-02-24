# animate.style — Curated Effect Catalog

[animate.style](https://animate.style/) (animate.css v4) — the most widely used CSS animation library. 80K+ GitHub stars, pure CSS, zero dependencies.

Curated into three tiers for product demo use. Effects in the **Use** tier get full CSS keyframes for direct integration. **Adapt** effects need modification. **Skip** effects are too playful for product contexts.

---

## Use Tier (~18 effects)

Production-ready for product demos. CSS keyframes included.

### Entrances — Fade

#### `as-fadeIn`
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.fadeIn { animation: fadeIn 400ms ease-out both; }
```
**Personality:** universal | **Duration:** 300-500ms | **Use for:** Generic content appearance, overlay reveals

#### `as-fadeInDown`
```css
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
.fadeInDown { animation: fadeInDown 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** editorial, neutral-light | **Duration:** 400-600ms | **Use for:** Dropdown menus, notification toasts

#### `as-fadeInUp`
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.fadeInUp { animation: fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** editorial, neutral-light | **Duration:** 400-600ms | **Use for:** Content reveals, list item entrances, the default stagger direction

#### `as-fadeInLeft`
```css
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
.fadeInLeft { animation: fadeInLeft 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** editorial | **Duration:** 400-600ms | **Use for:** Sidebar reveals, navigation items

#### `as-fadeInRight`
```css
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
.fadeInRight { animation: fadeInRight 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** editorial | **Duration:** 400-600ms | **Use for:** Panel slides, detail pane reveals

### Exits — Fade

#### `as-fadeOut`
```css
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
.fadeOut { animation: fadeOut 300ms ease-in both; }
```
**Personality:** universal | **Duration:** 200-400ms | **Use for:** Content dismissal, modal close

#### `as-fadeOutUp`
```css
@keyframes fadeOutUp {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}
.fadeOutUp { animation: fadeOutUp 400ms ease-in both; }
```
**Personality:** editorial, neutral-light | **Duration:** 300-500ms | **Use for:** Toast dismissal, content departure

#### `as-fadeOutDown`
```css
@keyframes fadeOutDown {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(20px); }
}
.fadeOutDown { animation: fadeOutDown 400ms ease-in both; }
```
**Personality:** editorial | **Duration:** 300-500ms | **Use for:** Dropdown close, content settling

### Entrances — Slide

#### `as-slideInUp`
```css
@keyframes slideInUp {
  from { transform: translateY(100%); visibility: visible; }
  to { transform: translateY(0); }
}
.slideInUp { animation: slideInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** universal | **Duration:** 400-600ms | **Use for:** Bottom sheets, modal entrances, panel reveals

#### `as-slideInDown`
```css
@keyframes slideInDown {
  from { transform: translateY(-100%); visibility: visible; }
  to { transform: translateY(0); }
}
.slideInDown { animation: slideInDown 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** universal | **Duration:** 400-600ms | **Use for:** Top banners, notification bars

#### `as-slideInLeft`
```css
@keyframes slideInLeft {
  from { transform: translateX(-100%); visibility: visible; }
  to { transform: translateX(0); }
}
.slideInLeft { animation: slideInLeft 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** universal | **Duration:** 400-600ms | **Use for:** Side panels, navigation drawers

#### `as-slideInRight`
```css
@keyframes slideInRight {
  from { transform: translateX(100%); visibility: visible; }
  to { transform: translateX(0); }
}
.slideInRight { animation: slideInRight 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** universal | **Duration:** 400-600ms | **Use for:** Detail panels, inspector views

### Entrances — Zoom

#### `as-zoomIn`
```css
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; }
  to { transform: scale(1); }
}
.zoomIn { animation: zoomIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```
**Personality:** cinematic-dark | **Duration:** 400-600ms | **Use for:** Modal entrances, card reveals, hero moments

#### `as-zoomOut`
```css
@keyframes zoomOut {
  from { opacity: 1; transform: scale(1); }
  50% { opacity: 0; }
  to { opacity: 0; transform: scale(0.3); }
}
.zoomOut { animation: zoomOut 400ms ease-in both; }
```
**Personality:** cinematic-dark | **Duration:** 300-500ms | **Use for:** Modal dismissal, element departure

### Attention Seekers

#### `as-pulse`
```css
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.pulse { animation: pulse 1s ease-in-out; }
```
**Personality:** universal | **Duration:** 800-1200ms | **Use for:** Drawing attention to an element, CTA emphasis, notification badge

#### `as-headShake`
```css
@keyframes headShake {
  0% { transform: translateX(0); }
  6.5% { transform: translateX(-6px) rotateY(-9deg); }
  18.5% { transform: translateX(5px) rotateY(7deg); }
  31.5% { transform: translateX(-3px) rotateY(-5deg); }
  43.5% { transform: translateX(2px) rotateY(3deg); }
  50% { transform: translateX(0); }
}
.headShake { animation: headShake 1s ease-in-out; }
```
**Personality:** neutral-light | **Duration:** 800-1000ms | **Use for:** Error validation, "no" gesture, input rejection

#### `as-tada`
```css
@keyframes tada {
  0% { transform: scale(1) rotate(0deg); }
  10%, 20% { transform: scale(0.9) rotate(-3deg); }
  30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }
  40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
}
.tada { animation: tada 1s ease-in-out; }
```
**Personality:** neutral-light | **Duration:** 800-1000ms | **Use for:** Success celebration, achievement unlocked (use sparingly)

---

## Adapt Tier (~12 effects)

Need modification before use. Notes on what to change.

| Effect | What to Adapt | Why |
|--------|--------------|-----|
| `bounceIn` | Reduce overshoot from 3 bounces to 1 settle. Shorten to 600ms. | Original is too playful/cartoon for product demos |
| `bounceInUp/Down` | Same — reduce bounce amplitude by 50%, shorten duration | Too much vertical bounce for product context |
| `lightSpeedInLeft` | Extract the skew entrance only (remove the speed blur feel). Use as `skewReveal`. | The skew + translate combination is interesting for headlines |
| `flipInX` | Use for card reveal interactions only. Reduce to single clean flip, 500ms. | Full 3D flip is cinematic but the default has too much perspective wobble |
| `flipInY` | Same as flipInX but on Y axis. Good for sidebar card reveals. | Needs damped spring feel instead of the default easing |
| `rotateIn` | Reduce rotation from 200deg to 15-30deg. Use as subtle rotate entrance. | Full rotation is excessive; small rotation adds character |
| `backInUp` | Reduce the overshoot scale from 0.7 to 0.95. Use as anticipation entrance. | The "pull back before entering" motion is good but overdone |
| `backInDown` | Same adaptation as backInUp | Good anticipation feel, just needs restraint |
| `fadeInUpBig` | Reduce translateY from 2000px to 40-60px. Rename to `fadeInUpDeep`. | The distance is way too large; the principle is right |
| `fadeInDownBig` | Same — reduce to 40-60px | Same issue |
| `slideOutUp` | Keep as-is but add opacity fade in last 30% of animation | Abrupt disappearance without opacity feels unfinished |
| `slideOutDown` | Same — add trailing opacity fade | Same issue |

---

## Skip Tier (~50 effects)

Too playful, too dramatic, or wrong aesthetic for product demos.

### Bouncing (All Variants)
`bounce`, `bounceOut`, `bounceOutUp`, `bounceOutDown`, `bounceOutLeft`, `bounceOutRight` — Cartoon physics, wrong register for SaaS.

### Rubber / Elastic
`rubberBand`, `wobble`, `jello`, `swing` — Playful/toy-like. Would undermine professional credibility.

### Extreme Attention
`flash`, `shakeX`, `shakeY`, `heartBeat` — Too aggressive for product demos. Flash is an accessibility concern.

### Theatrical Exits
`hinge`, `rollIn`, `rollOut` — Theatrical/comedic. Completely wrong tone.

### Novelty
`jackInTheBox`, `backOutUp`, `backOutDown`, `backOutLeft`, `backOutRight` — Novelty effects with no product demo application.

### Oversized Moves
`fadeInLeftBig`, `fadeInRightBig`, `fadeOutLeftBig`, `fadeOutRightBig`, `fadeOutUpBig`, `fadeOutDownBig`, `slideOutLeft`, `slideOutRight`, `zoomInUp`, `zoomInDown`, `zoomInLeft`, `zoomInRight`, `zoomOutUp`, `zoomOutDown`, `zoomOutLeft`, `zoomOutRight` — Movements that travel too far or are too aggressive for contained product demos.

### Full Rotations
`rotateInDownLeft`, `rotateInDownRight`, `rotateInUpLeft`, `rotateInUpRight`, `rotateOut`, `rotateOutDownLeft`, `rotateOutDownRight`, `rotateOutUpLeft`, `rotateOutUpRight` — Full rotation entrances/exits are disorienting in product contexts.

### Full Flips
`flip`, `flipOutX`, `flipOutY` — The flip exit animations are jarring. Flip entrance versions moved to Adapt tier.

---

## Integration Notes

### Easing Modifications
All animate.css effects ship with basic easing. We replace with our standard curves:
- **Entrances:** `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out)
- **Exits:** `cubic-bezier(0.7, 0, 0.84, 0)` (expo-in) or `ease-in`
- **Attention:** `ease-in-out`
- **Height changes:** `cubic-bezier(0.25, 0.1, 0.25, 1)` (smooth)

### Duration Modifications
animate.css defaults to 1s for everything. Our speed hierarchy:
- **FAST (150-220ms):** Header text swaps, footer transitions
- **MEDIUM (400-600ms):** Body content fades, standard entrances
- **SLOW (650-800ms):** Container height, stagger sequences
- **SPRING (900-1400ms):** Interaction animations

### Distance Modifications
animate.css uses large distances (2000px for "big" variants). Our demo context uses:
- **Fade offsets:** 10-20px (subtle)
- **Slide distances:** 100% of element size (full panel moves)
- **Zoom scales:** 0.3-0.95 start range
