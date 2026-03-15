---
ref: grainy-organic-blob
title: "Grainy Organic Blob — Stippled Morphing Mass"
source: "inspiration/cf46828e130513df3f196dbd6b33828f.gif"
type: gif
date: 2026-03-03
personality_affinity: cinematic-dark
tags: [blob, grain, noise, morph, organic, texture, ambient, continuous, generative, brand, stipple]
quality_tier: exemplary
---

# Grainy Organic Blob — Stippled Morphing Mass

## Summary

A single white organic shape on a dark charcoal background, slowly morphing and rotating. The shape has a heavy stippled/pointillist grain texture that gives it a tactile, almost physical quality — like a lump of clay or a stone rendered in ink dots. The grain is not static noise overlay; it follows the shape's contour and lighting, with denser dots in shadow areas and sparser dots in highlights. The morph is slow, continuous, and asymmetric — the shape breathes and shifts like something alive. This is a masterclass in texture as animation: the shape's motion is minimal, but the grain makes every frame feel hand-rendered.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| continuous | organic morph | ~5000-7000ms cycle | sine (very slow) | Shape boundary deforms continuously — bulges extend, recede, shift around the perimeter. No keyframe poses, feels procedural. |
| continuous | slow rotation | ~10000ms per revolution | linear | Entire shape rotates slowly clockwise. Combined with morph, creates the illusion of a 3D object turning in space. |
| continuous | stipple grain texture | per-frame | — | Dense dot pattern covers the shape. Dot density varies with implied lighting — sparse on the upper-left (highlight), dense on lower-right (shadow). |
| continuous | highlight shift | synced to rotation | — | The bright/sparse area tracks the upper-left as the shape rotates, maintaining consistent implied light source. |
| continuous | soft edge dissolution | — | — | Shape edges are not hard — they dissolve into scattered dots at the boundary. This prevents the clinical feel of a hard vector edge. |

## Technique Breakdown

### Approach A: SVG Filter Stack (Pure CSS/SVG)

```html
<svg viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <!-- Grain texture via turbulence -->
    <filter id="grain-blob" x="-20%" y="-20%" width="140%" height="140%">
      <!-- Step 1: Create noise field -->
      <feTurbulence type="fractalNoise" baseFrequency="0.65"
        numOctaves="3" seed="1" result="noise" />
      <!-- Step 2: Threshold noise to create dot pattern -->
      <feColorMatrix in="noise" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 -3 1.8" result="dots" />
      <!-- Step 3: Use original shape as mask, dots as texture -->
      <feComposite in="dots" in2="SourceGraphic" operator="in" result="textured" />
      <!-- Step 4: Lighting for 3D depth -->
      <feDiffuseLighting in="noise" surfaceScale="2" diffuseConstant="0.8"
        lighting-color="white" result="light">
        <feDistantLight azimuth="225" elevation="45" />
      </feDiffuseLighting>
      <!-- Step 5: Multiply lighting with textured shape -->
      <feComposite in="textured" in2="light" operator="arithmetic"
        k1="1.2" k2="0" k3="0" k4="0" />
    </filter>
  </defs>

  <ellipse cx="200" cy="200" rx="120" ry="100"
    filter="url(#grain-blob)" fill="white"
    class="morphing-blob" />
</svg>
```

### Approach B: Canvas (Higher Quality, More Control)

