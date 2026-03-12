# Mixed-Media Composition Techniques

Reference guide for animations combining video layers, kinetic typography, and UI element choreography. Used for marketing hero sections, product launch films, and editorial hero animations.

---

## When to Use Mixed-Media

| Signal | Use Mixed-Media |
|--------|----------------|
| Stock video or recorded footage as background | Yes |
| Video + text overlay compositing | Yes |
| Per-beat media switching (video on some beats, canvas on others) | Yes |
| Brand film with UI element callouts | Yes |
| Pure product UI demo | No — use `product-ui` |
| Pure SVG illustration | No — use `illustration` |

---

## Video Layer Integration

### Basic Video Layer

```html
<div class="scene">
  <!-- Video layer: lowest z-index -->
  <div class="video-layer">
    <video
      class="bg-video"
      src="hero-footage.mp4"
      muted
      playsinline
      loop
      autoplay
    ></video>
    <!-- Dark overlay for text legibility -->
    <div class="video-overlay"></div>
  </div>

  <!-- Content layer: choreography on top -->
  <div class="content-layer">
    <h1 class="hero-title">Your raise.</h1>
  </div>
</div>
```

### Video Layer CSS

```css
.video-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.bg-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Focal point adjustment — default center */
  object-position: center center;
}

/* Dark tint for text legibility */
.video-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.content-layer {
  position: relative;
  z-index: 1;
}
```

### Overlay Opacity Rules

Text over video requires sufficient contrast. Minimum overlay darkness depends on text color:

| Text Color | Min Overlay Opacity | WCAG Ratio |
|------------|-------------------|------------|
| White (`#fff`) | 0.40 | ~4.5:1 on bright footage |
| White, bold/large | 0.30 | ~3:1 (large text threshold) |
| Light gray (`#e5e5e5`) | 0.50 | ~4.5:1 |
| Colored accent | 0.45-0.55 | Test with actual footage |

**Rule:** When uncertain, use `0.45` overlay and verify contrast. Bright/high-key footage needs more overlay than dark footage.

### Blend Modes

```css
/* Additive glow — text appears to emit light over video */
.video-overlay { mix-blend-mode: multiply; }

/* Subtle color grade — warm/cool tint on footage */
.video-overlay {
  background: rgba(99, 102, 241, 0.15);
  mix-blend-mode: color;
}

/* Gradient overlay — darken bottom for text, keep top visible */
.video-overlay {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.6) 70%
  );
}
```

---

## Per-Beat Media Switching

Different beats can use different background treatments. Common patterns:

### Beat 0: Video Background → Beats 1+: Dark Canvas

```js
// In engine/choreography setup
const beatMedia = {
  0: { type: 'video', src: 'hero-footage.mp4', overlay: 0.40 },
  1: { type: 'canvas', color: '#0a0a0a' },
  2: { type: 'canvas', color: '#0a0a0a' },
  // ...
};

function switchBeatMedia(beatIndex) {
  const media = beatMedia[beatIndex];
  const videoLayer = document.querySelector('.video-layer');
  const video = videoLayer.querySelector('video');

  if (media.type === 'video') {
    video.style.opacity = '1';
    video.currentTime = 0;
    video.play();
    videoLayer.querySelector('.video-overlay').style.opacity = media.overlay;
  } else {
    // Crossfade video out
    video.style.transition = 'opacity 400ms ease-out';
    video.style.opacity = '0';
    videoLayer.style.background = media.color;
  }
}
```

### Alternating Video Clips

```js
const beatMedia = {
  0: { type: 'video', src: 'abstract-flow.mp4', overlay: 0.35 },
  1: { type: 'canvas', color: '#0a0a0a' },
  2: { type: 'video', src: 'team-footage.mp4', overlay: 0.50 },
  3: { type: 'canvas', color: '#0a0a0a' },
};
```

**Preloading:** When using multiple video clips, preload them in hidden `<video>` elements to avoid visible loading during transitions.

---

## Typography Over Video

### Legibility Hierarchy

```css
/* Hero title — maximum impact */
.hero-title {
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 800;
  color: white;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  /* Optional: subtle text stroke for extreme contrast */
}

/* Supporting text — readable but secondary */
.hero-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.5rem);
  font-weight: 400;
  color: rgba(255, 255, 255, 0.85);
  /* Slightly reduced opacity signals hierarchy */
}

/* UI elements over video — contained backgrounds */
.ui-card-over-video {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
}
```

### Text Animation Over Video

When text enters over video, use high-contrast entrances:

