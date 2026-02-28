#!/usr/bin/env node

/**
 * capture-prototype.mjs — Convert self-running HTML prototypes to video/GIF
 *
 * Usage:
 *   node scripts/capture-prototype.mjs <autoplay-file> [options]
 *
 * Options:
 *   --format webm|mp4|av1|hevc|prores|gif|all  (default: webm)
 *   --kit              Full distribution kit (all formats + social + embed + email + thumb)
 *   --deterministic    Virtual time for frame-perfect capture
 *   --output-dir       Output directory (default: captures/ alongside source)
 *   --width 800        Viewport width (renders at 2x = 1600px)
 *   --fps 30           Frames per second
 *   --loops 1          Number of animation loops to capture
 *   --quality 90       Encoding quality (1-100)
 *   --duration         Manual duration override in ms
 *   --social           Social media aspect ratio variants
 *   --embed            Generate embed.html + iframe snippet
 *   --thumb            Generate thumbnail PNG
 *   --email            Email kit (GIF + PNG + MP4 + HTML template)
 *   --thumb-phase 3    Which phase to capture for thumbnail
 */

import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const BOOT_TIME_MS = 600;

// ================================================================
//  CLI PARSING
// ================================================================

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format:        { type: 'string',  default: 'webm' },
    kit:           { type: 'boolean', default: false },
    deterministic: { type: 'boolean', default: false },
    'output-dir':  { type: 'string' },
    width:         { type: 'string',  default: '800' },
    fps:           { type: 'string',  default: '30' },
    loops:         { type: 'string',  default: '1' },
    quality:       { type: 'string',  default: '90' },
    duration:      { type: 'string' },
    social:        { type: 'boolean', default: false },
    embed:         { type: 'boolean', default: false },
    thumb:         { type: 'boolean', default: false },
    email:         { type: 'boolean', default: false },
    'thumb-phase': { type: 'string',  default: '3' },
    help:          { type: 'boolean', default: false },
  },
});

if (opts.help || positionals.length === 0) {
  console.log(`
  Usage: node scripts/capture-prototype.mjs <autoplay-file> [options]

  Options:
    --format <fmt>     webm|mp4|av1|hevc|prores|gif|all  (default: webm)
    --kit              Full distribution kit
    --deterministic    Virtual time for frame-perfect capture
    --output-dir <dir> Output directory (default: captures/ alongside source)
    --width <px>       Viewport width, renders at 2x (default: 800)
    --fps <n>          Frames per second (default: 30)
    --loops <n>        Animation loops to capture (default: 1)
    --quality <1-100>  Encoding quality (default: 90)
    --duration <ms>    Manual duration override
    --social           Generate social media aspect ratio variants
    --embed            Generate embed.html + iframe snippet
    --thumb            Generate thumbnail PNG
    --email            Email kit (GIF + PNG + MP4 + HTML template)
    --thumb-phase <n>  Phase index for thumbnail (default: 3)
    --help             Show this help
  `);
  process.exit(0);
}

const config = {
  inputFile:     path.resolve(positionals[0]),
  format:        opts.format,
  kit:           opts.kit,
  deterministic: opts.deterministic,
  outputDir:     opts['output-dir'],
  width:         parseInt(opts.width, 10),
  fps:           parseInt(opts.fps, 10),
  loops:         parseInt(opts.loops, 10),
  quality:       parseInt(opts.quality, 10),
  duration:      opts.duration ? parseInt(opts.duration, 10) : null,
  social:        opts.social || opts.kit,
  embed:         opts.embed || opts.kit,
  thumb:         opts.thumb || opts.kit,
  email:         opts.email || opts.kit,
  thumbPhase:    parseInt(opts['thumb-phase'], 10),
};

// Validate numeric CLI args
for (const [key, val] of [['width', config.width], ['fps', config.fps], ['loops', config.loops], ['quality', config.quality]]) {
  if (Number.isNaN(val) || val <= 0) {
    console.error(`Error: --${key} must be a positive number`);
    process.exit(1);
  }
}
if (config.quality > 100) {
  console.error('Error: --quality must be between 1 and 100');
  process.exit(1);
}
if (config.fps > 120) {
  console.error('Error: --fps must be 120 or less');
  process.exit(1);
}

