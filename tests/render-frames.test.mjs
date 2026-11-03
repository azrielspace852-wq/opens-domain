import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSceneFrames } from '../scripts/lib/render-frames.mjs';

function makeCanvas() {
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    setTransform: (...args) => calls.push(['setTransform', ...args]),
  };
  return { width: 2, height: 2, calls, getContext: () => ctx };
}

test('scene lifecycle runs setup, render and dispose with frame parameters', async () => {
  const canvas = makeCanvas();
  const events = [];
  const scene = {
    setup(params) { events.push(['setup', params.time]); return { value: 7 }; },
    render(params) { events.push(['render', params.frame, params.time, params.state.value]); },
    dispose(params) { events.push(['dispose', params.state.value]); },
  };
  const stats = await renderSceneFrames({
    canvas, scene, sceneFile: '/content/demo.js',
    options: { mode: 'video', fps: 2, duration: 2, aspectRatio: '16:9' },
    dimensions: { width: 2, height: 2 }, frameCount: 3,
  });
  assert.deepEqual(events, [
    ['setup', 0], ['render', 0, 0, 7], ['render', 1, 0.5, 7], ['render', 2, 1, 7], ['dispose', 7],
  ]);
  assert.equal(stats.frames, 3);
  assert.ok(stats.renderMs >= 0);
  assert.equal(canvas.calls.filter(([name]) => name === 'clearRect').length, 3);
});

test('async render lifecycle remains supported and dispose runs after render failure', async () => {
  const canvas = makeCanvas();
  let disposed = false;
  await assert.rejects(renderSceneFrames({
    canvas,
    scene: {
      async setup() { return 'ready'; },
      async render() { throw new Error('frame failure'); },
      dispose() { disposed = true; },
    },
    sceneFile: '/content/broken.js',
    options: { mode: 'video', fps: 30, duration: 1, aspectRatio: '16:9' },
    dimensions: { width: 2, height: 2 }, frameCount: 1,
  }), /frame failure/);
  assert.equal(disposed, true);
});


test('benchmark startTime offsets scene time without changing the local frame index', async () => {
  const canvas = makeCanvas();
  const frames = [];
  await renderSceneFrames({
    canvas,
    scene: { render(params) { frames.push([params.frame, params.time]); } },
    sceneFile: '/content/clip.js',
    options: { mode: 'video', fps: 2, duration: 240, sourceDuration: 240, aspectRatio: '16:9' },
    dimensions: { width: 2, height: 2 }, frameCount: 2, startTime: 65,
  });
  assert.deepEqual(frames, [[0, 65], [1, 65.5]]);
});


test('progress callback fires only after the frame sink has completed successfully', async () => {
  const canvas = makeCanvas();
  const events = [];
  await renderSceneFrames({
    canvas,
    scene: { render() { events.push('render'); } },
    sceneFile: '/content/progress.js',
    options: { mode: 'video', fps: 2, duration: 1, aspectRatio: '16:9' },
    dimensions: { width: 2, height: 2 },
    frameCount: 2,
    async onFrame({ frame }) { await Promise.resolve(); events.push(`write-${frame}`); },
    onProgress(completed) { events.push(`progress-${completed}`); },
  });
  assert.deepEqual(events, [
    'render', 'write-0', 'progress-1',
    'render', 'write-1', 'progress-2',
  ]);
});

test('failed frame sink does not count the failed frame as completed progress', async () => {
  const canvas = makeCanvas();
  const progress = [];
  await assert.rejects(renderSceneFrames({
    canvas,
    scene: { render() {} },
    sceneFile: '/content/broken-pipe.js',
    options: { mode: 'video', fps: 30, duration: 1, aspectRatio: '16:9' },
    dimensions: { width: 2, height: 2 },
    frameCount: 1,
    onFrame() { throw new Error('broken pipe'); },
    onProgress(completed) { progress.push(completed); },
  }), /broken pipe/);
  assert.deepEqual(progress, []);
});
