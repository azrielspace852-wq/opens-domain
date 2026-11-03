import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildRawVideoArgs, parseFfmpegProgressLine, startFfmpeg, validateFfmpegOptions } from '../scripts/lib/ffmpeg.mjs';

test('raw FFmpeg arguments use RGBA rawvideo and preserve H.264 quality settings', () => {
  const args = buildRawVideoArgs({
    width: 1920, height: 1080, fps: 30, frames: 7200,
    outputFile: 'render.mp4', preset: 'veryfast', crf: 18, input: 'pipe:0',
  });
  assert.ok(args.includes('rawvideo'));
  assert.ok(args.includes('rgba'));
  assert.ok(args.includes('1920x1080'));
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('18'));
  assert.ok(args.includes('yuv420p'));
  assert.ok(args.includes('7200'));
  assert.equal(args.at(-1), 'render.mp4');
});

test('FFmpeg option validation rejects invalid presets and CRF', () => {
  assert.deepEqual(validateFfmpegOptions({ preset: 'veryfast', crf: 18, threads: 0 }), {
    preset: 'veryfast', crf: 18, threads: 0,
  });
  assert.throws(() => validateFfmpegOptions({ preset: 'unknown', crf: 18 }), /Preset/);
  assert.throws(() => validateFfmpegOptions({ preset: 'fast', crf: 52 }), /CRF/);
  assert.throws(() => validateFfmpegOptions({ preset: 'fast', crf: 18, threads: -1 }), /thread/);
});

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const ffprobeAvailable = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0;


test('FFmpeg machine progress parser consumes protocol fields and separates diagnostics', () => {
  const snapshot = { outputTimeSeconds: 0, speed: null, state: 'starting', frame: 0, fps: 0 };
  assert.equal(parseFfmpegProgressLine('frame=42', snapshot), false);
  assert.equal(parseFfmpegProgressLine('fps=29.7', snapshot), false);
  assert.equal(parseFfmpegProgressLine('out_time_us=1250000', snapshot), false);
  assert.equal(parseFfmpegProgressLine('speed=1.25x', snapshot), false);
  assert.equal(parseFfmpegProgressLine('progress=continue', snapshot), true);
  assert.equal(parseFfmpegProgressLine('encoder exploded', snapshot), null);
  assert.deepEqual(snapshot, {
    outputTimeSeconds: 1.25, speed: '1.25x', state: 'continue', frame: 42, fps: 29.7,
  });
});

test('FFmpeg encodes a raw RGBA frame into a valid H.264 MP4', { skip: !ffmpegAvailable || !ffprobeAvailable }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renderer-ffmpeg-'));
  const rawFile = path.join(root, 'sample.rgba');
  const outputFile = path.join(root, 'sample.mp4');
  const frame = Buffer.alloc(16 * 16 * 4);
  for (let index = 0; index < frame.length; index += 4) {
    frame[index] = 25;
    frame[index + 1] = 220;
    frame[index + 2] = 90;
    frame[index + 3] = 255;
  }
  await fs.writeFile(rawFile, frame);
  const args = buildRawVideoArgs({
    width: 16, height: 16, fps: 1, frames: 1,
    input: rawFile, outputFile, preset: 'ultrafast', crf: 18,
  });
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,nb_frames',
    '-of', 'json', outputFile,
  ], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const stream = JSON.parse(probe.stdout).streams[0];
  assert.equal(stream.codec_name, 'h264');
  assert.equal(stream.width, 16);
  assert.equal(stream.height, 16);
  assert.equal(Number(stream.nb_frames), 1);
  await fs.rm(root, { recursive: true, force: true });
});


test('direct FFmpeg stdin streaming accepts successive raw frames and finalizes a valid MP4', { skip: !ffmpegAvailable || !ffprobeAvailable }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renderer-pipe-'));
  const outputFile = path.join(root, 'stream.mp4');
  const args = buildRawVideoArgs({
    width: 16, height: 16, fps: 2, frames: 2,
    outputFile, preset: 'ultrafast', crf: 18, input: 'pipe:0', progress: true,
  });
  const progressEvents = [];
  const encoder = startFfmpeg({ args, label: 'FFmpeg test stream', expectedFrames: 2, onProgress: (value) => progressEvents.push(value) });
  const frame = Buffer.alloc(16 * 16 * 4);
  for (let index = 0; index < frame.length; index += 4) {
    frame[index] = 25;
    frame[index + 1] = 220;
    frame[index + 2] = 90;
    frame[index + 3] = 255;
  }
  await encoder.writeFrame(frame);
  frame[0] = 200;
  await encoder.writeFrame(frame);
  const encoderResult = await encoder.finish();
  assert.equal(encoderResult.progress.state, 'end');
  assert.ok(progressEvents.length >= 1);
  assert.equal(progressEvents.at(-1).state, 'end');
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,nb_frames', '-of', 'json', outputFile,
  ], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const stream = JSON.parse(probe.stdout).streams[0];
  assert.equal(stream.codec_name, 'h264');
  assert.equal(stream.width, 16);
  assert.equal(stream.height, 16);
  assert.equal(Number(stream.nb_frames), 2);
  await fs.rm(root, { recursive: true, force: true });
});


test('FFmpeg non-zero exit retains actionable stderr diagnostics', { skip: !ffmpegAvailable }, async () => {
  const encoder = startFfmpeg({ args: ['-definitely-invalid-renderer-option'], label: 'FFmpeg failure test' });
  await assert.rejects(encoder.finish(), /gagal \(exit=\d+/);
});


test('successful FFmpeg exit with fewer frames does not count as completed rendering', { skip: !ffmpegAvailable }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renderer-frame-count-'));
  const outputFile = path.join(root, 'short.mp4');
  const args = buildRawVideoArgs({
    width: 16, height: 16, fps: 1, frames: 2,
    outputFile, preset: 'ultrafast', crf: 18, input: 'pipe:0', progress: true,
  });
  const encoder = startFfmpeg({ args, label: 'FFmpeg frame count test', expectedFrames: 2 });
  await encoder.writeFrame(Buffer.alloc(16 * 16 * 4, 255));
  await assert.rejects(encoder.finish(), /jumlah frame yang diharapkan: 1\/2/);
  await fs.rm(root, { recursive: true, force: true });
});
