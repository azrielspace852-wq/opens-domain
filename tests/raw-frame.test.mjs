import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';

import { getRawRgbaBuffer, writeChunk } from '../scripts/lib/raw-frame.mjs';

test('raw RGBA view is zero-copy and has the expected byte length', () => {
  const backing = new Uint8Array(4 * 4 * 4 + 8);
  const data = backing.subarray(4, 4 + 4 * 4 * 4);
  const canvas = { width: 4, height: 4, data };
  const view = getRawRgbaBuffer(canvas, 4, 4);
  assert.equal(view.length, 64);
  view[0] = 255;
  assert.equal(data[0], 255);
});

test('raw RGBA view rejects unexpected dimensions and malformed pixel storage', () => {
  assert.throws(() => getRawRgbaBuffer({ width: 2, height: 2, data: new Uint8Array(16) }, 3, 2), /Dimensi canvas/);
  assert.throws(() => getRawRgbaBuffer({ width: 2, height: 2, data: new Uint8Array(15) }), /Ukuran buffer/);
  assert.throws(() => getRawRgbaBuffer({ width: 2, height: 2, data: [] }), /Uint8Array/);
});

test('writeChunk waits for the writable callback and propagates failures', async () => {
  const written = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      written.push(Buffer.from(chunk));
      callback();
    },
  });
  await writeChunk(writable, Buffer.from([1, 2, 3]));
  assert.deepEqual(written, [Buffer.from([1, 2, 3])]);
  writable.end();

  const failing = new Writable({
    write(chunk, encoding, callback) { callback(new Error('disk full')); },
  });
  await assert.rejects(writeChunk(failing, Buffer.from([1])), /disk full/);
});
