import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const fixture = path.resolve('benchmarks/fixtures/part-02-des.js');
const source = await fs.readFile(fixture, 'utf8');

test('production scene fixture passes Node syntax validation', () => {
  const result = spawnSync(process.execPath, ['--check', fixture], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('production scene preserves 11 scenes and the setup/render/dispose lifecycle', () => {
  assert.match(source, /export\s+async\s+function\s+setup\s*\(/);
  assert.match(source, /export\s+function\s+render\s*\(/);
  assert.match(source, /export\s+function\s+dispose\s*\(/);
  const timelineBlock = source.match(/const SCENES\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(timelineBlock, 'timeline SCENES must exist');
  assert.equal((timelineBlock[1].match(/\{\s*start:/g) ?? []).length, 11);
});

test('production scene retains major visual subsystems and adds bounded per-context caches', () => {
  for (const feature of ['drawAzriel', 'drawBackground', 'drawCaptions', 'drawHUD', 'drawOverlays']) {
    assert.match(source, new RegExp(`function ${feature}\\(`));
  }
  assert.match(source, /BACKGROUND_GRADIENT_CACHE/);
  assert.match(source, /CAPTION_LAYOUT_CACHE/);
  assert.match(source, /MATRIX_SEED_CACHE/);
});
