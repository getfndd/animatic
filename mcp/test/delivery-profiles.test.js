/**
 * Tests for delivery profiles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDeliveryProfile,
  listDeliveryProfiles,
  getProfileForChannel,
  buildFfmpegArgs,
  buildTranscodeArgs,
  buildGifPaletteArgs,
  buildGifEncodeArgs,
  escapeSubtitlesPath,
  DELIVERY_PROFILE_SLUGS,
} from '../lib/delivery-profiles.js';

describe('listDeliveryProfiles', () => {
  it('returns all profiles', () => {
    const profiles = listDeliveryProfiles();
    assert.ok(profiles.length >= 8);
    for (const slug of DELIVERY_PROFILE_SLUGS) {
      assert.ok(profiles.some(p => p.slug === slug), `Missing profile: ${slug}`);
    }
  });

  it('each profile has required fields', () => {
    for (const p of listDeliveryProfiles()) {
      assert.ok(p.slug, 'missing slug');
      assert.ok(p.name, 'missing name');
      assert.ok(p.resolution, 'missing resolution');
      assert.ok(typeof p.fps === 'number', 'missing fps');
      assert.ok(p.codec, 'missing codec');
      assert.ok(Array.isArray(p.channels), 'missing channels');
    }
  });
});

describe('getDeliveryProfile', () => {
  it('returns profile by slug', () => {
    const p = getDeliveryProfile('web-hero');
    assert.equal(p.slug, 'web-hero');
    assert.equal(p.resolution.w, 1920);
    assert.equal(p.fps, 60);
  });

  it('returns null for unknown slug', () => {
    assert.equal(getDeliveryProfile('nonexistent'), null);
  });
});

describe('getProfileForChannel', () => {
  it('finds profile for youtube', () => {
    const p = getProfileForChannel('youtube');
    assert.ok(p);
    assert.equal(p.resolution.w, 1920);
  });

  it('finds profile for instagram-feed', () => {
    const p = getProfileForChannel('instagram-feed');
    assert.ok(p);
    assert.equal(p.resolution.w, 1080);
    assert.equal(p.resolution.h, 1080);
  });

  it('finds profile for email', () => {
    const p = getProfileForChannel('email');
    assert.ok(p);
    assert.equal(p.codec, 'gif');
  });

  it('finds profile for tiktok', () => {
    const p = getProfileForChannel('tiktok');
    assert.ok(p);
    assert.equal(p.resolution.h, 1920);
  });

  it('returns null for unknown channel', () => {
    assert.equal(getProfileForChannel('fax-machine'), null);
  });
});

describe('buildTranscodeArgs (mp4→mp4, ANI-190)', () => {
  it('transcodes the master MP4 with scale + fps + h264 quality + re-encoded audio', () => {
    const p = getDeliveryProfile('web-hero');
    const args = buildTranscodeArgs(p, 'master.mp4', 'web-hero.mp4');
    assert.deepEqual(args.slice(0, 3), ['-y', '-i', 'master.mp4'], 'input is the master mp4, not a frame pattern');
    const vf = args[args.indexOf('-vf') + 1];
    assert.match(vf, /fps=60/);
    assert.match(vf, /scale=1920:1080:flags=lanczos/);
    assert.match(vf, /noise=/, 'web-hero dithers');
    assert.ok(args.includes('libx264') && args.includes('-crf') && args.includes('14'));
    assert.ok(args.includes('-preset') && args.includes('slow'));
    assert.ok(args.includes('-movflags') && args.includes('+faststart'));
    // audio re-encoded to the profile spec (not copied)
    assert.deepEqual([args.includes('-c:a'), args.includes('aac'), args.includes('192k'), args.includes('48000')], [true, true, true, true]);
    assert.equal(args[args.length - 1], 'web-hero.mp4');
  });

  it('social-feed re-encodes audio to its own 44.1k/128k spec', () => {
    const args = buildTranscodeArgs(getDeliveryProfile('social-feed'), 'm.mp4', 'sf.mp4');
    const vf = args[args.indexOf('-vf') + 1];
    assert.match(vf, /scale=1080:1080/);
    assert.ok(args.includes('128k') && args.includes('44100'));
  });

  it('the prores master profile passes through prores_ks (no dithering)', () => {
    const args = buildTranscodeArgs(getDeliveryProfile('master'), 'm.mp4', 'master.mov');
    assert.ok(args.includes('prores_ks') && args.includes('-profile:v') && args.includes('4444'));
    assert.ok(args.includes('yuva444p10le'));
    assert.ok(!args.some(a => a.includes('noise')), 'master does not dither');
  });

  it('drops audio (-an) when the profile has no audio spec', () => {
    const silent = { ...getDeliveryProfile('web-hero'), audio: null };
    const args = buildTranscodeArgs(silent, 'm.mp4', 'out.mp4');
    assert.ok(args.includes('-an'));
    assert.ok(!args.includes('-c:a'));
  });

  it('refuses gif (needs palettegen) and bad input', () => {
    assert.throws(() => buildTranscodeArgs(getDeliveryProfile('email-gif'), 'm.mp4', 'out.gif'), /gif/);
    assert.throws(() => buildTranscodeArgs(null, 'm.mp4', 'out.mp4'), /requires/);
  });

  it('burns in subtitles AFTER scale when burnInSubtitles is given (ANI-193)', () => {
    const args = buildTranscodeArgs(getDeliveryProfile('social-feed'), 'm.mp4', 'sf.mp4', { burnInSubtitles: '/p/master.vtt' });
    const vf = args[args.indexOf('-vf') + 1];
    assert.ok(vf.indexOf('scale=') < vf.indexOf('subtitles='), 'subtitles render after scale (at delivery resolution)');
    // Unquoted argv form (no surrounding single quotes — those are a shell construct).
    assert.match(vf, /subtitles=\/p\/master\.vtt/);
  });

  it('omits the subtitles filter when no burn-in is requested', () => {
    const vf = buildTranscodeArgs(getDeliveryProfile('social-feed'), 'm.mp4', 'sf.mp4')[buildTranscodeArgs(getDeliveryProfile('social-feed'), 'm.mp4', 'sf.mp4').indexOf('-vf') + 1];
    assert.doesNotMatch(vf, /subtitles=/);
  });
});

describe('GIF palettegen builders (ANI-194)', () => {
  const gif = getDeliveryProfile('email-gif');

  it('pass 1 generates a palette: fps + scale + palettegen', () => {
    const args = buildGifPaletteArgs(gif, 'master.mp4', 'palette.png');
    assert.deepEqual(args.slice(0, 3), ['-y', '-i', 'master.mp4']);
    const vf = args[args.indexOf('-vf') + 1];
    assert.match(vf, /fps=15/);
    assert.match(vf, /scale=600:338:flags=lanczos/);
    assert.match(vf, /palettegen$/);
    assert.equal(args[args.length - 1], 'palette.png');
  });

  it('pass 2 applies the palette via paletteuse, no audio', () => {
    const args = buildGifEncodeArgs(gif, 'master.mp4', 'palette.png', 'out.gif');
    assert.ok(args.includes('master.mp4') && args.includes('palette.png'), 'two inputs: video + palette');
    const fc = args[args.indexOf('-filter_complex') + 1];
    assert.match(fc, /fps=15,scale=600:338:flags=lanczos\[x\];\[x\]\[1:v\]paletteuse/);
    assert.ok(args.includes('-an'), 'animated GIF carries no audio');
    assert.equal(args[args.length - 1], 'out.gif');
  });

  it('both builders validate inputs', () => {
    assert.throws(() => buildGifPaletteArgs(gif, 'm.mp4'), /requires/);
    assert.throws(() => buildGifEncodeArgs(gif, 'm.mp4', 'p.png'), /requires/);
  });
});

describe('escapeSubtitlesPath (ANI-193)', () => {
  it('escapes the filtergraph metacharacters : \\ and \'', () => {
    assert.equal(escapeSubtitlesPath('/a/b.vtt'), '/a/b.vtt');
    assert.equal(escapeSubtitlesPath('C:\\x\\y.vtt'), 'C\\:\\\\x\\\\y.vtt');
    assert.equal(escapeSubtitlesPath("/o'brien/c.vtt"), "/o\\'brien/c.vtt");
  });
});

describe('buildFfmpegArgs', () => {
  it('builds H.264 args with dithering', () => {
    const p = getDeliveryProfile('web-hero');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mp4');
    assert.ok(args.includes('-c:v'));
    assert.ok(args.includes('libx264'));
    assert.ok(args.includes('-movflags'));
    assert.ok(args.some(a => a.includes('noise')), 'should include dithering filter');
  });

  it('builds ProRes args without dithering', () => {
    const p = getDeliveryProfile('master');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mov');
    assert.ok(args.includes('prores_ks'));
    assert.ok(!args.some(a => a.includes('noise')), 'master should not dither');
  });

  it('strips audio (-an) when no audioInput is provided', () => {
    const p = getDeliveryProfile('web-hero');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mp4');
    assert.ok(args.includes('-an'), 'must explicitly strip audio when none supplied');
    assert.ok(!args.includes('-c:a'), 'should not emit audio codec flag without input');
  });

  it('emits audio codec flags from profile when audioInput is provided', () => {
    const p = getDeliveryProfile('web-hero');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mp4', {
      audioInput: 'music.wav',
    });
    assert.ok(args.includes('-i') && args.indexOf('-i', args.indexOf('-i') + 1) >= 0,
      'should have two -i flags (video + audio)');
    assert.ok(!args.includes('-an'), 'must not strip audio when input supplied');
    assert.ok(args.includes('-c:a'));
    assert.ok(args.includes('aac'));
    assert.ok(args.includes('-b:a'));
    assert.ok(args.includes('192k'));
    assert.ok(args.includes('-ar'));
    assert.ok(args.includes('48000'));
    assert.ok(args.includes('-ac'));
    assert.ok(args.includes('2'));
    assert.ok(args.includes('-shortest'), '-shortest prevents audio outlasting video');
  });

  it('email-gif strips audio even when audioInput is supplied (profile.audio === null)', () => {
    const p = getDeliveryProfile('email-gif');
    assert.equal(p.audio, null, 'email-gif must have audio: null');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.gif', {
      audioInput: 'music.wav',
    });
    assert.ok(args.includes('-an'), 'gif must strip audio even with audioInput');
    assert.ok(!args.includes('-c:a'));
  });

  it('master profile uses PCM codec with no bitrate', () => {
    const p = getDeliveryProfile('master');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mov', {
      audioInput: 'music.wav',
    });
    assert.ok(args.includes('-c:a'));
    assert.ok(args.includes('pcm_s24le'));
    assert.ok(!args.includes('-b:a'), 'PCM is lossless — no bitrate flag');
  });

  it('every h264 profile declares AAC audio config', () => {
    const slugs = ['web-hero', 'web-embed', 'social-feed', 'social-landscape', 'story-reel', 'presentation'];
    for (const slug of slugs) {
      const p = getDeliveryProfile(slug);
      assert.ok(p.audio, `${slug} must declare audio config`);
      assert.equal(p.audio.codec, 'aac', `${slug} should use AAC`);
      assert.ok(p.audio.bitrate_kbps > 0, `${slug} needs positive bitrate`);
    }
  });
});
