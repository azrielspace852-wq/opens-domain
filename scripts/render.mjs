import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import * as PImage from 'pureimage';
import { PassThrough } from 'node:stream';
import { createWriteStream } from 'node:fs';
import * as esbuild from 'esbuild';

import {
  getImageDimensions,
  getVideoDimensions,
  outputPathForScene,
  packageNameFromSpecifier,
  readRenderOptions,
  scanContentFiles,
} from './lib/config.mjs';

const require = createRequire(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'output');
const CACHE_ROOT = path.join(PROJECT_ROOT, '.render-cache');

function log(message) {
  process.stdout.write(`[renderer] ${message}\n`);
}

function ensureFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('FFmpeg tidak ditemukan. Pasang FFmpeg dan pastikan perintah "ffmpeg" tersedia di PATH.');
  }
  log(result.stdout.split('\n')[0] || 'FFmpeg tersedia.');
}

function isPackageInstalled(packageName) {
  try {
    import.meta.resolve(packageName);
    return true;
  } catch {
    try {
      require.resolve(packageName, { paths: [PROJECT_ROOT] });
      return true;
    } catch {
      return false;
    }
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

async function installMissingDependencies(packageNames) {
  const missing = packageNames.filter((name) => !isPackageInstalled(name));
  if (missing.length === 0) {
    log(packageNames.length === 0
      ? 'Tidak ada paket npm tambahan yang digunakan oleh scene.'
      : 'Semua dependensi pihak ketiga sudah tersedia; tidak ada instalasi tambahan.');
    return;
  }

  log(`Dependensi terdeteksi otomatis: ${missing.join(', ')}`);
  log('Menginstal dependensi npm sebelum proses render...');

  await new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--', ...missing],
      { cwd: PROJECT_ROOT, stdio: 'inherit', shell: false },
    );

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Instalasi dependensi npm gagal (exit code ${code}).`));
    });
  });
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
    : exported && typeof exported === 'object'
      ? exported
      : {};

  const render = typeof moduleNamespace.render === 'function'
    ? moduleNamespace.render
    : candidate.render;
  const setup = typeof moduleNamespace.setup === 'function'
    ? moduleNamespace.setup
    : candidate.setup;
  const dispose = typeof moduleNamespace.dispose === 'function'
    ? moduleNamespace.dispose
    : candidate.dispose;

  if (typeof render !== 'function') {
    throw new Error(
      `${path.relative(PROJECT_ROOT, sceneFile)} wajib mengekspor fungsi render(ctx). ` +
      'Gunakan named export "render" atau default export berupa fungsi/objek yang memiliki properti render.',
    );
  }

  return { render, setup, dispose };
}

function resetCanvasForFrame(ctx, width, height, mode) {
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

function makeFrameContext({
  canvas,
  ctx,
  dimensions,
  options,
  frame,
  totalFrames,
  sceneFile,
  state,
}) {
  const time = options.mode === 'video' ? frame / options.fps : 0;
  return {
    canvas,
    ctx,
    width: dimensions.width,
    height: dimensions.height,
    mode: options.mode,
    fps: options.mode === 'video' ? options.fps : null,
    frame: options.mode === 'video' ? frame : 0,
    totalFrames: options.mode === 'video' ? totalFrames : 1,
    time,
    duration: options.mode === 'video' ? options.duration : 0,
    progress: options.mode === 'video' ? (totalFrames <= 1 ? 1 : frame / (totalFrames - 1)) : 1,
    aspectRatio: options.aspectRatio,
    contentFile: sceneFile,
    contentDirectory: path.dirname(sceneFile),
    state,
  };
}

async function renderOneFrame(scene, frameContext) {
  resetCanvasForFrame(frameContext.ctx, frameContext.width, frameContext.height, frameContext.mode);
  await scene.render(frameContext);
}

function waitForFfmpeg(child) {
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-12_000);
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg gagal (code=${code}, signal=${signal ?? 'none'}). ${stderr.trim()}`));
    });
  });
}

async function writeBuffer(stream, buffer) {
  await new Promise((resolve, reject) => {
    stream.write(buffer, (error) => error ? reject(error) : resolve());
  });
}

async function encodePngBuffer(canvas) {
  const output = new PassThrough();
  const chunks = [];
  output.on('data', (chunk) => chunks.push(chunk));
  const endPromise = once(output, 'end');
  await Promise.all([PImage.encodePNGToStream(canvas, output), endPromise]);
  return Buffer.concat(chunks);
}