// --kit implies all formats
if (config.kit) config.format = 'all';

// Resolve output directory
if (!config.outputDir) {
  config.outputDir = path.join(path.dirname(config.inputFile), 'captures');
}
config.outputDir = path.resolve(config.outputDir);

// Derive base name from input file (without extension)
config.baseName = path.basename(config.inputFile, path.extname(config.inputFile));

// Validate input
if (!fs.existsSync(config.inputFile)) {
  console.error(`Error: File not found: ${config.inputFile}`);
  process.exit(1);
}

// ================================================================
//  DURATION AUTO-DETECTION
// ================================================================

function detectDuration(htmlSource) {
  // Pattern 1: Engine-based — new EditorialEngine({ phases: [...] })
  // Pattern 2: Inline — const PHASES = [...]
  // Both use { dwell: NNNN } in their phase definitions

  const dwellMatches = [...htmlSource.matchAll(/dwell\s*:\s*(\d+)/g)];
  if (dwellMatches.length === 0) {
    console.warn('Warning: No dwell times found in HTML. Using default 15000ms.');
    return 15000;
  }

  const dwells = dwellMatches.map(m => parseInt(m[1], 10));
  const totalDwell = dwells.reduce((sum, d) => sum + d, 0);

  // Extract loopPause if present, default 1500ms
  const loopPauseMatch = htmlSource.match(/loopPause\s*:\s*(\d+)/);
  const loopPause = loopPauseMatch ? parseInt(loopPauseMatch[1], 10) : 1500;

  const singleLoop = totalDwell + loopPause;
  const total = BOOT_TIME_MS + singleLoop * config.loops;

  console.log(`  Phases: ${dwells.length} (dwells: ${dwells.join(', ')}ms)`);
  console.log(`  Loop pause: ${loopPause}ms, Boot: ${BOOT_TIME_MS}ms`);
  console.log(`  Total duration: ${total}ms (${config.loops} loop${config.loops > 1 ? 's' : ''})`);

  return total;
}

// ================================================================
//  ENCODER DETECTION
// ================================================================

async function probeEncoders() {
  const available = {
    ffmpeg: false,
    libvpx_vp9: false,
    libx264: false,
    libsvtav1: false,
    hevc_videotoolbox: false,
    prores_ks: false,
    gifski: false,
  };

  // Check ffmpeg
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-encoders'], { timeout: 10000 });
    available.ffmpeg = true;
    if (stdout.includes('libvpx-vp9'))        available.libvpx_vp9 = true;
    if (stdout.includes('libx264'))            available.libx264 = true;
    if (stdout.includes('libsvtav1'))          available.libsvtav1 = true;
    if (stdout.includes('hevc_videotoolbox'))  available.hevc_videotoolbox = true;
    if (stdout.includes('prores_ks'))          available.prores_ks = true;
  } catch {
    console.warn('Warning: ffmpeg not found. Video encoding will be skipped.');
  }

  // Check gifski
  try {
    await execFileAsync('gifski', ['--version'], { timeout: 5000 });
    available.gifski = true;
  } catch {
    console.warn('Warning: gifski not found. GIF encoding will use ffmpeg fallback.');
  }

  return available;
}

// ================================================================
//  DETERMINISTIC TIME INJECTION
// ================================================================

