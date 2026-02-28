# Capture Pipeline Guide

Record autoplay prototypes to video, GIF, and distribution-ready assets.

---

## Overview

Capture mode takes a self-running autoplay HTML prototype and records it to video using headless Puppeteer for rendering and ffmpeg for encoding. The pipeline supports transparent backgrounds, deterministic timing, and a full distribution kit with social, embed, and email variants.

**Status:** The capture script (`scripts/capture-prototype.mjs`) is specified but not yet implemented. This document describes the designed pipeline. The `/animate --mode capture` command interface is defined in the animate skill.

---

## Quick Start

```bash
# Capture to WebM (default)
/animate autoplay-v1.html --mode capture

# Capture all web formats
/animate autoplay-v1.html --mode capture --format all

# Full distribution kit (all formats + social + embed + email)
/animate autoplay-v1.html --mode capture --kit

# Generate autoplay + capture in one step
/animate concept-v1.html --mode all --theme cinematic-dark
```

---

## Command Reference

```
/animate <autoplay-file> --mode capture [options]
  --format webm|mp4|av1|hevc|prores|gif|all    Output format (default: webm)
  --kit                                         Full distribution kit
  --social                                      Social media aspect ratio variants
  --embed                                       Generate embed.html + iframe snippet
  --thumb                                       Generate thumbnail PNG
  --email                                       Email kit (GIF + PNG + MP4 + HTML)
  --thumb-phase 3                               Which phase for thumbnail (default: 3)
  --deterministic                               Virtual time for frame-perfect capture
  --output-dir ./captures                       Output directory
  --width 800                                   Viewport width
  --fps 30                                      Frames per second
  --loops 1                                     Number of animation loops
  --quality 90                                  Encoding quality (1-100)
```

---

## Dependencies

| Dependency | Purpose | Required For | Install |
|------------|---------|--------------|---------|
| **Puppeteer** | Headless Chrome rendering | All capture | `npm install puppeteer` |
| **ffmpeg** | Video encoding | WebM, MP4, AV1, HEVC, ProRes | `brew install ffmpeg` |
| **gifski** | High-quality GIF encoding | GIF format | `brew install gifski` |

### Encoder Availability

Not all encoders are available on every system. Missing encoders are skipped with warnings.

| Encoder | ffmpeg Library | Platform Notes |
|---------|---------------|----------------|
| VP9 (WebM) | `libvpx-vp9` | Available everywhere |
| H.264 (MP4) | `libx264` | Available everywhere |
| AV1 | `libsvtav1` | Requires ffmpeg built with SVT-AV1 |
| HEVC | `videotoolbox` | macOS only (hardware accelerated) |
| ProRes | `prores_ks` | Available everywhere |
| GIF | gifski (external) | Requires separate gifski install |

---

## Format Reference

| Format | Alpha | File Size | Use Case |
|--------|-------|-----------|----------|
| **WebM** | Yes | 3-8 MB | Landing pages (Chrome, Firefox, Edge) |
| **MP4** | No | 1-3 MB | Universal fallback, social media |
| **AV1** | No | 1-2 MB | Smallest web delivery |
| **HEVC** | Yes | 2-4 MB | Safari/macOS native alpha |
| **ProRes** | Yes | 30-80 MB | Editor handoff, archival master |
| **GIF** | No | 2-4 MB | Legacy email, Notion embeds |

**Recommendation:** Use `--format all` for web distribution. Use `--kit` when you need social media variants and email assets.

---

## Distribution Kit Structure

The `--kit` flag produces a complete distribution directory:

```
captures/
├── {name}-master.mov                    # ProRes 4444 lossless master
├── thumb.png                            # Thumbnail at configured phase
├── web/
│   ├── {name}.webm                      # VP9 with alpha
│   ├── {name}.mp4                       # H.264 universal fallback
│   ├── {name}.av1.mp4                   # AV1 smallest file size
│   ├── {name}-hevc.mov                  # HEVC alpha (Safari)
│   └── {name}.gif                       # High-quality GIF
├── social/
│   ├── {name}-square-1080.mp4           # 1080x1080 (Product Hunt, X)
│   ├── {name}-landscape-1080p.mp4       # 1920x1080 (LinkedIn, YouTube)
│   └── {name}-portrait-1080x1920.mp4    # 1080x1920 (Instagram Reels)
├── embed/
│   ├── embed.html                       # Self-contained embed page
│   └── embed-snippet.html              # Copy-paste iframe snippet
└── email/
    ├── {name}-hero-600w.png             # Static fallback (Outlook desktop)
    ├── {name}-hero-600w.gif             # Animated GIF (Gmail, Yahoo)
    ├── {name}-hero-600w.mp4             # Inline video (Apple Mail)
    └── email-snippet.html               # Progressive enhancement template
```

---

## How It Works

The capture pipeline follows these steps:

1. **Launch** — Puppeteer opens the autoplay HTML at 2x device scale
2. **Configure** — Sets transparent background via CDP `Emulation.setDefaultBackgroundColorOverride`
3. **Detect duration** — Reads the prototype's `PHASES` config to calculate total loop time
4. **Measure** — Finds max element height for consistent frame dimensions
5. **Capture** — Records PNG frames with alpha at the configured FPS
6. **Encode** — Pipes frames to ffmpeg/gifski for the requested format(s)
7. **Distribute** — Generates social variants, embed HTML, thumbnails as requested

### Deterministic Mode

The `--deterministic` flag overrides browser timing functions:
- `requestAnimationFrame` — advances exactly `1000/fps` ms per frame
- `setTimeout` / `setInterval` — resolved in virtual time
- `Date.now()` / `performance.now()` — return virtual timestamps

This ensures frame-perfect capture regardless of system load. Use for production captures where timing consistency matters.

---

## Troubleshooting

### Blank or black frames

The autoplay file may not be loading correctly. Verify it plays properly in a regular browser first. Check that all CSS and JS are inline (no external dependencies that headless Chrome can't load).

### Choppy GIF output

GIF is limited to 256 colors. For dark themes with subtle gradients, increase quality or consider using WebM/MP4 instead. gifski produces significantly better results than ffmpeg's built-in GIF encoder.

### HEVC encoding fails

HEVC with alpha requires macOS VideoToolbox. This won't work on Linux or in CI. The pipeline skips missing encoders gracefully — use `--format webm` as the cross-platform alpha-capable alternative.

### AV1 encoding fails

Requires ffmpeg built with `libsvtav1`. Check with `ffmpeg -encoders | grep svtav1`. Install via `brew install ffmpeg` (Homebrew builds include SVT-AV1).

### Capture timing doesn't match browser playback

Use `--deterministic` flag. Without it, system load can cause timing drift between frames.

### Large file sizes

- Reduce `--fps` (24 is sufficient for UI animations)
- Reduce `--width` (600-800px covers most use cases)
- Lower `--quality` for web delivery
- Use AV1 format for smallest file size

---

## Related Documentation

- `.claude/skills/animate/SKILL.md` — Full animate skill reference
- `docs/process/prototype-animation-pipeline.md` — End-to-end pipeline workflow
- `docs/api/animation-engines.md` — Engine API reference for building autoplay prototypes
