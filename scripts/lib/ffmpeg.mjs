import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export const FFMPEG_PRESETS = Object.freeze(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium']);

export function validateFfmpegOptions({ preset = 'veryfast', crf = 18, threads = 0 } = {}) {
  if (!FFMPEG_PRESETS.includes(preset)) {
    throw new Error(`Preset FFmpeg tidak valid: ${preset}. Pilihan: ${FFMPEG_PRESETS.join(', ')}.`);
  }
  const quality = Number(crf);
  if (!Number.isInteger(quality) || quality < 0 || quality > 51) {
    throw new Error('CRF FFmpeg harus berupa bilangan bulat antara 0 dan 51.');
  }
  const threadCount = Number(threads);
  if (!Number.isInteger(threadCount) || threadCount < 0 || threadCount > 256) {
    throw new Error('Jumlah thread FFmpeg harus berupa bilangan bulat antara 0 dan 256.');
  }
  return { preset, crf: quality, threads: threadCount };
}

export function buildRawVideoArgs({
  width, height, fps, outputFile, frames, preset = 'veryfast', crf = 18,
  threads = 0, input = 'pipe:0', logLevel = 'error', progress = false,
}) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('Dimensi input raw video tidak valid.');
  }
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('FPS input raw video tidak valid.');
  if (frames != null && (!Number.isInteger(frames) || frames <= 0)) {
    throw new Error('Jumlah frame FFmpeg harus berupa bilangan bulat positif.');
  }
  const settings = validateFfmpegOptions({ preset, crf, threads });
  const args = [
    '-hide_banner', '-loglevel', logLevel, '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba',
    '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', input,
  ];
  if (frames != null) args.push('-frames:v', String(frames));
  args.push(
    '-an', '-c:v', 'libx264', '-preset', settings.preset, '-crf', String(settings.crf),
    '-pix_fmt', 'yuv420p', '-threads', String(settings.threads), '-movflags', '+faststart',
  );
  if (progress) args.push('-nostats', '-stats_period', '5', '-progress', 'pipe:2');
  args.push(outputFile);
  return args;
}

export function checkFfmpegAvailable() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('FFmpeg tidak ditemukan. Pasang FFmpeg dan pastikan perintah "ffmpeg" tersedia di PATH.');
  }
  return result.stdout.split('\n')[0] || 'FFmpeg tersedia.';
}

function parseProgressLine(line, snapshot) {
  const separator = line.indexOf('=');
  if (separator < 1) return false;
  const key = line.slice(0, separator);
  const value = line.slice(separator + 1).trim();
  if (key === 'out_time_us' || key === 'out_time_ms') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) snapshot.outputTimeSeconds = numeric / 1_000_000;
    return true;
  }
  if (key === 'speed') { snapshot.speed = value; return true; }
  if (key === 'progress') { snapshot.state = value; return true; }
  return ['frame', 'fps', 'bitrate', 'total_size', 'dup_frames', 'drop_frames'].includes(key);
}

export function startFfmpeg({ args, onProgress, label = 'FFmpeg' }) {
  const startedAt = performance.now();
  const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  const progress = { outputTimeSeconds: 0, speed: null, state: 'starting' };
  let stderrTail = '';
  let progressBuffer = '';
  let spawnError = null;
  let stdinError = null;
  child.stdin.on('error', (error) => { stdinError = error; });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    progressBuffer += chunk;
    const lines = progressBuffer.split(/\r?\n/);
    progressBuffer = lines.pop() ?? '';
    let changed = false;
    for (const line of lines) {
      const handled = parseProgressLine(line, progress);
      if (handled) changed = true;
      else if (line.trim()) stderrTail = `${stderrTail}${line}\n`.slice(-12_000);
    }
    if (changed && onProgress) onProgress({ ...progress, elapsedMs: performance.now() - startedAt });
  });
  child.once('error', (error) => { spawnError = error; });
  const closed = new Promise((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  return {
    child,
    progress,
    elapsed: () => performance.now() - startedAt,
    async writeFrame(buffer) {
      if (spawnError) throw spawnError;
      if (stdinError) throw stdinError;
      if (child.stdin.destroyed || !child.stdin.writable) {
        throw new Error(`${label}: pipe stdin sudah tertutup sebelum seluruh frame dikirim.`);
      }
      await new Promise((resolve, reject) => {
        try {
          // Do not reuse the canvas buffer until Node confirms this write is flushed.
          child.stdin.write(buffer, (error) => {
            const failure = error ?? stdinError;
            if (failure) reject(failure);
            else resolve();
          });
        } catch (error) { reject(error); }
      });
    },
    async finish() {
      if (!child.stdin.destroyed && child.stdin.writable) child.stdin.end();
      const result = await closed;
      if (spawnError) throw spawnError;
      if (result.code !== 0) {
        throw new Error(`${label} gagal (exit=${result.code}, signal=${result.signal ?? 'none'}). ${stderrTail.trim()}`);
      }
      return { elapsedMs: performance.now() - startedAt, progress: { ...progress } };
    },
    async abort() {
      if (child.exitCode == null && child.signalCode == null) {
        child.stdin.destroy();
        child.kill('SIGTERM');
        const killTimer = setTimeout(() => {
          if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL');
        }, 5000);
        killTimer.unref?.();
        await closed;
        clearTimeout(killTimer);
      } else await closed;
    },
  };
}