async function encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions) {
  const totalFrames = Math.max(1, Math.ceil(options.duration * options.fps));
  const ffmpegArgs = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-framerate', String(options.fps),
    '-i', 'pipe:0',
    '-frames:v', String(totalFrames),
    '-an',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputFile,
  ];

  const child = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
  const closePromise = waitForFfmpeg(child);
  child.stdin.on('error', () => {});
  const ctx = canvas.getContext('2d');
  let state;

  try {
    const setupContext = makeFrameContext({
      canvas, ctx, dimensions, options, frame: 0, totalFrames,
      sceneFile, state: undefined,
    });
    if (scene.setup) state = await scene.setup(setupContext);

    const progressStep = Math.max(1, Math.floor(totalFrames / 10));
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const frameContext = makeFrameContext({
        canvas, ctx, dimensions, options, frame, totalFrames, sceneFile, state,
      });
      await renderOneFrame(scene, frameContext);
      const pngFrame = await encodePngBuffer(canvas);
      await writeBuffer(child.stdin, pngFrame);

      if ((frame + 1) % progressStep === 0 || frame === totalFrames - 1) {
        const percent = Math.round(((frame + 1) / totalFrames) * 100);
        log(`  ${path.basename(sceneFile)}: ${percent}% (${frame + 1}/${totalFrames} frame)`);
      }
    }

    child.stdin.end();
    await closePromise;
  } catch (error) {
    child.stdin.destroy();
    child.kill('SIGTERM');
    await closePromise.catch(() => {});
    throw error;
  } finally {
    if (scene.dispose) {
      await Promise.resolve(scene.dispose({ canvas, ctx, state, contentFile: sceneFile })).catch(() => {});
    }
  }
}

async function renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions) {
  const ctx = canvas.getContext('2d');
  let state;
  const frameContext = makeFrameContext({
    canvas, ctx, dimensions, options, frame: 0, totalFrames: 1,
    sceneFile, state: undefined,
  });

  try {
    if (scene.setup) state = await scene.setup(frameContext);
    await renderOneFrame(scene, { ...frameContext, state });
    const outputStream = createWriteStream(outputFile);
    if (options.imageFormat === 'JPG') {
      await PImage.encodeJPEGToStream(canvas, outputStream, 92);
    } else {
      await PImage.encodePNGToStream(canvas, outputStream);
    }
  } finally {
    if (scene.dispose) {
      await Promise.resolve(scene.dispose({ canvas, ctx, state, contentFile: sceneFile })).catch(() => {});
    }
  }
}

async function main() {
  const options = readRenderOptions();
  await fs.access(CONTENT_ROOT).catch(() => {
    throw new Error('Folder content/ tidak ditemukan. Buat folder content/ dan tambahkan minimal satu file .js.');
  });

  const sceneFiles = await scanContentFiles(CONTENT_ROOT);
  if (sceneFiles.length === 0) {
    throw new Error('Tidak ada file .js di content/. File TS, TSX, JSX, dan format lain tidak diproses.');
  }

  if (options.mode === 'video') ensureFfmpeg();

  log(`Mode: ${options.mode}`);
  log(`Ditemukan ${sceneFiles.length} file JavaScript di content/.`);

  const dependencies = new Set();
  for (const sceneFile of sceneFiles) {
    const detected = await inspectSceneDependencies(sceneFile);
    for (const packageName of detected) dependencies.add(packageName);
  }
  await installMissingDependencies([...dependencies]);

  await fs.rm(CACHE_ROOT, { recursive: true, force: true });
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(CACHE_ROOT, { recursive: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const dimensions = options.mode === 'video'
    ? getVideoDimensions(options.videoResolution, options.aspectRatio)
    : getImageDimensions(options.imageResolution, options.aspectRatio);

  if (options.mode === 'video') {
    log(`Video: ${dimensions.width}x${dimensions.height}, ${options.fps} FPS, ${options.duration} detik, MP4.`);
  } else {
    log(`Foto: ${dimensions.width}x${dimensions.height} (${dimensions.actualMegapixels.toFixed(2)} MP), ${options.imageFormat}.`);
  }

  let completed = 0;
  for (const sceneFile of sceneFiles) {
    const relative = path.relative(CONTENT_ROOT, sceneFile);
    log(`Memproses: ${relative}`);

    const bundleFile = await compileScene(sceneFile);
    const moduleNamespace = await import(`${pathToFileURL(bundleFile).href}?v=${Date.now()}-${completed}`);
    const scene = resolveSceneInterface(moduleNamespace, sceneFile);
    const canvas = PImage.make(dimensions.width, dimensions.height);

    const extension = options.mode === 'video'
      ? 'mp4'
      : options.imageFormat.toLowerCase();
    const outputFile = outputPathForScene(OUTPUT_ROOT, CONTENT_ROOT, sceneFile, extension);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    if (options.mode === 'video') {
      await encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions);
    } else {
      await renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions);
    }

    log(`Selesai: ${path.relative(PROJECT_ROOT, outputFile)}`);
    completed += 1;
  }

  log(`Render selesai. ${completed} file berhasil dibuat di output/.`);
}

main().catch((error) => {
  process.stderr.write(`\n[renderer:error] ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
