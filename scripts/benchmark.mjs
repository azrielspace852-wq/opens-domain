import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import * as PImage from 'pureimage';
import * as esbuild from 'esbuild';

import { getVideoDimensions, packageNameFromSpecifier } from './lib/config.mjs';
import { buildRawVideoArgs, checkFfmpegAvailable, validateFfmpegOptions } from './lib/ffmpeg.mjs';
import { getRawRgbaBuffer, writeChunk } from './lib/raw-frame.mjs';
import { renderSceneFrames } from './lib/render-frames.mjs';
import { createRendererLogger } from './lib/progress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'benchmarks', 'results');
let logger;

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    values.set(key, value);
  }
  const get = (key, fallback) => values.get(key) ?? fallback;
  const asNumber = (key, fallback) => {
    const value = Number(get(key, fallback));
    if (!Number.isFinite(value)) throw new Error(`Nilai --${key} harus berupa angka.`);
    return value;
  };
  const duration = asNumber('duration', 2);
  const fps = asNumber('fps', 30);
  const sourceDuration = asNumber('source-duration', 240);
  const startTime = asNumber('start-time', 0);
  const maxRawGb = asNumber('max-raw-gb', 1.5);
  if (duration <= 0 || fps <= 0 || sourceDuration <= 0 || startTime < 0 || maxRawGb <= 0) {
    throw new Error('Durasi, FPS, source-duration, dan max-raw-gb harus positif; start-time tidak boleh negatif.');
  }
  if (startTime + duration > sourceDuration + (1 / fps)) {
    throw new Error('--start-time + --duration tidak boleh melewati --source-duration.');
  }
  if (![10, 20, 30, 60].includes(fps)) throw new Error('FPS yang didukung: 10, 20, 30, 60.');
  const resolution = get('resolution', '720p');
  if (!['360p', '480p', '720p', '1080p', '2160p'].includes(resolution)) {
    throw new Error('Resolusi yang didukung: 360p, 480p, 720p, 1080p, 2160p.');
  }
  return {
    file: path.resolve(ROOT, get('file', 'benchmarks/fixtures/part-02-des.js')),
    duration, fps, sourceDuration, startTime, maxRawGb,
    resolution,
    aspectRatio: get('aspect-ratio', '16:9'),
    preset: get('ffmpeg-preset', 'veryfast'),
    crf: asNumber('ffmpeg-crf', 18),
    threads: asNumber('ffmpeg-threads', 0),
    renderOnly: values.get('render-only') === 'true',
    keepRaw: values.get('keep-raw') === 'true',
    keepOutput: values.get('keep-output') === 'true',
  };
}

function resolveScene(moduleNamespace) {
  const exported = moduleNamespace.default;
  const candidate = typeof exported === 'function'
    ? { render: exported }
    : exported && typeof exported === 'object' ? exported : {};
  const scene = {
    render: typeof moduleNamespace.render === 'function' ? moduleNamespace.render : candidate.render,
    setup: typeof moduleNamespace.setup === 'function' ? moduleNamespace.setup : candidate.setup,
    dispose: typeof moduleNamespace.dispose === 'function' ? moduleNamespace.dispose : candidate.dispose,
  };
  if (typeof scene.render !== 'function') throw new Error('File benchmark tidak mengekspor render(params).');
  return scene;
}

async function compileScene(file) {
  const result = await esbuild.build({
    absWorkingDir: ROOT, entryPoints: [file], bundle: true, packages: 'external',
    platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true, logLevel: 'silent',
  });
  for (const input of Object.values(result.metafile?.inputs ?? {})) {
    for (const imported of input.imports ?? []) {
      if (imported.external) {
        const packageName = packageNameFromSpecifier(imported.path);
        if (packageName) {
          try { import.meta.resolve(packageName); }
          catch { throw new Error(`Dependensi scene belum terpasang: ${packageName}. Jalankan npm install terlebih dahulu.`); }
        }
      }
    }
  }
  const outfile = path.join(RESULTS, `.benchmark-bundle-${process.pid}.mjs`);
  await fs.writeFile(outfile, result.outputFiles[0].text, 'utf8');
  return outfile;
}

