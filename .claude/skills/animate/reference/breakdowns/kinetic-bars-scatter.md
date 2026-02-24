---
ref: kinetic-bars-scatter
title: "Kinetic Bars — Horizontal Scatter & Reconverge"
source: "inspiration/04df08e89170524c776dc2f3a1290b9e.gif"
type: gif
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [bars, kinetic, scatter, converge, rhythm, loading, transition, typography]
quality_tier: strong
---

# Kinetic Bars — Horizontal Scatter & Reconverge

## Summary

White vertical bars on black scatter horizontally with varying spacing, then reconverge to an even distribution. The motion is rhythmic — scatter out, hold, reconverge, hold, repeat. The bars feel like a barcode being decoded, or a musical visualization where each bar has its own velocity. The scatter phase creates tension (disorder), the converge phase creates resolution (order). This push-pull rhythm is immediately useful for loading states, transitions between phases, and decorative dividers.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / converge state | even distribution | ~800ms hold | — | ~10 bars evenly spaced across horizontal axis, uniform width (~3px), full height (~60px) |
| ~0:01 / scatter trigger | horizontal scatter | ~600ms | expo-out | Each bar moves to a random horizontal position with varying velocity — some bars cluster, others isolate |
| ~0:02 / scattered state | scattered hold | ~1200ms | — | Bars hold at scattered positions. Gaps between clusters create visual rhythm. |
| ~0:03 / reconverge | horizontal reconverge | ~800ms | expo-in-out | All bars slide back to even distribution. Slower than scatter — the return is more deliberate. |
| continuous | height micro-pulse | ~2000ms | ease-in-out | Individual bars have subtle height oscillation (±5px), preventing static feel during hold states |

## Technique Breakdown

```css
/* bk-bars-scatter — Horizontal scatter/converge bars */
.bars-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  gap: 0;
  position: relative;
}

.bar {
  width: 3px;
  height: var(--bar-height, 60px);
  background: white;
  position: absolute;
  left: var(--bar-target, 50%);
  transition: left var(--scatter-duration, 600ms) cubic-bezier(0.16, 1, 0.3, 1);
  animation: bar-breathe var(--breathe-duration, 2000ms) ease-in-out infinite;
  animation-delay: var(--breathe-offset, 0ms);
}

@keyframes bar-breathe {
  0%, 100% { height: var(--bar-height, 60px); }
  50% { height: calc(var(--bar-height, 60px) + 5px); }
}

/* Converged state — even distribution */
.bars-container.converged .bar {
  --scatter-duration: 800ms;
}

/* Scattered state — random positions */
.bars-container.scattered .bar {
  --scatter-duration: 600ms;
}
```

```js
/* Scatter/converge animation controller */
class BarsScatter {
  constructor(container, { count = 10, width = 3, height = 60 } = {}) {
    this.container = container;
    this.count = count;
    this.bars = [];

    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.setProperty('--bar-height', `${height}px`);
      bar.style.setProperty('--breathe-offset', `${-i * 200}ms`);
      bar.style.setProperty('--breathe-duration', `${1800 + Math.random() * 400}ms`);
      container.appendChild(bar);
      this.bars.push(bar);
    }

    this.converge();
  }

  converge() {
    const spacing = 100 / (this.count + 1);
    this.bars.forEach((bar, i) => {
      bar.style.setProperty('--bar-target', `${spacing * (i + 1)}%`);
    });
    this.container.classList.remove('scattered');
    this.container.classList.add('converged');
  }

  scatter() {
    // Generate random positions with clustering tendency
    const positions = this.bars.map(() => {
      const cluster = Math.random() > 0.4
        ? 20 + Math.random() * 30  // left cluster
        : 50 + Math.random() * 30; // right cluster
      return cluster;
    });

    this.bars.forEach((bar, i) => {
      bar.style.setProperty('--bar-target', `${positions[i]}%`);
    });
    this.container.classList.remove('converged');
    this.container.classList.add('scattered');
  }

  // Cycle: converge → hold → scatter → hold → repeat
  cycle(convergeHold = 800, scatterHold = 1200) {
    this.converge();
    setTimeout(() => {
      this.scatter();
      setTimeout(() => this.cycle(convergeHold, scatterHold), scatterHold);
    }, convergeHold);
  }
}
```

## Choreography Notes

- **Scatter is fast, converge is slow.** 600ms scatter (explosive), 800ms converge (deliberate return). The asymmetry creates a rhythm: quick tension, slow resolution. Like a drum hit and its decay.
- **Clustering during scatter creates visual words.** Random scattering is boring. The clustering logic (40% left cluster, 60% right cluster) creates recognizable groupings — the bars form visual "phrases" during the scattered state.
- **Height breathing prevents dead air.** During the hold states, the micro-pulse keeps the composition alive. Without it, the holds feel like bugs (why did it stop?). With it, the holds feel intentional (it's breathing).
- **Works as transition between phases.** Scatter = current phase dissolving. Converge = new phase materializing. The bars can live between phase content as a decorative transition element.

## What We Can Steal

- **`bk-bars-scatter`** — A decorative transition/loading pattern. Use between phases in autoplay, as a loading indicator for data-heavy transitions, or as a horizontal divider that animates. The scatter/converge rhythm communicates "processing" or "reorganizing" naturally.
- **Tension-resolution rhythm** — The scatter/hold/converge/hold cycle is a reusable choreographic pattern. Apply it to any group of elements that need to show state change: tags scattering and reconverging, avatars redistributing, menu items reshuffling.
- **Micro-pulse during holds** — The principle of maintaining subtle motion during pause states. Applicable to any element that has dwell time — keep a faint animation running so the user knows the system is alive.

## What to Avoid

- **Don't use with too many bars.** 8-12 is the sweet spot. Fewer than 6 loses the scatter effect. More than 15 becomes visually noisy and hard to read.
- **Don't make scatter random.** Pure random distribution looks arbitrary. The clustering logic gives the scattered state visual structure. Design the randomness.
- **Don't use as a primary loading indicator.** This is decorative, not informational. It doesn't communicate progress. Pair it with actual progress indicators for functional loading states.
