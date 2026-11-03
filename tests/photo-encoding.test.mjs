import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';

let PImage;
try { PImage = await import('pureimage'); } catch { PImage = null; }

test('PureImage PNG and JPG exports produce recognizable file signatures', { skip: !PImage }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renderer-photo-'));
  const canvas = PImage.make(8, 8);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20dc60';
  ctx.fillRect(0, 0, 8, 8);

  const pngFile = path.join(root, 'sample.png');
  const png = createWriteStream(pngFile);
  await PImage.encodePNGToStream(canvas, png);
  await finished(png);
  const pngBytes = await fs.readFile(pngFile);
  assert.deepEqual([...pngBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const jpgFile = path.join(root, 'sample.jpg');
  const jpg = createWriteStream(jpgFile);
  await PImage.encodeJPEGToStream(canvas, jpg, 92);
  await finished(jpg);
  const jpgBytes = await fs.readFile(jpgFile);
  assert.deepEqual([...jpgBytes.subarray(0, 3)], [255, 216, 255]);
  await fs.rm(root, { recursive: true, force: true });
});