const VIRTUAL_TIME_SCRIPT = `
(function() {
  // Virtual time controller — patches all timing APIs for deterministic capture
  let virtualTime = 0;
  const rafQueue = [];
  const timers = [];
  let timerIdCounter = 1;

  // Patch Date.now and performance.now
  Date.now = () => virtualTime;
  performance.now = () => virtualTime;

  // Patch requestAnimationFrame
  window.requestAnimationFrame = function(cb) {
    const id = timerIdCounter++;
    rafQueue.push({ id, cb });
    return id;
  };

  // Patch cancelAnimationFrame
  window.cancelAnimationFrame = function(id) {
    const idx = rafQueue.findIndex(r => r.id === id);
    if (idx !== -1) rafQueue.splice(idx, 1);
  };

  // Patch setTimeout
  window.setTimeout = function(cb, delay = 0, ...args) {
    const id = timerIdCounter++;
    timers.push({ id, cb, fireAt: virtualTime + delay, args, type: 'timeout' });
    return id;
  };

  // Patch clearTimeout
  window.clearTimeout = function(id) {
    const idx = timers.findIndex(t => t.id === id);
    if (idx !== -1) timers.splice(idx, 1);
  };

  // Patch setInterval
  window.setInterval = function(cb, interval = 0, ...args) {
    const id = timerIdCounter++;
    timers.push({ id, cb, fireAt: virtualTime + interval, interval, args, type: 'interval' });
    return id;
  };

  // Patch clearInterval
  window.clearInterval = function(id) {
    const idx = timers.findIndex(t => t.id === id);
    if (idx !== -1) timers.splice(idx, 1);
  };

  // Advance one frame — called by Puppeteer per captured frame
  window.__advanceFrame = function(frameDeltaMs) {
    virtualTime += frameDeltaMs;

    // Fire ready timers (sorted by fireAt for correctness)
    const ready = timers
      .filter(t => t.fireAt <= virtualTime)
      .sort((a, b) => a.fireAt - b.fireAt);

    for (const timer of ready) {
      try { timer.cb(...timer.args); } catch (e) { console.error(e); }
      if (timer.type === 'interval') {
        timer.fireAt += timer.interval;
      } else {
        const idx = timers.indexOf(timer);
        if (idx !== -1) timers.splice(idx, 1);
      }
    }

    // Drain rAF queue (snapshot first to allow re-queuing)
    const batch = rafQueue.splice(0, rafQueue.length);
    for (const { cb } of batch) {
      try { cb(virtualTime); } catch (e) { console.error(e); }
    }
  };

  // Signal that virtual time is active
  window.__virtualTimeEnabled = true;
})();
`;

// ================================================================
//  FRAME CAPTURE (Puppeteer + CDP)
// ================================================================

async function captureFrames(duration) {
  const puppeteer = await import('puppeteer');
  const chromeArgs = ['--disable-gpu', '--disable-dev-shm-usage'];
  if (process.env.CI) {
    chromeArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  const browser = await puppeteer.default.launch({
    headless: true,
    args: chromeArgs,
  });

  const page = await browser.newPage();

  // Set viewport at 2x device scale for retina-quality capture
  const deviceScaleFactor = 2;
  await page.setViewport({
    width: config.width,
    height: 600, // Initial height — will resize after measuring
    deviceScaleFactor,
  });

  // If deterministic mode, inject virtual time before page loads
  if (config.deterministic) {
    await page.evaluateOnNewDocument(VIRTUAL_TIME_SCRIPT);
  }

  // Set transparent background via CDP
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });

  // Navigate to file with ?embed parameter (pathToFileURL handles spaces/unicode)
  const parsedUrl = pathToFileURL(config.inputFile);
  parsedUrl.searchParams.set('embed', '');
  await page.goto(parsedUrl.href, { waitUntil: 'domcontentloaded' });

  try {
    // Wait for boot — in deterministic mode, advance virtual time
    if (config.deterministic) {
      const bootFrames = Math.ceil(BOOT_TIME_MS / (1000 / config.fps));
      for (let i = 0; i < bootFrames; i++) {
        await page.evaluate((delta) => window.__advanceFrame(delta), 1000 / config.fps);
      }
    } else {
      await new Promise(r => setTimeout(r, BOOT_TIME_MS));
    }

    // Measure actual content height and resize viewport
    const contentHeight = await page.evaluate(() => {
      const scene = document.querySelector('.scene') || document.body;
      return Math.ceil(scene.getBoundingClientRect().height);
    });

    const viewportHeight = Math.max(contentHeight, 400);
    await page.setViewport({
      width: config.width,
      height: viewportHeight,
      deviceScaleFactor,
    });

    // Create temp directory for frames
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'animatic-frames-'));
    const totalFrames = Math.ceil(duration / 1000 * config.fps);
    const frameDelta = 1000 / config.fps;

    if (totalFrames <= 0) {
      throw new Error(`Invalid frame count: ${totalFrames}. Check duration (${duration}ms) and fps (${config.fps}).`);
    }

    console.log(`  Capturing ${totalFrames} frames at ${config.fps}fps (${config.width}x${viewportHeight} @${deviceScaleFactor}x)...`);

    for (let i = 0; i < totalFrames; i++) {
      // In deterministic mode, advance virtual time per frame
      if (config.deterministic && i > 0) {
        await page.evaluate((delta) => window.__advanceFrame(delta), frameDelta);
      } else if (!config.deterministic && i > 0) {
        await new Promise(r => setTimeout(r, frameDelta));
      }

      // Capture frame via CDP (supports alpha channel)
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });

      const frameNum = String(i).padStart(6, '0');
      fs.writeFileSync(path.join(tmpDir, `frame_${frameNum}.png`), Buffer.from(data, 'base64'));

      // Progress indicator every 10%
      if (i > 0 && i % Math.ceil(totalFrames / 10) === 0) {
        process.stdout.write(`  ${Math.round(i / totalFrames * 100)}%`);
      }
    }
    console.log('  100%');

    return { tmpDir, totalFrames };
  } finally {
    await browser.close();
  }
}

