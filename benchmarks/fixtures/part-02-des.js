// =====================================================================
// Part 2 — Jenis-Jenis Enkripsi: DES  (@random.ai.id / AI Gabut)
// Durasi: 240 detik | Gaya: bersih, hijau matrix, cybersecurity
// Karakter AZRIEL: rig manusia prosedural (wave, kedip, bicara, thumbs up, nunjuk)
// Renderer: GitHub JavaScript Content Renderer (PureImage Canvas 2D, Node.js)
// =====================================================================
import path from 'node:path';
import fs from 'node:fs';
import * as PImage from 'pureimage';

const DURATION = 240;

// ----------------------------- util dasar -----------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => {
  const c = 1.70158, d = c + 1;
  return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 13.7) * 43758.5453;
  return s - Math.floor(s);
};
const fmtID = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const typed = (text, lt, start, cps = 26) =>
  lt < start ? '' : text.slice(0, Math.floor((lt - start) * cps));

// ----------------------------- warna tema -----------------------------
const C = {
  txt: '#E4FFF0',
  soft: '#9FFFC6',
  dim: '#7CE8A8',
  main: '#33FF77',
  warn: '#D9FF4D',
  red: '#FF8A7A',
};

// ----------------------------- font & teks -----------------------------
function setText(ctx, st, px, family) {
  const fam = family || (st && st.main) || 'sans-serif';
  const pt = Math.max(1, px * 0.75);
  try { ctx.font = `${px}px "${fam}"`; } catch (e) {}
  try { ctx._font = `${pt}pt ${fam}`; } catch (e) {}
  return fam;
}

function estChar(ch, size, family) {
  if (family && /mono/i.test(family)) return size * 0.6;
  let f = 0.52;
  if ('ilj.,:;!?|()[]{}<>/\''.includes(ch)) f = 0.3;
  else if ('tfkrvsxyz'.includes(ch)) f = 0.44;
  else if ('mwMW@'.includes(ch)) f = 0.82;
  else if (ch === ' ') f = 0.3;
  else if (ch >= 'A' && ch <= 'Z') f = 0.62;
  else if (ch >= '0' && ch <= '9') f = 0.55;
  else if (ch >= 'a' && ch <= 'z') f = 0.5;
  else f = 0.55;
  return size * f;
}
const estWidth = (s, size, family) => {
  let w = 0;
  for (const ch of String(s)) w += estChar(ch, size, family);
  return w;
};

function drawText(ctx, st, str, x, y, o = {}) {
  if (!str) return 0;
  const { size = 24, color = C.txt, family, align = 'left', alpha = 1 } = o;
  setText(ctx, st, size, family);
  const w = estWidth(str, size, family);
  let xx = x;
  if (align === 'center') xx = x - w / 2;
  else if (align === 'right') xx = x - w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(String(str), xx, y);
  ctx.globalAlpha = 1;
  return w;
}

function drawSpaced(ctx, st, text, cx, y, o = {}) {
  const { size = 30, spacing = 10, color = C.main, family, alpha = 1 } = o;
  setText(ctx, st, size, family);
  const chars = [...text];
  const ws = chars.map((ch) => estChar(ch, size, family));
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += ws[i] + spacing;
  });
  ctx.globalAlpha = 1;
  return total;
}

