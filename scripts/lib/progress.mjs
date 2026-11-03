import { performance } from 'node:perf_hooks';

const LOG_LEVELS = new Set(['quiet', 'normal', 'verbose']);

function readInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER, name }) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} harus berupa bilangan bulat antara ${min} dan ${max}.`);
  }
  return parsed;
}

export function readLoggingOptions(env = process.env) {
  const level = String(env.LOG_LEVEL ?? 'normal').toLowerCase();
  const percentStep = Number(env.PROGRESS_PERCENT_STEP ?? 5);
  if (!Number.isFinite(percentStep) || percentStep <= 0 || percentStep > 100) {
    throw new Error('PROGRESS_PERCENT_STEP harus berupa angka lebih besar dari 0 hingga 100.');
  }
  if (!LOG_LEVELS.has(level)) {
    throw new Error('LOG_LEVEL harus bernilai quiet, normal, atau verbose.');
  }
  return Object.freeze({
    level,
    intervalMs: readInteger(env.PROGRESS_INTERVAL_MS, 5000, { min: 100, max: 3_600_000, name: 'PROGRESS_INTERVAL_MS' }),
    percentStep,
    minIntervalMs: readInteger(env.PROGRESS_MIN_INTERVAL_MS, 1000, { min: 0, max: 3_600_000, name: 'PROGRESS_MIN_INTERVAL_MS' }),
    maxUpdates: readInteger(env.PROGRESS_MAX_UPDATES, 100, { min: 1, max: 10_000, name: 'PROGRESS_MAX_UPDATES' }),
    barWidth: readInteger(env.PROGRESS_BAR_WIDTH, 32, { min: 10, max: 80, name: 'PROGRESS_BAR_WIDTH' }),
  });
}

export function formatProgressBar(percent, width = 32) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((safePercent / 100) * width);
  return `[${'='.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

export class ProgressReporter {
  constructor({
    env = process.env,
    stream = process.stdout,
    errorStream = process.stderr,
    isInteractive,
    clock = () => performance.now(),
  } = {}) {
    this.options = readLoggingOptions(env);
    this.stream = stream;
    this.errorStream = errorStream;
    this.clock = clock;
    this.isInteractive = isInteractive ?? (stream?.isTTY === true && env.GITHUB_ACTIONS !== 'true');
    this.progressUpdates = 0;
    this.progressLineOpen = false;
    this.sceneLabel = '';
    this.lastUpdateAt = 0;
    this.lastPercent = 0;
    this.totalFrames = 0;
  }

  get level() { return this.options.level; }
  get isVerbose() { return this.options.level === 'verbose'; }

  info(message) {
    if (this.options.level === 'quiet') return;
    this.writeLine(`[renderer] ${message}`);
  }

  warn(message) {
    if (this.options.level === 'quiet') return;
    this.writeLine(`[renderer:warning] ${message}`);
  }

  verbose(message) {
    if (!this.isVerbose) return;
    this.writeLine(`[renderer:verbose] ${message}`);
  }

  summary(message) {
    this.writeLine(message);
  }

  error(error, { stage = 'rendering' } = {}) {
    this.closeProgressLine();
    const detail = error?.stack ?? error?.message ?? String(error);
    this.writeLine(`[renderer:error] Tahap gagal: ${stage}\n${detail}`, true);
  }

  start(message) {
    this.info(message);
  }

  beginScene({ label, totalFrames }) {
    this.sceneLabel = String(label ?? 'scene').replace(/[\r\n]/g, ' ');
    this.lastUpdateAt = this.clock();
    this.lastPercent = 0;
    this.totalFrames = totalFrames;
    this.writeProgress(0, 0, totalFrames, 'Rendering', true);
  }

  /** Called after each successfully completed frame write. Formatting/output happens only when due. */
  onFrame(completedFrames, totalFrames) {
    if (!Number.isInteger(completedFrames) || !Number.isInteger(totalFrames) || totalFrames <= 0) return false;
    const now = this.clock();
    const rawPercent = Math.min(100, (completedFrames / totalFrames) * 100);
    const timeDue = now - this.lastUpdateAt >= this.options.intervalMs;
    const percentDue = rawPercent - this.lastPercent >= this.options.percentStep;
    const minimumIntervalPassed = now - this.lastUpdateAt >= this.options.minIntervalMs;
    const reachedEnd = completedFrames >= totalFrames;
    // 100% is reserved until FFmpeg successfully exits and the MP4 is published.
    if (reachedEnd || (!(timeDue || percentDue) || !minimumIntervalPassed)) return false;
    if (this.progressUpdates >= this.options.maxUpdates) return false;

    this.writeProgress(Math.min(99, rawPercent), completedFrames, totalFrames, 'Rendering', false);
    this.lastUpdateAt = now;
    this.lastPercent = rawPercent;
    return true;
  }

  finalizing() {
    this.writeProgress(99, this.totalFrames, this.totalFrames, 'Finalizing', true);
  }

  completeScene() {
    this.writeProgress(100, this.totalFrames, this.totalFrames, 'Rendering', true);
    this.closeProgressLine();
  }

  closeProgressLine() {
    if (this.isInteractive && this.progressLineOpen) {
      this.stream.write('\n');
      this.progressLineOpen = false;
    }
  }

  writeLine(message, stderr = false) {
    this.closeProgressLine();
    const target = stderr ? (this.errorStream ?? process.stderr) : this.stream;
    target.write(`${message}\n`);
  }

  writeProgress(percent, completed, total, stage, force) {
    if (!force && this.progressUpdates >= this.options.maxUpdates) return false;
    const rounded = Math.round(percent);
    const line = `[${stage}] ${formatProgressBar(rounded, this.options.barWidth)} ${String(rounded).padStart(3, ' ')}% | ${completed}/${total} frames | ${this.sceneLabel}`;
    if (this.isInteractive) {
      this.stream.write(`\r${line}`);
      this.progressLineOpen = true;
    } else {
      this.stream.write(`${line}\n`);
    }
    this.progressUpdates += 1;
    return true;
  }
}

export function createRendererLogger(options = {}) {
  return new ProgressReporter(options);
}
