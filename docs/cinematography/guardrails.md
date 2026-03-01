# Guardrails Enforcement Engine (ANI-29)

Camera physics validation layer that checks moves and manifests against safety bounds before rendering.

## Architecture

```
catalog/camera-guardrails.json    ← Source of truth: speed limits, acceleration, jerk,
                                     lens bounds, personality boundaries

mcp/lib/guardrails.js             ← Validation engine (5 checks per camera move)
  ├── validateCameraMove()        ← Single camera + shot grammar + personality
  ├── validateManifestScene()     ← Extract from manifest entry, delegate
  └── validateFullManifest()      ← Per-scene + cumulative checks

mcp/index.js                      ← MCP tool: validate_manifest
  └── handleValidateManifest()    ← Format markdown output

src/remotion/lib.js               ← Runtime clamping
  ├── clampCameraValues()         ← Clamp to bounds
  ├── getCameraTransformValues()  ← Optional clampBounds param
  └── composeCameraTransform()    ← Optional clampBounds param

src/remotion/compositions/CameraRig.jsx  ← Passes GUARDRAIL_BOUNDS to transforms
```

## Check Reference

| # | Check | What It Validates | Severity | Details |
|---|-------|-------------------|----------|---------|
| 1 | **Speed limits** | Velocity of camera displacement vs `speed_limits[property]` | WARN | Pan: `intensity * PAN_MAX_PX / duration`. Scale: `intensity * SCALE_FACTOR * 100 / duration`. Drift: peak `intensity * DRIFT_AMPLITUDE * 2π / duration` |
| 2 | **Acceleration** | Easing deceleration phase vs `deceleration_phase_minimum` (0.3) | WARN | `linear` = 0% decel (fails). `ease_out` = 60%. `cinematic_scurve` = 50% |
| 3 | **Jerk / settling** | Drift reversal interval vs `settling_on_reversal_ms` (200ms) | WARN | Reversal = `duration/2 * 1000`. Fails when drift scene < 0.4s |
| 4 | **Lens bounds** | Camera scale factor and SG rotation vs `lens_bounds` | WARN | Camera delta only (not combined with SG scale). Scale [0.95, 1.05]. Rotation [-20, +20]deg |
| 5 | **Personality** | Forbidden features, translate/scale limits, ambient conditions | BLOCK/WARN | BLOCK for forbidden features. WARN for limit exceedance |

### Cumulative Checks (Full Manifest)

| Check | Condition | Severity |
|-------|-----------|----------|
| Consecutive linear easings | >2 in a row | WARN |

## MCP Tool: `validate_manifest`

Validates a sequence manifest against camera guardrails for a given personality.

### Input

```json
{
  "manifest": { "scenes": [...] },
  "personality": "cinematic-dark"
}
```

### Output

Markdown report with:
- Overall verdict: **PASS**, **WARN**, or **BLOCK**
- Per-scene results table
- Grouped blocking violations
- Grouped warnings
- Cumulative findings

### Usage

```
1. plan_sequence → manifest
2. validate_manifest(manifest, personality) → verdict
3. If BLOCK: fix and re-validate
4. If WARN: review, optionally adjust
5. If PASS: render
```

## Runtime Clamping

`CameraRig.jsx` passes `GUARDRAIL_BOUNDS` to `composeCameraTransform` and `getCameraTransformValues`. Camera-only deltas are clamped before composition with shot grammar.

```js
const GUARDRAIL_BOUNDS = {
  scaleMin: 0.95,   // from lens_bounds.scale.min
  scaleMax: 1.05,   // from lens_bounds.scale.max
  rotationMin: -20, // from lens_bounds.rotation.min
  rotationMax: 20,  // from lens_bounds.rotation.max
  translateMax: 400, // from speed_limits.translateX.max_velocity
};
```

This is backward-compatible: omitting `clampBounds` = no clamping. Existing callers are unaffected.

## Design Decisions

1. **Camera delta, not combined scale** — `lens_bounds.scale` [0.95, 1.05] applies to camera move contribution only. Shot grammar `extreme_close_up` = 1.4 scale is static framing, not camera motion. Camera max at intensity=1 is 1.08 → clamped to 1.05.

2. **New tool, not extending `evaluate_sequence`** — Evaluation scores quality (0-100). Validation checks safety (PASS/WARN/BLOCK). Different concerns, different outputs.

3. **Easing decel as static lookup** — Easing functions are fixed curves. `linear` = 0% decel (fails minimum). `ease_out` = 60%. `cinematic_scurve` = 50%. No need to sample the curve.

4. **Optional clamping param** — Backward-compatible. Existing callers unaffected. Only CameraRig opts in.