function wrapLines(text, size, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (estWidth(trial, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawWrapped(ctx, st, text, cx, y, o = {}) {
  const { size = 16, color = C.txt, maxW = 1e9, lh, alpha = 1 } = o;
  const lines = wrapLines(text, size, maxW);
  const L = lh || size * 1.35;
  lines.forEach((ln, i) => drawText(ctx, st, ln, cx, y + i * L, { size, color, align: 'center', alpha }));
  return lines.length;
}

// ----------------------------- bentuk dasar -----------------------------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, o = {}) {
  const { r = 14, bg = 'rgba(5,26,14,0.88)', bd = 'rgba(70,255,140,0.35)', lw = 1.5, alpha = 1 } = o;
  ctx.globalAlpha = alpha;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  if (bd) {
    ctx.strokeStyle = bd;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function chip(ctx, st, cx, cy, text, o = {}) {
  const { size = 16, padX = 14, padY = 8, tone = 'green', alpha = 1 } = o;
  const tones = {
    green: { bg: 'rgba(7,45,23,0.92)', bd: 'rgba(70,255,140,0.55)', fg: '#B9FFD4' },
    bright: { bg: 'rgba(11,70,35,0.95)', bd: 'rgba(120,255,170,0.9)', fg: '#E9FFF1' },
    warn: { bg: 'rgba(58,60,6,0.92)', bd: 'rgba(217,255,77,0.6)', fg: '#EAFF9E' },
    red: { bg: 'rgba(64,16,12,0.92)', bd: 'rgba(255,107,94,0.6)', fg: '#FFC9C2' },
    dim: { bg: 'rgba(6,26,15,0.85)', bd: 'rgba(70,255,140,0.25)', fg: '#7FD9A6' },
  };
  const tn = tones[tone] || tones.green;
  setText(ctx, st, size);
  const w = estWidth(text, size) + padX * 2;
  const h = size + padY * 2;
  ctx.globalAlpha = alpha;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = tn.bg;
  ctx.fill();
  ctx.strokeStyle = tn.bd;
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.stroke();
  ctx.fillStyle = tn.fg;
  ctx.fillText(text, cx - w / 2 + padX, cy + size * 0.34);
  ctx.globalAlpha = 1;
  return { w, h };
}

function heading(ctx, st, text, cx, y, o = {}) {
  const { size = 34, alpha = 1 } = o;
  const w = estWidth(text, size);
  const k = size / 34;
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = 'rgba(70,255,140,0.5)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 48 * k, y - size * 0.32);
  ctx.lineTo(cx - w / 2 - 14 * k, y - size * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w / 2 + 14 * k, y - size * 0.32);
  ctx.lineTo(cx + w / 2 + 48 * k, y - size * 0.32);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawText(ctx, st, text, cx, y, { size, align: 'center', color: '#DFFFE9', alpha });
}

function arrowHead(ctx, x, y, ang, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-s * 1.8, -s);
  ctx.lineTo(-s * 1.8, s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,255,170,0.85)';
  ctx.fill();
  ctx.restore();
}

// ----------------------------- latar matrix -----------------------------
// Background gradients are static for a given canvas; dynamic rain gradients stay frame-local.
const BACKGROUND_GRADIENT_CACHE = new WeakMap();
const MATRIX_SEED_CACHE = new Map();

function getBackgroundGradients(ctx, W, H) {
  let bySize = BACKGROUND_GRADIENT_CACHE.get(ctx);
  if (!bySize) {
    bySize = new Map();
    BACKGROUND_GRADIENT_CACHE.set(ctx, bySize);
  }
  const key = `${W}x${H}`;
  let cached = bySize.get(key);
  if (!cached) {
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#020805');
    base.addColorStop(0.45, '#04150B');
    base.addColorStop(1, '#020805');
    const vignette = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.36,
      W / 2, H / 2, Math.max(W, H) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    cached = { base, vignette };
    bySize.set(key, cached);
  }
  return cached;
}

function getMatrixSeeds(count) {
  let seeds = MATRIX_SEED_CACHE.get(count);
  if (!seeds) {
    seeds = Array.from({ length: count }, (_, i) => [hash(i), hash(i + 7), hash(i + 3)]);
    MATRIX_SEED_CACHE.set(count, seeds);
  }
  return seeds;
}

function drawBackground(ctx, W, H, F, t, intensity = 1) {
  const staticGradients = getBackgroundGradients(ctx, W, H);
  ctx.fillStyle = staticGradients.base;
  ctx.fillRect(0, 0, W, H);

  // hujan data (rect cepat, tanpa glyph); nilai hash tidak berubah antarfame.
  const colW = Math.max(24, 34 * F);
  const n = Math.ceil(W / colW);
  const seeds = getMatrixSeeds(n);
  for (let i = 0; i < n; i++) {
    const seed = seeds[i];
    const sp = (50 + seed[0] * 150) * F;
    const trail = (90 + seed[1] * 240) * F;
    const range = H + trail;
    const yy = ((t * sp + seed[2] * range * 3) % range) - trail;
    const x = i * colW + colW * 0.5;
    const gr = ctx.createLinearGradient(0, yy, 0, yy + trail);
    gr.addColorStop(0, 'rgba(0,255,106,0)');
    gr.addColorStop(1, `rgba(0,255,106,${0.14 * intensity})`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - 1.3 * F, yy, 2.6 * F, trail);
    ctx.fillStyle = `rgba(170,255,200,${0.45 * intensity})`;
    ctx.fillRect(x - 2.4 * F, yy + trail - 7 * F, 4.8 * F, 7 * F);
  }

  ctx.fillStyle = staticGradients.vignette;
  ctx.fillRect(0, 0, W, H);
}

// ----------------------------- gembok -----------------------------
function drawPadlock(ctx, x, y, s, o = {}) {
  const sh = o.shackle == null ? 1 : o.shackle;
  const glow = o.glow || 0;
  const off = (1 - sh) * 30 * s;
  const dxo = (1 - sh) * 8 * s;
  ctx.save();
  ctx.translate(x, y);
  if (glow > 0) {
    ctx.strokeStyle = `rgba(140,255,180,${(1 - glow) * 0.55})`;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(0, 20 * s, (60 + glow * 55) * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  // shackle
  ctx.strokeStyle = '#BFFFD9';
  ctx.lineWidth = 11 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26 * s + dxo, 6 * s + off);
  ctx.lineTo(-26 * s + dxo, -14 * s + off);
  ctx.arc(dxo, -14 * s + off, 26 * s, Math.PI, 0, false);
  ctx.lineTo(26 * s + dxo, 6 * s + off);
  ctx.stroke();
  // body
  const bg = ctx.createLinearGradient(0, 0, 0, 70 * s);
  bg.addColorStop(0, '#11592D');
  bg.addColorStop(1, '#07301A');
  rr(ctx, -46 * s, 0, 92 * s, 70 * s, 12 * s);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,255,170,0.8)';
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();
  // lubang kunci
  ctx.fillStyle = '#03130A';
  ctx.beginPath();
  ctx.arc(0, 26 * s, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-3.6 * s, 30 * s, 7.2 * s, 18 * s);
  ctx.restore();
}

// ----------------------------- AZRIEL (manusia prosedural) -----------------------------
function armLimb(ctx, sx, sy, a1, l1, a2, l2, w, sleeve, skin) {
  const ex = sx + Math.cos(a1) * l1;
  const ey = sy + Math.sin(a1) * l1;
  const ang = a1 + a2;
  const hx = ex + Math.cos(ang) * l2;
  const hy = ey + Math.sin(ang) * l2;
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, w * 0.58, 0, Math.PI * 2);
  ctx.fill();
  return { hx, hy, ang };
}

function drawAzriel(ctx, x, yFeet, h, t, o = {}) {
  const u = h / 340;
  const wave = o.wave || 0;
  const talk = o.talk || 0;
  const thumb = o.thumb || 0;
  const point = o.point || 0;
  const bob = Math.sin(t * 2.1) * 3.5 * u;
  const sway = Math.sin(t * 1.2) * 0.02;
  const SKIN = '#EDF7D9', SKIN_D = '#C9DFAE', HAIR = '#072812';
  const HOOD = '#0C3B1D', HOOD_D = '#082A14', PANTS = '#061C0F';

  ctx.save();
  ctx.translate(x, yFeet);
  ctx.rotate(sway * 0.4);

  // bayangan
  ctx.save();
  ctx.translate(0, 2 * u);
  ctx.scale(1, 0.28);
  ctx.beginPath();
  ctx.arc(0, 0, 64 * u, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,255,106,0.10)';
  ctx.fill();
  ctx.restore();

  ctx.translate(0, bob);

  // kaki
  ctx.lineCap = 'round';
  ctx.strokeStyle = PANTS;
  ctx.lineWidth = 19 * u;
  ctx.beginPath(); ctx.moveTo(-13 * u, -118 * u); ctx.lineTo(-17 * u, -12 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13 * u, -118 * u); ctx.lineTo(17 * u, -12 * u); ctx.stroke();
  // sepatu
  ctx.fillStyle = HOOD_D;
  rr(ctx, -34 * u, -16 * u, 34 * u, 16 * u, 7 * u); ctx.fill();
  rr(ctx, 0, -16 * u, 34 * u, 16 * u, 7 * u); ctx.fill();

  // torso (hoodie)
  ctx.beginPath();
  ctx.moveTo(-27 * u, -118 * u);
  ctx.quadraticCurveTo(-36 * u, -170 * u, -33 * u, -214 * u);
  ctx.quadraticCurveTo(0, -226 * u, 33 * u, -214 * u);
  ctx.quadraticCurveTo(36 * u, -170 * u, 27 * u, -118 * u);
  ctx.quadraticCurveTo(0, -108 * u, -27 * u, -118 * u);
  ctx.closePath();
  ctx.fillStyle = HOOD;
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,255,140,0.35)';
  ctx.lineWidth = 2 * u;
  ctx.stroke();
  // resleting
  ctx.strokeStyle = 'rgba(160,255,190,0.6)';
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath(); ctx.moveTo(0, -214 * u); ctx.lineTo(0, -120 * u); ctx.stroke();
  // hood belakang
  ctx.beginPath();
  ctx.arc(0, -238 * u, 40 * u, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fillStyle = HOOD_D;
  ctx.fill();
  // leher
  ctx.fillStyle = SKIN_D;
  ctx.fillRect(-8 * u, -240 * u, 16 * u, 18 * u);

  // kepala
  const hx = Math.sin(t * 0.9) * 2 * u;
  const hy = -272 * u;
  const hr = 41 * u;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(Math.sin(t * 1.3) * 0.03);
  // rambut belakang
  ctx.beginPath(); ctx.arc(0, -4 * u, hr + 3 * u, 0, Math.PI * 2); ctx.fillStyle = HAIR; ctx.fill();
  // wajah
  ctx.beginPath(); ctx.arc(0, 3 * u, hr - 3 * u, 0, Math.PI * 2); ctx.fillStyle = SKIN; ctx.fill();
  // rambut depan (cap)
  ctx.beginPath(); ctx.arc(0, 1 * u, hr - 1 * u, Math.PI * 0.98, Math.PI * 2.02); ctx.fillStyle = HAIR; ctx.fill();
  // spikes
  ctx.beginPath();
  ctx.moveTo(-26 * u, -32 * u);
  ctx.lineTo(-16 * u, -56 * u);
  ctx.lineTo(-8 * u, -34 * u);
  ctx.lineTo(0, -60 * u);
  ctx.lineTo(8 * u, -34 * u);
  ctx.lineTo(18 * u, -54 * u);
  ctx.lineTo(26 * u, -30 * u);
  ctx.closePath();
  ctx.fillStyle = HAIR;
  ctx.fill();
  // headphone
  ctx.strokeStyle = '#0B3018';
  ctx.lineWidth = 7 * u;
  ctx.beginPath(); ctx.arc(0, 2 * u, hr + 4 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#0B3018';
  rr(ctx, -hr - 8 * u, -8 * u, 13 * u, 26 * u, 6 * u); ctx.fill();
  rr(ctx, hr - 5 * u, -8 * u, 13 * u, 26 * u, 6 * u); ctx.fill();
  ctx.strokeStyle = 'rgba(70,255,140,0.7)';
  ctx.lineWidth = 1.6 * u;
  rr(ctx, -hr - 8 * u, -8 * u, 13 * u, 26 * u, 6 * u); ctx.stroke();
  rr(ctx, hr - 5 * u, -8 * u, 13 * u, 26 * u, 6 * u); ctx.stroke();
  // mata + kedip
  const bp = (t + (o.blinkSeed || 0)) % 3.4;
  let bs = 1;
  if (bp < 0.14) bs = Math.abs(Math.cos((bp / 0.14) * Math.PI));
  const browLift = wave * 4 * u + Math.sin(t * 1.7) * 1 * u;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 15 * u, -2 * u);
    ctx.scale(1, Math.max(0.12, bs));
    ctx.beginPath(); ctx.arc(0, 0, 6.4 * u, 0, Math.PI * 2); ctx.fillStyle = '#0A2413'; ctx.fill();
    ctx.beginPath(); ctx.arc(2 * u, -2 * u, 1.7 * u, 0, Math.PI * 2); ctx.fillStyle = 'rgba(230,255,240,0.9)'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#0A2413';
    ctx.lineWidth = 2.6 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 8 * u, -14 * u - browLift);
    ctx.lineTo(s * 21 * u, -17 * u - browLift);
    ctx.stroke();
  }
  // blush
  ctx.fillStyle = 'rgba(90,255,150,0.16)';
  ctx.beginPath(); ctx.arc(-24 * u, 12 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(24 * u, 12 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  // hidung
  ctx.strokeStyle = 'rgba(120,150,90,0.55)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.moveTo(0, 4 * u); ctx.lineTo(-2 * u, 10 * u); ctx.stroke();
  // mulut
  if (talk > 0.05) {
    const open = talk * (2 * u + Math.abs(Math.sin(t * 9.3)) * 7 * u);
    ctx.save();
    ctx.translate(0, 20 * u);
    ctx.scale(1, Math.max(0.2, open / (8 * u)));
    ctx.beginPath(); ctx.arc(0, 0, 8 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#123320';
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#123320';
    ctx.lineWidth = 2.6 * u;
    ctx.beginPath();
    ctx.arc(0, 16 * u, 9 * u, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.restore(); // kepala

  // lengan kiri (nunjuk saat outro)
  const shY = -208 * u;
  let la1 = Math.PI - 1.25 + Math.sin(t * 1.9) * 0.05;
  let la2 = 0.18;
  if (point > 0) {
    la1 = lerp(la1, Math.PI + 0.18, point);
    la2 = lerp(la2, -0.06, point);
  }
  const L = armLimb(ctx, -31 * u, shY, la1, 62 * u, la2, 58 * u, 15 * u, HOOD_D, SKIN);
  if (point > 0.3) {
    ctx.save();
    ctx.translate(L.hx, L.hy);
    ctx.rotate(L.ang);
    ctx.fillStyle = SKIN;
    rr(ctx, 0, -3.2 * u, 20 * u, 6.4 * u, 3 * u);
    ctx.fill();
    ctx.restore();
  }

  // lengan kanan (wave / thumbs up)
  let ra1 = 1.25 + Math.sin(t * 1.9 + 1) * 0.05;
  let ra2 = 0.18;
  if (wave > 0) {
    const wa1 = -1.18 + Math.sin(t * 7.2) * 0.1;
    const wa2 = -0.7 + Math.sin(t * 7.2 + 1.1) * 0.5;
    ra1 = lerp(ra1, wa1, wave);
    ra2 = lerp(ra2, wa2, wave);
  } else if (thumb > 0) {
    ra1 = lerp(ra1, 0.35, thumb);
    ra2 = lerp(ra2, -1.9, thumb);
  }
  const R = armLimb(ctx, 31 * u, shY, ra1, 62 * u, ra2, 58 * u, 15 * u, HOOD, SKIN);
  if (thumb > 0.3) {
    ctx.save();
    ctx.translate(R.hx, R.hy);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(0, 0, 9.5 * u, 0, Math.PI * 2); ctx.fill();
    rr(ctx, -4 * u, -26 * u, 8.5 * u, 20 * u, 4 * u);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ----------------------------- subtitle (dari narasi) -----------------------------
const CAPTIONS = [
  [3, 8, 'Sebelumnya, kita udah bahas: apa itu enkripsi.'],
  [8, 14.5, 'Sekarang, kita bahas jenis-jenis enkripsi umum, yang paling sering dipake, dari yang paling dasar sampai yang tingkat militer.'],
  [14.5, 20, 'Tapi di part ini, kita fokus ke satu dulu: DES. 😎'],
  [20, 28, 'DES ini lahir di IBM, awal 1970-an.'],
  [28, 36, 'Dasarnya dari desain Horst Feistel yang namanya Lucifer.'],
  [36, 45, 'Jadi ceritanya, IBM lagi bikin algo enkripsi, terus Feistel bikin fondasi strukturnya.'],
  [45, 53, 'Terus Januari 1977, DES resmi jadi standar federal, FIPS PUB 46, sama National Bureau of Standards.'],
  [53, 59, 'Tapi ada kontroversi: NSA ikut campur, dan ukuran kunci dikurangi. 👀'],
  [59, 65, 'S-box-nya justru diperkuat, tapi tetap aja bikin curiga.'],
  [65, 73, 'Sekarang teknisnya. DES itu symmetric-key block cipher.'],
  [73, 82, 'Blok datanya 64 bit. Kuncinya 64 bit, tapi cuma 56 bit yang efektif.'],
  [82, 95, '8 bit sisanya parity, dibuang. Jadi kunci aslinya ya 56 bit doang.'],
  [95, 103, 'Strukturnya pake balanced Feistel network, 16 putaran.'],
  [103, 112, 'Datanya dipecah dua, kiri dan kanan. Tiap putaran, satu sisi diacak pake fungsi F, terus di-XOR ke sisi lain, lalu ditukar.'],
  [112, 118, 'Ulang 16 kali.'],
  [118, 125, 'Simpel, tapi kuat buat zamannya. 💪'],
  [125, 132, 'Masalahnya, 56 bit itu pendek banget buat sekarang.'],
  [132, 140, 'Brute force jadi gampang. Komputer makin cepat.'],
  [140, 150, 'GPU, hardware murah, tinggal hajar. 🔨'],
  [150, 157, 'Buktinya: Juni 1997, DESCHALL Project berhasil mecahin pesan DES.'],
  [157, 166, 'Juli 1998, EFF Deep Crack mecahin kunci DES dalam 56 jam, biayanya sekitar 250 ribu dolar.'],
  [166, 175, 'Januari 1999, Deep Crack plus distributed.net cuma butuh 22 jam 15 menit. Gila, kan? 🤯'],
  [175, 184, 'Karena udah nggak aman, DES diganti Triple DES, terus diganti lagi sama AES.'],
  [184, 192, 'NIST resmi narik DES sebagai standar di 2005.'],
  [192, 200, 'Tapi jangan salah, DES itu pondasi penting buat kriptografi modern.'],
  [200, 209, 'Walaupun udah pensiun, DES ninggalin jejak besar.'],
  [209, 217, 'Banyak block cipher modern belajar dari struktur Feistel dan desain S-box-nya.'],
  [217, 225, 'Jadi DES itu bukan cuma sejarah, tapi batu loncatan. 🚀'],
  [225, 232, 'Itu dia DES, enkripsi legendaris yang udah nggak aman tapi tetap penting.'],
  [232, 240, 'Follow @random.ai.id, AI Gabut, biar lu nggak gabut soal teknologi. Ciao! 👋'],
];

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/u;

function tokenize(text) {
  const tokens = [];
  let cur = '';
  for (const ch of String(text)) {
    if (EMOJI_RE.test(ch)) {
      if (cur) { tokens.push({ t: 'text', v: cur }); cur = ''; }
      tokens.push({ t: 'emoji', v: ch });
    } else cur += ch;
  }
  if (cur) tokens.push({ t: 'text', v: cur });
  return tokens;
}

const CAPTION_LAYOUT_CACHE = new Map();

function buildCaptionLayouts(W, H, F) {
  const size = Math.round(30 * F);
  const maxW = W * 0.78;
  const lh = size * 1.45;
  const padX = 26 * F, padY = 16 * F;
  const bw = Math.min(maxW + padX * 2, W * 0.86);
  return CAPTIONS.map(([start, end, text]) => {
    const words = [];
    for (const tok of tokenize(text)) {
      if (tok.t === 'emoji') { words.push({ v: tok.v, emoji: true }); continue; }
      const parts = tok.v.split(' ');
      parts.forEach((part, index) => {
        if (index > 0) words.push({ space: true });
        if (part) words.push({ v: part });
      });
    }
    const lines = [];
    let line = [], lineWidth = 0;
    for (const word of words) {
      const width = word.emoji ? size * 1.3 : word.space ? size * 0.3 : estWidth(word.v, size);
      if (lineWidth + width > maxW && line.length) {
        lines.push({ words: line, width: lineWidth });
        line = [];
        lineWidth = 0;
        if (word.space) continue;
      }
      line.push({ ...word, width });
      lineWidth += width;
    }
    if (line.length) lines.push({ words: line, width: lineWidth });
    const bh = lines.length * lh + padY * 2;
    return {
      start, end, size, lh, padX, padY, bw, bh,
      bx: W / 2 - bw / 2,
      by: H - bh - 26 * F,
      lines,
    };
  });
}

function drawCaptions(env) {
  const { ctx, W, H, F, t, st } = env;
  const cacheKey = `${W}x${H}`;
  let layouts = CAPTION_LAYOUT_CACHE.get(cacheKey);
  if (!layouts) {
    layouts = buildCaptionLayouts(W, H, F);
    CAPTION_LAYOUT_CACHE.set(cacheKey, layouts);
  }

  // Binary search the active subtitle instead of scanning every caption each frame.
  let low = 0, high = layouts.length - 1, cap = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = layouts[mid];
    if (t < candidate.start) high = mid - 1;
    else if (t >= candidate.end) low = mid + 1;
    else { cap = candidate; break; }
  }
  if (!cap) return;
  const alpha = Math.min(seg(t, cap.start, cap.start + 0.25), 1 - seg(t, cap.end - 0.25, cap.end));
  if (alpha <= 0) return;

  const { size, lh, padX, padY, bw, bh, bx, by, lines } = cap;
  ctx.globalAlpha = alpha;
  rr(ctx, bx, by, bw, bh, 14 * F);
  ctx.fillStyle = 'rgba(3,15,8,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,255,140,0.35)';
  ctx.lineWidth = 1.4 * F;
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,255,140,0.8)';
  ctx.fillRect(bx, by + 10 * F, 3.4 * F, bh - 20 * F);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let x = W / 2 - line.width / 2;
    const y = by + padY + size * 0.95 + i * lh;
    for (const word of line.words) {
      if (word.space) { x += word.width; continue; }
      if (word.emoji) {
        if (st.emoji) {
          setText(ctx, st, size, st.emoji);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(word.v, x, y);
        }
        x += word.width;
        continue;
      }
      setText(ctx, st, size);
      ctx.fillStyle = '#E4FFF0';
      ctx.fillText(word.v, x, y);
      x += word.width;
    }
  }
  ctx.globalAlpha = 1;
}

// ----------------------------- HUD & transisi -----------------------------
function drawHUD(env) {
  const { ctx, W, H, F, t, st } = env;
  drawText(ctx, st, 'PART 2', 28 * F, 40 * F, { size: 15 * F, color: C.dim, alpha: 0.85 });
  drawText(ctx, st, 'JENIS-JENIS ENKRIPSI - DES', 28 * F, 60 * F, { size: 15 * F, color: '#BFFFD9', alpha: 0.85 });
  drawText(ctx, st, '@random.ai.id', W - 28 * F, 40 * F, { size: 15 * F, color: '#BFFFD9', align: 'right', alpha: 0.85 });
  drawText(ctx, st, 'AI GABUT', W - 28 * F, 60 * F, { size: 15 * F, color: C.dim, align: 'right', alpha: 0.85 });
  const py = H - 8 * F;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(120,255,170,0.12)';
  ctx.fillRect(0, py, W, 3 * F);
  ctx.fillStyle = 'rgba(70,255,140,0.8)';
  ctx.fillRect(0, py, W * (t / DURATION), 3 * F);
  ctx.globalAlpha = 1;
}

function drawOverlays(env, sc) {
  const { ctx, W, H, lt, t } = env;
  const dur = sc.end - sc.start;
  let a = Math.max((1 - seg(lt, 0, 0.4)) * 0.85, seg(lt, dur - 0.4, dur) * 0.85);
  if (t < 0.35) a = Math.max(a, 1 - seg(t, 0, 0.35));
  if (t > DURATION - 1) a = Math.max(a, seg(t, DURATION - 1, DURATION));
  if (a > 0.001) {
    ctx.fillStyle = `rgba(1,6,3,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ----------------------------- scene 1: title (0-3) -----------------------------
function sceneTitle(e) {
  const { ctx, W, H, F, lt, st } = e;
  const cx = W / 2;
  const closeP = easeOutCubic(seg(lt, 0.35, 0.95));
  drawPadlock(ctx, cx, H * 0.235, 1.6 * F, { shackle: closeP, glow: seg(lt, 0.95, 1.5) });
  const a1 = seg(lt, 0.25, 0.65), a2 = seg(lt, 0.45, 0.9), a3 = seg(lt, 0.75, 1.25), a4 = seg(lt, 1.1, 1.6);
  drawSpaced(ctx, st, 'PART 2', cx, H * 0.435, { size: 26 * F, spacing: 16 * F, color: C.dim, alpha: a1 });
  drawText(ctx, st, 'JENIS-JENIS ENKRIPSI', cx, H * 0.515, { size: 52 * F, align: 'center', color: '#EFFFF5', alpha: a2 });
  setText(ctx, st, 130 * F);
  const wDes = estWidth('DES', 130 * F);
  const gd = ctx.createLinearGradient(0, H * 0.56, 0, H * 0.72);
  gd.addColorStop(0, '#C9FFDF');
  gd.addColorStop(0.5, '#43FF8B');
  gd.addColorStop(1, '#0DBF5C');
  ctx.globalAlpha = a3;
  ctx.fillStyle = gd;
  ctx.fillText('DES', cx - wDes / 2, H * 0.7);
  ctx.globalAlpha = 1;
  chip(ctx, st, cx, H * 0.8, '@random.ai.id', { size: 18 * F, tone: 'bright', alpha: a4 });
  drawText(ctx, st, 'AI GABUT', cx, H * 0.86, { size: 15 * F, align: 'center', color: C.dim, alpha: a4 });
}

// ----------------------------- scene 2: intro AZRIEL (3-20) -----------------------------
function sceneIntro(e) {
  const { ctx, W, H, F, lt, st } = e;
  const slide = easeOutCubic(seg(lt, 0.1, 1));
  const ax = W * 0.24 - (1 - slide) * W * 0.3;
  const wave = seg(lt, 0.5, 1.1) * (1 - seg(lt, 4.5, 5.5));
  drawAzriel(ctx, ax, H * 0.93, 330 * F, e.t, { wave, talk: lt > 0.8 ? 1 : 0, blinkSeed: 0.7 });
  chip(ctx, st, ax, H * 0.235, 'AZRIEL', { size: 20 * F, tone: 'bright', alpha: slide });
  chip(ctx, st, ax, H * 0.235 + 44 * F, '@random.ai.id - AI Gabut', { size: 14 * F, tone: 'dim', alpha: slide });

  // terminal
  const ap = seg(lt, 0.6, 1.2);
  const px = W * 0.47, py = H * 0.2, pw = W * 0.44, ph = H * 0.58;
  ctx.globalAlpha = ap;
  panel(ctx, px, py, pw, ph, { r: 14 * F });
  rr(ctx, px, py, pw, 36 * F, 14 * F);
  ctx.fillStyle = 'rgba(10,50,26,0.95)';
  ctx.fill();
  ['#2EE87E', '#9CFFC6', '#57C98B'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(px + 22 * F + i * 18 * F, py + 18 * F, 5 * F, 0, Math.PI * 2);
    ctx.fill();
  });
  drawText(ctx, st, 'azriel --intro.log', px + pw - 16 * F, py + 24 * F, { size: 13 * F, color: C.dim, align: 'right' });
  const lines = [
    [1.4, '> memuat part-02 ... OK'],
    [3.2, '> sebelumnya: apa itu enkripsi'],
    [6.2, '> sekarang: jenis-jenis enkripsi umum'],
    [9.8, '> dari paling dasar -> tingkat militer'],
    [13.8, '> fokus part ini: DES'],
  ];
  let lastY = 0, lastW = 0;
  lines.forEach(([s0, txt], i) => {
    const vis = typed(txt, lt, s0, 30);
    if (!vis) return;
    const yy = py + 72 * F + i * 32 * F;
    setText(ctx, st, 17 * F);
    ctx.fillStyle = '#9FFFC6';
    ctx.fillText(vis, px + 22 * F, yy);
    lastY = yy;
    lastW = estWidth(vis, 17 * F);
  });
  if (lastY && lt % 1 < 0.55) {
    ctx.fillStyle = C.main;
    ctx.fillRect(px + 22 * F + lastW + 6 * F, lastY - 14 * F, 9 * F, 18 * F);
  }
  ctx.globalAlpha = 1;
}

// ----------------------------- scene 3: IBM / Lucifer (20-45) -----------------------------
function sceneIBM(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'AWAL 1970-AN - LAHIRNYA DES', W / 2, H * 0.13, { size: 36 * F, alpha: seg(lt, 0.2, 0.8) });

  const y = H * 0.7, x0 = W * 0.1, x1 = W * 0.9;
  ctx.strokeStyle = 'rgba(70,255,140,0.35)';
  ctx.lineWidth = 2 * F;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (let i = 0; i <= 6; i++) {
    const x = x0 + (x1 - x0) * (i / 6);
    ctx.beginPath(); ctx.moveTo(x, y - 6 * F); ctx.lineTo(x, y + 6 * F); ctx.stroke();
    drawText(ctx, st, `'${70 + i}`, x, y + 26 * F, { size: 15 * F, color: C.dim, align: 'center' });
  }
  const p = easeInOutCubic(seg(lt, 0.5, 23));
  const dx = lerp(x0, x1, p);
  ctx.fillStyle = 'rgba(70,255,140,0.25)';
  ctx.beginPath(); ctx.arc(dx, y, 14 * F, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8DFFBE';
  ctx.beginPath(); ctx.arc(dx, y, 6 * F, 0, Math.PI * 2); ctx.fill();

  const cards = [
    { at: 1.5, cx: W * 0.235, title: 'IBM', sub: 'bikin algoritma enkripsi', icon: 'ibm' },
    { at: 7.5, cx: W * 0.5, title: 'HORST FEISTEL', sub: 'bikin fondasi strukturnya', icon: 'person' },
    { at: 13.5, cx: W * 0.765, title: 'LUCIFER', sub: 'nama desain awalnya', icon: 'flame' },
  ];
  for (const c of cards) {
    const ap = easeOutBack(seg(lt, c.at, c.at + 0.7));
    if (ap <= 0) continue;
    const cw = W * 0.215, ch = H * 0.3;
    ctx.save();
    ctx.translate(c.cx, H * 0.24 + ch / 2);
    ctx.scale(ap, ap);
    ctx.translate(-cw / 2, -ch / 2);
    panel(ctx, 0, 0, cw, ch, { r: 16 * F });
    const icy = ch * 0.34;
    if (c.icon === 'ibm') {
      drawText(ctx, st, 'IBM', cw / 2, icy + 16 * F, { size: 44 * F, align: 'center', color: '#EFFFF5' });
      ctx.fillStyle = 'rgba(4,20,11,0.9)';
      for (let i = 0; i < 4; i++) ctx.fillRect(cw / 2 - 70 * F, icy - 26 * F + i * 13 * F, 140 * F, 5 * F);
    } else if (c.icon === 'person') {
      ctx.strokeStyle = '#8DFFBE';
      ctx.lineWidth = 3 * F;
      ctx.beginPath(); ctx.arc(cw / 2, icy - 12 * F, 15 * F, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cw / 2, icy + 34 * F, 26 * F, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      ctx.fillStyle = '#8DFFBE';
      ctx.beginPath();
      ctx.moveTo(cw / 2, icy - 26 * F);
      ctx.bezierCurveTo(cw / 2 + 22 * F, icy - 6 * F, cw / 2 + 16 * F, icy + 16 * F, cw / 2, icy + 22 * F);
      ctx.bezierCurveTo(cw / 2 - 16 * F, icy + 16 * F, cw / 2 - 22 * F, icy - 6 * F, cw / 2, icy - 26 * F);
      ctx.fill();
      ctx.fillStyle = '#0B3B1D';
      ctx.beginPath();
      ctx.moveTo(cw / 2, icy - 8 * F);
      ctx.bezierCurveTo(cw / 2 + 9 * F, icy + 2 * F, cw / 2 + 7 * F, icy + 12 * F, cw / 2, icy + 15 * F);
      ctx.bezierCurveTo(cw / 2 - 7 * F, icy + 12 * F, cw / 2 - 9 * F, icy + 2 * F, cw / 2, icy - 8 * F);
      ctx.fill();
    }
    drawText(ctx, st, c.title, cw / 2, ch * 0.68, { size: 21 * F, align: 'center', color: '#DFFFE9' });
    drawWrapped(ctx, st, c.sub, cw / 2, ch * 0.68 + 26 * F, { size: 15 * F, color: C.dim, maxW: cw * 0.8 });
    ctx.restore();
    ctx.strokeStyle = `rgba(70,255,140,${0.25 * ap})`;
    ctx.lineWidth = 1.5 * F;
    ctx.beginPath();
    ctx.moveTo(c.cx, H * 0.24 + ch);
    ctx.lineTo(c.cx, y);
    ctx.stroke();
  }
}

// ----------------------------- scene 4: FIPS PUB 46 (45-65) -----------------------------
function sceneFIPS(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'JANUARI 1977 - STANDAR FEDERAL', W / 2, H * 0.11, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });

  const slide = easeOutCubic(seg(lt, 0.2, 1));
  const dw = W * 0.3, dh = H * 0.62;
  const dx = W * 0.115, dy = H * 0.2 + (1 - slide) * 40 * F;
  ctx.globalAlpha = slide;
  panel(ctx, dx, dy, dw, dh, { r: 10 * F, bg: 'rgba(6,34,18,0.94)', bd: 'rgba(120,255,170,0.5)', lw: 2 * F });
  ctx.fillStyle = 'rgba(2,14,7,0.9)';
  ctx.beginPath();
  ctx.moveTo(dx + dw - 40 * F, dy);
  ctx.lineTo(dx + dw, dy + 40 * F);
  ctx.lineTo(dx + dw - 40 * F, dy + 40 * F);
  ctx.closePath();
  ctx.fill();
  drawText(ctx, st, 'FIPS PUB 46', dx + dw / 2, dy + dh * 0.13, { size: 34 * F, align: 'center', color: '#EFFFF5' });
  ctx.strokeStyle = 'rgba(120,255,170,0.4)';
  ctx.lineWidth = 1.5 * F;
  ctx.beginPath();
  ctx.moveTo(dx + dw * 0.15, dy + dh * 0.17);
  ctx.lineTo(dx + dw * 0.85, dy + dh * 0.17);
  ctx.stroke();
  drawText(ctx, st, 'Data Encryption Standard', dx + dw / 2, dy + dh * 0.225, { size: 17 * F, align: 'center', color: C.soft });
  const rows = [
    ['Ditetapkan', 'Januari 1977'],
    ['Lembaga', 'National Bureau of Standards'],
    ['Jenis', 'Symmetric-key block cipher'],
    ['Status', 'Standar federal AS'],
  ];
  rows.forEach((r, i) => {
    const yy = dy + dh * (0.33 + i * 0.085);
    drawText(ctx, st, r[0], dx + dw * 0.1, yy, { size: 14 * F, color: '#6FCF97' });
    drawText(ctx, st, r[1], dx + dw * 0.1, yy + 19 * F, { size: 16 * F, color: '#DFFFE9' });
  });
  ctx.fillStyle = 'rgba(120,255,170,0.14)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(dx + dw * 0.1, dy + dh * (0.72 + i * 0.055), dw * 0.8 * (i === 3 ? 0.55 : 1), 7 * F);
  }
  ctx.globalAlpha = 1;

  // stempel
  const sp = easeOutBack(seg(lt, 4.5, 5.2));
  if (sp > 0) {
    ctx.save();
    ctx.translate(dx + dw * 0.62, dy + dh * 0.52);
    ctx.rotate(-0.24);
    ctx.scale(sp, sp);
    ctx.globalAlpha = Math.min(1, sp * 1.2) * 0.95;
    ctx.strokeStyle = C.warn;
    ctx.lineWidth = 3.5 * F;
    ctx.strokeRect(-110 * F, -34 * F, 220 * F, 68 * F);
    ctx.lineWidth = 1.5 * F;
    ctx.strokeRect(-102 * F, -26 * F, 204 * F, 52 * F);
    drawText(ctx, st, 'STANDAR FEDERAL', 0, 10 * F, { size: 22 * F, align: 'center', color: C.warn });
    ctx.restore();
  }

  // chips kontroversi (ikon digambar, bukan emoji)
  drawText(ctx, st, 'KONTROVERSI', W * 0.7, H * 0.215, { size: 18 * F, align: 'center', color: C.soft, alpha: seg(lt, 6, 6.8) });
  const items = [
    [7, 'NSA ikut campur', 'warn', 'tri'],
    [10, 'Ukuran kunci dikurangi', 'warn', 'tri'],
    [13, 'S-box justru diperkuat', 'green', 'check'],
    [16, 'Tetap aja bikin curiga...', 'dim', 'dots'],
  ];
  items.forEach(([at, txt, tone, icon], i) => {
    const ap = easeOutCubic(seg(lt, at, at + 0.6));
    if (ap <= 0) return;
    const bw = W * 0.38, bh = H * 0.095;
    const bx = W * 0.51 + (1 - ap) * 40 * F;
    const by = H * (0.26 + i * 0.135);
    ctx.globalAlpha = ap;
    panel(ctx, bx, by, bw, bh, { r: 12 * F });
    const ix = bx + 28 * F, iy = by + bh / 2;
    const col = tone === 'warn' ? '#EAFF9E' : tone === 'dim' ? '#7FD9A6' : '#9CFFC6';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2.5 * F;
    ctx.lineCap = 'round';
    if (icon === 'tri') {
      ctx.beginPath();
      ctx.moveTo(ix, iy - 11 * F);
      ctx.lineTo(ix + 12 * F, iy + 9 * F);
      ctx.lineTo(ix - 12 * F, iy + 9 * F);
      ctx.closePath();
      ctx.stroke();
      drawText(ctx, st, '!', ix, iy + 7 * F, { size: 13 * F, align: 'center', color: col });
    } else if (icon === 'check') {
      ctx.beginPath();
      ctx.moveTo(ix - 9 * F, iy);
      ctx.lineTo(ix - 2 * F, iy + 8 * F);
      ctx.lineTo(ix + 11 * F, iy - 8 * F);
      ctx.stroke();
    } else {
      for (let d = -1; d <= 1; d++) {
        ctx.beginPath();
        ctx.arc(ix + d * 9 * F, iy, 2.4 * F, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawText(ctx, st, txt, bx + 54 * F, by + bh / 2 + 6 * F, { size: 18 * F, color: '#E4FFF0' });
    ctx.globalAlpha = 1;
  });
}

// ----------------------------- scene 5: spesifikasi (65-95) -----------------------------
function sceneSpec(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'SPESIFIKASI TEKNIS', W / 2, H * 0.1, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });
  chip(ctx, st, W / 2, H * 0.165, 'symmetric-key block cipher', { size: 14 * F, alpha: seg(lt, 0.7, 1.3) });

  // blok 64-bit terbelah
  const ap = seg(lt, 0.3, 1);
  const bw = W * 0.3, bh = H * 0.3, bcx = W * 0.26, bcy = H * 0.47;
  const gap = easeInOutCubic(seg(lt, 2.2, 4.4)) * 44 * F;
  ctx.globalAlpha = ap;
  const btop = bcy - bh / 2 - 26 * F;
  ctx.strokeStyle = 'rgba(120,255,170,0.6)';
  ctx.lineWidth = 2 * F;
  ctx.beginPath();
  ctx.moveTo(bcx - bw / 2, btop + 10 * F);
  ctx.lineTo(bcx - bw / 2, btop);
  ctx.lineTo(bcx + bw / 2, btop);
  ctx.lineTo(bcx + bw / 2, btop + 10 * F);
  ctx.stroke();
  drawText(ctx, st, 'BLOCK 64 BIT', bcx, btop - 10 * F, { size: 18 * F, align: 'center', color: '#EFFFF5' });
  const hw = (bw - gap) / 2;
  const centers = [bcx - gap / 2 - hw / 2, bcx + gap / 2 + hw / 2];
  const tags = ['L', 'R'];
  centers.forEach((cc, i) => {
    panel(ctx, cc - hw / 2, bcy - bh / 2, hw, bh, { r: 10 * F, bg: 'rgba(9,48,25,0.95)', bd: 'rgba(120,255,170,0.55)', lw: 2 * F });
    ctx.fillStyle = 'rgba(120,255,170,0.16)';
    const rows = 4, cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (hash(i * 37 + r * 7 + c) > 0.45) {
          ctx.fillRect(
            cc - hw / 2 + 10 * F + c * (hw - 20 * F) / cols,
            bcy - bh / 2 + 34 * F + r * (bh - 58 * F) / rows,
            (hw - 20 * F) / cols - 4 * F,
            (bh - 58 * F) / rows - 6 * F
          );
        }
      }
    }
    drawText(ctx, st, '32 bit', cc, bcy + 6 * F, { size: 20 * F, align: 'center', color: '#EFFFF5' });
    chip(ctx, st, cc, bcy - bh / 2 + 14 * F, tags[i], { size: 11 * F });
  });
  ctx.globalAlpha = 1;

  // grid kunci 64 bit
  const cs = 22 * F, gg = 5 * F, kx = W * 0.565, ky = H * 0.27;
  drawText(ctx, st, 'KUNCI: 8 byte x 8 bit', kx + (8 * (cs + gg)) / 2, ky - 16 * F, { size: 15 * F, align: 'center', color: C.dim, alpha: seg(lt, 1.5, 2) });
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    rr(ctx, kx + c * (cs + gg), ky + r * (cs + gg), cs, cs, 4 * F);
    ctx.strokeStyle = 'rgba(120,255,170,0.25)';
    ctx.lineWidth = 1.2 * F;
    ctx.stroke();
  }
  const lit = Math.floor(seg(lt, 2.5, 7.5) * 56);
  let litDrawn = 0;
  for (let i = 0; i < 64; i++) {
    const parity = i % 8 === 7;
    const r = Math.floor(i / 8), c = i % 8;
    const x = kx + c * (cs + gg), y = ky + r * (cs + gg);
    if (!parity) {
      if (litDrawn < lit) {
        rr(ctx, x, y, cs, cs, 4 * F);
        ctx.fillStyle = `rgba(51,255,119,${0.35 + 0.5 * hash(i)})`;
        ctx.fill();
        litDrawn++;
      }
    } else {
      const j = Math.floor(i / 8);
      const on = seg(lt, 8.2 + j * 0.22, 8.7 + j * 0.22);
      if (on > 0) {
        rr(ctx, x, y, cs, cs, 4 * F);
        ctx.fillStyle = `rgba(255,107,94,${0.3 * on})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,120,105,${0.9 * on})`;
        ctx.lineWidth = 2 * F;
        ctx.beginPath();
        ctx.moveTo(x + 5 * F, y + 5 * F);
        ctx.lineTo(x + cs - 5 * F, y + cs - 5 * F);
        ctx.moveTo(x + cs - 5 * F, y + 5 * F);
        ctx.lineTo(x + 5 * F, y + cs - 5 * F);
        ctx.stroke();
      }
    }
  }
  const gy2 = ky + 8 * (cs + gg) + 26 * F;
  drawText(ctx, st, 'Key masuk: 64 bit', kx + 90 * F, gy2, { size: 17 * F, align: 'center', color: C.soft, alpha: seg(lt, 3, 3.6) });
  const ax0 = kx + 190 * F, ax1 = kx + 250 * F;
  ctx.strokeStyle = 'rgba(120,255,170,0.7)';
  ctx.lineWidth = 2.5 * F;
  ctx.beginPath(); ctx.moveTo(ax0, gy2 - 6 * F); ctx.lineTo(ax1, gy2 - 6 * F); ctx.stroke();
  arrowHead(ctx, ax1, gy2 - 6 * F, 0, 7 * F);
  drawText(ctx, st, 'Efektif: 56 bit', kx + 360 * F, gy2, { size: 20 * F, align: 'center', color: '#EFFFF5', alpha: seg(lt, 3.4, 4) });
  drawText(ctx, st, '8 bit parity dibuang', kx + (8 * (cs + gg)) / 2, gy2 + 30 * F, { size: 14 * F, align: 'center', color: '#FFB3A8', alpha: seg(lt, 8.5, 9.5) });
}

// ----------------------------- scene 6: Feistel (95-125) -----------------------------
function sceneFeistel(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'FEISTEL NETWORK - 16 PUTARAN', W / 2, H * 0.1, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });
  const xL = W * 0.38, xR = W * 0.62, y0 = H * 0.18, y1 = H * 0.7;
  const step = (y1 - y0) / 16;
  const done = seg(lt, 1, 21) * 16;

  chip(ctx, st, xL, y0 - 26 * F, 'KIRI', { size: 14 * F });
  chip(ctx, st, xR, y0 - 26 * F, 'KANAN', { size: 14 * F });
  ctx.strokeStyle = 'rgba(70,255,140,0.25)';
  ctx.lineWidth = 3 * F;
  ctx.beginPath();
  ctx.moveTo(xL, y0); ctx.lineTo(xL, y1);
  ctx.moveTo(xR, y0); ctx.lineTo(xR, y1);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    const a = clamp(done - i, 0, 1);
    if (a <= 0) break;
    const ya = y0 + step * i, yb = y0 + step * (i + 1), ym = (ya + yb) / 2;
    const active = a < 1;
    ctx.strokeStyle = `rgba(90,255,150,${0.28 + 0.5 * a})`;
    ctx.lineWidth = 2 * F;
    ctx.beginPath(); ctx.moveTo(xL, ya); ctx.lineTo(xR, yb); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xR, ya); ctx.lineTo(xL, yb); ctx.stroke();
    const bs = 22 * F;
    rr(ctx, xR - bs / 2, ym - bs / 2, bs, bs, 5 * F);
    ctx.fillStyle = active ? 'rgba(20,120,60,0.95)' : 'rgba(10,60,30,0.95)';
    ctx.fill();
    ctx.strokeStyle = `rgba(140,255,180,${0.5 + 0.5 * a})`;
    ctx.lineWidth = 1.6 * F;
    ctx.stroke();
    drawText(ctx, st, 'F', xR, ym + 6 * F, { size: 14 * F, align: 'center', color: '#DFFFE9', alpha: a });
    ctx.beginPath();
    ctx.arc(xL, ym, 11 * F, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,30,16,0.95)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xL - 6 * F, ym); ctx.lineTo(xL + 6 * F, ym);
    ctx.moveTo(xL, ym - 6 * F); ctx.lineTo(xL, ym + 6 * F);
    ctx.stroke();
    if (active) {
      ctx.strokeStyle = 'rgba(200,255,220,0.9)';
      ctx.lineWidth = 2.4 * F;
      ctx.beginPath();
      ctx.arc(xR, ym, bs * 0.85 + Math.sin(e.t * 8) * 3 * F, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const n = clamp(Math.ceil(done), 0, 16);
  drawText(ctx, st, `ROUND ${n} / 16`, W / 2, H * 0.765, { size: 24 * F, align: 'center', color: '#EFFFF5' });
  const ay = H * 0.8;
  const off = (e.t * 0.4) % 1;
  ctx.strokeStyle = 'rgba(120,255,170,0.5)';
  ctx.lineWidth = 2 * F;
  ctx.beginPath(); ctx.moveTo(xL, ay - 7 * F); ctx.lineTo(xR, ay - 7 * F); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xR, ay + 7 * F); ctx.lineTo(xL, ay + 7 * F); ctx.stroke();
  arrowHead(ctx, xR - 2 * F, ay - 7 * F, 0, 7 * F);
  arrowHead(ctx, xL + 2 * F, ay + 7 * F, Math.PI, 7 * F);
  ctx.fillStyle = '#8DFFBE';
  ctx.beginPath(); ctx.arc(lerp(xL, xR, off), ay - 7 * F, 4 * F, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(lerp(xR, xL, off), ay + 7 * F, 4 * F, 0, Math.PI * 2); ctx.fill();

  chip(ctx, st, W * 0.845, H * 0.3, 'fungsi F + XOR', { size: 14 * F, alpha: seg(lt, 2, 2.6) });
  chip(ctx, st, W * 0.845, H * 0.38, 'tukar posisi tiap putaran', { size: 14 * F, alpha: seg(lt, 3, 3.6) });
  chip(ctx, st, W * 0.845, H * 0.46, 'balanced Feistel network', { size: 14 * F, alpha: seg(lt, 4, 4.6) });
}

// ----------------------------- scene 7: brute force (125-150) -----------------------------
function sceneBrute(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, '56-BIT TERLALU PENDEK', W / 2, H * 0.1, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });

  const ph = lt % 0.55;
  const shake = ph < 0.09 ? Math.sin(ph * 90) * 4 * F * (1 - ph / 0.09) : 0;
  const ringP = seg(ph, 0, 0.4);
  drawPadlock(ctx, W * 0.185 + shake, H * 0.33, 1.05 * F, { shackle: 1 });
  if (lt > 0.6) {
    ctx.strokeStyle = `rgba(255,180,120,${(1 - ringP) * 0.5})`;
    ctx.lineWidth = 2.5 * F;
    ctx.beginPath();
    ctx.arc(W * 0.185, H * 0.355, (46 + ringP * 60) * F, 0, Math.PI * 2);
    ctx.stroke();
  }
  chip(ctx, st, W * 0.185, H * 0.52, 'KEY 56-BIT', { size: 15 * F });

  // GPU / server
  const gx = W * 0.815, gy = H * 0.26;
  for (let i = 0; i < 3; i++) {
    const yy = gy + i * 54 * F;
    panel(ctx, gx - 95 * F, yy, 190 * F, 44 * F, { r: 8 * F });
    ctx.strokeStyle = 'rgba(140,255,180,0.7)';
    ctx.lineWidth = 2 * F;
    ctx.beginPath(); ctx.arc(gx - 58 * F, yy + 22 * F, 13 * F, 0, Math.PI * 2); ctx.stroke();
    for (let b = 0; b < 3; b++) {
      const ang = e.t * 7 + b * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(gx - 58 * F, yy + 22 * F);
      ctx.lineTo(gx - 58 * F + Math.cos(ang) * 11 * F, yy + 22 * F + Math.sin(ang) * 11 * F);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,255,170,0.18)';
    for (let v = 0; v < 4; v++) ctx.fillRect(gx - 24 * F + v * 18 * F, yy + 10 * F, 8 * F, 24 * F);
    const on = Math.sin(e.t * 5 + i * 2) > 0;
    ctx.fillStyle = on ? C.main : 'rgba(60,120,80,0.5)';
    ctx.beginPath(); ctx.arc(gx + 78 * F, yy + 22 * F, 4 * F, 0, Math.PI * 2); ctx.fill();
  }
  chip(ctx, st, gx, H * 0.52, 'GPU + HARDWARE MURAH', { size: 15 * F });
  drawText(ctx, st, 'vs', W / 2, H * 0.36, { size: 30 * F, align: 'center', color: C.dim, alpha: 0.8 });

  // counter keyspace
  const ap = seg(lt, 0.8, 1.4);
  const pw = W * 0.56, phh = H * 0.2, px = W / 2 - pw / 2, py = H * 0.6;
  ctx.globalAlpha = ap;
  panel(ctx, px, py, pw, phh, { r: 14 * F });
  drawText(ctx, st, 'KEYSPACE 2^56 - BRUTE FORCE', W / 2, py + 30 * F, { size: 15 * F, align: 'center', color: C.dim });
  const MAXV = 72057594037927936;
  const p = seg(lt, 1.5, 15);
  drawText(ctx, st, fmtID(Math.floor(MAXV * p)), W / 2, py + phh * 0.52, { size: 34 * F, align: 'center', color: '#EFFFF5' });
  ctx.fillStyle = 'rgba(120,255,170,0.15)';
  ctx.fillRect(px + 30 * F, py + phh * 0.72, pw - 60 * F, 8 * F);
  ctx.fillStyle = C.main;
  ctx.fillRect(px + 30 * F, py + phh * 0.72, (pw - 60 * F) * p, 8 * F);
  drawText(ctx, st, `dicoba: ${(p * 100).toFixed(1)}%`, W / 2, py + phh * 0.72 + 30 * F, { size: 13 * F, align: 'center', color: C.soft });
  ctx.globalAlpha = 1;

  const sp = easeOutBack(seg(lt, 9, 9.7));
  if (sp > 0) {
    ctx.save();
    ctx.translate(W * 0.5, H * 0.47);
    ctx.rotate(-0.08);
    ctx.scale(sp, sp);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3 * F;
    ctx.strokeRect(-170 * F, -30 * F, 340 * F, 60 * F);
    drawText(ctx, st, 'TERLALU PENDEK!', 0, 10 * F, { size: 26 * F, align: 'center', color: '#FFB3A8' });
    ctx.restore();
  }
}

