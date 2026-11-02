#!/usr/bin/env node
/**
 * Part 2 — Jenis-Jenis Enkripsi: DES
 * Pure JavaScript motion graphics renderer.
 *
 * Stack:
 * - Node.js
 * - node-canvas untuk menggambar frame
 * - FFmpeg untuk encoding MP4
 *
 * Tidak memakai Chromium, Puppeteer, Playwright, atau Remotion.
 */

'use strict';

const { createCanvas } = require('canvas');
const { spawn } = require('child_process');
const path = require('path');

/* ============================================================
 * CLI ARGUMENTS
 * ============================================================ */

function parseArgs(argv) {
  const args = {
    output: 'part-02-jenis-jenis-enkripsi-des.mp4',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 240,
    silentAudio: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output') {
      args.output = argv[i + 1];
      i += 1;
    } else if (arg === '--width') {
      args.width = parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--height') {
      args.height = parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--fps') {
      args.fps = parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--duration') {
      args.duration = parseFloat(argv[i + 1]);
      i += 1;
    } else if (arg === '--no-silent-audio') {
      args.silentAudio = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node render-video.js [options]

Options:
  --output <file>       Output MP4 file name
  --width <px>          Frame width, default 1080
  --height <px>         Frame height, default 1920
  --fps <n>             Frames per second, default 30
  --duration <seconds>  Video duration, default 240
  --no-silent-audio     Do not add silent AAC track
`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.width) || args.width <= 0) args.width = 1080;
  if (!Number.isFinite(args.height) || args.height <= 0) args.height = 1920;
  if (!Number.isFinite(args.fps) || args.fps <= 0) args.fps = 30;
  if (!Number.isFinite(args.duration) || args.duration <= 0) args.duration = 240;

  return args;
}

const OPTS = parseArgs(process.argv);

const W = OPTS.width;
const H = OPTS.height;
const FPS = OPTS.fps;
const DURATION = OPTS.duration;
const TOTAL_FRAMES = Math.max(1, Math.round(DURATION * FPS));

/* ============================================================
 * THEME / CONSTANTS
 * ============================================================ */

const FONT = 'DejaVu Sans Mono';

const COLOR = {
  bgTop: '#020a05',
  bgBottom: '#010403',
  neon: '#00ff7a',
  neonSoft: 'rgba(0,255,122,0.75)',
  neonDim: 'rgba(0,255,122,0.32)',
  text: '#eafff3',
  textDim: 'rgba(234,255,243,0.72)',
  panel: 'rgba(3,20,12,0.88)',
  panelStroke: 'rgba(0,255,122,0.62)',
  danger: '#ff5468',
  warning: '#ffd75e',
  cyan: '#69f0ff',
};

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@<>/\\|*+=?:;'.split('');

/* ============================================================
 * SMALL UTILITIES
 * ============================================================ */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setFont(ctx, px, weight = 700) {
  ctx.font = `${weight} ${Math.round(px)}px "${FONT}", monospace`;
}

function setTextStyle(ctx, {
  px = 30,
  weight = 700,
  color = COLOR.text,
  align = 'center',
  baseline = 'middle',
  alpha = 1,
  glow = 0,
  glowColor = COLOR.neon,
} = {}) {
  setFont(ctx, px, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (glow > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow;
  } else {
    ctx.shadowBlur = 0;
  }
}

function resetAlphaShadow(ctx) {
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawChip(ctx, x, y, text, {
  px = 26,
  color = COLOR.neon,
  alpha = 1,
  bg = COLOR.panel,
  stroke = COLOR.panelStroke,
  glow = 10,
  weight = 700,
} = {}) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  setFont(ctx, px, weight);
  const tw = ctx.measureText(text).width;
  const w = tw + px * 1.5;
  const h = px * 1.9;

  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = glow;
  ctx.fillStyle = bg;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineWidth = Math.max(2, px * 0.08);
  ctx.strokeStyle = stroke;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + px * 0.04);
  ctx.restore();
}

function drawPanel(ctx, x, y, w, h, {
  alpha = 1,
  radius = 28,
  bg = COLOR.panel,
  stroke = COLOR.panelStroke,
  glow = 16,
} = {}) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = glow;
  ctx.fillStyle = bg;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.stroke();
  ctx.restore();
}

function drawScanlines(ctx, alpha = 0.05) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 6) {
    ctx.fillRect(0, y, W, 2);
  }
  ctx.restore();
}

/* ============================================================
 * MATRIX RAIN BACKGROUND
 * ============================================================ */

const RAIN_CELL = 28;
const RAIN_COLS = Math.ceil(W / RAIN_CELL);
const rainRng = mulberry32(20261102);

const RAIN = [];
for (let c = 0; c < RAIN_COLS; c += 1) {
  const trail = 5 + Math.floor(rainRng() * 8);
  const chars = [];
  for (let i = 0; i < trail + 2; i += 1) {
    chars.push(GLYPHS[Math.floor(rainRng() * GLYPHS.length)]);
  }
  RAIN.push({
    x: c * RAIN_CELL + RAIN_CELL * 0.5,
    speed: 45 + rainRng() * 170,
    offset: rainRng() * H * 2,
    trail,
    chars,
  });
}

function drawBackground(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLOR.bgTop);
  grad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  setFont(ctx, 20, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const totalH = H + 30 * RAIN_CELL;

  for (const col of RAIN) {
    const headY = (col.offset + t * col.speed) % totalH;
    for (let i = 0; i < col.trail; i += 1) {
      const y = headY - i * RAIN_CELL;
      if (y < -RAIN_CELL || y > H + RAIN_CELL) continue;
      const ch = col.chars[i % col.chars.length];
      const fade = 1 - i / col.trail;

      if (i === 0) {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#baffdc';
      } else {
        ctx.globalAlpha = 0.06 + fade * 0.24;
        ctx.fillStyle = COLOR.neon;
      }
      ctx.fillText(ch, col.x, y);
    }
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(
    W / 2, H * 0.45, H * 0.18,
    W / 2, H * 0.45, H * 0.78
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/* ============================================================
 * CHARACTER: AZRIEL
 * ============================================================
 * Avatar cyber/hologram: hoodie gelap, visor hijau neon,
 * headphone, mata digital, mulut animasi bicara.
 */

function drawAzriel(ctx, {
  x,
  y,
  s = 1,
  t = 0,
  talking = false,
  wave = 0,
  thumb = 0,
  alpha = 1,
} = {}) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);
  ctx.scale(s, s);

  const bob = Math.sin(t * 2.2) * 4;
  ctx.translate(0, bob);

  // Legs
  ctx.fillStyle = '#04170f';
  roundRectPath(ctx, -36, -6, 26, 36, 9);
  ctx.fill();
  roundRectPath(ctx, 10, -6, 26, 36, 9);
  ctx.fill();

  // Hoodie body
  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#07231a';
  roundRectPath(ctx, -58, -100, 116, 100, 28);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 3;
  roundRectPath(ctx, -58, -100, 116, 100, 28);
  ctx.stroke();

  // Zipper
  ctx.strokeStyle = COLOR.neonDim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -94);
  ctx.lineTo(0, -10);
  ctx.stroke();

  // Left arm idle
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#07231a';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(-50, -82);
  ctx.quadraticCurveTo(-68, -52, -60, -24);
  ctx.stroke();

  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-50, -82);
  ctx.quadraticCurveTo(-68, -52, -60, -24);
  ctx.stroke();

  // Right arm
  ctx.save();
  ctx.translate(50, -82);

  let armAngle = 0.9;
  if (wave > 0) {
    armAngle = -1.85 + Math.sin(t * 7) * 0.45 * wave;
  } else if (thumb > 0) {
    armAngle = -2.2;
  }

  ctx.rotate(armAngle);

  ctx.strokeStyle = '#07231a';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 46);
  ctx.stroke();

  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 46);
  ctx.stroke();

  // Hand
  ctx.fillStyle = '#0b2f21';
  ctx.beginPath();
  ctx.arc(0, 54, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (thumb > 0) {
    ctx.fillStyle = '#0b2f21';
    roundRectPath(ctx, -5, 26, 10, 20, 5);
    ctx.fill();
    ctx.strokeStyle = COLOR.neonSoft;
    ctx.lineWidth = 2;
    roundRectPath(ctx, -5, 26, 10, 20, 5);
    ctx.stroke();
  }

  ctx.restore();

  // Head group
  ctx.save();
  ctx.translate(0, -132);

  // Hood back
  ctx.fillStyle = '#052015';
  ctx.beginPath();
  ctx.arc(0, -6, 48, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#0a2d20';
  ctx.beginPath();
  ctx.arc(0, 0, 39, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 39, 0, Math.PI * 2);
  ctx.stroke();

  // Visor
  ctx.fillStyle = '#02130a';
  roundRectPath(ctx, -28, -15, 56, 21, 9);
  ctx.fill();
  ctx.strokeStyle = COLOR.neonDim;
  ctx.lineWidth = 2;
  roundRectPath(ctx, -28, -15, 56, 21, 9);
  ctx.stroke();

  // Eyes
  const blink = Math.sin(t * 0.9) > 0.985 ? 0.2 : 1;
  ctx.fillStyle = '#43ffa4';
  ctx.fillRect(-19, -9, 11, 7 * blink);
  ctx.fillRect(8, -9, 11, 7 * blink);

  // Headphones
  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -6, 46, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = '#062012';
  ctx.beginPath();
  ctx.arc(-42, 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(42, 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Mouth
  ctx.fillStyle = '#43ffa4';
  if (talking) {
    const mouth = 2 + Math.abs(Math.sin(t * 9)) * 8;
    ctx.beginPath();
    ctx.ellipse(0, 19, 8, mouth, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-9, 17, 18, 3);
  }

  ctx.restore();
  ctx.restore();
}

/* ============================================================
 * ICON HELPERS
 * ============================================================ */

function drawLock(ctx, x, y, s, t, open = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  const lift = open * 16;

  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 26;

  ctx.strokeStyle = '#7dffbe';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -44 - lift, 34, Math.PI, 0, false);
  ctx.lineTo(34, -8 - lift);
  ctx.stroke();

  ctx.fillStyle = '#06231a';
  roundRectPath(ctx, -54, -12, 108, 90, 18);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = COLOR.neonSoft;
  ctx.lineWidth = 4;
  roundRectPath(ctx, -54, -12, 108, 90, 18);
  ctx.stroke();

  ctx.fillStyle = '#43ffa4';
  ctx.beginPath();
  ctx.arc(0, 26, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, 30, 10, 26);

  ctx.restore();
}

function drawBitGrid(ctx, x, y, cols, rows, cell, {
  fill = COLOR.neon,
  alpha = 0.85,
  deadCells = [],
  deadAlpha = 0.12,
  deadColor = COLOR.danger,
} = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;

  let idx = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * cell;
      const cy = y + r * cell;
      const isDead = deadCells.includes(idx);

      if (isDead) {
        ctx.globalAlpha = deadAlpha;
        ctx.fillStyle = deadColor;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
      }

      roundRectPath(ctx, cx, cy, cell - 4, cell - 4, 3);
      ctx.fill();
      idx += 1;
    }
  }

  ctx.restore();
}

function drawXorGate(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLOR.neon;
  ctx.lineWidth = 4;
  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  setFont(ctx, Math.round(r * 0.8), 700);
  ctx.fillStyle = COLOR.neon;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('XOR', 0, 1);
  ctx.restore();
}

function drawArrow(ctx, x1, y1, x2, y2, {
  color = COLOR.neonSoft,
  width = 5,
  head = 14,
  alpha = 1,
} = {}) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/* ============================================================
 * GLOBAL OVERLAY
 * ============================================================ */

function drawOverlay(ctx, t, sceneLabel) {
  ctx.save();

  // Top branding bar
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = 'rgba(1,8,4,0.72)';
  ctx.fillRect(0, 0, W, 92);

  ctx.strokeStyle = COLOR.neonDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 92);
  ctx.lineTo(W, 92);
  ctx.stroke();

  setTextStyle(ctx, {
    px: 30,
    weight: 700,
    color: COLOR.neon,
    align: 'left',
    baseline: 'middle',
    glow: 8,
  });
  ctx.fillText('@random.ai.id', 42, 48);

  setTextStyle(ctx, {
    px: 30,
    weight: 700,
    color: COLOR.textDim,
    align: 'right',
    baseline: 'middle',
  });
  ctx.fillText('AI GABUT', W - 42, 48);

  // Bottom progress bar
  const barY = H - 26;
  ctx.fillStyle = 'rgba(0,255,122,0.12)';
  ctx.fillRect(0, barY, W, 10);

  const progress = clamp(t / DURATION, 0, 1);
  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLOR.neon;
  ctx.fillRect(0, barY, W * progress, 10);
  ctx.shadowBlur = 0;

  setTextStyle(ctx, {
    px: 24,
    weight: 700,
    color: COLOR.textDim,
    align: 'center',
    baseline: 'middle',
  });
  ctx.fillText(sceneLabel, W / 2, H - 58);

  ctx.restore();
}

/* ============================================================
 * SCENES
 * ============================================================ */

function sceneTitle(ctx, t, st) {
  const a = easeOutCubic(st / 0.8);
  const lockOpen = clamp((st - 0.45) / 1.4, 0, 1);

  drawLock(ctx, W / 2, H * 0.30, 1.35, t, lockOpen);

  setTextStyle(ctx, {
    px: 34,
    color: COLOR.neon,
    alpha: a,
    glow: 10,
  });
  ctx.fillText('PART 2', W / 2, H * 0.475);

  setTextStyle(ctx, {
    px: 74,
    color: COLOR.text,
    alpha: a,
    glow: 18,
  });
  ctx.fillText('JENIS-JENIS', W / 2, H * 0.535);
  ctx.fillText('ENKRIPSI', W / 2, H * 0.60);

  setTextStyle(ctx, {
    px: 120,
    color: COLOR.neon,
    alpha: a,
    glow: 30,
  });
  ctx.fillText('DES', W / 2, H * 0.715);

  setTextStyle(ctx, {
    px: 30,
    color: COLOR.textDim,
    alpha: a,
  });
  ctx.fillText('DATA ENCRYPTION STANDARD', W / 2, H * 0.785);

  drawChip(ctx, W / 2, H * 0.86, '@random.ai.id', {
    px: 30,
    alpha: a,
  });
}

function sceneIntro(ctx, t, st) {
  const inA = easeOutCubic(st / 0.7);
  const charY = H * 0.80 + (1 - inA) * 120;

  setTextStyle(ctx, {
    px: 42,
    color: COLOR.text,
    alpha: inA,
    glow: 14,
  });
  ctx.fillText('PART 2 • FOKUS: DES', W / 2, H * 0.20);

  drawChip(ctx, W / 2, H * 0.30, 'AZRIEL', {
    px: 42,
    alpha: easeOutCubic((st - 0.25) / 0.5),
  });

  drawChip(ctx, W / 2, H * 0.38, '@random.ai.id', {
    px: 34,
    alpha: easeOutCubic((st - 0.55) / 0.5),
  });

  drawChip(ctx, W / 2, H * 0.46, 'AI GABUT', {
    px: 34,
    alpha: easeOutCubic((st - 0.85) / 0.5),
  });

  drawAzriel(ctx, {
    x: W / 2,
    y: charY,
    s: 1.35,
    t,
    talking: true,
    wave: 1,
    alpha: inA,
  });
}

function sceneHistory(ctx, t, st, dur) {
  const titleA = easeOutCubic(st / 0.5);

  setTextStyle(ctx, {
    px: 44,
    color: COLOR.text,
    alpha: titleA,
    glow: 12,
  });
  ctx.fillText('AWAL MULA DES', W / 2, H * 0.18);

  setTextStyle(ctx, {
    px: 30,
    color: COLOR.textDim,
    alpha: titleA,
  });
  ctx.fillText('1970-AN • IBM • HORST FEISTEL', W / 2, H * 0.24);

  const lineY = H * 0.52;
  const x0 = W * 0.12;
  const x1 = W * 0.88;
  const progress = easeInOut(clamp(st / (dur * 0.82), 0, 1));
  const lineX = lerp(x0, x1, progress);

  ctx.save();
  ctx.strokeStyle = COLOR.neonDim;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, lineY);
  ctx.lineTo(x1, lineY);
  ctx.stroke();

  ctx.shadowColor = COLOR.neon;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = COLOR.neon;
  ctx.beginPath();
  ctx.moveTo(x0, lineY);
  ctx.lineTo(lineX, lineY);
  ctx.stroke();
  ctx.restore();

  const nodes = [
    { p: 0.08, label: '1970-AN', sub: 'IBM' },
    { p: 0.48, label: 'HORST FEISTEL', sub: 'STRUKTUR CIPHER' },
    { p: 0.90, label: 'LUCIFER', sub: 'DESAIN AWAL' },
  ];

  nodes.forEach((node, i) => {
    const nx = lerp(x0, x1, node.p);
    const show = clamp((progress - node.p + 0.06) / 0.1, 0, 1);
    const a = easeOutCubic(show);
    const scale = 0.85 + a * 0.15;

    ctx.save();
    ctx.translate(nx, lineY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = a;

    ctx.fillStyle = COLOR.bgTop;
    ctx.shadowColor = COLOR.neon;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = COLOR.neon;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    const yLabel = i % 2 === 0 ? lineY - 120 : lineY + 120;
    drawChip(ctx, nx, yLabel, node.label, { px: 28, alpha: a });

    setTextStyle(ctx, {
      px: 24,
      color: COLOR.textDim,
      alpha: a,
    });
    ctx.fillText(node.sub, nx, yLabel + 56);
  });
}

function sceneStandard(ctx, t, st) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 44,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('STANDAR FEDERAL', W / 2, H * 0.17);

  const docX = W / 2 - 330;
  const docY = H * 0.24;
  const docW = 660;
  const docH = 620;

  drawPanel(ctx, docX, docY, docW, docH, { alpha: a });

  setTextStyle(ctx, {
    px: 48,
    color: COLOR.neon,
    alpha: a,
    glow: 14,
  });
  ctx.fillText('FIPS PUB 46', W / 2, docY + 92);

  setTextStyle(ctx, {
    px: 30,
    color: COLOR.textDim,
    alpha: a,
  });
  ctx.fillText('JANUARI 1977', W / 2, docY + 152);

  ctx.save();
  ctx.globalAlpha = a * 0.5;
  ctx.strokeStyle = COLOR.neonDim;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const y = docY + 230 + i * 52;
    ctx.beginPath();
    ctx.moveTo(docX + 70, y);
    ctx.lineTo(docX + docW - 70, y);
    ctx.stroke();
  }
  ctx.restore();

  drawChip(ctx, W / 2 - 150, docY + docH + 80, 'NBS', { px: 34, alpha: a });
  drawChip(ctx, W / 2 + 150, docY + docH + 80, 'NSA', { px: 34, alpha: a });

  const warnPulse = 0.75 + Math.sin(t * 3.2) * 0.25;
  drawChip(ctx, W / 2, H * 0.80, 'KONTROVERSI KUNCI', {
    px: 36,
    color: COLOR.warning,
    stroke: 'rgba(255,215,94,0.7)',
    alpha: a * warnPulse,
  });
}

function sceneTechnical(ctx, t, st, dur) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 42,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('SYMMETRIC-KEY BLOCK CIPHER', W / 2, H * 0.16);

  // Data block
  drawPanel(ctx, W * 0.08, H * 0.22, W * 0.84, H * 0.24, { alpha: a });

  setTextStyle(ctx, {
    px: 32,
    color: COLOR.neon,
    alpha: a,
  });
  ctx.fillText('BLOK DATA: 64 BIT', W / 2, H * 0.26);

  drawBitGrid(ctx, W * 0.14, H * 0.30, 16, 4, 46, { alpha: a * 0.9 });

  // Key block
  drawPanel(ctx, W * 0.08, H * 0.50, W * 0.84, H * 0.34, { alpha: a });

  setTextStyle(ctx, {
    px: 32,
    color: COLOR.neon,
    alpha: a,
  });
  ctx.fillText('KEY: 64 BIT', W / 2, H * 0.54);

  const parityStart = 56;
  const deadCells = Array.from({ length: 8 }, (_, i) => parityStart + i);
  const removeProgress = clamp((st - dur * 0.35) / (dur * 0.25), 0, 1);

  drawBitGrid(ctx, W * 0.14, H * 0.585, 16, 4, 46, {
    alpha: a * 0.9,
    deadCells,
    deadAlpha: 0.12 + (1 - removeProgress) * 0.65,
  });

  if (removeProgress > 0.15) {
    const a2 = easeOutCubic((removeProgress - 0.15) / 0.85);
    drawChip(ctx, W / 2, H * 0.745, '8 BIT PARITY DIBUANG', {
      px: 30,
      color: COLOR.warning,
      stroke: 'rgba(255,215,94,0.65)',
      alpha: a * a2,
    });

    setTextStyle(ctx, {
      px: 52,
      color: COLOR.neon,
      alpha: a * a2,
      glow: 18,
    });
    ctx.fillText('EFEKTIF: 56 BIT', W / 2, H * 0.815);
  }
}

function sceneFeistel(ctx, t, st, dur) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 44,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('FEISTEL NETWORK', W / 2, H * 0.16);

  const round = Math.min(16, 1 + Math.floor((st / (dur * 0.9)) * 16));

  drawChip(ctx, W / 2, H * 0.225, `ROUND ${round}/16`, {
    px: 32,
    alpha: a,
  });

  const boxW = 190;
  const boxH = 300;
  const leftX = W * 0.16;
  const rightX = W * 0.84 - boxW;
  const topY = H * 0.32;

  drawPanel(ctx, leftX, topY, boxW, boxH, { alpha: a });
  drawPanel(ctx, rightX, topY, boxW, boxH, { alpha: a });

  setTextStyle(ctx, {
    px: 70,
    color: COLOR.neon,
    alpha: a,
    glow: 16,
  });
  ctx.fillText('L', leftX + boxW / 2, topY + boxH / 2);
  ctx.fillText('R', rightX + boxW / 2, topY + boxH / 2);

  // F function box
  const fSize = 120;
  const fx = W / 2 - fSize / 2;
  const fy = topY + boxH + 130;

  drawPanel(ctx, fx, fy, fSize, fSize, { alpha: a, radius: 20 });
  setTextStyle(ctx, {
    px: 46,
    color: COLOR.neon,
    alpha: a,
    glow: 14,
  });
  ctx.fillText('F', W / 2, fy + fSize / 2);

  drawXorGate(ctx, W * 0.28, fy + fSize / 2, 44);

  // Arrows
  drawArrow(ctx, rightX + boxW / 2, topY + boxH, rightX + boxW / 2, fy + fSize / 2, { alpha: a });
  drawArrow(ctx, fx, fy + fSize / 2, W * 0.28 + 46, fy + fSize / 2, { alpha: a });
  drawArrow(ctx, W * 0.28, fy + fSize / 2 - 46, leftX + boxW / 2, topY + boxH, { alpha: a });

  drawChip(ctx, W / 2, H * 0.76, '16 ROUNDS', { px: 34, alpha: a });
  drawChip(ctx, W / 2, H * 0.82, 'FUNGSI F + XOR', { px: 30, alpha: a });
}

function sceneWeakness(ctx, t, st) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 68,
    color: COLOR.warning,
    alpha: a,
    glow: 20,
  });
  ctx.fillText('56-BIT KEY', W / 2, H * 0.20);

  setTextStyle(ctx, {
    px: 34,
    color: COLOR.textDim,
    alpha: a,
  });
  ctx.fillText('TERLALU PENDEK UNTUK KOMPUTER MODERN', W / 2, H * 0.26);

  const bars = [
    { label: 'DES', bits: 56, color: COLOR.danger },
    { label: '3DES', bits: 168, color: COLOR.warning },
    { label: 'AES-128', bits: 128, color: COLOR.neon },
    { label: 'AES-256', bits: 256, color: COLOR.neon },
  ];

  const panelX = W * 0.08;
  const panelY = H * 0.32;
  const panelW = W * 0.84;
  const panelH = H * 0.34;

  drawPanel(ctx, panelX, panelY, panelW, panelH, { alpha: a });

  bars.forEach((bar, i) => {
    const y = panelY + 70 + i * 90;
    const maxW = panelW - 320;
    const barW = maxW * (bar.bits / 256);
    const grow = easeOutCubic(clamp((st - 0.3 - i * 0.18) / 0.7, 0, 1));

    setTextStyle(ctx, {
      px: 26,
      color: COLOR.text,
      align: 'left',
      alpha: a,
    });
    ctx.fillText(bar.label, panelX + 40, y + 18);

    ctx.save();
    ctx.globalAlpha = a * 0.2;
    ctx.fillStyle = bar.color;
    roundRectPath(ctx, panelX + 220, y, maxW, 36, 10);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = bar.color;
    ctx.shadowColor = bar.color;
    ctx.shadowBlur = 14;
    roundRectPath(ctx, panelX + 220, y, Math.max(8, barW * grow), 36, 10);
    ctx.fill();
    ctx.restore();

    setTextStyle(ctx, {
      px: 24,
      color: COLOR.textDim,
      align: 'left',
      alpha: a,
    });
    ctx.fillText(`${bar.bits} BIT`, panelX + 230 + maxW, y + 18);
  });

  drawChip(ctx, W / 2, H * 0.72, 'BRUTE FORCE', { px: 36, alpha: a });
  drawChip(ctx, W / 2 - 190, H * 0.79, 'GPU', { px: 30, alpha: a });
  drawChip(ctx, W / 2 + 190, H * 0.79, 'HARDWARE MURAH', { px: 26, alpha: a });
}

function sceneBroken(ctx, t, st, dur) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 44,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('DES BERHASIL DIPECAHKAN', W / 2, H * 0.16);

  const events = [
    {
      year: '1997',
      title: 'DESCHALL PROJECT',
      desc: 'PESAN DES DIPECAHKAN',
      width: 0.80,
      color: COLOR.warning,
    },
    {
      year: '1998',
      title: 'EFF DEEP CRACK',
      desc: '56 JAM • ±250 RIBU DOLAR',
      width: 0.55,
      color: COLOR.neon,
    },
    {
      year: '1999',
      title: 'DEEP CRACK + DISTRIBUTED.NET',
      desc: '22 JAM 15 MENIT',
      width: 0.30,
      color: COLOR.danger,
    },
  ];

  events.forEach((ev, i) => {
    const enter = easeOutCubic(clamp((st - 0.35 - i * (dur * 0.16)) / 0.7, 0, 1));
    const y = H * 0.25 + i * H * 0.185;
    const cardX = W * 0.08;
    const cardW = W * 0.84;
    const cardH = H * 0.15;

    ctx.save();
    ctx.globalAlpha = enter * a;
    ctx.translate((1 - enter) * 120, 0);

    drawPanel(ctx, cardX, y, cardW, cardH, { alpha: 1 });

    setTextStyle(ctx, {
      px: 44,
      color: ev.color,
      align: 'left',
      glow: 12,
    });
    ctx.fillText(ev.year, cardX + 36, y + cardH / 2);

    setTextStyle(ctx, {
      px: 30,
      color: COLOR.text,
      align: 'left',
    });
    ctx.fillText(ev.title, cardX + 210, y + cardH / 2 - 24);

    setTextStyle(ctx, {
      px: 24,
      color: COLOR.textDim,
      align: 'left',
    });
    ctx.fillText(ev.desc, cardX + 210, y + cardH / 2 + 26);

    ctx.restore();
  });

  const pulse = 0.72 + Math.sin(t * 3.4) * 0.28;
  drawChip(ctx, W / 2, H * 0.84, 'BRUTE FORCE MAKIN CEPAT', {
    px: 32,
    color: COLOR.danger,
    stroke: 'rgba(255,84,104,0.7)',
    alpha: a * pulse,
  });
}

function sceneReplacement(ctx, t, st) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 42,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('PENGGANTI DES', W / 2, H * 0.17);

  const nodes = [
    { label: 'DES', x: W * 0.18, dead: true },
    { label: '3DES', x: W * 0.50, dead: false },
    { label: 'AES', x: W * 0.82, dead: false },
  ];

  const y = H * 0.45;

  nodes.forEach((node, i) => {
    const enter = easeOutCubic(clamp((st - 0.2 - i * 0.3) / 0.55, 0, 1));
    const size = 150;

    ctx.save();
    ctx.globalAlpha = enter * a;
    ctx.translate(node.x, y);
    ctx.scale(0.8 + enter * 0.2, 0.8 + enter * 0.2);

    drawPanel(ctx, -size / 2, -size / 2, size, size, { alpha: 1, radius: 24 });

    setTextStyle(ctx, {
      px: 42,
      color: node.dead ? COLOR.danger : COLOR.neon,
      glow: 16,
    });
    ctx.fillText(node.label, 0, 0);

    if (node.dead) {
      ctx.strokeStyle = COLOR.danger;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-56, -56);
      ctx.lineTo(56, 56);
      ctx.stroke();
    }

    ctx.restore();

    if (i < nodes.length - 1) {
      const next = nodes[i + 1];
      const arrowEnter = easeOutCubic(clamp((st - 0.55 - i * 0.3) / 0.45, 0, 1));
      drawArrow(ctx, node.x + 88, y, lerp(node.x + 88, next.x - 88, arrowEnter), y, {
        alpha: a * arrowEnter,
      });
    }
  });

  drawChip(ctx, W / 2, H * 0.62, 'NIST', { px: 38, alpha: a });

  const enter2005 = easeOutCubic(clamp((st - 1.4) / 0.6, 0, 1));
  drawChip(ctx, W / 2, H * 0.71, '2005 • DES TARIK DARI STANDAR', {
    px: 30,
    color: COLOR.warning,
    stroke: 'rgba(255,215,94,0.65)',
    alpha: a * enter2005,
  });
}

function sceneLegacy(ctx, t, st) {
  const a = easeOutCubic(st / 0.6);

  setTextStyle(ctx, {
    px: 44,
    color: COLOR.text,
    alpha: a,
    glow: 12,
  });
  ctx.fillText('LEGACY DES', W / 2, H * 0.17);

  drawChip(ctx, W / 2, H * 0.24, 'FONDASI BLOCK CIPHER MODERN', {
    px: 28,
    alpha: a,
  });

  // Mini Feistel motif
  const boxW = 120;
  const boxH = 180;
  const leftX = W * 0.22;
  const rightX = W * 0.78 - boxW;
  const topY = H * 0.31;

  drawPanel(ctx, leftX, topY, boxW, boxH, { alpha: a * 0.9 });
  drawPanel(ctx, rightX, topY, boxW, boxH, { alpha: a * 0.9 });

  setTextStyle(ctx, {
    px: 46,
    color: COLOR.neon,
    alpha: a * 0.9,
    glow: 12,
  });
  ctx.fillText('L', leftX + boxW / 2, topY + boxH / 2);
  ctx.fillText('R', rightX + boxW / 2, topY + boxH / 2);

  drawArrow(ctx, leftX + boxW + 10, topY + 40, rightX - 10, topY + 40, { alpha: a * 0.8 });
  drawArrow(ctx, rightX - 10, topY + boxH - 40, leftX + boxW + 10, topY + boxH - 40, { alpha: a * 0.8 });

  // S-box style grid
  const sboxRng = mulberry32(565656);
  const gridX = W * 0.20;
  const gridY = H * 0.565;
  const cell = 56;

  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 12; c += 1) {
      const v = Math.floor(sboxRng() * 16).toString(16).toUpperCase();
      const x = gridX + c * cell;
      const y = gridY + r * cell;
      const glow = 0.35 + 0.35 * Math.sin(t * 2 + r * 0.8 + c * 0.4);

      ctx.save();
      ctx.globalAlpha = a * clamp(glow, 0.12, 0.8);
      ctx.fillStyle = COLOR.neon;
      roundRectPath(ctx, x, y, cell - 8, cell - 8, 8);
      ctx.fill();
      ctx.restore();

      setTextStyle(ctx, {
        px: 22,
        color: COLOR.text,
        alpha: a * 0.85,
      });
      ctx.fillText(v, x + (cell - 8) / 2, y + (cell - 8) / 2);
    }
  }

  drawAzriel(ctx, {
    x: W / 2,
    y: H * 0.945,
    s: 1.05,
    t,
    talking: true,
    alpha: a,
  });
}

function sceneOutro(ctx, t, st, dur) {
  const a = easeOutCubic(st / 0.7);
  const fadeOut = clamp((dur - st) / 0.8, 0, 1);

  setTextStyle(ctx, {
    px: 56,
    color: COLOR.neon,
    alpha: a * fadeOut,
    glow: 22,
  });
  ctx.fillText('PART 2 — DES', W / 2, H * 0.18);

  drawAzriel(ctx, {
    x: W / 2,
    y: H * 0.62,
    s: 1.45,
    t,
    talking: true,
    thumb: 1,
    alpha: a * fadeOut,
  });

  drawChip(ctx, W / 2, H * 0.78, 'FOLLOW @random.ai.id', {
    px: 34,
    alpha: a * fadeOut,
  });

  drawChip(ctx, W / 2, H * 0.85, 'AI GABUT', {
    px: 30,
    alpha: a * fadeOut,
  });

  setTextStyle(ctx, {
    px: 34,
    color: COLOR.textDim,
    alpha: a * fadeOut,
  });
  ctx.fillText('CIAO!', W / 2, H * 0.915);
}

/* ============================================================
 * TIMELINE
 * Durasi scene mengikuti naskah Part 2 (total ±240 detik).
 * ============================================================ */

const SCENES = [
  { start: 0, end: 3, label: 'PART 2 • DES', draw: sceneTitle },
  { start: 3, end: 20, label: 'INTRO • AZRIEL', draw: sceneIntro },
  { start: 20, end: 45, label: 'SEJARAH • 1970-AN', draw: sceneHistory },
  { start: 45, end: 65, label: 'FIPS PUB 46 • 1977', draw: sceneStandard },
  { start: 65, end: 95, label: 'TEKNIS • BLOK 64 BIT / KEY 56 BIT', draw: sceneTechnical },
  { start: 95, end: 125, label: 'FEISTEL NETWORK • 16 ROUNDS', draw: sceneFeistel },
  { start: 125, end: 150, label: 'KELEMAHAN • 56-BIT', draw: sceneWeakness },
  { start: 150, end: 175, label: 'DES DIPECAHKAN', draw: sceneBroken },
  { start: 175, end: 200, label: '3DES → AES', draw: sceneReplacement },
  { start: 200, end: 225, label: 'LEGACY DES', draw: sceneLegacy },
  { start: 225, end: 240, label: 'OUTRO', draw: sceneOutro },
];

function renderFrame(ctx, t) {
  drawBackground(ctx, t);

  const scene =
    SCENES.find((s) => t >= s.start && t < s.end) ||
    SCENES[SCENES.length - 1];

  const st = clamp(t - scene.start, 0, scene.end - scene.start);
  const sceneDur = scene.end - scene.start;

  scene.draw(ctx, t, st, sceneDur);
  drawOverlay(ctx, t, scene.label);
  drawScanlines(ctx, 0.045);

  resetAlphaShadow(ctx);
}

/* ============================================================
 * FFMPEG ENCODER
 * ============================================================ */

function buildFfmpegArgs(outputPath) {
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',

    // Video input from stdin (node-canvas raw buffer is BGRA in memory).
    '-f', 'rawvideo',
    '-pixel_format', 'bgra',
    '-video_size', `${W}x${H}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
  ];

  if (OPTS.silentAudio) {
    args.push(
      '-f', 'lavfi',
      '-i', 'anullsrc=r=44100:cl=stereo'
    );
  }

  args.push(
    '-map', '0:v:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high'
  );

  if (OPTS.silentAudio) {
    args.push(
      '-map', '1:a:0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest'
    );
  }

  args.push(
    '-movflags', '+faststart',
    outputPath
  );

  return args;
}

