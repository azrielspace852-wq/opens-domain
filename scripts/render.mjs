import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import * as PImage from 'pureimage';
import * as esbuild from 'esbuild';

import {
  getImageDimensions,
  getVideoDimensions,
  outputPathForScene,
  packageNameFromSpecifier,
  readRenderOptions,
  scanContentFiles,
} from './lib/config.mjs';
import { buildRawVideoArgs, checkFfmpegAvailable, startFfmpeg, validateFfmpegOptions } from './lib/ffmpeg.mjs';
import { getRawRgbaBuffer } from './lib/raw-frame.mjs';
import { renderSceneFrames } from './lib/render-frames.mjs';
import { createRendererLogger } from './lib/progress.mjs';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'output');
const CACHE_ROOT = path.join(PROJECT_ROOT, '.render-cache');
let activeLogger;
let activeStage = 'initialization / content discovery';

function isPackageInstalled(packageName) {
  try {
    import.meta.resolve(packageName);
    return true;
  } catch {
    try { require.resolve(packageName, { paths: [PROJECT_ROOT] }); return true; }
    catch { return false; }
  }
}

async function inspectSceneDependencies(sceneFile) {
  const result = await esbuild.build({
    absWorkingDir: PROJECT_ROOT,
    entryPoints: [sceneFile],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node22',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const packages = new Set();
  for (const input of Object.values(result.metafile.inputs)) {
    for (const imported of input.imports) {
      if (!imported.external) continue;
      const packageName = packageNameFromSpecifier(imported.path);
      if (packageName) packages.add(packageName);
    }
  }
  return [...packages].sort();
}

async function installMissingDependencies(packageNames, logger) {
  const missing = packageNames.filter((name) => !isPackageInstalled(name));
  if (missing.length === 0) {
    logger.verbose(packageNames.length === 0
      ? 'Scene tidak memiliki dependensi npm tambahan.'
      : 'Semua dependensi scene sudah tersedia.');
    return;
  }
  logger.verbose(`Dependensi npm yang perlu dipasang: ${missing.join(', ')}`);
  const child = spawn('npm', ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--', ...missing], {
    cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  let stdoutTail = '';
  let stderrTail = '';
  const appendTail = (current, chunk) => `${current}${chunk}`.slice(-12_000);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutTail = appendTail(stdoutTail, chunk);
    if (logger.isVerbose) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderrTail = appendTail(stderrTail, chunk);
    if (logger.isVerbose) process.stderr.write(chunk);
  });
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (result.code !== 0) {
    const diagnostics = stderrTail.trim() || stdoutTail.trim() || 'npm tidak memberikan detail tambahan.';
    throw new Error(`Instalasi dependensi npm gagal (exit=${result.code}, signal=${result.signal ?? 'none'}).\n${diagnostics}`);
  }
  logger.verbose(`Instalasi dependensi selesai: ${missing.join(', ')}`);
}

async function compileScene(sceneFile) {
  const result = await esbuild.build({
    absWorkingDir: PROJECT_ROOT,
    entryPoints: [sceneFile],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node22',
    write: false,
    logLevel: 'silent',
    legalComments: 'inline',
  });
  const source = result.outputFiles[0]?.text;
  if (!source) throw new Error(`Tidak dapat mengompilasi scene: ${sceneFile}`);
  const hash = createHash('sha256').update(sceneFile).update(source).digest('hex').slice(0, 20);
  const bundleFile = path.join(CACHE_ROOT, `${hash}.mjs`);
  await fs.writeFile(bundleFile, source, 'utf8');
  return bundleFile;
}

function resolveSceneInterface(moduleNamespace, sceneFile) {
  const exported = moduleNamespace.default;
  const candidate = typeof exported === 'function'
    ? { render: exported }
    : exported && typeof exported === 'object' ? exported : {};
  const render = typeof moduleNamespace.render === 'function' ? moduleNamespace.render : candidate.render;
  const setup = typeof moduleNamespace.setup === 'function' ? moduleNamespace.setup : candidate.setup;
  const dispose = typeof moduleNamespace.dispose === 'function' ? moduleNamespace.dispose : candidate.dispose;
  if (typeof render !== 'function') {
    throw new Error(
      `${path.relative(PROJECT_ROOT, sceneFile)} wajib mengekspor fungsi render(ctx). ` +
      'Gunakan named export "render" atau default export berupa fungsi/objek yang memiliki properti render.',
    );
  }
  return { render, setup, dispose };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return 'tidak diketahui';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}j ${minutes}m ${remainder}d` : minutes ? `${minutes}m ${remainder}d` : `${remainder}d`;
}

async function encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions, logger, sceneIndex, sceneCount) {
  const totalFrames = Math.max(1, Math.ceil(options.duration * options.fps));
  const partialId = createHash('sha256').update(outputFile).digest('hex').slice(0, 16);
  const partialFile = path.join(CACHE_ROOT, `${partialId}.partial.mp4`);
  const frameBuffer = getRawRgbaBuffer(canvas, dimensions.width, dimensions.height);
  const args = buildRawVideoArgs({
    width: dimensions.width,
    height: dimensions.height,
    fps: options.fps,
    outputFile: partialFile,
    frames: totalFrames,
    preset: options.ffmpegPreset,
    crf: options.ffmpegCrf,
    threads: options.ffmpegThreads,
    input: 'pipe:0',
    progress: true,
  });
  logger.beginScene({
    label: `${sceneIndex}/${sceneCount} ${path.basename(sceneFile)}`,
    totalFrames,
  });
  const encoder = startFfmpeg({
    args,
    label: `FFmpeg ${path.basename(sceneFile)}`,
    expectedFrames: totalFrames,
    onProgress: (value) => {
      // Machine-readable FFmpeg progress is consumed internally. It is exposed
      // only in verbose mode; normal mode has exactly one progress bar source.
      logger.verbose(`FFmpeg: frame=${value.frame}, output=${value.outputTimeSeconds.toFixed(1)}s, speed=${value.speed ?? 'n/a'}, state=${value.state}.`);
    },
  });

  let frameStats;
  try {
    frameStats = await renderSceneFrames({
      canvas, scene, sceneFile, options, dimensions, frameCount: totalFrames,
      onFrame: async () => encoder.writeFrame(frameBuffer),
      onProgress: (completed, total) => logger.onFrame(completed, total),
      onWarning: (message) => logger.warn(message),
    });
    logger.finalizing();
    logger.verbose(`Rasterisasi JavaScript: ${frameStats.renderMs.toFixed(0)} ms (${frameStats.renderFps.toFixed(2)} FPS).`);
    const encoderStats = await encoder.finish();
    await fs.rm(outputFile, { force: true });
    await fs.rename(partialFile, outputFile);
    logger.completeScene();
    logger.verbose(`FFmpeg selesai dalam ${formatDuration(encoderStats.elapsedMs)}; frame ${encoderStats.progress.frame}, state=${encoderStats.progress.state}.`);
    logger.verbose(`Pipeline selesai: ${frameStats.frames} frame, wall time ${formatDuration(frameStats.elapsedMs)}, throughput ${frameStats.averageFps.toFixed(2)} FPS.`);
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    error.renderStage ??= 'render frame / transfer raw RGBA / finalisasi FFmpeg';
    await encoder.abort().catch(() => {});
    await fs.rm(partialFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions, logger, sceneIndex, sceneCount) {
  logger.beginScene({ label: `${sceneIndex}/${sceneCount} ${path.basename(sceneFile)}`, totalFrames: 1 });
  await renderSceneFrames({
    canvas, scene, sceneFile, options, dimensions, frameCount: 1,
    onProgress: (completed, total) => logger.onFrame(completed, total),
    onWarning: (message) => logger.warn(message),
  });
  const outputStream = createWriteStream(outputFile);
  try {
    if (options.imageFormat === 'JPG') await PImage.encodeJPEGToStream(canvas, outputStream, 92);
    else await PImage.encodePNGToStream(canvas, outputStream);
    await finished(outputStream);
    logger.finalizing();
    logger.completeScene();
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    outputStream.destroy();
    await fs.rm(outputFile, { force: true }).catch(() => {});
    error.renderStage ??= 'encode foto';
    throw error;
  }
}

async function main() {
  const logger = createRendererLogger();
  activeLogger = logger;
  const jobStartedAt = performance.now();
  activeStage = 'read configuration and validate FFmpeg options';
  const options = readRenderOptions();
  validateFfmpegOptions({ preset: options.ffmpegPreset, crf: options.ffmpegCrf, threads: options.ffmpegThreads });
  await fs.access(CONTENT_ROOT).catch(() => {
    throw new Error('Folder content/ tidak ditemukan. Buat folder content/ dan tambahkan minimal satu file .js.');
  });
  const sceneFiles = await scanContentFiles(CONTENT_ROOT);
  if (sceneFiles.length === 0) {
    throw new Error('Tidak ada file .js di content/. File TS, TSX, JSX, dan format lain tidak diproses.');
  }

  logger.start(`Starting ${options.mode} rendering...`);
  if (options.mode === 'video') logger.verbose(checkFfmpegAvailable());
  logger.verbose(`Mode: ${options.mode}; ditemukan ${sceneFiles.length} file JavaScript.`);

  activeStage = 'inspect JavaScript scene dependencies';
  const dependencies = new Set();
  for (const sceneFile of sceneFiles) {
    for (const packageName of await inspectSceneDependencies(sceneFile)) dependencies.add(packageName);
  }
  activeStage = 'install missing npm dependencies';
  await installMissingDependencies([...dependencies], logger);

  activeStage = 'prepare cache and output directories';
  await fs.rm(CACHE_ROOT, { recursive: true, force: true });
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(CACHE_ROOT, { recursive: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const dimensions = options.mode === 'video'
    ? getVideoDimensions(options.videoResolution, options.aspectRatio)
    : getImageDimensions(options.imageResolution, options.aspectRatio);
  const totalFrames = options.mode === 'video' ? Math.ceil(options.duration * options.fps) : 1;
  logger.verbose(options.mode === 'video'
    ? `Output: ${dimensions.width}x${dimensions.height}, ${options.fps} FPS, ${options.duration}s, ${totalFrames} frame; libx264 ${options.ffmpegPreset}/CRF ${options.ffmpegCrf}; RGBA/frame ${(dimensions.width * dimensions.height * 4 / 1024 / 1024).toFixed(2)} MiB.`
    : `Output: ${dimensions.width}x${dimensions.height}, ${dimensions.actualMegapixels.toFixed(2)} MP, ${options.imageFormat}.`);

  let completed = 0;
  const sceneCount = sceneFiles.length;
  for (const [scenePosition, sceneFile] of sceneFiles.entries()) {
    activeStage = `compile scene ${path.relative(CONTENT_ROOT, sceneFile)}`;
    const bundleFile = await compileScene(sceneFile);
    try {
      activeStage = `load scene ${path.relative(CONTENT_ROOT, sceneFile)}`;
      const moduleNamespace = await import(`${pathToFileURL(bundleFile).href}?v=${Date.now()}-${completed}`);
      const scene = resolveSceneInterface(moduleNamespace, sceneFile);
      const canvas = PImage.make(dimensions.width, dimensions.height);
      const extension = options.mode === 'video' ? 'mp4' : options.imageFormat.toLowerCase();
      const outputFile = outputPathForScene(OUTPUT_ROOT, CONTENT_ROOT, sceneFile, extension);
      await fs.mkdir(path.dirname(outputFile), { recursive: true });

      activeStage = `render scene ${path.relative(CONTENT_ROOT, sceneFile)}`;
      if (options.mode === 'video') {
        await encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions, logger, scenePosition + 1, sceneCount);
      } else {
        await renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions, logger, scenePosition + 1, sceneCount);
      }
      completed += 1;
    } finally {
      await fs.rm(bundleFile, { force: true }).catch(() => {});
    }
  }

  const elapsedMs = performance.now() - jobStartedAt;
  logger.summary('Rendering completed successfully.');
  logger.summary(`Output: ${completed} file(s) saved in output/.`);
  if (options.mode === 'video') {
    logger.summary(`Video: ${options.duration}s | ${dimensions.width}x${dimensions.height} | ${options.fps} FPS | ${totalFrames} frames.`);
  } else {
    logger.summary(`Image: ${dimensions.width}x${dimensions.height} | ${options.imageFormat}.`);
  }
  logger.summary(`Elapsed: ${formatDuration(elapsedMs)}.`);
}

main().catch((error) => {
  if (activeLogger) activeLogger.error(error, { stage: error?.renderStage ?? activeStage });
  else process.stderr.write(`[renderer:error] ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