// ----------------------------- scene 8: sejarah crack (150-175) -----------------------------
function sceneCracks(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'BUKTI: DES MULAI JEBOL', W / 2, H * 0.12, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });
  const cards = [
    { at: 1.5, x: W * 0.18, year: '1997', title: 'DESCHALL Project', sub: 'pesan DES berhasil dipecahkan lewat proyek terdistribusi', bar: null },
    { at: 9, x: W * 0.5, year: '1998', title: 'EFF Deep Crack', sub: 'mesin khusus seharga 250 ribu dolar', bar: 1, label: '56 jam' },
    { at: 16.5, x: W * 0.82, year: '1999', title: 'Deep Crack + distributed.net', sub: 'rekor baru pemecahan kunci DES', bar: 0.397, label: '22 jam 15 menit', hot: true },
  ];
  for (const c of cards) {
    const ap = easeOutCubic(seg(lt, c.at, c.at + 0.8));
    if (ap <= 0) continue;
    const cw = W * 0.27, ch = H * 0.46;
    const cy = H * 0.24 + (1 - ap) * 30 * F;
    ctx.globalAlpha = ap;
    panel(ctx, c.x - cw / 2, cy, cw, ch, { r: 16 * F, bd: c.hot ? 'rgba(255,170,120,0.65)' : 'rgba(70,255,140,0.35)' });
    if (c.hot) {
      const pul = 0.5 + 0.5 * Math.sin(e.t * 4);
      ctx.strokeStyle = `rgba(255,170,120,${0.15 + 0.25 * pul})`;
      ctx.lineWidth = 6 * F;
      rr(ctx, c.x - cw / 2 - 4 * F, cy - 4 * F, cw + 8 * F, ch + 8 * F, 18 * F);
      ctx.stroke();
    }
    drawText(ctx, st, c.year, c.x, cy + 56 * F, { size: 44 * F, align: 'center', color: c.hot ? '#FFD9A8' : '#EFFFF5' });
    drawText(ctx, st, c.title, c.x, cy + 92 * F, { size: 16 * F, align: 'center', color: C.soft });
    drawWrapped(ctx, st, c.sub, c.x, cy + 124 * F, { size: 14 * F, color: C.dim, maxW: cw * 0.82 });
    if (c.bar != null) {
      const byy = cy + ch - 64 * F, bw2 = cw * 0.76;
      drawText(ctx, st, 'waktu crack', c.x, byy - 8 * F, { size: 12 * F, align: 'center', color: '#6FCF97' });
      ctx.fillStyle = 'rgba(120,255,170,0.12)';
      ctx.fillRect(c.x - bw2 / 2, byy, bw2, 12 * F);
      const bp = seg(lt, c.at + 0.8, c.at + 2.2);
      ctx.fillStyle = c.hot ? '#FFB073' : C.main;
      ctx.fillRect(c.x - bw2 / 2, byy, bw2 * c.bar * bp, 12 * F);
      drawText(ctx, st, c.label, c.x, byy + 34 * F, { size: 16 * F, align: 'center', color: '#EFFFF5' });
    } else {
      const byy = cy + ch - 70 * F;
      ctx.strokeStyle = C.main;
      ctx.lineWidth = 4 * F;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - 16 * F, byy);
      ctx.lineTo(c.x - 4 * F, byy + 12 * F);
      ctx.lineTo(c.x + 18 * F, byy - 12 * F);
      ctx.stroke();
    }
    if (c.hot) chip(ctx, st, c.x, cy + ch + 26 * F, 'REKOR', { size: 13 * F, tone: 'warn', alpha: ap });
    ctx.globalAlpha = 1;
  }
}