function spawnFfmpeg(outputPath) {
  const args = buildFfmpegArgs(outputPath);
  const proc = spawn('ffmpeg', args, {
    stdio: ['pipe', 'inherit', 'pipe'],
  });

  let stderr = '';
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  proc.on('error', (err) => {
    console.error('Gagal menjalankan FFmpeg:', err.message);
    console.error('Pastikan ffmpeg terinstall dan tersedia di PATH.');
    process.exit(1);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`FFmpeg exit dengan code ${code}`);
      if (stderr) console.error(stderr);
      process.exit(1);
    }
  });

  return proc;
}

/* ============================================================
 * MAIN RENDER LOOP
 * ============================================================ */

async function main() {
  console.log('==================================================');
  console.log('Part 2 — Jenis-Jenis Enkripsi: DES');
  console.log(`Output   : ${OPTS.output}`);
  console.log(`Resolusi : ${W}x${H}`);
  console.log(`FPS      : ${FPS}`);
  console.log(`Durasi   : ${DURATION} detik`);
  console.log(`Frames   : ${TOTAL_FRAMES}`);
  console.log('==================================================');

  const outputPath = path.resolve(process.cwd(), OPTS.output);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false });

  const ffmpeg = spawnFfmpeg(outputPath);
  const expectedBytes = W * H * 4;

  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const t = frame / FPS;

    renderFrame(ctx, t);

    const raw = canvas.toBuffer('raw');
    if (raw.length !== expectedBytes) {
      console.error(`Ukuran raw buffer tidak sesuai: ${raw.length} != ${expectedBytes}`);
      ffmpeg.stdin.end();
      process.exit(1);
    }

    const canWrite = ffmpeg.stdin.write(raw);
    if (!canWrite) {
      await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    }

    if (frame % FPS === 0) {
      const percent = ((frame + 1) / TOTAL_FRAMES) * 100;
      console.log(`Render frame ${frame + 1}/${TOTAL_FRAMES} (${percent.toFixed(1)}%)`);
    }
  }

  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit code ${code}`));
    });
    ffmpeg.on('error', reject);
  });

  console.log('==================================================');
  console.log('Render selesai.');
  console.log(`File output: ${outputPath}`);
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Render gagal:', err);
  process.exit(1);
});