| Technique | Works Over Video | Notes |
|-----------|-----------------|-------|
| Fade in | Yes | Safe default. `opacity: 0 → 1` |
| Slide + fade | Yes | Combine with `text-shadow` |
| Scale entrance | Yes, if subtle | Keep scale range 0.95-1.0 |
| Clip-path reveal | Yes | Clean horizontal/vertical reveal |
| Typewriter | Caution | Per-character can be hard to read over motion |
| Blur entrance | No | Blur + video motion = unreadable |

**Rule:** Avoid blur-based entrances over video. The motion in the footage already provides visual complexity — adding blur creates confusion.

---

## Video Loop Sync

### Matching Video Duration to Animation Timeline

```js
// Option 1: Video loops independently (simplest)
video.loop = true; // Let video repeat naturally

// Option 2: Sync video to phase timeline
const totalDwell = phases.reduce((sum, p) => sum + p.dwell, 0);
video.playbackRate = video.duration / (totalDwell / 1000);
// Caution: playbackRate changes speed — only works if video duration is close

// Option 3: Trim video to match (best for production)
// Use ffmpeg to trim video to exact animation loop duration before use
```

### Handling Loop Boundaries

When the animation loops but the video is shorter/longer:

| Scenario | Solution |
|----------|----------|
| Video shorter than animation | `video.loop = true` + crossfade at video restart |
| Video longer than animation | Let video continue; reset animation on top |
| Video same length | Ideal — sync loop points |

```css
/* Crossfade on video loop restart */
.bg-video {
  transition: opacity 200ms ease;
}
/* JS sets opacity to 0 briefly at video.ended, then back to 1 */
```

---

## Aspect Ratio & Cropping

### Object-Fit for Video

```css
/* Cover: fills container, crops overflow (default choice) */
.bg-video { object-fit: cover; }

/* Contain: shows full video, may have letterboxing */
.bg-video { object-fit: contain; background: #0a0a0a; }
```

### Focal Point Adjustment

Stock video subjects aren't always centered. Adjust `object-position` to keep the subject visible:

```css
/* Subject in upper-right of 16:9 footage, container is 4:3 */
.bg-video {
  object-fit: cover;
  object-position: 70% 30%; /* shift right, shift up */
}

/* Subject at bottom (e.g., horizon line) */
.bg-video { object-position: center 80%; }
```

### Common Container Ratios

| Use Case | Ratio | Container |
|----------|-------|-----------|
| Landing page hero | 16:9 or wider | Full-viewport-width |
| Email/embed | 4:3 or 1:1 | Fixed 600-800px width |
| Social card | 1:1 or 4:5 | Platform-specific |
| Slide deck | 16:9 | 1920x1080 |

---

## Stock Video Selection

### What Makes Good Background Footage

| Quality | Good | Avoid |
|---------|------|-------|
| Motion speed | Slow, steady movement | Fast/jerky camera moves |
| Focus | Shallow DOF, soft background | Busy sharp details everywhere |
| Color temp | Consistent warmth or coolness | Mixed/changing lighting |
| Subject | Abstract, atmospheric, textural | Recognizable faces (licensing), text |
| Contrast | Low-to-medium contrast | High contrast (fights overlay) |
| Duration | 8-15s clean loop | Very short (<3s visible repetition) |

### Abstract vs. Figurative

| Type | When | Example |
|------|------|---------|
| Abstract | Hero sections, brand mood | Light leaks, particle flow, gradient mesh |
| Textural | Editorial, product context | Fabric, water, architecture details |
| Figurative | Team/people, lifestyle | Slow-mo hands, workspace, nature |

**Personality alignment:**
- cinematic-dark: Abstract dark (particles, light leaks), figurative slow-mo
- editorial: Textural (architecture, materials), figurative workspace
- neutral-light: Rarely uses video — if so, bright abstract only
- montage: Fast cuts of figurative footage, not background loops

---

## Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Use blur entrances over video | Unreadable — video motion + blur = chaos | Use fade or clip-path reveal |
| Skip the overlay layer | Text becomes unreadable on bright frames | Always add 0.30+ overlay |
| Use fast video with fast animation | Competing motion overwhelms viewer | Slow video + moderate animation |
| Hard-cut between video and canvas beats | Jarring transition | Crossfade video opacity over 300-400ms |
| Auto-detect video files as `product-ui` | Video presence is a strong mixed-media signal | Detect `<video>` elements → `mixed-media` |
| Use the same video for every beat | Monotonous background | Mix video + canvas, or use multiple clips |
| Set video volume > 0 in autoplay | Browser autoplay policies block audio | Always `muted` on `<video>` |