// ----------------------------- scene 9: transisi 3DES/AES (175-200) -----------------------------
function sceneTransisi(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'TRANSISI STANDAR', W / 2, H * 0.12, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });
  chip(ctx, st, W / 2, H * 0.185, 'NIST - National Institute of Standards and Technology', { size: 13 * F, alpha: seg(lt, 0.6, 1.2) });
  const ny = H * 0.46;
  const nodes = [
    { at: 1, x: W * 0.2, label: 'DES', sub: 'ditarik 2005', dim: true },
    { at: 4, x: W * 0.5, label: '3DES', sub: 'pengganti sementara' },
    { at: 7, x: W * 0.8, label: 'AES', sub: 'standar baru', bright: true },
  ];
  for (let i = 0; i < 2; i++) {
    const a = seg(lt, 2.5 + i * 3, 3.5 + i * 3);
    if (a <= 0) continue;
    const x0 = nodes[i].x + 70 * F, x1 = nodes[i + 1].x - 70 * F;
    ctx.strokeStyle = 'rgba(120,255,170,0.6)';
    ctx.lineWidth = 3 * F;
    ctx.beginPath();
    ctx.moveTo(x0, ny);
    ctx.lineTo(lerp(x0, x1, a), ny);
    ctx.stroke();
    if (a >= 1) arrowHead(ctx, x1, ny, 0, 8 * F);
    const mx = lerp(x0, x1, (e.t * 0.6) % 1);
    ctx.fillStyle = 'rgba(200,255,220,0.9)';
    ctx.beginPath(); ctx.arc(mx, ny, 4 * F, 0, Math.PI * 2); ctx.fill();
  }
  for (const nd of nodes) {
    const ap = easeOutBack(seg(lt, nd.at, nd.at + 0.7));
    if (ap <= 0) continue;
    ctx.save();
    ctx.translate(nd.x, ny);
    ctx.scale(ap, ap);
    ctx.beginPath();
    ctx.arc(0, 0, 56 * F, 0, Math.PI * 2);
    ctx.fillStyle = nd.dim ? 'rgba(8,30,17,0.9)' : nd.bright ? 'rgba(16,90,45,0.95)' : 'rgba(10,55,28,0.95)';
    ctx.fill();
    ctx.strokeStyle = nd.dim ? 'rgba(120,255,170,0.3)' : nd.bright ? 'rgba(190,255,215,0.95)' : 'rgba(120,255,170,0.6)';
    ctx.lineWidth = 2.5 * F;
    ctx.stroke();
    drawText(ctx, st, nd.label, 0, 10 * F, { size: 26 * F, align: 'center', color: nd.dim ? '#7FD9A6' : '#EFFFF5' });
    ctx.restore();
    drawText(ctx, st, nd.sub, nd.x, ny + 86 * F, { size: 14 * F, align: 'center', color: C.dim, alpha: ap });
    if (nd.dim) {
      const sp2 = seg(lt, 8, 9.2);
      if (sp2 > 0) {
        ctx.strokeStyle = 'rgba(255,107,94,0.85)';
        ctx.lineWidth = 4 * F;
        ctx.beginPath();
        ctx.moveTo(nd.x - 50 * F, ny);
        ctx.lineTo(lerp(nd.x - 50 * F, nd.x + 50 * F, sp2), ny);
        ctx.stroke();
      }
    }
    if (nd.bright) {
      const pul = 0.5 + 0.5 * Math.sin(e.t * 3);
      ctx.strokeStyle = `rgba(190,255,215,${0.12 + 0.2 * pul})`;
      ctx.lineWidth = 8 * F;
      ctx.beginPath();
      ctx.arc(nd.x, ny, 66 * F, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const sp = easeOutBack(seg(lt, 10.5, 11.3));
  if (sp > 0) {
    ctx.save();
    ctx.translate(W / 2, H * 0.72);
    ctx.scale(sp, sp);
    drawText(ctx, st, '2005', 0, 0, { size: 64 * F, align: 'center', color: C.warn });
    drawText(ctx, st, 'NIST resmi menarik DES dari standar', 0, 36 * F, { size: 17 * F, align: 'center', color: '#DFFFE9' });
    ctx.restore();
  }
}

// ----------------------------- scene 10: legacy (200-225) -----------------------------
function sceneLegacy(e) {
  const { ctx, W, H, F, lt, st } = e;
  heading(ctx, st, 'LEGACY DES', W / 2, H * 0.1, { size: 34 * F, alpha: seg(lt, 0.2, 0.8) });
  drawAzriel(ctx, W * 0.18, H * 0.9, 270 * F, e.t, { talk: seg(lt, 0.5, 999), blinkSeed: 1.7 });
  chip(ctx, st, W * 0.18, H * 0.3, 'AZRIEL', { size: 15 * F });

  const gx = W * 0.6, gy = H * 0.44;
  const sats = [
    { at: 2, a: -0.9, label: 'FEISTEL NETWORK' },
    { at: 4.5, a: 0, label: 'DESAIN S-BOX' },
    { at: 7, a: 0.9, label: 'BLOCK CIPHER MODERN' },
  ];
  for (const s of sats) {
    const lp = seg(lt, s.at, s.at + 1.2);
    if (lp <= 0) continue;
    const r = 210 * F;
    const sx = gx + Math.cos(s.a) * r;
    const sy = gy + Math.sin(s.a) * r * 0.85;
    ctx.strokeStyle = 'rgba(120,255,170,0.5)';
    ctx.lineWidth = 2 * F;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(lerp(gx, sx, lp), lerp(gy, sy, lp));
    ctx.stroke();
    if (lp >= 1) {
      const np = easeOutBack(seg(lt, s.at + 1.2, s.at + 1.8));
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(np, np);
      const tw = estWidth(s.label, 15 * F) + 30 * F;
      panel(ctx, -tw / 2, -18 * F, tw, 36 * F, { r: 18 * F });
      drawText(ctx, st, s.label, 0, 6 * F, { size: 15 * F, align: 'center', color: '#DFFFE9' });
      ctx.restore();
    }
  }
  const cp = easeOutBack(seg(lt, 0.6, 1.3));
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(cp, cp);
  ctx.beginPath();
  ctx.arc(0, 0, 58 * F, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16,90,45,0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,255,215,0.9)';
  ctx.lineWidth = 2.5 * F;
  ctx.stroke();
  drawText(ctx, st, 'DES', 0, 10 * F, { size: 28 * F, align: 'center', color: '#EFFFF5' });
  ctx.restore();
  const msg = typed('DES bukan cuma sejarah - ini batu loncatan kriptografi modern.', lt, 12, 32);
  if (msg) drawText(ctx, st, msg, W * 0.6, H * 0.8, { size: 18 * F, align: 'center', color: C.soft });
}

// ----------------------------- scene 11: outro (225-240) -----------------------------
function sceneOutro(e) {
  const { ctx, W, H, F, lt, st } = e;
  for (let i = 0; i < 16; i++) {
    const px = hash(i) * W;
    const sp = (20 + hash(i + 9) * 40) * F;
    const py = H - ((e.t * sp + hash(i + 4) * H) % (H * 0.95));
    ctx.fillStyle = `rgba(120,255,170,${0.1 + 0.25 * hash(i + 2)})`;
    ctx.fillRect(px, py, 4 * F, 4 * F);
  }
  const ap = seg(lt, 0.3, 1);
  drawText(ctx, st, 'Follow', W * 0.3, H * 0.3, { size: 30 * F, align: 'center', color: C.dim, alpha: ap });
  setText(ctx, st, 60 * F);
  const handle = '@random.ai.id';
  const gd = ctx.createLinearGradient(0, H * 0.33, 0, H * 0.42);
  gd.addColorStop(0, '#DFFFE9');
  gd.addColorStop(1, '#2BE878');
  ctx.globalAlpha = ap;
  ctx.fillStyle = gd;
  ctx.fillText(handle, W * 0.3 - estWidth(handle, 60 * F) / 2, H * 0.4);
  ctx.globalAlpha = 1;
  chip(ctx, st, W * 0.22, H * 0.48, 'AI Gabut', { size: 16 * F, alpha: seg(lt, 1, 1.6) });
  chip(ctx, st, W * 0.38, H * 0.48, 'Part 2 - DES', { size: 16 * F, alpha: seg(lt, 1.3, 1.9) });

  const bp = seg(lt, 2, 2.7);
  if (bp > 0) {
    const bw = 220 * F, bh = 62 * F;
    const bx = W * 0.3 - bw / 2, by = H * 0.56;
    const pul = 1 + 0.04 * Math.sin(e.t * 3.4);
    ctx.save();
    ctx.translate(W * 0.3, by + bh / 2);
    ctx.scale(bp * pul, bp * pul);
    ctx.translate(-bw / 2, -bh / 2);
    rr(ctx, 0, 0, bw, bh, bh / 2);
    ctx.fillStyle = '#12B85C';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,235,0.9)';
    ctx.lineWidth = 2.5 * F;
    ctx.stroke();
    drawText(ctx, st, 'FOLLOW', bw / 2, bh / 2 + 9 * F, { size: 24 * F, align: 'center', color: '#04180B' });
    ctx.restore();
    ctx.strokeStyle = `rgba(120,255,170,${0.25 + 0.2 * Math.sin(e.t * 3.4)})`;
    ctx.lineWidth = 3 * F;
    rr(ctx, bx - 10 * F, by - 10 * F, bw + 20 * F, bh + 20 * F, (bh + 20 * F) / 2);
    ctx.stroke();
  }
  drawAzriel(ctx, W * 0.74, H * 0.92, 330 * F, e.t, {
    thumb: seg(lt, 1, 1.8),
    point: seg(lt, 2.4, 3.2),
    talk: lt < 13 ? 1 : 0,
    blinkSeed: 2.6,
  });
}

// ----------------------------- timeline utama -----------------------------
const SCENES = [
  { start: 0, end: 3, rain: 1.2, draw: sceneTitle },
  { start: 3, end: 20, rain: 0.8, draw: sceneIntro },
  { start: 20, end: 45, rain: 0.7, draw: sceneIBM },
  { start: 45, end: 65, rain: 0.7, draw: sceneFIPS },
  { start: 65, end: 95, rain: 0.6, draw: sceneSpec },
  { start: 95, end: 125, rain: 0.6, draw: sceneFeistel },
  { start: 125, end: 150, rain: 0.8, draw: sceneBrute },
  { start: 150, end: 175, rain: 0.7, draw: sceneCracks },
  { start: 175, end: 200, rain: 0.7, draw: sceneTransisi },
  { start: 200, end: 225, rain: 0.7, draw: sceneLegacy },
  { start: 225, end: 240, rain: 1.0, draw: sceneOutro },
];

// ----------------------------- lifecycle -----------------------------
export async function setup(params = {}) {
  const st = { main: 'sans-serif', mono: null, emoji: null, fonts: [] };
  try {
    const dir = path.join(params.contentDirectory || '.', 'fonts');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => /\.(ttf|otf)$/i.test(f));
      for (const f of files) {
        const family = 'F_' + f.replace(/\.(ttf|otf)$/i, '');
        try {
          const font = PImage.registerFont(path.join(dir, f), family);
          await font.load();
          st.fonts.push({ file: f, family });
          const low = f.toLowerCase();
          if (low.includes('mono') && !st.mono) st.mono = family;
          else if (low.includes('emoji') && !st.emoji) st.emoji = family;
          else if (st.main === 'sans-serif') st.main = family;
        } catch (err) {
          // font gagal dimuat, lewati
        }
      }
    }
  } catch (err) {
    // folder fonts opsional
  }
  return st;
}

export function render(params) {
  const { ctx, width: W, height: H, mode, time, duration, progress } = params;
  const st = params.state || {};
  const D = duration || DURATION;
  let t = mode === 'photo' ? D * (progress == null ? 1 : progress) : time || 0;
  t = clamp(t, 0, D - 0.001);
  const F = Math.min(W / 1920, H / 1080);

  let low = 0, high = SCENES.length - 1, sceneIndex = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (t >= SCENES[mid].start) { sceneIndex = mid; low = mid + 1; }
    else high = mid - 1;
  }
  const sc = SCENES[sceneIndex];
  const lt = t - sc.start;
  const env = { ctx, W, H, F, t, lt, st };

  drawBackground(ctx, W, H, F, t, sc.rain || 1);
  sc.draw(env);
  drawHUD(env);
  drawCaptions(env);
  drawOverlays(env, sc);
}

export function dispose() {}