// ================================================================
//  ENCODING FUNCTIONS
// ================================================================

async function encodeWebM(tmpDir, outputPath, encoders) {
  if (!encoders.libvpx_vp9) {
    console.warn('  Skipping WebM: libvpx-vp9 encoder not available');
    return false;
  }
  console.log('  Encoding WebM (VP9 alpha)...');
  const crf = Math.round(63 - (config.quality / 100 * 38)); // quality 90 → crf ~29, quality 100 → crf 25
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(config.fps),
      '-i', path.join(tmpDir, 'frame_%06d.png'),
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-crf', String(crf),
      '-b:v', '0',
      '-auto-alt-ref', '0',
      '-an',
      outputPath,
    ], { timeout: 300000 });
    return true;
  } catch (err) {
    console.error(`  WebM encoding failed: ${err.message}`);
    return false;
  }
}

async function encodeMp4(tmpDir, outputPath, encoders) {
  if (!encoders.libx264) {
    console.warn('  Skipping MP4: libx264 encoder not available');
    return false;
  }
  console.log('  Encoding MP4 (H.264)...');
  const crf = Math.round(51 - (config.quality / 100 * 33)); // quality 90 → crf ~21, quality 100 → crf 18
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(config.fps),
      '-i', path.join(tmpDir, 'frame_%06d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', String(crf),
      '-preset', 'slow',
      '-movflags', '+faststart',
      '-an',
      outputPath,
    ], { timeout: 300000 });
    return true;
  } catch (err) {
    console.error(`  MP4 encoding failed: ${err.message}`);
    return false;
  }
}

async function encodeAv1(tmpDir, outputPath, encoders) {
  if (!encoders.libsvtav1) {
    console.warn('  Skipping AV1: libsvtav1 encoder not available');
    return false;
  }
  console.log('  Encoding AV1...');
  const crf = Math.round(63 - (config.quality / 100 * 35)); // quality 90 → crf ~31
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(config.fps),
      '-i', path.join(tmpDir, 'frame_%06d.png'),
      '-c:v', 'libsvtav1',
      '-pix_fmt', 'yuv420p',
      '-crf', String(crf),
      '-an',
      outputPath,
    ], { timeout: 600000 });
    return true;
  } catch (err) {
    console.error(`  AV1 encoding failed: ${err.message}`);
    return false;
  }
}

async function encodeHevc(tmpDir, outputPath, encoders) {
  if (!encoders.hevc_videotoolbox) {
    console.warn('  Skipping HEVC: hevc_videotoolbox encoder not available (macOS only)');
    return false;
  }
  console.log('  Encoding HEVC (VideoToolbox alpha)...');
  const q = Math.round(100 - config.quality); // Invert: quality 90 → q:v 10
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(config.fps),
      '-i', path.join(tmpDir, 'frame_%06d.png'),
      '-c:v', 'hevc_videotoolbox',
      '-pix_fmt', 'bgra',
      '-q:v', String(Math.max(q, 1)),
      '-tag:v', 'hvc1',
      '-alpha_quality', '1',
      '-an',
      outputPath,
    ], { timeout: 300000 });
    return true;
  } catch (err) {
    console.error(`  HEVC encoding failed: ${err.message}`);
    return false;
  }
}

