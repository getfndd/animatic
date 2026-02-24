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

---

## By Personality

**Cinematic Dark:** dot-grid-ripple, kinetic-type-scale-cascade, linear-homepage
**Editorial:** 3d-card-cascade
**Neutral Light:** *(none yet)*
**Universal:** *(none yet)*

## By Quality Tier

**Exemplary:** dot-grid-ripple, linear-homepage
**Strong:** kinetic-type-scale-cascade, 3d-card-cascade
**Interesting:** *(none yet)*

## By Tag

| Tag | Breakdowns |
|-----|-----------|
| grid | dot-grid-ripple, 3d-card-cascade |
| stagger | 3d-card-cascade, linear-homepage |
| typography | kinetic-type-scale-cascade |
| spring | linear-homepage |
| 3d | 3d-card-cascade |
| ambient | dot-grid-ripple |
| cascade | kinetic-type-scale-cascade, 3d-card-cascade |

---

## Adding a New Breakdown

1. Copy template from `../SCHEMA.md`
2. Save as `breakdowns/{ref-slug}.md`
3. Fill in Signature Moments table
4. Extract new primitives to `../primitives/sources/breakdowns.md`
5. Add row to this index
6. Run `@saul enrich` to update registry
