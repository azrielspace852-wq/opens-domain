import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import {
  getImageDimensions,
  getVideoDimensions,
  outputPathForScene,
  packageNameFromSpecifier,
  parsePositiveNumber,
  readRenderOptions,
  scanContentFiles,
} from '../scripts/lib/config.mjs';

test('video dimensions follow landscape, portrait, and square aspect ratios', () => {
  assert.deepEqual(getVideoDimensions('1080p', '16:9'), { width: 1920, height: 1080 });
  assert.deepEqual(getVideoDimensions('1080p', '9:16'), { width: 1080, height: 1920 });
  assert.deepEqual(getVideoDimensions('720p', '1:1'), { width: 720, height: 720 });
  const evenDimensions = getVideoDimensions('480p', '16:9');
  assert.equal(evenDimensions.width % 2, 0);
  assert.equal(evenDimensions.height % 2, 0);
});

test('photo dimensions approximate the requested megapixel count', () => {
  const dimensions = getImageDimensions('12MP', '16:9');
  assert.ok(dimensions.width > dimensions.height);
  assert.ok(Math.abs(dimensions.actualMegapixels - 12) < 0.02);
});

test('package specifiers are normalized without built-in modules', () => {
  assert.equal(packageNameFromSpecifier('lodash/fp'), 'lodash');
  assert.equal(packageNameFromSpecifier('@scope/tool/subpath'), '@scope/tool');
  assert.equal(packageNameFromSpecifier('node:fs'), null);
  assert.equal(packageNameFromSpecifier('path'), null);
  assert.equal(packageNameFromSpecifier('./helper.js'), null);
  assert.equal(packageNameFromSpecifier('#internal-alias'), null);
});

test('output file keeps the subfolder path from content/', () => {
  const outputPath = outputPathForScene('/repo/output', '/repo/content', '/repo/content/campaign/spot.js', 'mp4');
  assert.equal(outputPath, path.join('/repo/output', 'campaign', 'spot.mp4'));
});

test('positive numeric values reject zero, negative, and non-numeric input', () => {
  assert.equal(parsePositiveNumber('2.5', 'Durasi'), 2.5);
  assert.throws(() => parsePositiveNumber('0', 'Durasi'));
  assert.throws(() => parsePositiveNumber('-1', 'Durasi'));
  assert.throws(() => parsePositiveNumber('abc', 'Durasi'));
});

test('render options can be read from environment and CLI arguments', () => {
  const options = readRenderOptions(
    { RENDER_MODE: 'photo', RENDER_ASPECT_RATIO: '1:1', RENDER_IMAGE_FORMAT: 'jpg' },
    ['--image-resolution', '48MP'],
  );
  assert.equal(options.mode, 'photo');
  assert.equal(options.aspectRatio, '1:1');
  assert.equal(options.imageFormat, 'JPG');
  assert.equal(options.imageResolution, '48MP');
});

test('content scanner recursively includes only .js files and skips symlinks', async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-render-test-'));
  const contentRoot = path.join(temporaryRoot, 'content');
  await fs.mkdir(path.join(contentRoot, 'nested'), { recursive: true });
  await fs.writeFile(path.join(contentRoot, 'scene.js'), 'export default {}');
  await fs.writeFile(path.join(contentRoot, 'nested', 'second.js'), 'export default {}');
  await fs.writeFile(path.join(contentRoot, 'ignored.jsx'), 'export default {}');
  await fs.writeFile(path.join(contentRoot, 'nested', 'ignored.ts'), 'export default {}');
  await fs.writeFile(path.join(contentRoot, 'nested', 'ignored.JS'), 'export default {}');
  await fs.symlink(path.join(contentRoot, 'scene.js'), path.join(contentRoot, 'linked-scene.js'));

  try {
    const results = await scanContentFiles(contentRoot);
    assert.deepEqual(results.map((file) => path.relative(contentRoot, file)), [
      'nested/second.js',
      'scene.js',
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