async function encodeProRes(tmpDir, outputPath, encoders) {
  if (!encoders.prores_ks) {
    console.warn('  Skipping ProRes: prores_ks encoder not available');
    return false;
  }
  console.log('  Encoding ProRes 4444...');
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(config.fps),
      '-i', path.join(tmpDir, 'frame_%06d.png'),
      '-c:v', 'prores_ks',
      '-profile:v', '4444',
      '-pix_fmt', 'yuva444p10le',
      '-an',
      outputPath,
    ], { timeout: 300000 });
    return true;
  } catch (err) {
    console.error(`  ProRes encoding failed: ${err.message}`);
    return false;
  }
}

function listFrames(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
    .sort()
    .map(f => path.join(dir, f));
}

async function encodeGif(tmpDir, outputPath, encoders) {
  if (encoders.gifski) {
    console.log('  Encoding GIF (gifski)...');
    try {
      const frames = listFrames(tmpDir);
      await execFileAsync('gifski', [
        '--quality', String(config.quality),
        '--fps', String(config.fps),
        '-o', outputPath,
        ...frames,
      ], { timeout: 300000 });
      return true;
    } catch (err) {
      console.error(`  gifski failed: ${err.message}`);
      // Fall through to ffmpeg
    }
  }

  if (encoders.ffmpeg) {
    console.log('  Encoding GIF (ffmpeg fallback)...');
    const palettePath = path.join(tmpDir, 'palette.png');
    const inputPattern = path.join(tmpDir, 'frame_%06d.png');
    try {
      // Two-pass for better quality
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-vf', 'palettegen=max_colors=256:stats_mode=diff',
        palettePath,
      ], { timeout: 120000 });

      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-i', palettePath,
        '-lavfi', 'paletteuse=dither=sierra2_4a',
        outputPath,
      ], { timeout: 300000 });
      return true;
    } catch (err) {
      console.error(`  GIF encoding failed: ${err.message}`);
      return false;
    }
  }

  console.warn('  Skipping GIF: no encoder available');
  return false;
}

// ================================================================
//  SOCIAL MEDIA VARIANTS
// ================================================================

async function generateSocialVariants(mp4Source, socialDir, encoders) {
  if (!encoders.libx264 || !fs.existsSync(mp4Source)) {
    console.warn('  Skipping social variants: requires MP4 source + libx264');
    return;
  }

  fs.mkdirSync(socialDir, { recursive: true });
  console.log('  Generating social variants...');

  const variants = [
    { name: 'square-1080',         w: 1080, h: 1080 },
    { name: 'landscape-1080p',     w: 1920, h: 1080 },
    { name: 'portrait-1080x1920',  w: 1080, h: 1920 },
  ];

  for (const v of variants) {
    const outPath = path.join(socialDir, `${config.baseName}-${v.name}.mp4`);
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-i', mp4Source,
        '-vf', `scale=${v.w}:${v.h}:force_original_aspect_ratio=decrease,pad=${v.w}:${v.h}:(ow-iw)/2:(oh-ih)/2:color=black`,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
        '-movflags', '+faststart', '-an',
        outPath,
      ], { timeout: 120000 });
      console.log(`    ${v.name} ✓`);
    } catch (err) {
      console.error(`    ${v.name} failed: ${err.message}`);
    }
  }
}