```js
/* Canvas-based stippled blob with Perlin noise morphing */
class GrainBlob {
  constructor(canvas, { radius = 120, dotCount = 8000, morphSpeed = 0.0008 } = {}) {
    this.ctx = canvas.getContext('2d');
    this.cx = canvas.width / 2;
    this.cy = canvas.height / 2;
    this.radius = radius;
    this.dotCount = dotCount;
    this.morphSpeed = morphSpeed;
    this.rotation = 0;
    this.time = 0;
  }

  // Deformed radius at a given angle
  getRadius(angle) {
    const t = this.time;
    // Sum of sine waves at different frequencies = organic deformation
    return this.radius * (1
      + 0.12 * Math.sin(angle * 2 + t * 0.7)
      + 0.08 * Math.sin(angle * 3 - t * 1.1)
      + 0.05 * Math.sin(angle * 5 + t * 0.5)
    );
  }

  // Check if point is inside the deformed blob
  isInside(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) - this.rotation;
    return dist < this.getRadius(angle);
  }

  // Lighting: brighter toward upper-left light source
  getLightness(x, y) {
    const dx = (x - this.cx) / this.radius;
    const dy = (y - this.cy) / this.radius;
    // Light from upper-left (azimuth 225°)
    const light = 0.5 - dx * 0.35 + dy * 0.35;
    return Math.max(0.1, Math.min(1, light));
  }

  draw() {
    this.time += this.morphSpeed * 16;
    this.rotation += 0.001;
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // Scatter random dots, keep only those inside blob
    for (let i = 0; i < this.dotCount; i++) {
      const x = this.cx + (Math.random() - 0.5) * this.radius * 2.8;
      const y = this.cy + (Math.random() - 0.5) * this.radius * 2.8;

      if (this.isInside(x, y)) {
        const lightness = this.getLightness(x, y);
        // Sparser dots in highlights (skip some), denser in shadows
        if (Math.random() < lightness) {
          const alpha = 0.3 + lightness * 0.7;
          this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          this.ctx.fillRect(x, y, 1.2, 1.2);
        }
      }
    }

    requestAnimationFrame(() => this.draw());
  }
}
```

## Choreography Notes

- **Morph IS the motion.** There's no translation, no entrance, no exit. The shape stays centered and the deformation IS the animation. The sine-wave sum (`sin(2θ) + sin(3θ) + sin(5θ)`) at different time-scaled frequencies creates an organic, never-repeating deformation.
- **Rotation adds dimensionality.** The slow rotation combined with asymmetric morph creates the illusion that we're seeing a 3D object from a fixed camera. Without rotation, the morph reads as 2D wobble. With it, it reads as a physical object turning.
- **Grain density IS the lighting model.** This is the key insight: there's no smooth gradient for shading. Instead, dot density varies — sparse dots in lit areas, dense dots in shadow. This creates shading that feels hand-drawn rather than computed.
- **Edge dissolution prevents hard boundaries.** At the shape boundary, the `isInside` check with random dot placement naturally creates scattered dots at the edge. This soft boundary is what makes the shape feel organic vs. a vector ellipse.

## What We Can Steal

- **`bk-grain-blob`** — Slow-morphing organic shape with stipple texture. Brand/ambient use: hero backgrounds, loading states, identity elements. Two implementation paths: SVG filter (simpler, less control) or Canvas (more control, better grain quality). The SVG filter approach is sufficient for most brand uses.
- **Sine-sum morphing** — The formula `radius * (1 + a*sin(2θ + t) + b*sin(3θ - t) + c*sin(5θ + t))` is a general-purpose organic deformation. Usable on any shape boundary, not just circles. Controls: `a,b,c` control deformation intensity, frequency multipliers (2,3,5) control complexity, time coefficients control speed.
- **Stipple-as-shading** — Using dot density instead of opacity/color gradient to create lighting. Applicable to any shape: illustrations, icons, backgrounds. Creates a distinctive hand-rendered aesthetic that reads as "craft" rather than "computed."
- **Edge dissolution** — Scattering dots at shape boundaries instead of hard edges. Can apply to any CSS shape via SVG turbulence filter at the edge, or via canvas dot rendering.

## What to Avoid

- **Don't animate the grain seed.** If the noise pattern changes every frame, the texture flickers. In the SVG filter approach, keep `seed` constant. In canvas, use consistent random sequences (seeded PRNG) or accept that per-frame random dots at high density read as stable texture.
- **Don't morph too fast.** The reference is glacially slow (~5-7 second cycle). If the morph is faster than ~3 seconds, it reads as "wobbling" rather than "breathing." The slow speed is what gives it gravitas.
- **Don't use on small sizes.** The stipple effect needs minimum ~200px to read. Below that, the dots merge into grey noise. This is a hero/large-format technique.
- **Don't combine with other textures.** The grain IS the visual identity. Adding shadows, gradients, or borders would fight with the stipple aesthetic. Keep the shape isolated on a flat background.
