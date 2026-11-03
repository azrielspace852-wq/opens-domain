import path from 'node:path';
import { performance } from 'node:perf_hooks';

export function resetCanvasForFrame(ctx, width, height, mode) {
  if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if ('filter' in ctx) ctx.filter = 'none';
  ctx.clearRect(0, 0, width, height);
  if (mode === 'video') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
}

export function makeFrameContext({
  canvas, ctx, dimensions, options, frame, frameCount, sceneFile, state, startTime = 0,
}) {
  const time = options.mode === 'video' ? startTime + frame / options.fps : 0;
  const totalDuration = options.sourceDuration ?? options.duration;
  return {
    canvas, ctx, width: dimensions.width, height: dimensions.height,
    mode: options.mode, fps: options.mode === 'video' ? options.fps : null,
    frame: options.mode === 'video' ? frame : 0,
    totalFrames: options.mode === 'video' ? frameCount : 1,
    time, duration: options.mode === 'video' ? totalDuration : 0,
    // Keep the original renderer contract: first frame 0, last frame 1.
    progress: options.mode === 'video' ? (frameCount <= 1 ? 1 : frame / (frameCount - 1)) : 1,
    aspectRatio: options.aspectRatio,
    contentFile: sceneFile,
    contentDirectory: path.dirname(sceneFile),
    state,
  };
}

function callLifecycle(fn, args) {
  return typeof fn === 'function' ? fn(args) : undefined;
}

/** Runs setup(params) -> render(params) -> dispose() and awaits the frame sink for backpressure. */
export async function renderSceneFrames({
  canvas, scene, sceneFile, options, dimensions,
  frameCount = Math.max(1, Math.ceil(options.duration * options.fps)),
  startTime = 0, onFrame = async () => {}, onProgress = () => {}, progressIntervalMs = 5000,
}) {
  const ctx = canvas.getContext('2d');
  const startedAt = performance.now();
  let renderMs = 0;
  let callbackMs = 0;
  let state;
  let completedFrames = 0;
  let primaryError;
  let lastProgressAt = startedAt;
  const setupContext = makeFrameContext({
    canvas, ctx, dimensions, options, frame: 0, frameCount, sceneFile,
    state: undefined, startTime,
  });

  try {
    state = callLifecycle(scene.setup, setupContext);
    if (state && typeof state.then === 'function') state = await state;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const frameContext = makeFrameContext({
        canvas, ctx, dimensions, options, frame, frameCount, sceneFile, state, startTime,
      });
      const frameStartedAt = performance.now();
      resetCanvasForFrame(ctx, dimensions.width, dimensions.height, options.mode);
      const renderResult = callLifecycle(scene.render, frameContext);
      if (renderResult && typeof renderResult.then === 'function') await renderResult;
      renderMs += performance.now() - frameStartedAt;

      const callbackStartedAt = performance.now();
      const frameSinkResult = onFrame({ frame, frameContext, canvas, ctx });
      if (frameSinkResult && typeof frameSinkResult.then === 'function') await frameSinkResult;
      callbackMs += performance.now() - callbackStartedAt;
      completedFrames += 1;

      const now = performance.now();
      if (completedFrames === frameCount || now - lastProgressAt >= progressIntervalMs) {
        const elapsedMs = now - startedAt;
        const averageFps = elapsedMs > 0 ? completedFrames / (elapsedMs / 1000) : 0;
        onProgress({
          scene: path.basename(sceneFile), frame: completedFrames, totalFrames: frameCount,
          percent: (completedFrames / frameCount) * 100, elapsedMs, averageFps,
          etaMs: averageFps > 0 ? ((frameCount - completedFrames) / averageFps) * 1000 : null,
          stage: 'render JavaScript + transfer frame',
        });
        lastProgressAt = now;
      }
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      const disposeResult = callLifecycle(scene.dispose, { canvas, ctx, state, contentFile: sceneFile });
      if (disposeResult && typeof disposeResult.then === 'function') await disposeResult;
    } catch (disposeError) {
      if (primaryError) {
        process.stderr.write(`[renderer:warning] dispose() juga gagal: ${disposeError?.stack ?? disposeError}\n`);
      } else throw disposeError;
    }
  }

  const elapsedMs = performance.now() - startedAt;
  return {
    frames: completedFrames, renderMs, callbackMs, elapsedMs,
    averageFps: elapsedMs > 0 ? completedFrames / (elapsedMs / 1000) : 0,
    renderFps: renderMs > 0 ? completedFrames / (renderMs / 1000) : 0,
  };
}