// ================================================================
//  EMBED GENERATION
// ================================================================

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateEmbed(embedDir) {
  fs.mkdirSync(embedDir, { recursive: true });
  console.log('  Generating embed assets...');

  // Copy source HTML as embed.html
  fs.copyFileSync(config.inputFile, path.join(embedDir, 'embed.html'));

  // Generate embed snippet
  const snippet = `<!-- Responsive iframe embed -->
<div style="aspect-ratio: 16/9; width: 100%; max-width: 640px;">
  <iframe
    src="embed.html"
    style="width: 100%; height: 100%; border: none;"
    loading="lazy"
    title="${escapeHtml(config.baseName)} demo"
  ></iframe>
</div>

<!-- Cross-browser transparent video embed -->
<video autoplay loop muted playsinline style="max-width: 640px; width: 100%;">
  <source src="../web/${config.baseName}-hevc.mov" type='video/mp4; codecs="hvc1"'>
  <source src="../web/${config.baseName}.webm" type="video/webm">
  <source src="../web/${config.baseName}.mp4" type="video/mp4">
</video>
`;
  fs.writeFileSync(path.join(embedDir, 'embed-snippet.html'), snippet);
}

// ================================================================
//  EMAIL KIT
// ================================================================

async function generateEmailKit(tmpDir, emailDir, encoders) {
  fs.mkdirSync(emailDir, { recursive: true });
  console.log('  Generating email kit...');

  const emailWidth = 600;
  const inputPattern = path.join(tmpDir, 'frame_%06d.png');

  // 600w PNG (first frame for Outlook fallback)
  const pngPath = path.join(emailDir, `${config.baseName}-hero-600w.png`);
  if (encoders.ffmpeg) {
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-i', path.join(tmpDir, 'frame_000000.png'),
        '-vf', `scale=${emailWidth}:-1`,
        pngPath,
      ], { timeout: 30000 });
    } catch (err) {
      console.error(`    Email PNG failed: ${err.message}`);
    }
  }

  // 600w GIF (Gmail/Yahoo)
  const gifPath = path.join(emailDir, `${config.baseName}-hero-600w.gif`);
  if (encoders.gifski) {
    // Scale frames first, then gifski
    const emailTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'animatic-email-'));
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-vf', `scale=${emailWidth}:-1`,
        path.join(emailTmp, 'frame_%06d.png'),
      ], { timeout: 120000 });

      const emailFrames = listFrames(emailTmp);
      await execFileAsync('gifski', [
        '--quality', '80', '--fps', String(Math.min(config.fps, 15)),
        '-o', gifPath,
        ...emailFrames,
      ], { timeout: 300000 });
    } catch (err) {
      console.error(`    Email GIF failed: ${err.message}`);
    }
    fs.rmSync(emailTmp, { recursive: true, force: true });
  } else if (encoders.ffmpeg) {
    try {
      const palettePath = path.join(tmpDir, 'email_palette.png');
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-vf', `scale=${emailWidth}:-1,palettegen=max_colors=128`,
        palettePath,
      ], { timeout: 60000 });
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-i', palettePath,
        '-lavfi', `scale=${emailWidth}:-1[s];[s][1:v]paletteuse=dither=sierra2_4a`,
        gifPath,
      ], { timeout: 300000 });
    } catch (err) {
      console.error(`    Email GIF (ffmpeg) failed: ${err.message}`);
    }
  }

  // 600w MP4 (Apple Mail)
  const mp4Path = path.join(emailDir, `${config.baseName}-hero-600w.mp4`);
  if (encoders.libx264) {
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', String(config.fps),
        '-i', inputPattern,
        '-vf', `scale=${emailWidth}:-1`,
        '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
        '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-an',
        mp4Path,
      ], { timeout: 120000 });
    } catch (err) {
      console.error(`    Email MP4 failed: ${err.message}`);
    }
  }

  // Email snippet HTML (progressive enhancement template)
  const emailSnippet = `<!--
  Email Hero — Progressive Enhancement
  ─────────────────────────────────────
  Apple Mail:      Plays inline MP4 video (best experience)
  Gmail/Yahoo:     Shows animated GIF
  Outlook desktop: Shows static PNG (first frame of GIF)

  Replace {{CDN_BASE}} with your asset URL base.
  Replace {{CTA_URL}} with the landing page URL.
-->

<!-- Apple Mail: inline video (other clients ignore this) -->
<!--[if !mso]><!-->
<div class="email-video" style="display:none; max-width:${emailWidth}px;">
  <video autoplay loop muted playsinline
    poster="{{CDN_BASE}}/${config.baseName}-hero-600w.png"
    width="${emailWidth}"
    style="max-width:100%; height:auto; border-radius:8px;">
    <source src="{{CDN_BASE}}/${config.baseName}-hero-600w.mp4" type="video/mp4">
  </video>
</div>
<style>
  /* Apple Mail supports <style> — show video, hide GIF fallback */
  .email-video { display: block !important; }
  .email-gif-fallback { display: none !important; }
</style>
<!--<![endif]-->

<!-- GIF fallback — Gmail, Yahoo, Outlook.com -->
<!--[if !mso]><!-->
<div class="email-gif-fallback" style="max-width:${emailWidth}px;">
  <a href="{{CTA_URL}}" style="text-decoration:none;">
    <img
      src="{{CDN_BASE}}/${config.baseName}-hero-600w.gif"
      alt="See ${config.baseName} in action"
      width="${emailWidth}"
      style="max-width:100%; height:auto; border-radius:8px; display:block;"
    >
  </a>
</div>
<!--<![endif]-->

<!-- Outlook desktop: static PNG (MSO conditional) -->
<!--[if mso]>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${emailWidth}">
  <tr>
    <td>
      <a href="{{CTA_URL}}">
        <img
          src="{{CDN_BASE}}/${config.baseName}-hero-600w.png"
          alt="See ${config.baseName} in action"
          width="${emailWidth}"
          style="display:block; border-radius:8px;"
        >
      </a>
    </td>
  </tr>
</table>
<![endif]-->

<!-- CTA button (works everywhere) -->
<div style="text-align:center; margin-top:16px;">
  <a href="{{CTA_URL}}"
    style="display:inline-block; padding:12px 28px; background-color:#262626; color:#ffffff; text-decoration:none; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:14px; font-weight:500;">
    Watch the full demo &rarr;
  </a>
</div>
`;
  fs.writeFileSync(path.join(emailDir, 'email-snippet.html'), emailSnippet);
}

