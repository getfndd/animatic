# Animation Reference Breakdowns — Index

Structured analyses of animation references. Each breakdown maps to the schema in `../SCHEMA.md` and feeds primitives to the registry.

---

## All Breakdowns

| Ref | Title | Type | Personality | Quality | Tags |
|-----|-------|------|-------------|---------|------|
| [dot-grid-ripple](dot-grid-ripple.md) | Dot Grid Ripple — Traveling Wave Distortion | gif | cinematic-dark | exemplary | grid, ripple, ambient, particle, wave, continuous |
| [kinetic-type-scale-cascade](kinetic-type-scale-cascade.md) | Kinetic Typography — Scale Cascade | gif | cinematic-dark | strong | typography, kinetic-type, scale, cascade, parallax |
| [3d-card-cascade](3d-card-cascade.md) | 3D Card Cascade — Isometric Grid Flip | gif | editorial | strong | 3d, grid, cascade, flip, stagger, card, reveal |
| [linear-homepage](linear-homepage.md) | Linear Homepage — Spring Physics Product Demo | website | cinematic-dark | exemplary | spring, speed-hierarchy, stagger, hover, product-demo |
| [sparse-dot-breathing](sparse-dot-breathing.md) | Sparse Dot Grid — Ambient Breathing | gif | universal | strong | grid, ambient, breathing, dot, subtle, background |
| [arc-wave-cascade](arc-wave-cascade.md) | Arc Wave Cascade — Vertical Stagger | gif | cinematic-dark | strong | arc, cascade, stagger, wave, curve, entrance, reveal |
| [text-image-reveal](text-image-reveal.md) | Text Block Image Reveal — Editorial Split | gif | editorial | exemplary | typography, image, reveal, editorial, split, clip-path, hero, content |
| [flow-field-vortex](flow-field-vortex.md) | Flow Field Vortex — Directional Line Segments | gif | cinematic-dark | strong | flow-field, vortex, ambient, particle, rotation, generative, background, continuous |
| [kinetic-bars-scatter](kinetic-bars-scatter.md) | Kinetic Bars — Horizontal Scatter & Reconverge | gif | cinematic-dark | strong | bars, kinetic, scatter, converge, rhythm, loading, transition, typography |

---

## By Personality

**Cinematic Dark:** dot-grid-ripple, kinetic-type-scale-cascade, linear-homepage, arc-wave-cascade, flow-field-vortex, kinetic-bars-scatter
**Editorial:** 3d-card-cascade, text-image-reveal
**Neutral Light:** *(none yet)*
**Universal:** sparse-dot-breathing

## By Quality Tier

**Exemplary:** dot-grid-ripple, linear-homepage, text-image-reveal
**Strong:** kinetic-type-scale-cascade, 3d-card-cascade, sparse-dot-breathing, arc-wave-cascade, flow-field-vortex, kinetic-bars-scatter
**Interesting:** *(none yet)*

## By Tag

| Tag | Breakdowns |
|-----|-----------|
| grid | dot-grid-ripple, 3d-card-cascade, sparse-dot-breathing |
| stagger | 3d-card-cascade, linear-homepage, arc-wave-cascade |
| typography | kinetic-type-scale-cascade, text-image-reveal |
| spring | linear-homepage |
| 3d | 3d-card-cascade |
| ambient | dot-grid-ripple, sparse-dot-breathing, flow-field-vortex |
| cascade | kinetic-type-scale-cascade, 3d-card-cascade, arc-wave-cascade |
| reveal | 3d-card-cascade, arc-wave-cascade, text-image-reveal |
| continuous | dot-grid-ripple, flow-field-vortex |
| arc | arc-wave-cascade |
| wave | dot-grid-ripple, arc-wave-cascade |
| background | sparse-dot-breathing, flow-field-vortex |
| flow-field | flow-field-vortex |
| generative | flow-field-vortex |
| bars | kinetic-bars-scatter |
| scatter | kinetic-bars-scatter |
| rhythm | kinetic-bars-scatter |
| transition | kinetic-bars-scatter |
| image | text-image-reveal |
| hero | text-image-reveal |
| breathing | sparse-dot-breathing |

---

## Adding a New Breakdown

1. Copy template from `../SCHEMA.md`
2. Save as `breakdowns/{ref-slug}.md`
3. Fill in Signature Moments table
4. Extract new primitives to `../primitives/sources/breakdowns.md`
5. Add row to this index
6. Run `@saul enrich` to update registry
