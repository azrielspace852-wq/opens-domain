import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressReporter, formatProgressBar, readLoggingOptions } from '../scripts/lib/progress.mjs';

function capture() {
  const chunks = [];
  return { chunks, write(value) { chunks.push(String(value)); return true; }, toString() { return chunks.join(''); } };
}

function makeReporter({ env = {}, isInteractive = false, clock } = {}) {
  const stream = capture();
  const errorStream = capture();
  const reporter = new ProgressReporter({
    env: { GITHUB_ACTIONS: 'true', ...env }, stream, errorStream, isInteractive, clock,
  });
  return { reporter, stream, errorStream };
}

test('progress bar formatting clamps percentages and preserves fixed width', () => {
  assert.equal(formatProgressBar(0, 10), '[----------]');
  assert.equal(formatProgressBar(50, 10), '[=====-----]');
  assert.equal(formatProgressBar(100, 10), '[==========]');
  assert.equal(formatProgressBar(140, 10), '[==========]');
  assert.equal(formatProgressBar(-10, 10), '[----------]');
});

test('logging configuration validates mode and periodic update options', () => {
  assert.deepEqual(readLoggingOptions({}), {
    level: 'normal', intervalMs: 5000, percentStep: 5,
    minIntervalMs: 1000, maxUpdates: 100, barWidth: 32,
  });
  assert.equal(readLoggingOptions({ LOG_LEVEL: 'QUIET', PROGRESS_INTERVAL_MS: '2000' }).level, 'quiet');
  assert.throws(() => readLoggingOptions({ LOG_LEVEL: 'chatty' }), /LOG_LEVEL/);
  assert.throws(() => readLoggingOptions({ PROGRESS_INTERVAL_MS: '0' }), /PROGRESS_INTERVAL_MS/);
  assert.throws(() => readLoggingOptions({ PROGRESS_PERCENT_STEP: '0' }), /PROGRESS_PERCENT_STEP/);
});

test('percentage threshold triggers progress but minimum interval prevents duplicate updates', () => {
  let now = 0;
  const { reporter, stream } = makeReporter({
    env: { PROGRESS_INTERVAL_MS: '5000', PROGRESS_PERCENT_STEP: '5', PROGRESS_MIN_INTERVAL_MS: '1000' },
    clock: () => now,
  });
  reporter.beginScene({ label: 'demo.js', totalFrames: 100 });
  now = 500;
  assert.equal(reporter.onFrame(5, 100), false);
  now = 1000;
  assert.equal(reporter.onFrame(10, 100), true);
  const afterThreshold = stream.toString();
  now = 1100;
  assert.equal(reporter.onFrame(11, 100), false);
  assert.equal(stream.toString(), afterThreshold);
  assert.match(stream.toString(), /10% \| 10\/100 frames/);
});

test('time threshold triggers progress when percentage step has not been reached', () => {
  let now = 0;
  const { reporter, stream } = makeReporter({
    env: { PROGRESS_INTERVAL_MS: '5000', PROGRESS_PERCENT_STEP: '5', PROGRESS_MIN_INTERVAL_MS: '1000' },
    clock: () => now,
  });
  reporter.beginScene({ label: 'slow.js', totalFrames: 1000 });
  now = 5000;
  assert.equal(reporter.onFrame(10, 1000), true);
  assert.match(stream.toString(), /1% \| 10\/1000 frames/);
});

test('interactive terminal rewrites one line and final 100 percent is explicit', () => {
  const { reporter, stream } = makeReporter({ isInteractive: true });
  reporter.beginScene({ label: 'demo.js', totalFrames: 10 });
  reporter.onFrame(10, 10); // Must not report 100% before finalization.
  reporter.finalizing();
  assert.doesNotMatch(stream.toString(), /100%/);
  reporter.completeScene();
  const output = stream.toString();
  assert.ok(output.includes('\r'));
  assert.match(output, /100% \| 10\/10 frames/);
  assert.ok(output.endsWith('\n'));
  assert.equal(output.split('\n').length, 2);
});

test('GitHub Actions output uses newline updates without ANSI escape sequences', () => {
  const { reporter, stream } = makeReporter({
    env: { GITHUB_ACTIONS: 'true' },
    isInteractive: false,
  });
  reporter.beginScene({ label: 'demo.js', totalFrames: 10 });
  reporter.finalizing();
  reporter.completeScene();
  const output = stream.toString();
  assert.ok(output.includes('\n'));
  assert.doesNotMatch(output, /\r|\u001b\[/);
  assert.match(output, /100% \| 10\/10 frames/);
});

test('quiet mode suppresses ordinary logs but keeps progress, summary, and fatal errors', () => {
  const { reporter, stream, errorStream } = makeReporter({ env: { LOG_LEVEL: 'quiet' } });
  reporter.start('Starting render...');
  reporter.warn('warning');
  reporter.verbose('debug');
  reporter.beginScene({ label: 'demo.js', totalFrames: 1 });
  reporter.finalizing();
  reporter.completeScene();
  reporter.summary('Rendering completed successfully.');
  reporter.error(new Error('encoder failed'), { stage: 'FFmpeg' });
  assert.doesNotMatch(stream.toString(), /Starting render|warning|debug/);
  assert.match(stream.toString(), /Rendering completed successfully/);
  assert.match(errorStream.toString(), /Tahap gagal: FFmpeg/);
  assert.match(errorStream.toString(), /encoder failed/);
});

test('7,200-frame progress output is bounded and never emits one line per frame', () => {
  let now = 0;
  const { reporter, stream } = makeReporter({
    env: {
      GITHUB_ACTIONS: 'true', PROGRESS_INTERVAL_MS: '5000',
      PROGRESS_PERCENT_STEP: '5', PROGRESS_MIN_INTERVAL_MS: '1000',
      PROGRESS_MAX_UPDATES: '100',
    },
    clock: () => now,
  });
  const total = 7200;
  reporter.beginScene({ label: 'part-02-des.js', totalFrames: total });
  for (let frame = 1; frame <= total; frame += 1) {
    now += 5000; // Simulate an unusually slow renderer (one progress interval per frame).
    reporter.onFrame(frame, total);
  }
  reporter.finalizing();
  reporter.completeScene();
  const lines = stream.toString().trim().split('\n');
  assert.ok(lines.length <= 102, `Expected at most 102 lines, got ${lines.length}`);
  assert.ok(lines.length < total / 10, 'Progress output must not grow proportionally to frame count');
  assert.match(lines.at(-1), /100% \| 7200\/7200 frames/);
});