async function readLinuxPeakRssBytes(pid) {
  if (!pid || process.platform !== 'linux') return null;
  try {
    const status = await fs.readFile(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/^VmHWM:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

async function runFfmpegFile(rawFile, outputFile, dimensions, config, frames) {
  const args = buildRawVideoArgs({
    width: dimensions.width, height: dimensions.height, fps: config.fps,
    outputFile, frames, preset: config.preset, crf: config.crf,
    threads: config.threads, input: rawFile, logLevel: 'error',
  });
  const started = performance.now();
  let peakRssBytes = null;
  let stderr = '';
  let samplePending = false;
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
    const sample = async () => {
      if (samplePending) return;
      samplePending = true;
      try {
        const value = await readLinuxPeakRssBytes(child.pid);
        if (value != null) peakRssBytes = Math.max(peakRssBytes ?? 0, value);
      } finally { samplePending = false; }
    };
    const monitor = setInterval(sample, 200);
    monitor.unref?.();
    child.once('error', (error) => {
      clearInterval(monitor);
      reject(error);
    });
    child.once('close', async (code, signal) => {
      clearInterval(monitor);
      await sample();
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg benchmark gagal (exit=${code}, signal=${signal ?? 'none'}): ${stderr.trim()}`));
    });
  });
  return { elapsedMs: performance.now() - started, peakRssBytes };
}

function printUsage() {
  process.stdout.write(`\nBenchmark renderer (contoh):\n` +
    `  npm run benchmark -- --resolution 720p --fps 30 --duration 3 --start-time 65\n` +
    `  npm run benchmark -- --resolution 1080p --fps 30 --duration 240 --render-only\n\n` +
    `Opsi: --file path --duration detik --start-time detik --source-duration detik\n` +
    `      --resolution 360p|480p|720p|1080p|2160p --fps 10|20|30|60\n` +
    `      --aspect-ratio 16:9|9:16|1:1 --render-only --max-raw-gb 1.5\n` +
    `      --ffmpeg-preset veryfast --ffmpeg-crf 18 --ffmpeg-threads 0\n`);
}

async function main() {
  logger = createRendererLogger();
  if (process.argv.includes('--help')) { printUsage(); return; }
  const config = parseArgs(process.argv.slice(2));
  validateFfmpegOptions({ preset: config.preset, crf: config.crf, threads: config.threads });
  await fs.access(config.file);
  await fs.mkdir(RESULTS, { recursive: true });
  const dimensions = getVideoDimensions(config.resolution, config.aspectRatio);
  const frames = Math.ceil(config.duration * config.fps);
  const bytesPerFrame = dimensions.width * dimensions.height * 4;
  const rawBytes = bytesPerFrame * frames;
  const maxRawBytes = config.maxRawGb * 1024 ** 3;
  if (!config.renderOnly) {
    const stat = await fs.statfs(RESULTS);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    if (rawBytes > maxRawBytes) {
      throw new Error(`Benchmark ini memerlukan ${(rawBytes / 1024 ** 3).toFixed(2)} GiB untuk frame RGBA, melewati --max-raw-gb ${config.maxRawGb}. Gunakan --render-only atau naikkan batas secara sadar.`);
    }
    if (rawBytes > freeBytes * 0.8) {
      throw new Error(`Ruang disk tidak cukup aman: perlu ${(rawBytes / 1024 ** 3).toFixed(2)} GiB; ruang bebas ${(freeBytes / 1024 ** 3).toFixed(2)} GiB.`);
    }
    logger.verbose(checkFfmpegAvailable());
  }
  logger.start('Starting renderer benchmark...');
  logger.beginScene({ label: path.basename(config.file), totalFrames: frames });
  log(`Benchmark ${path.relative(ROOT, config.file)} | ${dimensions.width}x${dimensions.height} | ${config.fps} FPS | ${config.duration}s (${frames} frame) | start ${config.startTime}s.`);
  log(`Buffer RGBA/frame ${(bytesPerFrame / 1024 / 1024).toFixed(2)} MiB; total sample ${(rawBytes / 1024 ** 3).toFixed(2)} GiB${config.renderOnly ? ' (render-only)' : ''}.`);

  const reportId = `${Date.now()}-${process.pid}`;
  const rawFile = path.join(RESULTS, `.${reportId}.rgba`);
  const outputFile = path.join(RESULTS, `.${reportId}.mp4`);
  let bundleFile;
  let rawStream;
  let renderStats;
  let rawSpoolMs = 0;
  let ffmpegEncodeMs = null;
  let ffmpegPeakRssBytes = null;
  let reportFile;
  let succeeded = false;

  try {
    bundleFile = await compileScene(config.file);
    const moduleNamespace = await import(`${pathToFileURL(bundleFile).href}?id=${reportId}`);
    const scene = resolveScene(moduleNamespace);
    const canvas = PImage.make(dimensions.width, dimensions.height);
    const options = {
      mode: 'video', fps: config.fps, duration: config.sourceDuration,
      sourceDuration: config.sourceDuration, aspectRatio: config.aspectRatio,
    };
    const processCpuStart = process.cpuUsage();
    const processStartedAt = performance.now();
    if (!config.renderOnly) rawStream = createWriteStream(rawFile, { highWaterMark: 1024 * 1024 });

    try {
      renderStats = await renderSceneFrames({
        canvas, scene, sceneFile: config.file, options, dimensions,
        frameCount: frames, startTime: config.startTime,
        onFrame: async () => {
          if (!rawStream) return;
          const rawFrame = getRawRgbaBuffer(canvas, dimensions.width, dimensions.height);
          const before = performance.now();
          await writeChunk(rawStream, rawFrame);
          rawSpoolMs += performance.now() - before;
        },
        onProgress: (completed, total) => logger.onFrame(completed, total),
        onWarning: (message) => logger.warn(message),
      });
      if (rawStream) {
        rawStream.end();
        await finished(rawStream);
        rawStream = null;
      }
    } catch (error) {
      rawStream?.destroy();
      rawStream = null;
      throw error;
    }

    logger.finalizing();
    logger.completeScene();
    if (!config.renderOnly) {
      logger.verbose('Mengukur FFmpeg secara terpisah dari waktu render JavaScript...');
      const ffmpegStats = await runFfmpegFile(rawFile, outputFile, dimensions, config, frames);
      ffmpegEncodeMs = ffmpegStats.elapsedMs;
      ffmpegPeakRssBytes = ffmpegStats.peakRssBytes;
    }

    const wallMs = performance.now() - processStartedAt;
    const processCpu = process.cpuUsage(processCpuStart);
    const cpuMs = (processCpu.user + processCpu.system) / 1000;
    const report = {
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(ROOT, config.file),
      node: process.version,
      ffmpeg: config.renderOnly ? null : checkFfmpegAvailable(),
      cpuCores: os.cpus().length,
      config: { ...config, file: path.relative(ROOT, config.file) },
      dimensions,
      frames,
      bytesPerFrame,
      rawSampleBytes: config.renderOnly ? null : rawBytes,
      measurements: {
        javascriptRenderMs: renderStats.renderMs,
        javascriptRenderFps: renderStats.renderFps,
        renderAndSpoolWallMs: renderStats.elapsedMs,
        frameSinkCallbackMs: renderStats.callbackMs,
        rawDiskSpoolMs: config.renderOnly ? null : rawSpoolMs,
        ffmpegEncodeMs,
        benchmarkWallMs: wallMs,
        nodeProcessCpuMs: cpuMs,
        nodeProcessCpuPercentOfOneCore: wallMs > 0 ? (cpuMs / wallMs) * 100 : 0,
        nodePeakRssBytes: process.resourceUsage().maxRSS * 1024,
        ffmpegPeakRssBytes: ffmpegPeakRssBytes ?? null,
      },
      notes: [
        'javascriptRenderMs mengukur reset canvas dan render(params), tidak termasuk penulisan file RGBA.',
        'ffmpegEncodeMs mengukur pass encoding terpisah dari file RGBA yang sama.',
        'renderAndSpoolWallMs termasuk transfer ke raw file; tidak sama dengan waktu pipeline streaming langsung.',
        'frameSinkCallbackMs mengukur waktu tunggu callback sink per frame; termasuk transfer data ke file raw jika mode bukan render-only.',
        'Benchmark sample singkat tidak menjamin performa linear untuk 7.200 frame.',
      ],
    };

    reportFile = path.join(RESULTS, `benchmark-${reportId}.json`);
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    logger.summary(`JavaScript render: ${(renderStats.renderMs / 1000).toFixed(2)}s (${renderStats.renderFps.toFixed(2)} FPS).`);
    if (ffmpegEncodeMs != null) logger.summary(`FFmpeg encode: ${(ffmpegEncodeMs / 1000).toFixed(2)}s.`);
    logger.summary(`Peak RSS Node: ${(report.measurements.nodePeakRssBytes / 1024 / 1024).toFixed(1)} MiB.`);
    if (report.measurements.ffmpegPeakRssBytes != null) logger.summary(`Peak RSS FFmpeg: ${(report.measurements.ffmpegPeakRssBytes / 1024 / 1024).toFixed(1)} MiB.`);
    logger.summary(`Laporan: ${path.relative(ROOT, reportFile)}`);
    succeeded = true;
  } finally {
    if (rawStream) {
      rawStream.destroy();
      await finished(rawStream).catch(() => {});
    }
    if (!config.keepRaw || !succeeded) await fs.rm(rawFile, { force: true });
    if (!config.keepOutput || !succeeded) await fs.rm(outputFile, { force: true });
    if (bundleFile) await fs.rm(bundleFile, { force: true });
  }
}

function log(message) { logger?.info(message); }

main().then(() => {
  if (logger) logger.summary('Benchmark completed successfully.');
}).catch((error) => {
  if (logger) logger.error(error, { stage: 'benchmark / JavaScript rendering / FFmpeg encoding' });
  else process.stderr.write(`[benchmark:error] ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
