# Cinematography Pipeline — Proof of Concept

**Issue:** ANI-14
**Status:** Validated

## What This Tests

Mixed media composition: `<video>` background + CSS-animated text overlay, captured through the existing Puppeteer pipeline.

## Files

- `mixed-media-test.html` — PoC prototype (3 phases, video bg, text overlay, camera push-in)
- `assets/test-gradient.mp4` — 6s generated gradient video (1080p, ffmpeg lavfi)

## Results

### Normal Capture Mode

```
node scripts/capture-prototype.mjs prototypes/cinematography-poc/mixed-media-test.html \
  --format mp4 --duration 11000
```

- **Verdict: PASS** — Video plays, CSS animations fire, all layers composite correctly
- Output: 857KB MP4, 330 frames at 30fps
- Video background gradient animates smoothly
- Text phases transition with stagger reveals
- Camera push-in CSS animation applies to entire scene

### Deterministic Capture Mode

```
node scripts/capture-prototype.mjs prototypes/cinematography-poc/mixed-media-test.html \
  --format mp4 --duration 11000 --deterministic
```

- **Verdict: PARTIAL PASS** — CSS animations are frame-accurate, video playback is not
- Output: 714KB MP4, 330 frames at 30fps
- CSS animations driven by patched `setTimeout` → frame-accurate (virtual time works)
- CSS `@keyframes` (camera-push-in) → frame-accurate (browser renders per screenshot)
- `<video>` playback → runs on browser's native media clock, NOT virtual time
- Video frames may be out of sync with JS timer-driven phase transitions

### Key Finding

`<video>` elements in HTML use the browser's media pipeline which cannot be overridden by our virtual time hack (`Date.now`, `setTimeout`, `requestAnimationFrame` patches). The video plays at wall-clock speed regardless of virtual time advances.

**This confirms why Remotion is needed:** Remotion's `<Video>` component uses `useCurrentFrame()` to seek video to exact frame positions, giving true frame-accurate video compositing. Our Puppeteer pipeline can handle basic mixed media but cannot achieve frame-accurate video sync.

### Capability Matrix

| Feature | Puppeteer (Normal) | Puppeteer (Deterministic) | Remotion |
|---------|-------------------|--------------------------|----------|
| CSS animations | Real-time | Frame-accurate | Frame-accurate |
| JS timer animations | Real-time | Frame-accurate | Frame-accurate |
| Video playback | Real-time | Real-time (not synced) | Frame-accurate |
| Multi-scene cuts | Not supported | Not supported | Native |
| Transitions | Not supported | Not supported | `interpolate()` |
| Audio sync | Not supported | Not supported | Native |

## Conclusion

Mixed media works in HTML prototypes — sufficient for single-scene demos where video is ambient background (opacity-reduced, looping). For the cinematography pipeline's multi-scene sequencing with frame-accurate video compositing, Remotion is required (Phase 2).