// ================================================================
//  THUMBNAIL
// ================================================================

async function generateThumbnail(tmpDir, outputPath) {
  console.log('  Generating thumbnail...');

  // Pick frame at the thumb phase — estimate by proportion through frames
  const htmlSource = fs.readFileSync(config.inputFile, 'utf-8');
  const dwellMatches = [...htmlSource.matchAll(/dwell\s*:\s*(\d+)/g)];
  const dwells = dwellMatches.map(m => parseInt(m[1], 10));

  let targetMs = BOOT_TIME_MS;
  for (let i = 0; i <= config.thumbPhase && i < dwells.length; i++) {
    if (i < config.thumbPhase) {
      targetMs += dwells[i];
    } else {
      // Capture midway through target phase
      targetMs += dwells[i] * 0.6;
    }
  }

  const frameIndex = Math.min(
    Math.floor(targetMs / 1000 * config.fps),
    fs.readdirSync(tmpDir).filter(f => f.startsWith('frame_')).length - 1,
  );

  const frameFile = path.join(tmpDir, `frame_${String(Math.max(0, frameIndex)).padStart(6, '0')}.png`);

  if (fs.existsSync(frameFile)) {
    fs.copyFileSync(frameFile, outputPath);
  } else {
    // Fallback: use last frame
    const frames = fs.readdirSync(tmpDir).filter(f => f.startsWith('frame_')).sort();
    if (frames.length > 0) {
      fs.copyFileSync(path.join(tmpDir, frames[frames.length - 1]), outputPath);
    }
  }
}

// ================================================================
//  MAIN ORCHESTRATOR
// ================================================================

