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

const require = createRequire(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'output');
const CACHE_ROOT = path.join(PROJECT_ROOT, '.render-cache');

function log(message) {
  process.stdout.write(`[renderer] ${message}\n`);
}

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
    const child = spawn('npm', ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--', ...missing], {
      cwd: PROJECT_ROOT, stdio: 'inherit', shell: false,
    });
    child.once('error', reject);
    child.once('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`Instalasi dependensi npm gagal (exit code ${code}).`)));
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

function logProgress(info) {
  const percent = info.percent.toFixed(1);
  const fps = info.averageFps.toFixed(2);
  const eta = formatDuration(info.etaMs);
  log(
    `${info.stage} | ${info.scene} | frame ${info.frame}/${info.totalFrames} ` +
    `(${percent}%) | elapsed ${formatDuration(info.elapsedMs)} | avg ${fps} FPS | ETA ${eta}`,
  );
}

async function encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions) {
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
  const encoder = startFfmpeg({
    args,
    label: `FFmpeg ${path.basename(sceneFile)}`,
    onProgress: (value) => {
      if (value.speed) log(`FFmpeg encoder: output ${value.outputTimeSeconds.toFixed(1)}s, speed ${value.speed}.`);
    },
  });

  let frameStats;
  try {
    frameStats = await renderSceneFrames({
      canvas, scene, sceneFile, options, dimensions, frameCount: totalFrames,
      onFrame: async () => encoder.writeFrame(frameBuffer),
      onProgress: logProgress,
    });
    log(`Tahap render JS selesai: ${frameStats.renderMs.toFixed(0)} ms; render-only ${frameStats.renderFps.toFixed(2)} FPS.`);
    log('Tahap FFmpeg: menyelesaikan encoding dan menutup MP4...');
    const encoderStats = await encoder.finish();
    await fs.rm(outputFile, { force: true });
    await fs.rename(partialFile, outputFile);
    log(`Proses FFmpeg aktif selama ${formatDuration(encoderStats.elapsedMs)} (termasuk waktu menerima frame secara paralel dengan render JavaScript).`);
    log(`Pipeline video selesai: ${frameStats.frames} frame; wall time ${formatDuration(frameStats.elapsedMs)}; throughput end-to-end ${frameStats.averageFps.toFixed(2)} FPS.`);
  } catch (error) {
    await encoder.abort().catch(() => {});
    await fs.rm(partialFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions) {
  await renderSceneFrames({ canvas, scene, sceneFile, options, dimensions, frameCount: 1 });
  const outputStream = createWriteStream(outputFile);
  try {
    if (options.imageFormat === 'JPG') await PImage.encodeJPEGToStream(canvas, outputStream, 92);
    else await PImage.encodePNGToStream(canvas, outputStream);
    await finished(outputStream);
  } catch (error) {
    outputStream.destroy();
    await fs.rm(outputFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function main() {
  const options = readRenderOptions();
  validateFfmpegOptions({ preset: options.ffmpegPreset, crf: options.ffmpegCrf, threads: options.ffmpegThreads });
  await fs.access(CONTENT_ROOT).catch(() => {
    throw new Error('Folder content/ tidak ditemukan. Buat folder content/ dan tambahkan minimal satu file .js.');
  });
  const sceneFiles = await scanContentFiles(CONTENT_ROOT);
  if (sceneFiles.length === 0) {
    throw new Error('Tidak ada file .js di content/. File TS, TSX, JSX, dan format lain tidak diproses.');
  }
  if (options.mode === 'video') log(checkFfmpegAvailable());
  log(`Mode: ${options.mode}`);
  log(`Ditemukan ${sceneFiles.length} file JavaScript di content/.`);

  const dependencies = new Set();
  for (const sceneFile of sceneFiles) {
    for (const packageName of await inspectSceneDependencies(sceneFile)) dependencies.add(packageName);
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
    log(`Video: ${dimensions.width}x${dimensions.height}, ${options.fps} FPS, ${options.duration} detik, ${Math.ceil(options.duration * options.fps)} frame, MP4.`);
    log(`Encoder: libx264 preset=${options.ffmpegPreset}, CRF=${options.ffmpegCrf}, threads=${options.ffmpegThreads || 'auto'}.`);
    log(`Buffer mentah per frame: ${(dimensions.width * dimensions.height * 4 / 1024 / 1024).toFixed(2)} MiB (satu buffer dipakai ulang).`);
  } else {
    log(`Foto: ${dimensions.width}x${dimensions.height} (${dimensions.actualMegapixels.toFixed(2)} MP), ${options.imageFormat}.`);
  }

  let completed = 0;
  for (const sceneFile of sceneFiles) {
    const relative = path.relative(CONTENT_ROOT, sceneFile);
    log(`Memproses scene: ${relative}`);
    const bundleFile = await compileScene(sceneFile);
    const moduleNamespace = await import(`${pathToFileURL(bundleFile).href}?v=${Date.now()}-${completed}`);
    const scene = resolveSceneInterface(moduleNamespace, sceneFile);
    const canvas = PImage.make(dimensions.width, dimensions.height);
    const extension = options.mode === 'video' ? 'mp4' : options.imageFormat.toLowerCase();
    const outputFile = outputPathForScene(OUTPUT_ROOT, CONTENT_ROOT, sceneFile, extension);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    if (options.mode === 'video') await encodeVideo(canvas, scene, sceneFile, options, outputFile, dimensions);
    else await renderPhoto(canvas, scene, sceneFile, options, outputFile, dimensions);
    log(`Selesai: ${path.relative(PROJECT_ROOT, outputFile)}`);
    completed += 1;
  }
  log(`Render selesai. ${completed} file berhasil dibuat di output/.`);
}

main().catch((error) => {
  process.stderr.write(`\n[renderer:error] ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
