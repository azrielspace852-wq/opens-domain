import path from 'node:path';
import { builtinModules } from 'node:module';

export const VIDEO_FPS_OPTIONS = Object.freeze([10, 20, 30, 60]);
export const VIDEO_RESOLUTION_OPTIONS = Object.freeze(['360p', '480p', '720p', '1080p', '2160p']);
export const ASPECT_RATIO_OPTIONS = Object.freeze(['16:9', '9:16', '1:1']);
export const IMAGE_RESOLUTION_OPTIONS = Object.freeze(['12MP', '24MP', '48MP', '108MP']);
export const IMAGE_FORMAT_OPTIONS = Object.freeze(['PNG', 'JPG']);

const VIDEO_HEIGHTS = Object.freeze({
  '360p': 360,
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '2160p': 2160,
});

const IMAGE_PIXELS = Object.freeze({
  '12MP': 12_000_000,
  '24MP': 24_000_000,
  '48MP': 48_000_000,
  '108MP': 108_000_000,
});

const BUILTIN_SET = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, '')]),
);

export function parseAspectRatio(value) {
  if (!ASPECT_RATIO_OPTIONS.includes(value)) {
    throw new Error(`Rasio aspek tidak valid: ${value}. Pilih salah satu: ${ASPECT_RATIO_OPTIONS.join(', ')}.`);
  }

  const [width, height] = value.split(':').map(Number);
  return width / height;
}

export function getVideoDimensions(resolution, aspectRatio) {
  const baseHeight = VIDEO_HEIGHTS[resolution];
  if (!baseHeight) {
    throw new Error(`Resolusi video tidak valid: ${resolution}.`);
  }

  const ratio = parseAspectRatio(aspectRatio);
  const even = (value) => Math.max(2, Math.round(value / 2) * 2);
  if (ratio >= 1) {
    return { width: even(baseHeight * ratio), height: even(baseHeight) };
  }

  return { width: even(baseHeight), height: even(baseHeight / ratio) };
}

export function getImageDimensions(resolution, aspectRatio) {
  const pixels = IMAGE_PIXELS[resolution];
  if (!pixels) {
    throw new Error(`Resolusi foto tidak valid: ${resolution}.`);
  }

  const ratio = parseAspectRatio(aspectRatio);
  const height = Math.round(Math.sqrt(pixels / ratio));
  const width = Math.round(height * ratio);

  return {
    width,
    height,
    actualMegapixels: (width * height) / 1_000_000,
  };
}

export function parsePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} harus berupa angka lebih besar dari 0.`);
  }
  return parsed;
}

export function packageNameFromSpecifier(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) return null;
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#') ||
    specifier.startsWith('file:') ||
    specifier.startsWith('data:') ||
    specifier.startsWith('http:') ||
    specifier.startsWith('https:')
  ) {
    return null;
  }

  if (specifier.startsWith('node:')) return null;
  const firstSegment = specifier.split('/')[0];
  if (BUILTIN_SET.has(firstSegment) || BUILTIN_SET.has(specifier)) return null;

  const segments = specifier.split('/');
  if (segments[0].startsWith('@')) {
    if (!segments[1]) return null;
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] || null;
}

export function outputPathForScene(outputRoot, contentRoot, sceneFile, extension) {
  const relative = path.relative(contentRoot, sceneFile);
  const parsed = path.parse(relative);
  return path.join(outputRoot, parsed.dir, `${parsed.name}.${extension}`);
}

export async function scanContentFiles(contentRoot) {
  const fs = await import('node:fs/promises');
  const found = [];

  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        found.push(fullPath);
      }
    }
  }

  await walk(contentRoot);
  return found;
}

export function readRenderOptions(env = process.env, argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, 'true');
    }
  }

  const read = (argName, envName, fallback) => args.get(argName) ?? env[envName] ?? fallback;
  const mode = read('mode', 'RENDER_MODE', 'video').toLowerCase();
  if (!['video', 'photo'].includes(mode)) {
    throw new Error('Mode harus "video" atau "photo".');
  }

  const aspectRatio = read('aspect-ratio', 'RENDER_ASPECT_RATIO', '16:9');
  parseAspectRatio(aspectRatio);

  const options = {
    mode,
    aspectRatio,
    fps: Number(read('fps', 'RENDER_FPS', '30')),
    videoResolution: read('video-resolution', 'RENDER_VIDEO_RESOLUTION', '1080p'),
    duration: parsePositiveNumber(read('duration', 'RENDER_DURATION', '5'), 'Durasi'),
    imageResolution: read('image-resolution', 'RENDER_IMAGE_RESOLUTION', '24MP'),
    imageFormat: read('image-format', 'RENDER_IMAGE_FORMAT', 'PNG').toUpperCase(),
    ffmpegPreset: read('ffmpeg-preset', 'FFMPEG_PRESET', 'veryfast'),
    ffmpegCrf: Number(read('ffmpeg-crf', 'FFMPEG_CRF', '18')),
    ffmpegThreads: Number(read('ffmpeg-threads', 'FFMPEG_THREADS', '0')),
  };

  if (!VIDEO_FPS_OPTIONS.includes(options.fps)) {
    throw new Error(`FPS tidak valid: ${options.fps}. Pilihan: ${VIDEO_FPS_OPTIONS.join(', ')}.`);
  }
  if (!VIDEO_RESOLUTION_OPTIONS.includes(options.videoResolution)) {
    throw new Error(`Resolusi video tidak valid: ${options.videoResolution}.`);
  }
  if (!IMAGE_RESOLUTION_OPTIONS.includes(options.imageResolution)) {
    throw new Error(`Resolusi foto tidak valid: ${options.imageResolution}.`);
  }
  if (!IMAGE_FORMAT_OPTIONS.includes(options.imageFormat)) {
    throw new Error('Format foto harus PNG atau JPG.');
  }
  if (!Number.isInteger(options.ffmpegCrf) || options.ffmpegCrf < 0 || options.ffmpegCrf > 51) {
    throw new Error('FFMPEG_CRF harus berupa bilangan bulat antara 0 dan 51.');
  }
  if (!Number.isInteger(options.ffmpegThreads) || options.ffmpegThreads < 0 || options.ffmpegThreads > 256) {
    throw new Error('FFMPEG_THREADS harus berupa bilangan bulat antara 0 dan 256.');
  }

  return options;
}