async function main() {
  const startTime = Date.now();

  console.log(`\nCapture Pipeline`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  Input: ${config.inputFile}`);
  console.log(`  Output: ${config.outputDir}`);
  console.log(`  Format: ${config.format}${config.kit ? ' (full kit)' : ''}`);
  console.log(`  Viewport: ${config.width}px @2x`);
  console.log(`  FPS: ${config.fps}, Quality: ${config.quality}`);
  if (config.deterministic) console.log(`  Mode: deterministic (virtual time)`);
  console.log();

  // 1. Read HTML and detect duration
  console.log('1. Detecting duration...');
  const htmlSource = fs.readFileSync(config.inputFile, 'utf-8');
  const duration = config.duration || detectDuration(htmlSource);
  console.log();

  // 2. Probe available encoders
  console.log('2. Probing encoders...');
  const encoders = await probeEncoders();
  const available = Object.entries(encoders).filter(([, v]) => v).map(([k]) => k);
  console.log(`  Available: ${available.join(', ')}`);
  console.log();

  // 3. Determine which formats to encode
  const allFormats = ['webm', 'mp4', 'av1', 'hevc', 'prores', 'gif'];
  const formats = config.format === 'all' ? allFormats : [config.format];

  // 4. Create output directories
  fs.mkdirSync(config.outputDir, { recursive: true });
  if (formats.length > 1 || config.kit) {
    fs.mkdirSync(path.join(config.outputDir, 'web'), { recursive: true });
  }

  // 5. Capture frames
  console.log('3. Capturing frames...');
  const { tmpDir, totalFrames } = await captureFrames(duration);
  console.log(`  Captured ${totalFrames} frames to ${tmpDir}`);
  console.log();

  try {
    // 6. Encode formats
    console.log('4. Encoding...');
    const results = {};

    for (const fmt of formats) {
      const isKit = formats.length > 1;
      let outputPath;

      if (fmt === 'prores' && isKit) {
        // ProRes master always at root level
        outputPath = path.join(config.outputDir, `${config.baseName}-master.mov`);
      } else if (isKit) {
        outputPath = path.join(config.outputDir, 'web', getOutputFilename(fmt));
      } else {
        outputPath = path.join(config.outputDir, getOutputFilename(fmt));
      }

      switch (fmt) {
        case 'webm':   results.webm   = await encodeWebM(tmpDir, outputPath, encoders);   break;
        case 'mp4':    results.mp4    = await encodeMp4(tmpDir, outputPath, encoders);     break;
        case 'av1':    results.av1    = await encodeAv1(tmpDir, outputPath, encoders);     break;
        case 'hevc':   results.hevc   = await encodeHevc(tmpDir, outputPath, encoders);    break;
        case 'prores': results.prores = await encodeProRes(tmpDir, outputPath, encoders);  break;
        case 'gif':    results.gif    = await encodeGif(tmpDir, outputPath, encoders);     break;
      }
    }
    console.log();

    // 7. Distribution extras
    if (config.social) {
      console.log('5. Social variants...');
      const mp4Source = config.kit
        ? path.join(config.outputDir, 'web', `${config.baseName}.mp4`)
        : path.join(config.outputDir, `${config.baseName}.mp4`);
      await generateSocialVariants(mp4Source, path.join(config.outputDir, 'social'), encoders);
      console.log();
    }

    if (config.embed) {
      console.log('6. Embed assets...');
      generateEmbed(path.join(config.outputDir, 'embed'));
      console.log();
    }

    if (config.email) {
      console.log('7. Email kit...');
      await generateEmailKit(tmpDir, path.join(config.outputDir, 'email'), encoders);
      console.log();
    }

    if (config.thumb) {
      console.log('8. Thumbnail...');
      await generateThumbnail(tmpDir, path.join(config.outputDir, 'thumb.png'));
      console.log();
    }
  } finally {
    // Always cleanup temp frames
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Done in ${elapsed}s`);
  console.log();

  // List generated files
  console.log('Generated files:');
  listFiles(config.outputDir, '  ');
}

function getOutputFilename(format) {
  switch (format) {
    case 'webm':   return `${config.baseName}.webm`;
    case 'mp4':    return `${config.baseName}.mp4`;
    case 'av1':    return `${config.baseName}.av1.mp4`;
    case 'hevc':   return `${config.baseName}-hevc.mov`;
    case 'prores': return `${config.baseName}-master.mov`;
    case 'gif':    return `${config.baseName}.gif`;
    default:       return `${config.baseName}.${format}`;
  }
}

function listFiles(dir, indent) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    // Directories first, then files
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      console.log(`${indent}${entry.name}/`);
      listFiles(fullPath, indent + '  ');
    } else {
      const stats = fs.statSync(fullPath);
      const size = formatBytes(stats.size);
      console.log(`${indent}${entry.name} (${size})`);
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Run
main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
